"""Saved deck generations (rules.md §2.2.2, GEN-8 … GEN-10). The LLM is the fake from test_generation."""

import pytest
from test_generation import FakeLlm, _body, _set_keys, _wait

from app import llm


@pytest.fixture
def fake(monkeypatch):
    f = FakeLlm()
    monkeypatch.setattr(llm, "complete_json", f)
    return f


def _saved(acme, name="Kids mix", **extra):
    return {
        "name": name,
        "description": "Short questions for 10-year-olds",
        "provider": "openai",
        "spec": {**_body(acme, count=12), "instructions": "For kids"},
        **extra,
    }


def test_crud(client, root, world, acme):
    auth, deck_id = acme["auth"], acme["deck"]["id"]
    url = f"/api/decks/{deck_id}/generations"
    r = client.post(url, json=_saved(acme), headers=auth)
    assert r.status_code == 201, r.text
    g = r.json()
    assert g["name"] == "Kids mix" and g["deck_name"] == "Basics" and g["provider"] == "openai" and g["creator_name"] == "Ana"
    assert g["spec"]["count"] == 12 and g["spec"]["instructions"] == "For kids"
    assert [s["weight"] for s in g["spec"]["categories"]] == [20, 80]
    assert (g["use_count"], g["last_used_at"], g["cards_accepted"]) == (0, None, 0)

    # Names are unique per deck, ignoring case
    assert client.post(url, json=_saved(acme, name="kids MIX"), headers=auth).status_code == 409
    other = client.post(url, json=_saved(acme, name="Adults"), headers=auth).json()
    assert client.patch(f"{url}/{other['id']}", json={"name": "Kids Mix"}, headers=auth).status_code == 409

    # Only what was sent changes; a null provider clears it
    r = client.patch(f"{url}/{g['id']}", json={"description": "v2", "provider": None, "spec": {**_body(acme, count=5), "instructions": "Harder"}}, headers=auth)
    assert r.status_code == 200, r.text
    assert (r.json()["name"], r.json()["description"], r.json()["provider"], r.json()["spec"]["count"]) == ("Kids mix", "v2", None, 5)
    assert client.get(f"{url}/{g['id']}", headers=auth).json()["spec"]["instructions"] == "Harder"

    assert [x["name"] for x in client.get(url, headers=auth).json()] == ["Adults", "Kids mix"]
    assert client.delete(f"{url}/{other['id']}", headers=auth).status_code == 204
    assert client.get(f"{url}/{other['id']}", headers=auth).status_code == 404
    assert [x["name"] for x in client.get(url, headers=auth).json()] == ["Kids mix"]


def test_saving_checks_the_settings(client, root, world, acme):
    auth, url = acme["auth"], f"/api/decks/{acme['deck']['id']}/generations"
    bad = _saved(acme)
    bad["spec"]["categories"] = []
    assert client.post(url, json=bad, headers=auth).status_code == 422
    bad["spec"]["categories"] = [{"category_id": acme["cats"]["Art"]["id"], "weight": 0}]
    assert client.post(url, json=bad, headers=auth).status_code == 422  # GEN-2: a share above 0
    bad["spec"] = {**_body(acme), "count": 201}
    assert client.post(url, json=bad, headers=auth).status_code == 422
    assert client.post(url, json={**_saved(acme), "name": "  "}, headers=auth).status_code == 422

    # Categories must be the deck's organization's
    gus = client.post("/api/auth/login", json={"email": "gus@globex.dev", "password": "guspass123"}).json()["access_token"]
    theirs = client.post("/api/categories", json={"name": "Theirs", "color": "#000000"}, headers={"Authorization": f"Bearer {gus}"}).json()
    foreign = _saved(acme)
    foreign["spec"]["categories"] = [{"category_id": theirs["id"], "weight": 1}]
    assert client.post(url, json=foreign, headers=auth).status_code == 404


def test_scoped_to_the_organization(client, root, world, acme):
    auth, deck_id = acme["auth"], acme["deck"]["id"]
    g = client.post(f"/api/decks/{deck_id}/generations", json=_saved(acme), headers=auth).json()
    gus = {"Authorization": "Bearer " + client.post("/api/auth/login", json={"email": "gus@globex.dev", "password": "guspass123"}).json()["access_token"]}
    assert client.get(f"/api/decks/{deck_id}/generations", headers=gus).status_code == 404
    assert client.patch(f"/api/decks/{deck_id}/generations/{g['id']}", json={"name": "x"}, headers=gus).status_code == 404
    assert client.delete(f"/api/decks/{deck_id}/generations/{g['id']}", headers=gus).status_code == 404
    assert client.get("/api/deck-generations", headers=gus).json() == []
    # Another deck's id in the path doesn't reach it
    other = client.post("/api/decks", json={"name": "Other"}, headers=auth).json()
    assert client.get(f"/api/decks/{other['id']}/generations/{g['id']}", headers=auth).status_code == 404

    # The organization list has every deck's, for loading into any deck; root picks the organization
    client.post(f"/api/decks/{other['id']}/generations", json=_saved(acme, name="Other mix"), headers=auth)
    listed = client.get("/api/deck-generations", headers=auth).json()
    assert [(x["deck_name"], x["name"]) for x in listed] == [("Basics", "Kids mix"), ("Other", "Other mix")]
    assert len(client.get(f"/api/deck-generations?organization_id={world['acme']['id']}", headers=root).json()) == 2


