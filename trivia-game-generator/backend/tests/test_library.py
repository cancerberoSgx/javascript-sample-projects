"""The public Library (rules.md §2.8, SHR-*): publishing, browsing and copying boards, decks,
cards, categories and images between organizations (migration 0008)."""

import pytest
from conftest import board_definition, login
from test_images import board_with, png, upload


@pytest.fixture
def gus(client, world):
    return login(client, "gus@globex.dev", "guspass123")


def publish(client, auth, kind: str, item_id: int, visibility: str = "public"):
    return client.put(f"/api/{kind}/{item_id}/visibility", json={"visibility": visibility}, headers=auth)


# ---------- publishing (SHR-1, SHR-2) ----------


def test_items_are_private_until_published(client, acme, gus):
    ana = acme["auth"]
    assert acme["deck"]["visibility"] == "private" and acme["deck"]["published_at"] is None and acme["deck"]["copied_from"] is None
    assert client.get("/api/library/decks", headers=gus).json() == []

    r = publish(client, ana, "decks", acme["deck"]["id"])
    assert r.status_code == 200, r.text
    assert r.json()["visibility"] == "public" and r.json()["published_at"]
    published_at = r.json()["published_at"]
    # Publishing again keeps the date
    assert publish(client, ana, "decks", acme["deck"]["id"]).json()["published_at"] == published_at

    listed = client.get("/api/library/decks", headers=gus).json()
    assert [(d["name"], d["organization_name"], d["card_count"]) for d in listed] == [("Basics", "Acme", 5)]

    # Public doesn't mean editable, or visible through the ordinary endpoints (SHR-2)
    assert client.get(f"/api/decks/{acme['deck']['id']}", headers=gus).status_code == 404
    assert client.patch(f"/api/decks/{acme['deck']['id']}", json={"name": "Mine"}, headers=gus).status_code == 404
    assert publish(client, gus, "decks", acme["deck"]["id"], "private").status_code == 404

    r = publish(client, ana, "decks", acme["deck"]["id"], "private")
    assert r.json()["visibility"] == "private" and r.json()["published_at"] is None
    assert client.get("/api/library/decks", headers=gus).json() == []
    assert client.get(f"/api/library/decks/{acme['deck']['id']}", headers=gus).status_code == 404


def test_root_can_unpublish_anything(client, acme, root, gus):
    publish(client, acme["auth"], "boards", acme["board"]["id"])
    assert publish(client, root, "boards", acme["board"]["id"], "private").json()["visibility"] == "private"
    assert client.get("/api/library/boards", headers=gus).json() == []


def test_drafts_and_empty_decks_cant_be_published(client, acme):
    ana = acme["auth"]
    definition = board_definition("linear-basic")
    definition["spaces"] = [s for s in definition["spaces"] if s["type"] != "finish"]
    draft = client.post("/api/boards", json={"name": "Draft", "definition": definition}, headers=ana).json()
    assert any(i["severity"] == "error" for i in draft["issues"])
    r = publish(client, ana, "boards", draft["id"])
    assert r.status_code == 422 and "SHR-2" in r.json()["detail"][0]

    empty = client.post("/api/decks", json={"name": "Empty"}, headers=ana).json()
    assert publish(client, ana, "decks", empty["id"]).status_code == 422
    # Unpublishing always works
    assert publish(client, ana, "decks", empty["id"], "private").status_code == 200
    assert publish(client, ana, "games", 1).status_code == 422  # not a shareable kind


def test_library_search(client, acme, gus):
    ana = acme["auth"]
    for cat in acme["cats"].values():
        publish(client, ana, "categories", cat["id"])
    client.patch(f"/api/categories/{acme['cats']['Art']['id']}", json={"description": "Paintings_100%"}, headers=ana)
    names = lambda q: [c["name"] for c in client.get("/api/library/categories", params={"q": q}, headers=gus).json()]  # noqa: E731
    assert sorted(names("")) == ["Art", "History", "Pop", "Science"]
    assert names("hist") == ["History"]
    assert names("paintings_100%") == ["Art"]  # description, with LIKE wildcards taken literally
    assert names("_") == ["Art"]
    assert sorted(names("acme")) == ["Art", "History", "Pop", "Science"]  # the publisher
    assert names("globex") == []


# ---------- copying (SHR-3 … SHR-7) ----------


