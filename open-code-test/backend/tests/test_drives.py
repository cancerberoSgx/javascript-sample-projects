import pytest

from tests.conftest import IntegrationApi

pytestmark = pytest.mark.integration


def test_drive_crud_and_permissions(api: IntegrationApi) -> None:
    organization = api.create_organization("drives")
    other_organization = api.create_organization("drives-other")
    member, member_token = api.create_member(organization["id"])

    drive = api.create_drive(
        organization["id"], name="Team Drive", token=member_token
    )
    assert drive["organization_id"] == organization["id"]

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives",
        json={"name": "team drive"},
        headers=api.headers(member_token),
    )
    assert response.status_code == 409

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [drive["id"]]

    response = api.client.get(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}",
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Team Drive"

    response = api.client.patch(
        f"/api/organizations/{organization['id']}/drives/{drive['id']}",
        json={"name": "Renamed Drive"},
        headers=api.headers(member_token),
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed Drive"

    response = api.client.post(
        f"/api/organizations/{organization['id']}/drives",
        json={"name": "   "},
        headers=api.headers(member_token),
    )
    assert response.status_code == 422

    other_drive = api.create_drive(
        other_organization["id"], name="Other Drive"
    )
    assert (
        api.client.get(
            f"/api/organizations/{other_organization['id']}/drives",
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.get(
            f"/api/organizations/{other_organization['id']}/drives/{other_drive['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.patch(
            f"/api/organizations/{other_organization['id']}/drives/{other_drive['id']}",
            json={"name": "Nope"},
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.delete(
            f"/api/organizations/{other_organization['id']}/drives/{other_drive['id']}",
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.post(
            f"/api/organizations/{other_organization['id']}/drives",
            json={"name": "Nope"},
            headers=api.headers(member_token),
        ).status_code
        == 403
    )
    assert (
        api.client.get(
            f"/api/organizations/{other_organization['id']}/drives",
            headers=api.headers(),
        ).status_code
        == 200
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

    response = api.client.delete(
        f"/api/organizations/{other_organization['id']}/drives/{other_drive['id']}",
        headers=api.headers(),
    )
    assert response.status_code == 204