def test_usage_is_counted(client, root, world, acme, fake):
    """GEN-9: starting a generation from a saved one counts a use; adding its cards counts them."""
    auth, deck_id = acme["auth"], acme["deck"]["id"]
    _set_keys(client, root, world["acme"]["id"])
    other = client.post("/api/decks", json={"name": "Other"}, headers=auth).json()
    g = client.post(f"/api/decks/{other['id']}/generations", json=_saved(acme), headers=auth).json()  # another deck's: still usable

    r = client.post(f"/api/decks/{deck_id}/generation", json={**_body(acme, count=6), "deck_generation_id": g["id"]}, headers=auth)
    assert r.status_code == 201, r.text
    assert r.json()["deck_generation_id"] == g["id"]
    job = _wait(client, auth, deck_id)
    after = client.get(f"/api/decks/{other['id']}/generations/{g['id']}", headers=auth).json()
    assert after["use_count"] == 1 and after["last_used_at"] and after["cards_accepted"] == 0

    r = client.post(f"/api/decks/{deck_id}/generation/accept", json={"job_id": job["id"], "cards": [{**c, "grand_prize": False} for c in job["cards"][:4]]}, headers=auth)
    assert r.json()["added"] == 4
    assert client.get(f"/api/decks/{other['id']}/generations/{g['id']}", headers=auth).json()["cards_accepted"] == 4

    # A discarded run still counted as a use
    client.post(f"/api/decks/{deck_id}/generation", json={**_body(acme, count=3), "deck_generation_id": g["id"]}, headers=auth)
    _wait(client, auth, deck_id)
    assert client.delete(f"/api/decks/{deck_id}/generation", headers=auth).status_code == 204
    assert client.get(f"/api/decks/{other['id']}/generations/{g['id']}", headers=auth).json()["use_count"] == 2

    # Deleting the saved generation leaves the job alone
    client.post(f"/api/decks/{deck_id}/generation", json={**_body(acme, count=3), "deck_generation_id": g["id"]}, headers=auth)
    _wait(client, auth, deck_id)
    assert client.delete(f"/api/decks/{other['id']}/generations/{g['id']}", headers=auth).status_code == 204
    job = client.get(f"/api/decks/{deck_id}/generation", headers=auth).json()
    assert job["deck_generation_id"] is None
    r = client.post(f"/api/decks/{deck_id}/generation/accept", json={"job_id": job["id"], "cards": [{**c, "grand_prize": False} for c in job["cards"]]}, headers=auth)
    assert r.status_code == 200, r.text

    # Another organization's saved generation can't be used
    gus = {"Authorization": "Bearer " + client.post("/api/auth/login", json={"email": "gus@globex.dev", "password": "guspass123"}).json()["access_token"]}
    gdeck = client.post("/api/decks", json={"name": "G"}, headers=gus).json()
    gcat = client.post("/api/categories", json={"name": "G", "color": "#000000"}, headers=gus).json()
    _set_keys(client, root, world["globex"]["id"])
    mine = client.post(f"/api/decks/{deck_id}/generations", json=_saved(acme, name="Mine"), headers=auth).json()
    r = client.post(
        f"/api/decks/{gdeck['id']}/generation",
        json={"count": 2, "categories": [{"category_id": gcat["id"]}], "deck_generation_id": mine["id"]},
        headers=gus,
    )
    assert r.status_code == 404


def test_deleting_a_category_drops_its_share(client, root, world, acme):
    """GEN-10"""
    auth, url = acme["auth"], f"/api/decks/{acme['deck']['id']}/generations"
    new = client.post("/api/categories", json={"name": "Unused", "color": "#123456"}, headers=auth).json()
    spec = {**_body(acme), "categories": [{"category_id": new["id"], "weight": 30}, {"category_id": acme["cats"]["History"]["id"], "weight": 70}]}
    g = client.post(url, json={**_saved(acme), "spec": spec}, headers=auth).json()
    only = client.post(url, json={**_saved(acme, name="Only"), "spec": {**spec, "categories": [{"category_id": new["id"]}]}}, headers=auth).json()
    assert client.delete(f"/api/categories/{new['id']}", headers=auth).status_code == 204
    assert client.get(f"{url}/{g['id']}", headers=auth).json()["spec"]["categories"] == [{"category_id": acme["cats"]["History"]["id"], "weight": 70}]
    assert client.get(f"{url}/{only['id']}", headers=auth).json()["spec"]["categories"] == []  # kept, to be fixed by the user


