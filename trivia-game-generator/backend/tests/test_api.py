from conftest import ROOT, login


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


# ---------- auth ----------


def test_login_and_me(client, root):
    me = client.get("/api/auth/me", headers=root).json()
    assert me["email"] == ROOT["email"] and me["role"] == "root" and me["organization_name"] == "Default"
    assert "password_hash" not in me


def test_login_rejects_bad_credentials(client):
    assert client.post("/api/auth/login", json={"email": ROOT["email"], "password": "wrong-pass"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "nobody@x.dev", "password": "whatever1"}).status_code == 401


def test_requests_need_a_valid_token(client, root):
    assert client.get("/api/auth/me").status_code == 401
    token = root["Authorization"]
    tampered = {"Authorization": token[:-3] + ("AAA" if not token.endswith("AAA") else "BBB")}
    assert client.get("/api/auth/me", headers=tampered).status_code == 401


def test_logout_revokes_the_token(client, root):
    assert client.post("/api/auth/logout", headers=root).status_code == 204
    r = client.get("/api/auth/me", headers=root)
    assert r.status_code == 401 and "revoked" in r.json()["detail"]
    # A fresh login still works
    assert client.get("/api/auth/me", headers=login(client, **ROOT)).status_code == 200


# ---------- organizations ----------


def test_root_organization_crud_and_masked_key(client, root):
    r = client.post("/api/organizations", json={"name": "Acme", "openai_api_key": "sk-proj-abcdefghijklmnop1234"}, headers=root)
    assert r.status_code == 201
    org = r.json()
    assert org["has_openai_api_key"] and org["openai_api_key_masked"] == "sk-…1234"
    assert "abcdefgh" not in r.text  # the full key never comes back

    assert client.post("/api/organizations", json={"name": "ACME"}, headers=root).status_code == 409

    r = client.patch(f"/api/organizations/{org['id']}", json={"name": "Acme Inc"}, headers=root)
    assert r.json()["name"] == "Acme Inc" and r.json()["has_openai_api_key"]  # key untouched
    r = client.patch(f"/api/organizations/{org['id']}", json={"openai_api_key": None}, headers=root)
    assert r.json()["has_openai_api_key"] is False

    names = [o["name"] for o in client.get("/api/organizations", headers=root).json()]
    assert names == ["Acme Inc", "Default"]
    assert client.delete(f"/api/organizations/{org['id']}", headers=root).status_code == 204
    assert client.get(f"/api/organizations/{org['id']}", headers=root).status_code == 404


def test_key_is_encrypted_at_rest(client, root):
    org = client.post("/api/organizations", json={"name": "Acme", "openai_api_key": "sk-secret-value-9999"}, headers=root).json()
    import psycopg

    from app.config import get_settings

    with psycopg.connect(get_settings().database_url) as conn:
        stored = conn.execute("SELECT openai_api_key_encrypted FROM trivia_organizations WHERE id = %s", (org["id"],)).fetchone()[0]
    assert "sk-secret" not in stored


def test_cannot_delete_organization_with_users(client, root, world):
    r = client.delete(f"/api/organizations/{world['acme']['id']}", headers=root)
    assert r.status_code == 409


def test_member_sees_only_own_organization(client, world):
    ana = world["ana_auth"]
    orgs = client.get("/api/organizations", headers=ana).json()
    assert [o["name"] for o in orgs] == ["Acme"]
    assert client.get(f"/api/organizations/{world['globex']['id']}", headers=ana).status_code == 404
    assert client.post("/api/organizations", json={"name": "Mine"}, headers=ana).status_code == 403
    assert client.patch(f"/api/organizations/{world['acme']['id']}", json={"name": "X"}, headers=ana).status_code == 403
    assert client.delete(f"/api/organizations/{world['acme']['id']}", headers=ana).status_code == 403


# ---------- users ----------


