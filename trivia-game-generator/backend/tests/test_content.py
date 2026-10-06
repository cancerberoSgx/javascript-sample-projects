"""Categories, decks + cards, boards and games (migration 0002)."""

from conftest import board_definition

from app.config import get_settings
from app.migrations import apply_pending

# ---------- categories ----------


def test_category_crud(client, acme):
    ana = acme["auth"]
    science = acme["cats"]["Science"]
    assert science["organization_id"] == client.get("/api/auth/me", headers=ana).json()["organization_id"]
    assert client.post("/api/categories", json={"name": "science", "color": "#000000"}, headers=ana).status_code == 409
    assert client.post("/api/categories", json={"name": "Bad", "color": "blue"}, headers=ana).status_code == 422

    r = client.patch(f"/api/categories/{science['id']}", json={"description": "Atoms and stars"}, headers=ana)
    assert r.json()["description"] == "Atoms and stars" and r.json()["name"] == "Science"
    assert [c["name"] for c in client.get("/api/categories", headers=ana).json()] == ["Art", "History", "Pop", "Science"]

    # In use by cards: can't delete
    r = client.delete(f"/api/categories/{science['id']}", headers=ana)
    assert r.status_code == 409 and "card" in r.json()["detail"]
    unused = client.post("/api/categories", json={"name": "Unused", "color": "#111111"}, headers=ana).json()
    assert client.delete(f"/api/categories/{unused['id']}", headers=ana).status_code == 204


def test_content_is_scoped_to_the_organization(client, root, world, acme):
    gus = client.post("/api/auth/login", json={"email": "gus@globex.dev", "password": "guspass123"}).json()["access_token"]
    gus_auth = {"Authorization": f"Bearer {gus}"}
    science = acme["cats"]["Science"]

    assert client.get("/api/categories", headers=gus_auth).json() == []
    assert client.get(f"/api/categories/{science['id']}", headers=gus_auth).status_code == 404
    assert client.get(f"/api/decks/{acme['deck']['id']}", headers=gus_auth).status_code == 404
    assert client.get(f"/api/boards/{acme['board']['id']}", headers=gus_auth).status_code == 404
    assert client.get(f"/api/categories?organization_id={world['acme']['id']}", headers=gus_auth).status_code == 404
    r = client.post("/api/categories", json={"organization_id": world["acme"]["id"], "name": "X", "color": "#000000"}, headers=gus_auth)
    assert r.status_code == 403

    # Globex can't build a game out of Acme's board
    r = client.post("/api/games", json={"name": "Steal", "board_id": acme["board"]["id"]}, headers=gus_auth)
    assert r.status_code == 404

    # Root sees every organization's content
    r = client.get(f"/api/categories?organization_id={world['acme']['id']}", headers=root)
    assert len(r.json()) == 4


# ---------- decks + cards ----------


def test_deck_and_card_rules(client, root, world, acme):
    ana, deck = acme["auth"], acme["deck"]
    detail = client.get(f"/api/decks/{deck['id']}", headers=ana).json()
    assert detail["card_count"] == 5 and [c["position"] for c in detail["cards"]] == [0, 1, 2, 3, 4]

    science = acme["cats"]["Science"]["id"]
    bad = {"category_id": science, "question": "Q?", "options": ["a", "b"], "answer": "c"}
    assert client.post(f"/api/decks/{deck['id']}/cards", json=bad, headers=ana).status_code == 422
    dup = {"category_id": science, "question": "Q?", "options": ["a", "a"], "answer": "a"}
    assert client.post(f"/api/decks/{deck['id']}/cards", json=dup, headers=ana).status_code == 422

    # Category from another organization
    other = client.post("/api/categories", json={"organization_id": world["globex"]["id"], "name": "G", "color": "#000000"}, headers=root).json()
    r = client.post(f"/api/decks/{deck['id']}/cards", json={"category_id": other["id"], "question": "Q?", "answer": "a"}, headers=ana)
    assert r.status_code == 404

    # Partial updates are validated against the merged card
    card = detail["cards"][4]  # the multiple-choice grand prize card
    r = client.patch(f"/api/decks/{deck['id']}/cards/{card['id']}", json={"answer": "maybe"}, headers=ana)
    assert r.status_code == 422
    r = client.patch(f"/api/decks/{deck['id']}/cards/{card['id']}", json={"options": None, "answer": "maybe"}, headers=ana)
    assert r.status_code == 200 and r.json()["options"] is None and r.json()["answer"] == "maybe"

    assert client.delete(f"/api/decks/{deck['id']}/cards/{card['id']}", headers=ana).status_code == 204
    assert client.get(f"/api/decks/{deck['id']}", headers=ana).json()["card_count"] == 4


# ---------- boards ----------


def test_board_validation(client, acme):
    ana = acme["auth"]
    broken = board_definition("linear-basic")
    broken["spaces"][-1].update(type="category", slot="A", next=[0])  # no finish anymore
    r = client.post("/api/boards", json={"name": "Broken", "definition": broken}, headers=ana)
    assert r.status_code == 422
    assert any("BRD-2" in e for e in r.json()["detail"]), r.json()

    unknown_slot = board_definition("linear-basic")
    unknown_slot["spaces"][1]["slot"] = "Z"
    r = client.post("/api/boards", json={"name": "Broken", "definition": unknown_slot}, headers=ana)
    assert r.status_code == 422 and "got Z" in r.json()["detail"][0]

    # Every example board from the frontend is valid on the backend too
    for name in ["loop-classic", "linear-forks", "loop-shortcut", "special-sandbox"]:
        r = client.post("/api/boards", json={"name": name, "definition": board_definition(name)}, headers=ana)
        assert r.status_code == 201, (name, r.text)


