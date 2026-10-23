import uuid

import pytest

from tests.conftest import IntegrationApi, TEST_USER_PASSWORD

pytestmark = pytest.mark.integration


def test_user_crud(api: IntegrationApi) -> None:
    organization = api.create_organization("users")
    member = api.create_user(organization["id"], label="member")

    response = api.client.get(
        f"/api/organizations/{organization['id']}/users", headers=api.headers()
    )
    assert response.status_code == 200
    assert member["id"] in {user["id"] for user in response.json()}

    response = api.client.get(
        f"/api/organizations/{organization['id']}/users/{member['id']}",
        headers=api.headers(),
    )
    assert response.status_code == 200
    assert response.json()["email"] == member["email"]
    assert response.json()["role"] == "member"

    response = api.client.post(
        f"/api/organizations/{organization['id']}/users",
        json={
            "email": member["email"],
            "password": TEST_USER_PASSWORD,
            "role": "member",
        },
        headers=api.headers(),
    )
    assert response.status_code == 409

    new_email = f"{api.prefix}-updated-{uuid.uuid4().hex[:10]}@example.com"
    new_password = "updated-password-456"
    response = api.client.patch(
        f"/api/organizations/{organization['id']}/users/{member['id']}",
        json={"email": new_email, "password": new_password},
        headers=api.headers(),
    )
    assert response.status_code == 200
    assert response.json()["email"] == new_email

    assert (
        api.client.post(
            "/api/auth/login",
            json={"email": member["email"], "password": member["password"]},
        ).status_code
        == 401
    )
    login = api.login(new_email, new_password)
    assert login["user"]["id"] == member["id"]

    response = api.client.patch(
        f"/api/organizations/{organization['id']}/users/{member['id']}",
        json={"role": "root"},
        headers=api.headers(),
    )
    assert response.status_code == 200
    assert response.json()["role"] == "root"

    response = api.client.delete(
        f"/api/organizations/{organization['id']}/users/{member['id']}",
        headers=api.headers(),
    )
    assert response.status_code == 204
    assert (
        api.client.get(
            f"/api/organizations/{organization['id']}/users/{member['id']}",
            headers=api.headers(),
        ).status_code
        == 404
    )

    assert (
        api.client.get(
            "/api/organizations/999999999/users", headers=api.headers()
        ).status_code
        == 404
    )
    assert (
        api.client.post(
            f"/api/organizations/{organization['id']}/users",
            json={"email": "bad-email", "password": "password", "role": "member"},
            headers=api.headers(),
        ).status_code
        == 422
    )
    assert (
        api.client.post(
            f"/api/organizations/{organization['id']}/users",
            json={
                "email": f"{api.prefix}-short@example.com",
                "password": "123",
                "role": "member",
            },
            headers=api.headers(),
        ).status_code
        == 422
    )


def test_user_permission_guards(api: IntegrationApi) -> None:
    organization = api.create_organization("user-perms")
    other_organization = api.create_organization("user-perms-other")
    member, member_token = api.create_member(organization["id"])
    organization_root = api.create_user(
        organization["id"], label="org-root", role="root"
    )
    other_user = api.create_user(other_organization["id"], label="other")

    assert (
        api.client.get(
            f"/api/organizations/{organization['id']}/users",
            headers=api.headers(member_token),
        ).status_code
        == 200
    )
    assert (
        api.client.get(
            f"/api/organizations/{other_organization['id']}/users",
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.get(
            f"/api/organizations/{other_organization['id']}/users/{other_user['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.post(
            f"/api/organizations/{other_organization['id']}/users",
            json={
                "email": f"{api.prefix}-cross@example.com",
                "password": TEST_USER_PASSWORD,
                "role": "member",
            },
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.post(
            f"/api/organizations/{organization['id']}/users",
            json={
                "email": f"{api.prefix}-root-by-member@example.com",
                "password": TEST_USER_PASSWORD,
                "role": "root",
            },
            headers=api.headers(member_token),
        ).status_code
        == 403
    )

    response = api.client.post(
        f"/api/organizations/{organization['id']}/users",
        json={
            "email": f"{api.prefix}-member-created@example.com",
            "password": TEST_USER_PASSWORD,
            "role": "member",
        },
        headers=api.headers(member_token),
    )
    assert response.status_code == 201
    member_created = response.json()
    assert (
        api.client.delete(
            f"/api/organizations/{organization['id']}/users/{member_created['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 204
    )

    assert (
        api.client.patch(
            f"/api/organizations/{organization['id']}/users/{organization_root['id']}",
            json={"email": f"{api.prefix}-nope@example.com"},
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.delete(
            f"/api/organizations/{organization['id']}/users/{organization_root['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.patch(
            f"/api/organizations/{organization['id']}/users/{member['id']}",
            json={"role": "root"},
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.delete(
            f"/api/organizations/{organization['id']}/users/{member['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.delete(
            f"/api/organizations/{api.root_user['organization_id']}/users/{api.root_user['id']}",
            headers=api.headers(),
        ).status_code
        == 403
    )
    assert (
        api.client.delete(
            f"/api/organizations/{organization['id']}/users/{organization_root['id']}",
            headers=api.headers(),
        ).status_code
        == 204
    )


def test_impersonation(api: IntegrationApi) -> None:
    organization = api.create_organization("impersonation")
    member, member_token = api.create_member(organization["id"])
    organization_root = api.create_user(
        organization["id"], label="root", role="root"
    )

    response = api.client.post(
        f"/api/organizations/{organization['id']}/users/{member['id']}/impersonate",
        headers=api.headers(),
    )
    assert response.status_code == 200
    impersonated = response.json()
    assert impersonated["user"]["id"] == member["id"]
    assert impersonated["user"]["role"] == "member"

    response = api.client.get(
        "/api/auth/me", headers=api.headers(impersonated["access_token"])
    )
    assert response.status_code == 200
    assert response.json()["id"] == member["id"]

    assert (
        api.client.post(
            f"/api/organizations/{organization['id']}/users/{member['id']}/impersonate",
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.post(
            f"/api/organizations/{organization['id']}/users/{organization_root['id']}/impersonate",
            headers=api.headers(),
        ).status_code
        == 403
    )
