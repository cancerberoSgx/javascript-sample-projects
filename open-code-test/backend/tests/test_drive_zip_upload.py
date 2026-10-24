import io
import zipfile

import pytest

from tests.conftest import IntegrationApi

pytestmark = pytest.mark.integration

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + bytes(range(32))


def _make_zip(entries: list[tuple[str, bytes]]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries:
            archive.writestr(name, data)
    return buffer.getvalue()


def _upload_zip(
    api: IntegrationApi,
    organization_id: int,
    drive_id: int,
    *,
    data: bytes,
    parent_id: int | None = None,
    token: str | None = None,
):
    form = {"parent_id": str(parent_id)} if parent_id is not None else None
    return api.client.post(
        f"/api/organizations/{organization_id}/drives/{drive_id}/files/upload-zip",
        files={"file": ("archive.zip", data, "application/zip")},
        data=form,
        headers=api.headers(token),
    )


def test_zip_upload_extracts_folders_and_files(api: IntegrationApi) -> None:
    organization = api.create_organization("zip")
    member, member_token = api.create_member(organization["id"])
    drive = api.create_drive(organization["id"])
    folder = api.create_folder(organization["id"], drive["id"], name="Imports")

    archive = _make_zip(
        [
            ("docs/", b""),
            ("docs/readme.txt", b"# extracted\n"),
            ("docs/photo.png", PNG_BYTES),
            ("root.bin", b"\x00\x01\x02binary"),
        ]
    )

    response = _upload_zip(
        api,
        organization["id"],
        drive["id"],
        data=archive,
        parent_id=folder["id"],
        token=member_token,
    )
    assert response.status_code == 201, response.text
    extracted = response.json()
    assert {item["name"] for item in extracted} == {"docs", "root.bin"}
    docs = next(item for item in extracted if item["name"] == "docs")
    assert docs["kind"] == "folder"
    assert docs["parent_id"] == folder["id"]

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    items = response.json()
    by_name = {item["name"]: item for item in items}

    assert by_name["readme.txt"]["kind"] == "file"
    assert by_name["readme.txt"]["parent_id"] == docs["id"]
    assert by_name["readme.txt"]["file_type"] == "text/plain"
    assert by_name["photo.png"]["file_type"] == "image/png"
    assert by_name["photo.png"]["parent_id"] == docs["id"]
    assert by_name["root.bin"]["file_type"] == "application/octet-stream"

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{by_name['readme.txt']['id']}",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.json()["content"] == "# extracted\n"

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{by_name['photo.png']['id']}/download",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.content == PNG_BYTES
    assert response.headers["content-type"].startswith("image/png")

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{by_name['photo.png']['id']}",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.json()["content"] is None


def test_zip_upload_conflicts_rollback_and_validation(api: IntegrationApi) -> None:
    organization = api.create_organization("zip-errors")
    other_organization = api.create_organization("zip-errors-other")
    member, member_token = api.create_member(organization["id"])
    other_member, other_member_token = api.create_member(
        other_organization["id"]
    )
    drive = api.create_drive(organization["id"])
    folder = api.create_folder(organization["id"], drive["id"], name="Target")

    response = _upload_zip(
        api,
        organization["id"],
        drive["id"],
        data=_make_zip([("existing/keep.txt", b"keep")]),
        parent_id=folder["id"],
        token=member_token,
    )
    assert response.status_code == 201, response.text

    response = _upload_zip(
        api,
        organization["id"],
        drive["id"],
        data=_make_zip(
            [
                ("new.bin", b"must be rolled back"),
                ("existing/keep.txt", b"clash"),
            ]
        ),
        parent_id=folder["id"],
        token=member_token,
    )
    assert response.status_code == 409

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items",
        headers=api.headers(member_token),
    )
    names = [item["name"] for item in response.json()]
    assert "new.bin" not in names
    assert names.count("keep.txt") == 1

    response = _upload_zip(
        api,
        organization["id"],
        drive["id"],
        data=b"this is not a zip archive",
        parent_id=folder["id"],
        token=member_token,
    )
    assert response.status_code == 400
    assert "valid ZIP" in response.json()["detail"]

    response = _upload_zip(
        api,
        organization["id"],
        drive["id"],
        data=_make_zip([("../escape.txt", b"nope")]),
        parent_id=folder["id"],
        token=member_token,
    )
    assert response.status_code == 400
    assert "unsafe path" in response.json()["detail"]

    response = _upload_zip(
        api,
        organization["id"],
        drive["id"],
        data=_make_zip([("/absolute.txt", b"nope")]),
        parent_id=folder["id"],
        token=member_token,
    )
    assert response.status_code == 400

    response = _upload_zip(
        api,
        organization["id"],
        drive["id"],
        data=_make_zip([("file.txt", b"data")]),
        parent_id=999999999,
        token=member_token,
    )
    assert response.status_code == 404

    response = _upload_zip(
        api,
        organization["id"],
        drive["id"],
        data=_make_zip([("file.txt", b"data")]),
        token=other_member_token,
    )
    assert response.status_code == 403
    assert other_member["id"] != member["id"]

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items",
        headers=api.headers(member_token),
    )
    names = {item["name"] for item in response.json()}
    assert "escape.txt" not in names
    assert "absolute.txt" not in names
    assert "file.txt" not in names


def test_image_upload_type_detection(api: IntegrationApi) -> None:
    organization = api.create_organization("images")
    member, member_token = api.create_member(organization["id"])
    drive = api.create_drive(organization["id"])

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/files/upload",
        files={
            "file": (
                "photo.png",
                PNG_BYTES,
                "application/octet-stream",
            )
        },
        headers=api.headers(member_token),
    )
    assert response.status_code == 201, response.text
    assert response.json()["file_type"] == "image/png"

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/files/upload",
        files={
            "file": (
                "magic-only",
                PNG_BYTES,
                "application/octet-stream",
            )
        },
        headers=api.headers(member_token),
    )
    assert response.status_code == 201, response.text
    assert response.json()["file_type"] == "image/png"

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/files/upload",
        files={
            "file": (
                "drawing.svg",
                b"<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
                "image/svg+xml",
            )
        },
        headers=api.headers(member_token),
    )
    assert response.status_code == 201, response.text
    assert response.json()["file_type"] == "image/svg+xml"
