"""Saved games: /api/games/{id}/instances (migration 0003, rules.md §2.7)."""

import pytest
from conftest import login
from test_content import acme  # noqa: F401  (fixture)


def engine_state(names=("P1", "P2"), round=1, phase="AWAIT_ROLL", **extra) -> dict:
    """A minimal engine GameState (frontend/src/engine/types.ts)."""
    return {
        "config": {"track_type": "linear", "dice_sides": 6},
        "board": {"name": "Snake", "categories": [], "spaces": []},
        "cards": {"1": {"id": "1", "question": "Q?"}},
        "decks": {"1": {"draw": ["1"], "used": []}},
        "players": [
            {"id": f"p{i + 1}", "name": n, "color": "#e11d48", "current_space": i, "inventory": [], "score": i, "skip_next_turn": False}
            for i, n in enumerate(names)
        ],
        "active_player": 0,
        "round": round,
        "rolls_this_turn": 0,
        "phase": phase,
        "last_roll": None,
        "destinations": {"3": [1, 2, 3]},
        "last_move": None,
        "question": None,
        "last_answer": None,
        "result": None,
        "rng": 123456789,
        "log": [{"round": 1, "player_id": None, "text": "Game started"}],
        **extra,
    }


@pytest.fixture
def running(client, acme):  # noqa: F811
    ana = acme["auth"]
    game = client.post(
        "/api/games",
        json={"name": "Quiz night", "board_id": acme["board"]["id"], "deck_id": acme["deck"]["id"], "categories": acme["mapping"], "players": [{"name": "P1"}, {"name": "P2"}]},
        headers=ana,
    ).json()
    return {**acme, "game": game, "url": f"/api/games/{game['id']}/instances"}


def test_save_list_load_overwrite_delete(client, running):
    ana, url = running["auth"], running["url"]

    # Not started yet: nothing can be saved (SAV-4)
    assert client.post(url, json={"name": "s", "state": engine_state()}, headers=ana).status_code == 409
    assert client.post(f"/api/games/{running['game']['id']}/start", headers=ana).status_code == 200

    question = {"card": {"id": "1"}, "deadline": None, "time_left_ms": 12000, "grand_prize": False, "from_hq": False}
    state = engine_state(phase="AWAIT_ANSWER", question=question, unknown_future_field={"kept": True})
    r = client.post(url, json={"name": "Tuesday", "state": state}, headers=ana)
    assert r.status_code == 201, r.text
    saved = r.json()
    assert saved["name"] == "Tuesday" and saved["saved_by_name"] == "Ana" and saved["phase"] == "AWAIT_ANSWER"
    assert saved["state"] == state  # round-trips unchanged, extra fields included (SAV-2)

    later = client.post(url, json={"name": "Wednesday", "state": engine_state(round=3)}, headers=ana).json()
    listed = client.get(url, headers=ana).json()
    assert [i["name"] for i in listed] == ["Wednesday", "Tuesday"]  # most recent first
    assert "state" not in listed[0]
    assert listed[0]["round"] == 3 and [p["score"] for p in listed[0]["players"]] == [0, 1] and listed[0]["result"] is None

    assert client.get(f"{url}/{saved['id']}", headers=ana).json()["state"] == state

    # Overwrite with a finished state, then rename
    over = engine_state(round=4, phase="GAME_OVER", result={"type": "win", "player_id": "p2", "reason": "finish"})
    r = client.patch(f"{url}/{saved['id']}", json={"state": over}, headers=ana)
    assert r.status_code == 200 and r.json()["round"] == 4 and r.json()["result"]["player_id"] == "p2"
    assert r.json()["name"] == "Tuesday"
    r = client.patch(f"{url}/{saved['id']}", json={"name": "Final"}, headers=ana)
    assert r.json()["name"] == "Final" and r.json()["state"] == over
    assert client.patch(f"{url}/{saved['id']}", json={"name": "  "}, headers=ana).status_code == 422

    assert client.delete(f"{url}/{later['id']}", headers=ana).status_code == 204
    assert client.get(f"{url}/{later['id']}", headers=ana).status_code == 404
    assert [i["name"] for i in client.get(url, headers=ana).json()] == ["Final"]

    # Finished games keep their saves, readable but no longer writable
    client.post(f"/api/games/{running['game']['id']}/finish", headers=ana)
    assert client.get(f"{url}/{saved['id']}", headers=ana).status_code == 200
    assert client.patch(f"{url}/{saved['id']}", json={"state": over}, headers=ana).status_code == 409

    # Deleting the game deletes its saves
    assert client.delete(f"/api/games/{running['game']['id']}", headers=ana).status_code == 204
    assert client.get(f"{url}/{saved['id']}", headers=ana).status_code == 404


def test_state_is_checked(client, running):
    ana, url = running["auth"], running["url"]
    client.post(f"/api/games/{running['game']['id']}/start", headers=ana)

    r = client.post(url, json={"name": "s", "state": engine_state(names=("P2", "P1"))}, headers=ana)
    assert r.status_code == 422 and "players" in r.text  # SAV-4
    assert client.post(url, json={"name": "s", "state": engine_state(phase="DANCING")}, headers=ana).status_code == 422
    assert client.post(url, json={"name": "s", "state": {"players": []}}, headers=ana).status_code == 422
    big = engine_state(log=[{"text": "x" * 1000}] * 2500)
    assert client.post(url, json={"name": "s", "state": big}, headers=ana).status_code == 413


def test_saves_are_shared_within_the_organization_only(client, root, world, running):
    ana, url = running["auth"], running["url"]
    client.post(f"/api/games/{running['game']['id']}/start", headers=ana)
    saved = client.post(url, json={"name": "s", "state": engine_state()}, headers=ana).json()

    # Another member of Acme can load and overwrite it (SAV-1); the save records who saved last
    client.post("/api/users", json={"name": "Bea", "email": "bea@acme.dev", "password": "beapass123"}, headers=ana)
    bea = login(client, "bea@acme.dev", "beapass123")
    assert client.get(f"{url}/{saved['id']}", headers=bea).status_code == 200
    r = client.patch(f"{url}/{saved['id']}", json={"state": engine_state(round=2)}, headers=bea)
    assert r.json()["saved_by_name"] == "Bea"

    # Root sees every organization's saves
    assert client.get(url, headers=root).status_code == 200

    # Globex can't see the game or its saves: 404, not 403
    gus = login(client, "gus@globex.dev", "guspass123")
    assert client.get(url, headers=gus).status_code == 404
    assert client.get(f"{url}/{saved['id']}", headers=gus).status_code == 404
    assert client.post(url, json={"name": "s", "state": engine_state()}, headers=gus).status_code == 404
    assert client.delete(f"{url}/{saved['id']}", headers=gus).status_code == 404

    # A save is only reachable under its own game
    other = client.post("/api/games", json={"name": "Other"}, headers=ana).json()
    assert client.get(f"/api/games/{other['id']}/instances/{saved['id']}", headers=ana).status_code == 404
