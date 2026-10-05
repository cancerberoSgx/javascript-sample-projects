from conftest import login


def impersonate(client, auth, user_id):
    return client.post(f"/api/auth/impersonate/{user_id}", headers=auth)


def test_root_acts_exactly_as_the_member(client, root, world):
    r = impersonate(client, root, world["ana"]["id"])
    assert r.status_code == 200
    as_ana = {"Authorization": f"Bearer {r.json()['access_token']}"}

    me = client.get("/api/auth/me", headers=as_ana).json()
    assert me["email"] == "ana@acme.dev" and me["role"] == "member"
    assert me["impersonator"]["email"] == "root@test.dev"
    assert client.get("/api/auth/me", headers=root).json()["impersonator"] is None

    # Member permissions, not root ones
    assert [o["name"] for o in client.get("/api/organizations", headers=as_ana).json()] == ["Acme"]
    assert client.post("/api/organizations", json={"name": "X"}, headers=as_ana).status_code == 403
    assert client.get(f"/api/users/{world['gus']['id']}", headers=as_ana).status_code == 404
    r = client.post("/api/categories", json={"name": "Made by Ana", "color": "#123456"}, headers=as_ana)
    assert r.status_code == 201 and r.json()["organization_id"] == world["acme"]["id"]
    r = client.post("/api/games", json={"name": "G"}, headers=as_ana)
    assert r.json()["creator_name"] == "Ana"


def test_exit_revokes_only_the_impersonation_token(client, root, world):
    as_ana = {"Authorization": f"Bearer {impersonate(client, root, world['ana']['id']).json()['access_token']}"}
    assert client.post("/api/auth/logout", headers=as_ana).status_code == 204
    assert client.get("/api/auth/me", headers=as_ana).status_code == 401
    assert client.get("/api/auth/me", headers=root).status_code == 200  # root session continues


def test_who_can_be_impersonated(client, root, world):
    me = client.get("/api/auth/me", headers=root).json()
    assert impersonate(client, root, me["id"]).status_code == 403  # root users can't be impersonated
    assert impersonate(client, root, 999_999).status_code == 404
    assert impersonate(client, world["ana_auth"], world["gus"]["id"]).status_code == 403  # members can't impersonate

    as_ana = {"Authorization": f"Bearer {impersonate(client, root, world['ana']['id']).json()['access_token']}"}
    assert impersonate(client, as_ana, world["gus"]["id"]).status_code == 409  # no nesting


def test_impersonation_ends_when_the_root_user_loses_root(client, root, world):
    second_root = client.post(
        "/api/users",
        json={"organization_id": world["acme"]["id"], "name": "R2", "email": "r2@acme.dev", "password": "r2pass1234", "role": "root"},
        headers=root,
    ).json()
    r2 = login(client, "r2@acme.dev", "r2pass1234")
    as_gus = {"Authorization": f"Bearer {impersonate(client, r2, world['gus']['id']).json()['access_token']}"}
    assert client.get("/api/auth/me", headers=as_gus).status_code == 200

    client.patch(f"/api/users/{second_root['id']}", json={"role": "member"}, headers=root)
    r = client.get("/api/auth/me", headers=as_gus)
    assert r.status_code == 401 and "Impersonation" in r.json()["detail"]
