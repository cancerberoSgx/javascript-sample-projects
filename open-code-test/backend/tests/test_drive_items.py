import pytest
from sqlalchemy import text

from app.database import engine
from tests.conftest import IntegrationApi

pytestmark = pytest.mark.integration


def test_text_items_crud_move_and_cascade(api: IntegrationApi) -> None:
    organization = api.create_organization("items")
    other_organization = api.create_organization("items-other")
    member, member_token = api.create_member(organization["id"])
    drive = api.create_drive(organization["id"])

    folder = api.create_folder(organization["id"], drive["id"], name="Folder")
    nested = api.create_folder(
        organization["id"], drive["id"], name="Nested", parent_id=folder["id"]
    )
    file = api.create_file(
        organization["id"],
        drive["id"],
        name="notes.txt",
        parent_id=folder["id"],
        content="hello",
    )
    assert file["file_type"] == "text/plain"
    assert file["size_bytes"] == 5

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert {folder["id"], nested["id"], file["id"]} <= {
        item["id"] for item in response.json()
    }

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/files",
        json={
            "name": "notes.txt",
            "parent_id": folder["id"],
            "content": "duplicate",
        },
        headers=api.headers(member_token),
    )
    assert response.status_code == 409

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{file['id']}",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    detail = response.json()
    assert detail["content"] == "hello"
    assert detail["size_bytes"] == 5

    response = api.client.put(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{file['id']}/content",
        json={"content": "hello world"},
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.json()["content"] == "hello world"
    assert response.json()["size_bytes"] == len("hello world")

    response = api.client.patch(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{file['id']}",
        json={"name": "renamed.txt"},
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.json()["name"] == "renamed.txt"

    response = api.client.patch(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{file['id']}",
        json={"parent_id": nested["id"]},
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.json()["parent_id"] == nested["id"]

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/files",
        json={
            "name": "renamed.txt",
            "parent_id": folder["id"],
            "content": "same name, different folder",
        },
        headers=api.headers(member_token),
    )
    assert response.status_code == 201

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/folders",
        json={"name": "Not allowed", "parent_id": file["id"]},
        headers=api.headers(member_token),
    )
    assert response.status_code == 400

    other_drive = api.create_drive(organization["id"], name="Second Drive")
    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{other_drive['id']}/folders",
        json={"name": "Cross drive", "parent_id": folder["id"]},
        headers=api.headers(member_token),
    )
    assert response.status_code == 404

    response = api.client.patch(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{folder['id']}",
        json={"parent_id": nested["id"]},
        headers=api.headers(member_token),
    )
    assert response.status_code == 409

    response = api.client.put(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{folder['id']}/content",
        json={"content": "folders are not files"},
        headers=api.headers(member_token),
    )
    assert response.status_code == 400
    assert (
        api.client.get(
            f"/api/organizations/{organization['id']}/drives/{other_drive['id']}/items/{file['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 404
    )
    assert (
        api.client.get(
            f"/api/organizations/{other_organization['id']}/drives/{drive['id']}/items",
            headers=api.headers(member_token),
        ).status_code
        == 403
    )

    response = api.client.delete(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{folder['id']}",
        headers=api.headers(member_token),
    )
    assert response.status_code == 204
    assert (
        api.client.get(
            f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{file['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 404
    )
    assert (
        api.client.get(
            f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{nested['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 404
    )
    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.json() == []

    standalone = api.create_file(
        organization["id"],
        drive["id"],
        name="standalone.txt",
        content="standalone",
    )
    response = api.client.delete(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{standalone['id']}",
        headers=api.headers(member_token),
    )
    assert response.status_code == 204
    assert (
        api.client.get(
            f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{standalone['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 404
    )

    api.create_file(
        organization["id"],
        drive["id"],
        name="drive-cascade.txt",
        content="delete with drive",
    )
    response = api.client.delete(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}",
        headers=api.headers(member_token),
    )
    assert response.status_code == 204
    assert (
        api.client.get(
            f"/api/organizations/{organization['id']}/drives/{drive['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 404
    )
    with engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT count(*) FROM drive_items WHERE drive_id = :id"),
                {"id": drive["id"]},
            ).scalar_one()
            == 0
        )


def test_copy_items_recursively(api: IntegrationApi) -> None:
    organization = api.create_organization("copy")
    drive = api.create_drive(organization["id"])
    source = api.create_folder(organization["id"], drive["id"], name="Source")
    nested = api.create_folder(
        organization["id"], drive["id"], name="Nested", parent_id=source["id"]
    )
    child = api.create_file(
        organization["id"],
        drive["id"],
        name="child.txt",
        parent_id=source["id"],
        content="child content",
    )
    nested_file = api.create_file(
        organization["id"],
        drive["id"],
        name="nested.txt",
        parent_id=nested["id"],
        content="nested content",
    )
    top = api.create_file(
        organization["id"],
        drive["id"],
        name="top.txt",
        content="top content",
    )

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/copy",
        json={"item_ids": [source["id"]], "target_parent_id": None},
        headers=api.headers(),
    )
    assert response.status_code == 200
    copied = response.json()
    assert len(copied) == 1
    copy_folder = copied[0]
    assert copy_folder["name"] == "Source (copy)"
    assert copy_folder["parent_id"] is None

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items",
        headers=api.headers(),
    )
    items = response.json()
    copied_child = next(
        item
        for item in items
        if item["parent_id"] == copy_folder["id"] and item["name"] == "child.txt"
    )
    copied_nested = next(
        item
        for item in items
        if item["parent_id"] == copy_folder["id"] and item["name"] == "Nested"
    )
    copied_nested_child = next(
        item
        for item in items
        if item["parent_id"] == copied_nested["id"]
        and item["name"] == "nested.txt"
    )
    assert copied_child["id"] != child["id"]
    assert copied_nested["id"] != nested["id"]
    assert copied_nested_child["id"] != nested_file["id"]

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{copied_child['id']}",
        headers=api.headers(),
    )
    assert response.status_code == 200
    assert response.json()["content"] == "child content"

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/copy",
        json={"item_ids": [source["id"]], "target_parent_id": None},
        headers=api.headers(),
    )
    assert response.status_code == 200
    assert response.json()[0]["name"] == "Source (copy 2)"

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/copy",
        json={"item_ids": [top["id"]], "target_parent_id": None},
        headers=api.headers(),
    )
    assert response.status_code == 200
    top_copy = response.json()[0]
    assert top_copy["name"] == "top.txt (copy)"

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/copy",
        json={"item_ids": [top["id"], top["id"]], "target_parent_id": None},
        headers=api.headers(),
    )
    assert response.status_code == 200
    assert [item["name"] for item in response.json()] == ["top.txt (copy 2)"]

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/copy",
        json={"item_ids": [top["id"], top["id"]], "target_parent_id": None},
        headers=api.headers(),
    )
    assert response.status_code == 200
    assert [item["name"] for item in response.json()] == ["top.txt (copy 3)"]

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/copy",
        json={"item_ids": [top["id"]], "target_parent_id": source["id"]},
        headers=api.headers(),
    )
    assert response.status_code == 200
    assert response.json()[0]["parent_id"] == source["id"]
    assert response.json()[0]["name"] == "top.txt"

    response = api.client.put(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{top['id']}/content",
        json={"content": "changed original"},
        headers=api.headers(),
    )
    assert response.status_code == 200
    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/{top_copy['id']}",
        headers=api.headers(),
    )
    assert response.json()["content"] == "top content"

    assert (
        api.client.post(
            f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/copy",
            json={"item_ids": [source["id"]], "target_parent_id": source["id"]},
            headers=api.headers(),
        ).status_code
        == 409
    )
    assert (
        api.client.post(
            f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/copy",
            json={"item_ids": [source["id"]], "target_parent_id": nested["id"]},
            headers=api.headers(),
        ).status_code
        == 409
    )
    assert (
        api.client.post(
            f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/copy",
            json={"item_ids": [top["id"]], "target_parent_id": top["id"]},
            headers=api.headers(),
        ).status_code
        == 400
    )
    assert (
        api.client.post(
            f"/api/organizations/{organization['id']}/drives/{drive['id']}/items/copy",
            json={"item_ids": [999999999], "target_parent_id": None},
            headers=api.headers(),
        ).status_code
        == 404
    )
    other_drive = api.create_drive(organization["id"], name="Copy Target")
    assert (
        api.client.post(
            f"/api/organizations/{organization['id']}/drives/{other_drive['id']}/items/copy",
            json={"item_ids": [top["id"]], "target_parent_id": None},
            headers=api.headers(),
        ).status_code
        == 404
    )
