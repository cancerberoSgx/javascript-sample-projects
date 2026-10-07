"""Deck and board files: export and import (rules.md §7b, SER-7 … SER-9)."""

import json

from conftest import PUBLIC, login
from test_images import board_with, png, upload


def export(client, auth, kind: str, item_id: int):
    r = client.get(f"/api/{kind}/{item_id}/export", headers=auth)
    assert r.status_code == 200, r.text
    return r


def import_file(client, auth, kind: str, file: dict, **params):
    return client.post(f"/api/{kind}/import", json=file, params=params, headers=auth)


# ---------- decks ----------


def test_deck_export_is_a_readable_deck_file(client, acme):
    r = export(client, acme["auth"], "decks", acme["deck"]["id"])
    assert r.headers["content-disposition"] == 'attachment; filename="basics.deck.json"'
    file = r.json()
    assert list(file) == ["schema_version", "id", "name", "description", "categories", "cards"]
    assert file["schema_version"] == 2 and file["name"] == "Basics"
    # Only the categories the cards use, with readable ids
    assert [(c["id"], c["name"], c["color"]) for c in file["categories"]] == [
        ("science", "Science", "#3b82f6"),
        ("history", "History", "#d97706"),
        ("art", "Art", "#db2777"),
        ("pop", "Pop", "#16a34a"),
    ]
    assert [c["id"] for c in file["cards"]] == ["science-1", "history-1", "art-1", "pop-1", "science-2"]
    assert file["cards"][4] == {
        "id": "science-2",
        "category": "science",
        "question": "Final?",
        "options": ["yes", "no"],
        "answer": "yes",
        "difficulty": 3,
        "grand_prize": True,
    }


def test_deck_round_trip_into_another_organization(client, acme, world):
    file = export(client, acme["auth"], "decks", acme["deck"]["id"]).json()
    gus = login(client, "gus@globex.dev", "guspass123")
    # Globex already has a "science" category (any case): it is reused, the others are created
    client.post("/api/categories", json={"name": "science", "color": "#000000"}, headers=gus)

    r = import_file(client, gus, "decks", file)
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["deck"]["name"] == "Basics" and out["deck"]["card_count"] == 5
    assert out["deck"]["organization_id"] == world["globex"]["id"] and out["deck"]["visibility"] == "private"
    assert out["categories_matched"] == ["Science"] and out["categories_created"] == ["History", "Art", "Pop"]

    # Exporting the copy gives the same file (the matched category keeps Globex's name and color)
    again = export(client, gus, "decks", out["deck"]["id"]).json()
    assert again["cards"] == file["cards"]
    assert [c["name"] for c in again["categories"]] == ["science", "History", "Art", "Pop"]

    # Same name again: " (imported)", then " (imported 2)"; a chosen name must be free
    assert import_file(client, gus, "decks", file).json()["deck"]["name"] == "Basics (imported)"
    assert import_file(client, gus, "decks", file).json()["deck"]["name"] == "Basics (imported 2)"
    assert import_file(client, gus, "decks", file, name="Basics").status_code == 409
    assert import_file(client, gus, "decks", file, name="Mine").json()["deck"]["name"] == "Mine"


def test_example_deck_file_imports(client, world):
    file = json.loads((PUBLIC / "decks" / "general.json").read_text())
    r = import_file(client, world["ana_auth"], "decks", file)
    assert r.status_code == 201, r.text
    assert r.json()["deck"]["card_count"] == len(file["cards"])
    assert r.json()["categories_created"] == ["Science", "History", "Art", "Pop Culture"]


def test_unused_file_categories_are_created_too(client, world):
    file = {"schema_version": 2, "name": "Empty", "categories": [{"id": "x", "name": "Geography", "color": "#123456"}], "cards": []}
    r = import_file(client, world["ana_auth"], "decks", file)
    assert r.status_code == 201, r.text
    assert r.json()["categories_created"] == ["Geography"] and r.json()["deck"]["card_count"] == 0


