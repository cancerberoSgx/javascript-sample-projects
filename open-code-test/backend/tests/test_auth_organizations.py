import pytest
from sqlalchemy import text

from app.database import engine
from tests.conftest import IntegrationApi

pytestmark = pytest.mark.integration


def test_health_auth_and_me(api: IntegrationApi) -> None:
    response = api.client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    response = api.client.post(
        "/api/auth/login",
        json={"email": api.root_email, "password": api.root_password},
    )
    assert response.status_code == 200
    login = response.json()
    assert login["token_type"] == "bearer"
    assert login["expires_in"] > 0
    assert login["user"]["role"] == "root"

    response = api.client.get(
        "/api/auth/me", headers=api.headers(login["access_token"])
    )
    assert response.status_code == 200
    assert response.json()["id"] == login["user"]["id"]

    assert api.client.get("/api/auth/me").status_code == 401
    assert (
        api.client.get(
            "/api/auth/me", headers={"Authorization": "Bearer not-a-token"}
        ).status_code
        == 401
    )
    assert (
        api.client.post(
            "/api/auth/login",
            json={"email": api.root_email, "password": "wrong-password"},
        ).status_code
        == 401
    )
    assert (
        api.client.post(
            "/api/auth/login",
            json={"email": "missing@example.com", "password": "wrong-password"},
        ).status_code
        == 401
    )
    assert (
        api.client.post(
            "/api/auth/login",
            json={"email": "not-an-email", "password": "password"},
        ).status_code
        == 422
    )


def test_organization_crud_and_member_permissions(api: IntegrationApi) -> None:
    organization = api.create_organization("org")
    other_organization = api.create_organization("other")
    member, member_token = api.create_member(organization["id"])

    response = api.client.get("/api/organizations", headers=api.headers())
    assert response.status_code == 200
    root_ids = {item["id"] for item in response.json()}
    assert {organization["id"], other_organization["id"]} <= root_ids

    response = api.client.get(
        f"/api/organizations/{organization['id']}", headers=api.headers()
    )
    assert response.status_code == 200
    assert response.json()["name"] == organization["name"]

    renamed = f"{organization['name']}-renamed"
    response = api.client.patch(
        f"/api/organizations/{organization['id']}",
        json={"name": renamed},
        headers=api.headers(),
    )
    assert response.status_code == 200
    assert response.json()["name"] == renamed

    response = api.client.post(
        "/api/organizations", json={"name": renamed}, headers=api.headers()
    )
    assert response.status_code == 409

    response = api.client.get(
        "/api/organizations", headers=api.headers(member_token)
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [organization["id"]]

    assert (
        api.client.get(
            f"/api/organizations/{organization['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 200
    )
    assert (
        api.client.get(
            f"/api/organizations/{other_organization['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.post(
            "/api/organizations",
            json={"name": f"{api.prefix}-member-created"},
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.patch(
            f"/api/organizations/{organization['id']}",
            json={"name": f"{api.prefix}-member-renamed"},
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.delete(
            f"/api/organizations/{organization['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.delete(
            f"/api/organizations/{api.root_user['organization_id']}",
            headers=api.headers(),
        ).status_code
        == 403
    )

    response = api.client.delete(
        f"/api/organizations/{other_organization['id']}", headers=api.headers()
    )
    assert response.status_code == 204
    assert (
        api.client.get(
            f"/api/organizations/{other_organization['id']}", headers=api.headers()
        ).status_code
        == 404
    )


def test_organization_validation_and_delete_cascade(api: IntegrationApi) -> None:
    for invalid_name in ("", "   ", "x" * 121):
        response = api.client.post(
            "/api/organizations", json={"name": invalid_name}, headers=api.headers()
        )
        assert response.status_code == 422

    organization = api.create_organization("cascade")
    drive = api.create_drive(organization["id"])
    folder = api.create_folder(
        organization["id"], drive["id"], name="Folder"
    )
    api.create_file(
        organization["id"],
        drive["id"],
        name="file.txt",
        parent_id=folder["id"],
        content="cascade me",
    )

    response = api.client.delete(
        f"/api/organizations/{organization['id']}", headers=api.headers()
    )
    assert response.status_code == 204

    assert (
        api.client.get(
            f"/api/organizations/{organization['id']}", headers=api.headers()
        ).status_code
        == 404
    )
    assert (
        api.client.get(
            f"/api/organizations/{organization['id']}/drives/{drive['id']}",
            headers=api.headers(),
        ).status_code
        == 404
    )

    with engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT count(*) FROM drives WHERE organization_id = :id"),
                {"id": organization["id"]},
            ).scalar_one()
            == 0
        )
        assert (
            connection.execute(
                text("SELECT count(*) FROM drive_items WHERE drive_id = :id"),
                {"id": drive["id"]},
            ).scalar_one()
            == 0
        )