def test_copy_a_deck_matches_and_creates_categories(client, acme, world, gus):
    ana = acme["auth"]
    publish(client, ana, "decks", acme["deck"]["id"])
    client.patch(f"/api/categories/{acme['cats']['Science']['id']}", json={"description": "Atoms"}, headers=ana)
    # Globex already has a "science" category (another color): it's reused, not duplicated
    own = client.post("/api/categories", json={"name": "science", "color": "#000000"}, headers=gus).json()

    r = client.post(f"/api/library/decks/{acme['deck']['id']}/copy", json={}, headers=gus)
    assert r.status_code == 201, r.text
    out = r.json()
    deck = out["deck"]
    assert deck["organization_id"] == world["globex"]["id"] and deck["name"] == "Basics" and deck["card_count"] == 5
    assert deck["visibility"] == "private"
    assert deck["copied_from"] == {"id": acme["deck"]["id"], "name": "Basics", "organization_name": "Acme"}
    assert out["categories_matched"] == ["Science"] and sorted(out["categories_created"]) == ["Art", "History", "Pop"]

    cats = {c["name"]: c for c in client.get("/api/categories", headers=gus).json()}
    assert set(cats) == {"science", "Art", "History", "Pop"}
    assert cats["Art"]["copied_from"]["organization_name"] == "Acme" and cats["Art"]["color"] == acme["cats"]["Art"]["color"]
    cards = client.get(f"/api/decks/{deck['id']}", headers=gus).json()["cards"]
    assert {c["category_id"] for c in cards if c["question"].startswith("A Science")} == {own["id"]}
    assert [c["grand_prize"] for c in cards] == [False, False, False, False, True]

    # The copy is independent: the original changes, the copy doesn't
    original_cards = client.get(f"/api/decks/{acme['deck']['id']}", headers=ana).json()["cards"]
    client.delete(f"/api/decks/{acme['deck']['id']}/cards/{original_cards[0]['id']}", headers=ana)
    assert client.get(f"/api/decks/{deck['id']}", headers=gus).json()["card_count"] == 5

    # Copying again: the name is taken, so "(copy)", then "(copy 2)" (SHR-4)
    again = client.post(f"/api/library/decks/{acme['deck']['id']}/copy", json={}, headers=gus).json()["deck"]
    assert again["name"] == "Basics (copy)"
    assert client.post(f"/api/library/decks/{acme['deck']['id']}/copy", json={}, headers=gus).json()["deck"]["name"] == "Basics (copy 2)"
    r = client.post(f"/api/library/decks/{acme['deck']['id']}/copy", json={"name": "basics"}, headers=gus)
    assert r.status_code == 409
    r = client.post(f"/api/library/decks/{acme['deck']['id']}/copy", json={"name": "Trivia night"}, headers=gus)
    assert r.json()["deck"]["name"] == "Trivia night" and r.json()["categories_created"] == []


def test_copy_needs_a_public_item_and_your_own_organization(client, acme, world, gus, root):
    ana = acme["auth"]
    assert client.post(f"/api/library/decks/{acme['deck']['id']}/copy", json={}, headers=gus).status_code == 404
    publish(client, ana, "decks", acme["deck"]["id"])
    r = client.post(f"/api/library/decks/{acme['deck']['id']}/copy", json={"organization_id": world["acme"]["id"]}, headers=gus)
    assert r.status_code == 403
    # Root copies into any organization
    r = client.post(f"/api/library/decks/{acme['deck']['id']}/copy", json={"organization_id": world["globex"]["id"]}, headers=root)
    assert r.status_code == 201 and r.json()["deck"]["organization_id"] == world["globex"]["id"]
    # Copying your own public deck works too (a duplicate to change)
    r = client.post(f"/api/library/decks/{acme['deck']['id']}/copy", json={}, headers=ana)
    assert r.json()["deck"]["name"] == "Basics (copy)" and r.json()["categories_created"] == []


def test_copy_chosen_cards_into_your_deck(client, acme, gus):
    ana = acme["auth"]
    publish(client, ana, "decks", acme["deck"]["id"])
    detail = client.get(f"/api/library/decks/{acme['deck']['id']}", headers=gus).json()
    assert [c["name"] for c in detail["categories"]] == ["Art", "History", "Pop", "Science"]
    assert len(detail["cards"]) == 5 and detail["organization_name"] == "Acme"
    by_q = {c["question"]: c for c in detail["cards"]}

    history = client.post("/api/categories", json={"name": "History", "color": "#111111"}, headers=gus).json()
    mine = client.post("/api/decks", json={"name": "Mine"}, headers=gus).json()
    client.post(f"/api/decks/{mine['id']}/cards", json={"category_id": history["id"], "question": "a history question", "answer": "x"}, headers=gus)

    wanted = [by_q["A History question?"]["id"], by_q["Final?"]["id"], by_q["Final?"]["id"]]
    r = client.post(f"/api/library/decks/{acme['deck']['id']}/cards/copy", json={"deck_id": mine["id"], "card_ids": wanted}, headers=gus)
    assert r.status_code == 200, r.text
    # "A History question?" repeats Gus's card (GEN-3 rules); Final? is added once, with a new Science category
    assert r.json() == {"added": 1, "skipped_duplicates": ["A History question?"], "categories_created": ["Science"]}
    cards = client.get(f"/api/decks/{mine['id']}", headers=gus).json()["cards"]
    assert [c["question"] for c in cards] == ["a history question", "Final?"] and cards[1]["options"] == ["yes", "no"]

    # Only into your own decks, only cards of that deck
    r = client.post(f"/api/library/decks/{acme['deck']['id']}/cards/copy", json={"deck_id": acme["deck"]["id"], "card_ids": wanted}, headers=gus)
    assert r.status_code == 404
    r = client.post(f"/api/library/decks/{acme['deck']['id']}/cards/copy", json={"deck_id": mine["id"], "card_ids": [cards[0]["id"]]}, headers=gus)
    assert r.status_code == 404


