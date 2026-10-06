"""Tests run against a real Postgres: TEST_DATABASE_URL from .env (never DATABASE_URL).
Every test starts from an empty schema, with migrations applied and the root user bootstrapped."""

import json
import os
from pathlib import Path

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


PUBLIC = Path(__file__).resolve().parents[2] / "frontend" / "public"


def board_definition(board_id: str) -> dict:
    """An example board file, reduced to what the API stores (config + slots + spaces)."""
    data = json.loads((PUBLIC / "boards" / f"{board_id}.json").read_text())
    return {k: data[k] for k in ("config", "slots", "spaces")}


@pytest.fixture
def acme(client, world):
    """Ana (member of Acme) with 4 categories, a deck with one card each + a grand prize card, and a board."""
    ana = world["ana_auth"]
    cats = {}
    for name, color in [("Science", "#3b82f6"), ("History", "#d97706"), ("Art", "#db2777"), ("Pop", "#16a34a")]:
        r = client.post("/api/categories", json={"name": name, "color": color}, headers=ana)
        assert r.status_code == 201, r.text
        cats[name] = r.json()
    deck = client.post("/api/decks", json={"name": "Basics"}, headers=ana).json()
    for name, cat in cats.items():
        r = client.post(
            f"/api/decks/{deck['id']}/cards",
            json={"category_id": cat["id"], "question": f"A {name} question?", "answer": "42"},
            headers=ana,
        )
        assert r.status_code == 201, r.text
    client.post(
        f"/api/decks/{deck['id']}/cards",
        json={"category_id": cats["Science"]["id"], "question": "Final?", "options": ["yes", "no"], "answer": "yes", "difficulty": 3, "grand_prize": True},
        headers=ana,
    )
    board = client.post("/api/boards", json={"name": "Snake", "definition": board_definition("linear-basic")}, headers=ana)
    assert board.status_code == 201, board.text
    return {"auth": ana, "cats": cats, "deck": deck, "board": board.json(), "mapping": dict(zip("ABCD", [c["id"] for c in cats.values()]))}
