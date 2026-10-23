import pytest

from app.file_types import MAX_FILE_BYTES
from tests.conftest import IntegrationApi

pytestmark = pytest.mark.integration


def _upload(
    api: IntegrationApi,
    organization_id: int,
    drive_id: int,
    *,
    name: str,
    data: bytes,
    content_type: str,
    parent_id: int | None = None,
    token: str | None = None,
):
    form = {"parent_id": str(parent_id)} if parent_id is not None else None
    return api.client.post(
        f"/api/organizations/{organization_id}/drives/{drive_id}/files/upload",
        files={"file": (name, data, content_type)},
        data=form,
        headers=api.headers(token),
    )


def test_binary_upload_download_and_limits(api: IntegrationApi) -> None:
    organization = api.create_organization("binary")
    other_organization = api.create_organization("binary-other")
    member, member_token = api.create_member(organization["id"])
    drive = api.create_drive(organization["id"])
    folder = api.create_folder(organization["id"], drive["id"], name="Uploads")
    other_member, other_member_token = api.create_member(other_organization["id"])

    binary_data = b"\x89PNG\r\n\x1a\n" + bytes(range(256))
    response = _upload(
        api,
        organization["id"],
        drive["id"],
        name="sample.bin",
        data=binary_data,
        content_type="image/png",
        parent_id=folder["id"],
        token=member_token,
    )
    assert response.status_code == 201, response.text
    binary_file = response.json()
    assert binary_file["name"] == "sample.bin"
    assert binary_file["file_type"] == "image/png"
    assert binary_file["size_bytes"] == len(binary_data)
    assert binary_file["parent_id"] == folder["id"]

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    listed = next(item for item in response.json() if item["id"] == binary_file["id"])
    assert listed["size_bytes"] == len(binary_data)

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{binary_file['id']}",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.json()["content"] is None
    assert response.json()["size_bytes"] == len(binary_data)

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{binary_file['id']}/download",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.content == binary_data
    assert response.headers["content-type"].startswith("image/png")
    assert response.headers["content-disposition"].startswith("attachment;")
    assert "filename*=UTF-8''sample.bin" in response.headers["content-disposition"]

    response = api.client.put(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{binary_file['id']}/content",
        json={"content": "binary files cannot be edited as text"},
        headers=api.headers(member_token),
    )
    assert response.status_code == 400

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{folder['id']}/download",
        headers=api.headers(member_token),
    )
    assert response.status_code == 400

    text_data = b"uploaded text\nsecond line\n"
    response = _upload(
        api,
        organization["id"],
        drive["id"],
        name="notes.txt",
        data=text_data,
        content_type="text/plain",
        parent_id=folder["id"],
        token=member_token,
    )
    assert response.status_code == 201, response.text
    text_file = response.json()
    assert text_file["file_type"] == "text/plain"
    assert text_file["size_bytes"] == len(text_data)

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{text_file['id']}",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.json()["content"] == text_data.decode()

    response = api.client.put(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{text_file['id']}/content",
        json={"content": "updated uploaded text"},
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.json()["content"] == "updated uploaded text"
    assert response.json()["size_bytes"] == len(b"updated uploaded text")

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{text_file['id']}/download",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.content == b"updated uploaded text"
    assert response.headers["content-type"].startswith("text/plain")

    response = _upload(
        api,
        organization["id"],
        drive["id"],
        name="invalid-utf8.txt",
        data=b"\xff\xfe",
        content_type="text/plain",
        token=member_token,
    )
    assert response.status_code == 201
    assert response.json()["file_type"] == "application/octet-stream"

    response = _upload(
        api,
        organization["id"],
        drive["id"],
        name="empty.bin",
        data=b"",
        content_type="application/octet-stream",
        token=member_token,
    )
    assert response.status_code == 201
    assert response.json()["size_bytes"] == 0

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/copy",
        json={"item_ids": [binary_file["id"]], "target_parent_id": folder["id"]},
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    binary_copy = response.json()[0]
    assert binary_copy["name"] == "sample.bin (copy)"
    assert binary_copy["size_bytes"] == len(binary_data)

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{binary_copy['id']}/download",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.content == binary_data

    response = _upload(
        api,
        organization["id"],
        drive["id"],
        name="too-large.bin",
        data=b"x" * (MAX_FILE_BYTES + 1),
        content_type="application/octet-stream",
        token=member_token,
    )
    assert response.status_code == 400
    assert "10 MB" in response.json()["detail"]

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items",
        headers=api.headers(member_token),
    )
    assert "too-large.bin" not in {item["name"] for item in response.json()}

    response = _upload(
        api,
        organization["id"],
        drive["id"],
        name="missing-parent.bin",
        data=b"data",
        content_type="application/octet-stream",
        parent_id=999999999,
        token=member_token,
    )
    assert response.status_code == 404

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{binary_file['id']}/download",
        headers=api.headers(other_member_token),
    )
    assert response.status_code == 403
    assert other_member["id"] != member["id"]