def test_bad_deck_files_are_refused_with_every_problem(client, world):
    ana = world["ana_auth"]
    file = {
        "schema_version": 2,
        "name": "Broken",
        "categories": [{"id": "a", "name": "A", "color": "#111111"}, {"id": "b", "name": "a", "color": "#222222"}],
        "cards": [
            {"category": "a", "question": "Fine?", "options": None, "answer": "yes"},
            {"id": "q2", "category": "nope", "question": "Where?", "options": None, "answer": "here"},
            {"category": "a", "question": "Pick", "options": ["x", "y"], "answer": "z"},
            {"category": "a", "question": "Hard?", "options": None, "answer": "no", "difficulty": 5},
        ],
    }
    r = import_file(client, ana, "decks", file)
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail == [
        "categories: the name 'a' appears more than once",
        "cards[1] (q2) 'Where?': category 'nope' isn't one of the file's categories",
        "cards[2] 'Pick': answer must be one of the options (CRD-1)",
        "cards[3] 'Hard?': difficulty: Input should be less than or equal to 3",
    ]
    # Nothing was created
    assert client.get("/api/decks", headers=ana).json() == []
    assert client.get("/api/categories", headers=ana).json() == []

    # Shape problems and other versions are refused by the model
    r = import_file(client, ana, "decks", {**file, "schema_version": 1})
    assert r.status_code == 422 and "schema_version must be 2" in r.text
    r = import_file(client, ana, "decks", {**file, "cards": [{"category": "a", "question": "Q", "answer": "A", "anwser": "typo"}]})
    assert r.status_code == 422 and "anwser" in r.text


def test_deck_export_and_import_follow_organization_rules(client, acme, world, root):
    gus = login(client, "gus@globex.dev", "guspass123")
    assert client.get(f"/api/decks/{acme['deck']['id']}/export", headers=gus).status_code == 404
    file = export(client, root, "decks", acme["deck"]["id"]).json()
    # A member can't import into another organization; root picks any
    assert import_file(client, gus, "decks", file, organization_id=world["acme"]["id"]).status_code == 403
    r = import_file(client, root, "decks", file, organization_id=world["globex"]["id"])
    assert r.status_code == 201 and r.json()["deck"]["organization_id"] == world["globex"]["id"]


# ---------- boards ----------


def test_board_round_trip(client, acme, world):
    r = export(client, acme["auth"], "boards", acme["board"]["id"])
    assert r.headers["content-disposition"] == 'attachment; filename="snake.board.json"'
    file = r.json()
    assert list(file) == ["schema_version", "id", "name", "description", "config", "slots", "spaces"]
    example = json.loads((PUBLIC / "boards" / "linear-basic.json").read_text())
    assert {k: file[k] for k in ("config", "slots", "spaces")} == {k: example[k] for k in ("config", "slots", "spaces")}

    gus = login(client, "gus@globex.dev", "guspass123")
    r = import_file(client, gus, "boards", file)
    assert r.status_code == 201, r.text
    board = r.json()["board"]
    assert board["name"] == "Snake" and board["organization_id"] == world["globex"]["id"] and board["issues"] == []
    assert r.json()["background_image_missing"] is False
    assert export(client, gus, "boards", board["id"]).json() == file


def test_example_board_files_import(client, world):
    for path in sorted((PUBLIC / "boards").glob("*.json")):
        if path.name == "index.json":
            continue
        file = json.loads(path.read_text())
        r = import_file(client, world["ana_auth"], "boards", file)
        assert r.status_code == 201, (path.name, r.text)
        assert not [i for i in r.json()["board"]["issues"] if i["severity"] == "error"], path.name


def test_draft_boards_import_as_drafts(client, world):
    file = json.loads((PUBLIC / "boards" / "linear-basic.json").read_text())
    file["spaces"] = [s for s in file["spaces"] if s["type"] != "finish"]
    r = import_file(client, world["ana_auth"], "boards", file)
    assert r.status_code == 201, r.text
    assert any(i["severity"] == "error" for i in r.json()["board"]["issues"])
    # Shapes are still checked
    r = import_file(client, world["ana_auth"], "boards", {**file, "spaces": [{"index": 0, "type": "teleport"}]})
    assert r.status_code == 422


def test_board_background_settings_travel_but_the_image_only_if_the_library_has_it(client, world):
    ana = world["ana_auth"]
    gus = login(client, "gus@globex.dev", "guspass123")
    key = upload(client, ana, png()).json()["key"]
    board = board_with(client, ana, {"image": key, "fit": "tile", "opacity": 0.5}).json()
    file = export(client, ana, "boards", board["id"]).json()
    assert file["background"] == {"image": key, "fit": "tile", "opacity": 0.5}

    # Another organization without that image: the settings come, the image doesn't
    r = import_file(client, gus, "boards", file)
    assert r.status_code == 201, r.text
    assert r.json()["background_image_missing"] is True
    assert r.json()["board"]["definition"]["background"] == {"fit": "tile", "opacity": 0.5}

    # The same organization (its library has the image): everything comes back
    r = import_file(client, ana, "boards", file)
    assert r.json()["background_image_missing"] is False
    assert r.json()["board"]["name"] == "Pretty (imported)"
    assert r.json()["board"]["definition"]["background"] == file["background"]