def test_copy_a_board_brings_its_background_image(client, acme, world, gus):
    ana = acme["auth"]
    img = upload(client, ana, png(), name="Sunset").json()
    board = board_with(client, ana, {"image": img["key"], "fit": "tile"}).json()
    assert publish(client, ana, "boards", board["id"]).status_code == 200

    listed = client.get("/api/library/boards", headers=gus).json()
    assert [(b["name"], b["organization_name"], b["issues"] == board["issues"]) for b in listed] == [("Pretty", "Acme", True)]
    assert client.get(f"/api/library/boards/{board['id']}", headers=gus).json()["definition"]["background"]["image"] == img["key"]

    r = client.post(f"/api/library/boards/{board['id']}/copy", json={"name": "Our board"}, headers=gus)
    assert r.status_code == 201, r.text
    copy = r.json()
    assert copy["name"] == "Our board" and copy["definition"] == board["definition"] and copy["visibility"] == "private"
    assert copy["copied_from"] == {"id": board["id"], "name": "Pretty", "organization_name": "Acme"}
    library = client.get("/api/images", headers=gus).json()
    assert [(i["key"], i["name"], i["board_count"]) for i in library] == [(img["key"], "Sunset", 1)]
    assert library[0]["copied_from"]["organization_name"] == "Acme"

    # The copy can be played and edited like any board (BKG-4 holds: the image is in Globex's library)
    r = client.patch(f"/api/boards/{copy['id']}", json={"definition": copy["definition"]}, headers=gus)
    assert r.status_code == 200, r.text

    # Acme can't delete its image while its own board uses it; once that's gone, the file stays for Globex
    client.delete(f"/api/boards/{board['id']}", headers=ana)
    assert client.delete(f"/api/images/{img['id']}", headers=ana).status_code == 204
    assert client.get(img["url"]).status_code == 200


def test_copy_categories_and_images(client, acme, world, gus):
    ana = acme["auth"]
    art = acme["cats"]["Art"]
    publish(client, ana, "categories", art["id"])
    r = client.post(f"/api/library/categories/{art['id']}/copy", json={}, headers=gus)
    assert r.status_code == 201 and (r.json()["name"], r.json()["color"], r.json()["card_count"]) == ("Art", art["color"], 0)
    assert client.post(f"/api/library/categories/{art['id']}/copy", json={}, headers=gus).status_code == 409
    assert client.post(f"/api/library/categories/{art['id']}/copy", json={"name": "Fine art"}, headers=gus).status_code == 201

    img = upload(client, ana, png(), name="Stars").json()
    assert client.post(f"/api/library/images/{img['id']}/copy", json={}, headers=gus).status_code == 404
    publish(client, ana, "images", img["id"])
    listed = client.get("/api/library/images", headers=gus).json()
    assert [(i["name"], i["organization_name"], i["url"]) for i in listed] == [("Stars", "Acme", img["url"])]
    assert "creator_name" not in listed[0] and "board_count" not in listed[0]
    r = client.post(f"/api/library/images/{img['id']}/copy", json={}, headers=gus)
    assert r.status_code == 201 and r.json()["organization_id"] == world["globex"]["id"] and r.json()["key"] == img["key"]
    # Twice: the library already has it
    assert client.post(f"/api/library/images/{img['id']}/copy", json={}, headers=gus).json()["id"] == r.json()["id"]


def test_organization_with_copied_cards_can_be_deleted(client, acme, root):
    """Migration 0008 cascades cards with their category, so deleting an organization with cards works."""
    publish(client, acme["auth"], "decks", acme["deck"]["id"])
    empty = client.post("/api/organizations", json={"name": "Temp"}, headers=root).json()
    r = client.post(f"/api/library/decks/{acme['deck']['id']}/copy", json={"organization_id": empty["id"]}, headers=root)
    assert r.status_code == 201
    assert client.delete(f"/api/organizations/{empty['id']}", headers=root).status_code == 204
    # The original is untouched
    assert client.get(f"/api/decks/{acme['deck']['id']}", headers=acme["auth"]).json()["card_count"] == 5


def test_library_needs_a_login(client, acme):
    assert client.get("/api/library/boards").status_code == 401


def test_seeded_examples_are_public(client, gus):
    from app.config import get_settings
    from app.migrations import apply_pending

    apply_pending(get_settings().database_url, "seed")
    boards = client.get("/api/library/boards", headers=gus).json()
    assert len(boards) == 5 and {b["organization_name"] for b in boards} == {"Default"}
    assert all(not any(i["severity"] == "error" for i in b["issues"]) for b in boards)
    assert [d["name"] for d in client.get("/api/library/decks", headers=gus).json()] == ["General Knowledge (sample)"]
    assert len(client.get("/api/library/categories", headers=gus).json()) == 4