def test_member_lists_only_own_users(client, world):
    ana = world["ana_auth"]
    emails = [u["email"] for u in client.get("/api/users", headers=ana).json()]
    assert emails == ["ana@acme.dev"]
    assert client.get(f"/api/users?organization_id={world['globex']['id']}", headers=ana).status_code == 404
    assert client.get(f"/api/users/{world['gus']['id']}", headers=ana).status_code == 404


def test_member_creates_and_updates_users_in_own_org(client, world):
    ana = world["ana_auth"]
    r = client.post("/api/users", json={"name": "Bob", "email": "bob@acme.dev", "password": "bobpass123"}, headers=ana)
    assert r.status_code == 201 and r.json()["organization_id"] == world["acme"]["id"] and r.json()["role"] == "member"
    bob = r.json()

    r = client.patch(f"/api/users/{bob['id']}", json={"name": "Bobby", "password": "newpass123"}, headers=ana)
    assert r.status_code == 200 and r.json()["name"] == "Bobby"
    login(client, "bob@acme.dev", "newpass123")

    # Editing themselves is allowed too
    assert client.patch(f"/api/users/{world['ana']['id']}", json={"name": "Ana B"}, headers=ana).status_code == 200


def test_member_restrictions(client, root, world):
    ana = world["ana_auth"]
    other_org = {"organization_id": world["globex"]["id"], "name": "X", "email": "x@x.dev", "password": "xpass1234"}
    assert client.post("/api/users", json=other_org, headers=ana).status_code == 403
    as_root = {"name": "R", "email": "r@acme.dev", "password": "rpass1234", "role": "root"}
    assert client.post("/api/users", json=as_root, headers=ana).status_code == 403

    me = world["ana"]["id"]
    assert client.patch(f"/api/users/{me}", json={"role": "root"}, headers=ana).status_code == 403
    assert client.patch(f"/api/users/{me}", json={"organization_id": world["globex"]["id"]}, headers=ana).status_code == 403
    assert client.patch(f"/api/users/{world['gus']['id']}", json={"name": "X"}, headers=ana).status_code == 404
    assert client.delete(f"/api/users/{world['gus']['id']}", headers=ana).status_code == 403

    # A root user inside Acme can't be edited by an Acme member
    acme_root = client.post(
        "/api/users",
        json={**as_root, "organization_id": world["acme"]["id"]},
        headers=root,
    ).json()
    assert client.patch(f"/api/users/{acme_root['id']}", json={"password": "hijacked1"}, headers=ana).status_code == 403


def test_root_user_management(client, root, world):
    r = client.patch(f"/api/users/{world['ana']['id']}", json={"organization_id": world["globex"]["id"], "role": "root"}, headers=root)
    assert r.status_code == 200 and r.json()["organization_name"] == "Globex" and r.json()["role"] == "root"
    # The role change applies to Ana's existing token right away
    assert len(client.get("/api/organizations", headers=world["ana_auth"]).json()) == 3

    assert client.delete(f"/api/users/{world['gus']['id']}", headers=root).status_code == 204
    assert client.get(f"/api/users/{world['gus']['id']}", headers=root).status_code == 404


def test_root_safety_rules(client, root):
    me = client.get("/api/auth/me", headers=root).json()
    assert client.delete(f"/api/users/{me['id']}", headers=root).status_code == 409
    assert client.patch(f"/api/users/{me['id']}", json={"role": "member"}, headers=root).status_code == 409


def test_email_is_unique_case_insensitive(client, root, world):
    r = client.post("/api/users", json={"name": "Dup", "email": "ANA@acme.dev", "password": "duppass123"}, headers=root)
    assert r.status_code == 409


def test_validation(client, root):
    assert client.post("/api/users", json={"name": "Shorty", "email": "s@x.dev", "password": "short"}, headers=root).status_code == 422
    assert client.post("/api/users", json={"name": "Bad", "email": "not-an-email", "password": "longenough"}, headers=root).status_code == 422
    assert client.post("/api/organizations", json={"name": "   "}, headers=root).status_code == 422