# ---------- whole organizations (SER-10, SER-11) ----------


def test_organization_backup_and_restore_into_an_empty_organization(client, acme, root, world):
    ana = acme["auth"]
    client.post("/api/categories", json={"name": "Unused", "color": "#999999", "description": "Nothing yet"}, headers=ana)
    key = upload(client, ana, png()).json()["key"]
    board_with(client, ana, {"image": key, "opacity": 0.5})
    r = client.get(f"/api/organizations/{world['acme']['id']}/export", headers=ana)
    assert r.status_code == 200, r.text
    assert r.headers["content-disposition"] == 'attachment; filename="acme.organization.json"'
    file = r.json()
    assert list(file) == ["schema_version", "kind", "name", "exported_at", "categories", "decks", "boards"]
    assert file["kind"] == "organization" and file["name"] == "Acme"
    assert [c["name"] for c in file["categories"]] == ["Art", "History", "Pop", "Science", "Unused"]
    assert [d["name"] for d in file["decks"]] == ["Basics"] and len(file["decks"][0]["cards"]) == 5
    assert sorted(b["name"] for b in file["boards"]) == ["Pretty", "Snake"]
    # Each deck is a complete deck file: it imports on its own too
    assert import_file(client, ana, "decks", file["decks"][0], name="Alone").status_code == 201

    fresh = client.post("/api/organizations", json={"name": "Fresh"}, headers=root).json()
    r = client.post(f"/api/organizations/{fresh['id']}/import", json=file, headers=root)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["decks_created"] == ["Basics"]
    assert out["cards_created"] == 5 and out["decks_skipped"] == [] and out["boards_skipped"] == []
    assert sorted(out["boards_created"]) == ["Pretty", "Snake"]
    assert sorted(out["categories_created"]) == ["Art", "History", "Pop", "Science", "Unused"] and out["categories_matched"] == []
    assert out["background_images_missing"] == ["Pretty"]  # Fresh's library doesn't have the image

    # The restored organization exports the same content (the image aside)
    again = client.get(f"/api/organizations/{fresh['id']}/export", headers=root).json()
    assert again["categories"] == file["categories"] and again["decks"] == file["decks"]
    pretty = next(b for b in again["boards"] if b["name"] == "Pretty")
    assert pretty["background"] == {"opacity": 0.5}

    # Importing again adds nothing: everything is skipped by name
    out = client.post(f"/api/organizations/{fresh['id']}/import", json=file, headers=root).json()
    assert out["decks_created"] == [] and out["boards_created"] == [] and out["cards_created"] == 0
    assert out["decks_skipped"] == ["Basics"] and sorted(out["boards_skipped"]) == ["Pretty", "Snake"]
    assert out["categories_created"] == [] and len(out["categories_matched"]) == 5


def test_organization_import_is_all_or_nothing(client, acme, world):
    ana = acme["auth"]
    file = client.get(f"/api/organizations/{world['acme']['id']}/export", headers=ana).json()
    gus = login(client, "gus@globex.dev", "guspass123")
    globex = world["globex"]["id"]
    file["decks"][0]["cards"][0]["category"] = "nope"
    file["boards"].append(file["boards"][0])
    r = client.post(f"/api/organizations/{globex}/import", json=file, headers=gus)
    assert r.status_code == 422
    assert r.json()["detail"] == [
        "decks[0] 'Basics': cards[0] (science-1) 'A Science question?': category 'nope' isn't one of the file's categories",
        "boards: the name 'Snake' appears more than once",
    ]
    assert client.get("/api/categories", headers=gus).json() == []
    # A deck file isn't an organization file
    r = client.post(f"/api/organizations/{globex}/import", json=file["decks"][0], headers=gus)
    assert r.status_code == 422


def test_organization_files_follow_organization_rules(client, acme, world):
    gus = login(client, "gus@globex.dev", "guspass123")
    acme_id = world["acme"]["id"]
    assert client.get(f"/api/organizations/{acme_id}/export", headers=gus).status_code == 404
    file = client.get(f"/api/organizations/{acme_id}/export", headers=acme["auth"]).json()
    assert client.post(f"/api/organizations/{acme_id}/import", json=file, headers=gus).status_code == 404
    r = client.post(f"/api/organizations/{world['globex']['id']}/import", json=file, headers=gus)
    assert r.status_code == 200 and r.json()["decks_created"] == ["Basics"]