def test_deck_files_carry_saved_generations(client, root, world, acme):
    """GEN-8 / SER-3: exported with the file's category ids, imported with the importer's categories."""
    auth, deck_id = acme["auth"], acme["deck"]["id"]
    unused = client.post("/api/categories", json={"name": "Geo Graphy", "color": "#123456", "description": "Maps"}, headers=auth).json()
    spec = {**_body(acme), "categories": [{"category_id": unused["id"], "weight": 40}, {"category_id": acme["cats"]["History"]["id"], "weight": 60}]}
    client.post(f"/api/decks/{deck_id}/generations", json={**_saved(acme), "spec": spec}, headers=auth)

    file = client.get(f"/api/decks/{deck_id}/export", headers=auth).json()
    assert file["generations"] == [
        {
            "name": "Kids mix",
            "description": "Short questions for 10-year-olds",
            "provider": "openai",
            "count": 30,
            "categories": [{"category": "geo-graphy", "weight": 40}, {"category": "history", "weight": 60}],
            "difficulty": {"easy": 50, "medium": 0, "hard": 50},
            "types": {"multiple_choice": 50, "open": 50},
            "instructions": "",
        }
    ]
    assert "geo-graphy" in [c["id"] for c in file["categories"]]  # used only by the saved generation

    # Into another organization: categories matched or created, usage starts over
    gus = {"Authorization": "Bearer " + client.post("/api/auth/login", json={"email": "gus@globex.dev", "password": "guspass123"}).json()["access_token"]}
    r = client.post("/api/decks/import", json=file, headers=gus)
    assert r.status_code == 201, r.text
    assert "Geo Graphy" in r.json()["categories_created"]
    saved = client.get(f"/api/decks/{r.json()['deck']['id']}/generations", headers=gus).json()
    their_cats = {c["name"]: c["id"] for c in client.get("/api/categories", headers=gus).json()}
    assert [s["category_id"] for s in saved[0]["spec"]["categories"]] == [their_cats["Geo Graphy"], their_cats["History"]]
    assert saved[0]["use_count"] == 0 and saved[0]["provider"] == "openai"

    # A deck without saved generations has no `generations` key (example files stay as they are)
    plain = client.post("/api/decks", json={"name": "Plain"}, headers=auth).json()
    assert "generations" not in client.get(f"/api/decks/{plain['id']}/export", headers=auth).json()

    # Problems are reported with the rest (SER-9)
    bad = {**file, "generations": [{**file["generations"][0], "categories": [{"category": "nope"}]}, {**file["generations"][0], "count": 0}]}
    r = client.post("/api/decks/import", json=bad, headers=gus)
    assert r.status_code == 422
    assert any("generations[0] 'Kids mix': category 'nope'" in p for p in r.json()["detail"]), r.json()
    assert any(p.startswith("generations[1] 'Kids mix': the name appears more than once") for p in r.json()["detail"])
    assert any(p.startswith("generations[1] 'Kids mix': count") for p in r.json()["detail"])

    # Organization backups carry them inside each deck file (SER-10)
    backup = client.get(f"/api/organizations/{world['acme']['id']}/export", headers=auth).json()
    assert {d["name"]: [g["name"] for g in d.get("generations", [])] for d in backup["decks"]} == {"Basics": ["Kids mix"], "Plain": []}


def test_library_copies_bring_saved_generations(client, root, world, acme):
    """GEN-8 / SHR-5: shown in the Library and copied with the deck, with the copier's categories."""
    auth, deck_id = acme["auth"], acme["deck"]["id"]
    unused = client.post("/api/categories", json={"name": "Only In Saved", "color": "#123456"}, headers=auth).json()
    spec = {**_body(acme), "categories": [{"category_id": unused["id"], "weight": 1}]}
    client.post(f"/api/decks/{deck_id}/generations", json={**_saved(acme), "spec": spec}, headers=auth)
    assert client.put(f"/api/decks/{deck_id}/visibility", json={"visibility": "public"}, headers=auth).status_code == 200

    gus = {"Authorization": "Bearer " + client.post("/api/auth/login", json={"email": "gus@globex.dev", "password": "guspass123"}).json()["access_token"]}
    detail = client.get(f"/api/library/decks/{deck_id}", headers=gus).json()
    assert [g["name"] for g in detail["generations"]] == ["Kids mix"]
    assert "Only In Saved" in [c["name"] for c in detail["categories"]]

    r = client.post(f"/api/library/decks/{deck_id}/copy", json={}, headers=gus)
    assert r.status_code == 201, r.text
    assert r.json()["generations_copied"] == 1 and "Only In Saved" in r.json()["categories_created"]
    copied = client.get(f"/api/decks/{r.json()['deck']['id']}/generations", headers=gus).json()
    their = {c["name"]: c["id"] for c in client.get("/api/categories", headers=gus).json()}
    assert copied[0]["spec"]["categories"] == [{"category_id": their["Only In Saved"], "weight": 1}]
    assert copied[0]["creator_name"] == "Gus" and copied[0]["use_count"] == 0
