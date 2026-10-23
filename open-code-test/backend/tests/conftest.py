from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.database import engine
from app.main import app

ROOT_EMAIL = os.getenv("TEST_ROOT_EMAIL", "root@example.com")
ROOT_PASSWORD = os.getenv("TEST_ROOT_PASSWORD", "admin123")
TEST_USER_PASSWORD = "integration-password-123"


@dataclass
class IntegrationApi:
    client: TestClient
    root_token: str
    root_user: dict[str, Any]
    root_email: str
    root_password: str
    prefix: str
    created_org_ids: list[int] = field(default_factory=list)

    def headers(self, token: str | None = None) -> dict[str, str]:
        return {"Authorization": f"Bearer {token or self.root_token}"}

    def login(self, email: str, password: str) -> dict[str, Any]:
        response = self.client.post(
            "/api/auth/login", json={"email": email, "password": password}
        )
        assert response.status_code == 200, response.text
        return response.json()

    def create_organization(self, label: str = "org") -> dict[str, Any]:
        name = f"{self.prefix}-{label}-{uuid.uuid4().hex[:8]}"
        response = self.client.post(
            "/api/organizations",
            json={"name": name},
            headers=self.headers(),
        )
        assert response.status_code == 201, response.text
        organization = response.json()
        self.created_org_ids.append(organization["id"])
        return organization

    def create_user(
        self,
        organization_id: int,
        *,
        label: str = "member",
        role: str = "member",
        token: str | None = None,
    ) -> dict[str, Any]:
        email = f"{self.prefix}-{label}-{uuid.uuid4().hex[:10]}@example.com"
        response = self.client.post(
            f"/api/organizations/{organization_id}/users",
            json={
                "email": email,
                "password": TEST_USER_PASSWORD,
                "role": role,
            },
            headers=self.headers(token),
        )
        assert response.status_code == 201, response.text
        return {**response.json(), "password": TEST_USER_PASSWORD}

    def create_member(
        self, organization_id: int, *, label: str = "member"
    ) -> tuple[dict[str, Any], str]:
        user = self.create_user(organization_id, label=label, role="member")
        login = self.login(user["email"], user["password"])
        return user, login["access_token"]

    def create_drive(
        self,
        organization_id: int,
        *,
        name: str = "Drive",
        token: str | None = None,
    ) -> dict[str, Any]:
        response = self.client.post(
            f"/api/organizations/{organization_id}/drives",
            json={"name": name},
            headers=self.headers(token),
        )
        assert response.status_code == 201, response.text
        return response.json()

    def create_folder(
        self,
        organization_id: int,
        drive_id: int,
        *,
        name: str,
        parent_id: int | None = None,
        token: str | None = None,
    ) -> dict[str, Any]:
        response = self.client.post(
            f"/api/organizations/{organization_id}/drives/{drive_id}/folders",
            json={"name": name, "parent_id": parent_id},
            headers=self.headers(token),
        )
        assert response.status_code == 201, response.text
        return response.json()

    def create_file(
        self,
        organization_id: int,
        drive_id: int,
        *,
        name: str,
        parent_id: int | None = None,
        content: str = "",
        token: str | None = None,
    ) -> dict[str, Any]:
        response = self.client.post(
            f"/api/organizations/{organization_id}/drives/{drive_id}/files",
            json={"name": name, "parent_id": parent_id, "content": content},
            headers=self.headers(token),
        )
        assert response.status_code == 201, response.text
        return response.json()


def _cleanup(api: IntegrationApi) -> None:
    remaining: list[int] = []
    for organization_id in dict.fromkeys(api.created_org_ids):
        response = api.client.delete(
            f"/api/organizations/{organization_id}", headers=api.headers()
        )
        if response.status_code not in (204, 403, 404):
            remaining.append(organization_id)

    if remaining:
        with engine.begin() as connection:
            for organization_id in remaining:
                connection.execute(
                    text("DELETE FROM organizations WHERE id = :id"),
                    {"id": organization_id},
                )


@pytest.fixture(scope="session")
def api() -> IntegrationApi:
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            json={"email": ROOT_EMAIL, "password": ROOT_PASSWORD},
        )
        if response.status_code != 200:
            pytest.fail(
                "Could not log in as the integration-test root user. "
                "Run the database migrations and seed, or set TEST_ROOT_EMAIL / "
                f"TEST_ROOT_PASSWORD. Response: {response.status_code} {response.text}"
            )

        login = response.json()
        context = IntegrationApi(
            client=client,
            root_token=login["access_token"],
            root_user=login["user"],
            root_email=ROOT_EMAIL,
            root_password=ROOT_PASSWORD,
            prefix=f"itest-{uuid.uuid4().hex[:8]}",
        )

        try:
            yield context
        finally:
            _cleanup(context)
