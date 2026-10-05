"""Tests run against a real Postgres: TEST_DATABASE_URL from .env (never DATABASE_URL).
Every test starts from an empty schema, with migrations applied and the root user bootstrapped."""

import os

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings

_settings = Settings()  # type: ignore[call-arg]
if not _settings.test_database_url or _settings.test_database_url == _settings.database_url:
    raise RuntimeError("Set TEST_DATABASE_URL to a separate database. The tests wipe it.")

os.environ.update(
    DATABASE_URL=_settings.test_database_url,
    ROOT_EMAIL="root@test.dev",
    ROOT_PASSWORD="rootpass123",
    ROOT_ORGANIZATION="Default",
    RUN_SEEDS="false",
    AUTO_MIGRATE="true",
)
get_settings.cache_clear()

from app.main import create_app  # noqa: E402  (must import after the env is set)

ROOT = {"email": "root@test.dev", "password": "rootpass123"}


def _reset_db() -> None:
    with psycopg.connect(_settings.test_database_url, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")


@pytest.fixture
def client():
    _reset_db()
    with TestClient(create_app()) as c:
        yield c


def login(client: TestClient, email: str, password: str) -> dict:
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def root(client) -> dict:
    return login(client, **ROOT)


@pytest.fixture
def world(client, root):
    """Two organizations, each with a member user. Returns ids and auth headers."""
    acme = client.post("/api/organizations", json={"name": "Acme"}, headers=root).json()
    globex = client.post("/api/organizations", json={"name": "Globex"}, headers=root).json()
    ana = client.post(
        "/api/users",
        json={"organization_id": acme["id"], "name": "Ana", "email": "ana@acme.dev", "password": "anapass123"},
        headers=root,
    ).json()
    gus = client.post(
        "/api/users",
        json={"organization_id": globex["id"], "name": "Gus", "email": "gus@globex.dev", "password": "guspass123"},
        headers=root,
    ).json()
    return {
        "acme": acme,
        "globex": globex,
        "ana": ana,
        "gus": gus,
        "ana_auth": login(client, "ana@acme.dev", "anapass123"),
    }