def test_board_config_stays_partial(client, acme):
    board = client.get(f"/api/boards/{acme['board']['id']}", headers=acme["auth"]).json()
    assert board["definition"]["config"] == {"track_type": "linear", "win_conditions": ["finish", "collection"]}


# ---------- games ----------


def test_game_lifecycle(client, acme):
    ana = acme["auth"]
    r = client.post("/api/games", json={"name": "Quiz night"}, headers=ana)
    assert r.status_code == 201
    game = r.json()
    assert game["status"] == "awaiting" and game["creator_name"] == "Ana"
    assert game["setup_errors"] == ["Choose a board and a deck", "Wait for at least one player to join"]
    assert client.post(f"/api/games/{game['id']}/start", headers=ana).status_code == 422

    r = client.patch(
        f"/api/games/{game['id']}",
        json={"board_id": acme["board"]["id"], "deck_id": acme["deck"]["id"], "categories": {"A": acme["mapping"]["A"]}},
        headers=ana,
    )
    client.post(f"/api/games/{game['id']}/players", json={"name": "P1"}, headers=ana)
    game = client.post(f"/api/games/{game['id']}/players", json={"name": "P2"}, headers=ana).json()
    assert [p["name"] for p in game["players"]] == ["P1", "P2"]
    assert game["setup_errors"] == ["No category chosen for slot(s): B, C, D"]

    same_twice = {"A": acme["mapping"]["A"], "B": acme["mapping"]["A"]}
    assert client.patch(f"/api/games/{game['id']}", json={"categories": same_twice}, headers=ana).status_code == 422

    game = client.patch(f"/api/games/{game['id']}", json={"categories": acme["mapping"]}, headers=ana).json()
    assert game["setup_errors"] == []

    # The board can't be deleted while an awaiting game uses it
    assert client.delete(f"/api/boards/{acme['board']['id']}", headers=ana).status_code == 409

    r = client.post(f"/api/games/{game['id']}/start", headers=ana)
    assert r.status_code == 200, r.text
    game = r.json()
    snap = game["snapshot"]
    assert game["status"] == "running" and game["started_at"]
    assert snap["board"]["schema_version"] == 2 and snap["board"]["name"] == "Snake"
    assert snap["mapping"]["A"] == str(acme["mapping"]["A"])
    assert len(snap["deck"]["cards"]) == 5 and {c["name"] for c in snap["deck"]["categories"]} == {"Science", "History", "Art", "Pop"}

    # Started: setup is frozen
    assert client.patch(f"/api/games/{game['id']}", json={"name": "Renamed"}, headers=ana).status_code == 409
    assert client.post(f"/api/games/{game['id']}/start", headers=ana).status_code == 409

    # Later edits and deletes don't touch the snapshot
    client.patch(f"/api/boards/{acme['board']['id']}", json={"name": "Snake v2"}, headers=ana)
    assert client.delete(f"/api/boards/{acme['board']['id']}", headers=ana).status_code == 204
    after = client.get(f"/api/games/{game['id']}", headers=ana).json()
    assert after["board_id"] is None and after["snapshot"]["board"]["name"] == "Snake"

    r = client.post(f"/api/games/{game['id']}/finish", headers=ana)
    assert r.json()["status"] == "finished" and r.json()["finished_at"]
    assert client.post(f"/api/games/{game['id']}/finish", headers=ana).status_code == 409
    assert client.delete(f"/api/games/{game['id']}", headers=ana).status_code == 204


def test_start_needs_cards_for_every_slot(client, acme):
    ana = acme["auth"]
    empty = client.post("/api/decks", json={"name": "Empty"}, headers=ana).json()
    game = client.post(
        "/api/games",
        json={"name": "G", "board_id": acme["board"]["id"], "deck_id": empty["id"], "categories": acme["mapping"], "players": [{"name": "P"}]},
        headers=ana,
    ).json()
    errors = game["setup_errors"]
    assert any("BRD-5" in e and "Science" in e for e in errors)
    assert any("grand prize" in e for e in errors)


def test_example_content_seed(client, root):
    applied = apply_pending(get_settings().database_url, "seed")
    assert [f.name for f in applied] == ["demo_organizations", "example_content"]

    assert len(client.get("/api/categories", headers=root).json()) == 4
    assert len(client.get("/api/boards", headers=root).json()) == 5
    decks = client.get("/api/decks", headers=root).json()
    assert decks[0]["card_count"] == 28
    [game] = client.get("/api/games", headers=root).json()
    assert game["name"] == "Friday Quiz Night" and len(game["players"]) == 3 and set(game["categories"]) == {"A", "B", "C", "D"}

    detail = client.get(f"/api/games/{game['id']}", headers=root).json()
    assert detail["setup_errors"] == []
    assert client.post(f"/api/games/{game['id']}/start", headers=root).status_code == 200
