"""Multiplayer games (rules.md §2.7, MPL-*): joining with the link, the lobby, the live
WebSocket view, server-side play, and host controls."""

import time

import pytest
from conftest import board_definition, login
from starlette.testclient import WebSocketTestSession


def make_game(client, acme, **config) -> dict:
    """An awaiting game, ready to start once someone joins. dice_sides=1 makes every roll a 1."""
    ana = acme["auth"]
    definition = board_definition("linear-basic")
    definition["config"].update({"dice_sides": 1, **config})
    board = client.post("/api/boards", json={"name": f"Board {time.monotonic_ns()}", "definition": definition}, headers=ana).json()
    r = client.post(
        "/api/games",
        json={"name": "Live", "board_id": board["id"], "deck_id": acme["deck"]["id"], "categories": acme["mapping"]},
        headers=ana,
    )
    assert r.status_code == 201, r.text
    return r.json()


def join(client, game: dict, name: str, code: str | None = None):
    return client.post(f"/api/games/{game['id']}/join", json={"code": code or game["join_code"], "name": name})


@pytest.fixture
def connect(client):
    """connect(game_id, **hello): an open game WebSocket that has said hello. All are closed after the test."""
    opened: list[WebSocketTestSession] = []

    def open_socket(game_id: int, **hello) -> WebSocketTestSession:
        ws = client.websocket_connect(f"/api/games/{game_id}/ws")
        ws.__enter__()
        opened.append(ws)
        ws.send_json({"type": "hello", **hello})
        return ws

    yield open_socket
    for ws in opened:
        try:
            ws.__exit__(None, None, None)
        except Exception:
            pass


def until(ws: WebSocketTestSession, check, limit: int = 20) -> dict:
    """Reads messages until one passes `check` (earlier broadcasts may still be queued)."""
    for _ in range(limit):
        msg = ws.receive_json()
        if check(msg):
            return msg
    raise AssertionError("expected message never arrived")


def error(ws: WebSocketTestSession) -> str:
    return until(ws, lambda m: m["type"] == "error")["message"]


def act(ws: WebSocketTestSession, action: dict) -> None:
    ws.send_json({"type": "action", "action": action})


def phase(name: str):
    return lambda m: m["type"] == "game" and m["state"] and m["state"]["phase"] == name


def test_join_and_lobby(client, acme):
    ana = acme["auth"]
    game = make_game(client, acme)
    gid = game["id"]
    assert game["status"] == "awaiting" and game["players"] == [] and len(game["join_code"]) == 8
    assert game["setup_errors"] == ["Wait for at least one player to join"]

    assert join(client, game, "Mia", code="WRONG123").status_code == 404
    r = join(client, game, " Mia ")
    assert r.status_code == 201, r.text
    mia = r.json()
    assert mia["player"]["name"] == "Mia" and mia["player"]["joined"] and mia["player_token"]
    assert join(client, game, "mia").status_code == 409  # MPL-3: names unique, ignoring case
    r = join(client, game, "Leo", code=game["join_code"].lower())  # codes ignore case
    assert r.status_code == 201
    leo_token = r.json()["player_token"]

    # The host can add (no device), reorder and remove players
    detail = client.post(f"/api/games/{gid}/players", json={"name": "Zoe"}, headers=ana).json()
    assert [(p["name"], p["joined"]) for p in detail["players"]] == [("Mia", True), ("Leo", True), ("Zoe", False)]
    ids = [p["id"] for p in detail["players"]]
    assert client.put(f"/api/games/{gid}/players/order", json={"player_ids": ids[:2]}, headers=ana).status_code == 409
    detail = client.put(f"/api/games/{gid}/players/order", json={"player_ids": ids[::-1]}, headers=ana).json()
    assert [p["name"] for p in detail["players"]] == ["Zoe", "Leo", "Mia"]
    detail = client.delete(f"/api/games/{gid}/players/{ids[2]}", headers=ana).json()
    assert [(p["name"], p["position"]) for p in detail["players"]] == [("Leo", 0), ("Mia", 1)]

    # A player leaves from their own device
    assert client.post(f"/api/games/{gid}/leave", headers={"X-Player-Token": "nope"}).status_code == 404
    assert client.post(f"/api/games/{gid}/leave", headers={"X-Player-Token": mia["player_token"]}).status_code == 204
    assert [p["name"] for p in client.get(f"/api/games/{gid}", headers=ana).json()["players"]] == ["Leo"]

    # A new link invalidates the old one (MPL-1)
    old = game["join_code"]
    game = client.post(f"/api/games/{gid}/join-code", headers=ana).json()
    assert game["join_code"] != old
    assert join(client, game, "Old", code=old).status_code == 404

    # MPL-2: no joining once started
    assert client.post(f"/api/games/{gid}/start", headers=ana).status_code == 200
    assert join(client, game, "Late").status_code == 409
    assert client.post(f"/api/games/{gid}/players", json={"name": "Late"}, headers=ana).status_code == 409
    assert client.post(f"/api/games/{gid}/leave", headers={"X-Player-Token": leo_token}).status_code == 409


def test_lobby_is_limited_to_twelve_players(client, acme):
    game = make_game(client, acme)
    for i in range(12):
        assert join(client, game, f"P{i}").status_code == 201
    assert join(client, game, "P12").status_code == 409


def test_live_game(client, acme, world, connect):
    ana = acme["auth"]
    game = make_game(client, acme)
    gid = game["id"]
    mia = join(client, game, "Mia").json()
    leo = join(client, game, "Leo").json()
    token = ana["Authorization"].removeprefix("Bearer ")

    host = connect(gid, token=token)
    first = until(host, lambda m: m["type"] == "game")
    assert first["you"] == {"player_id": None, "can_host": True}
    assert first["state"] is None and first["game"]["status"] == "awaiting"

    p1 = connect(gid, player_token=mia["player_token"])
    msg = until(p1, lambda m: m["type"] == "game")
    assert msg["you"] == {"player_id": mia["player"]["id"], "can_host": False}
    online = until(host, lambda m: any(p["online"] for p in m["game"]["players"]))
    assert [(p["name"], p["online"]) for p in online["game"]["players"]] == [("Mia", True), ("Leo", False)]

    p2 = connect(gid, player_token=leo["player_token"])
    watcher = connect(gid, code=game["join_code"])
    until(watcher, lambda m: m["type"] == "game")

    # Someone without the link, a player token or access to the organization can't watch
    stranger = connect(gid, code="NOPE", token=login(client, "gus@globex.dev", "guspass123")["Authorization"][7:])
    assert stranger.receive_json() == {"type": "error", "message": "Game not found. The link may be out of date: ask the host for a new one.", "code": "error.badLink", "fatal": True}

    assert client.post(f"/api/games/{gid}/start", headers=ana).status_code == 200
    started = until(p2, phase("AWAIT_ROLL"))
    state = started["state"]
    assert started["game"]["status"] == "running"
    assert {"cards", "decks", "rng"}.isdisjoint(state)  # MPL-6
    assert [p["id"] for p in state["players"]] == [str(mia["player"]["id"]), str(leo["player"]["id"])]

    # MPL-6: only the active player's device can act; rigged rolls don't exist here (MPL-7)
    act(p2, {"type": "ROLL"})
    assert error(p2) == "It's Mia's turn."
    act(watcher, {"type": "ROLL"})
    assert error(watcher) == "Join the game to play."
    act(p1, {"type": "ROLL", "value": 3})
    assert "Invalid message" in error(p1)

    act(p1, {"type": "ROLL"})
    moved = until(watcher, phase("AWAIT_MOVE"))
    assert moved["state"]["last_roll"] == 1 and moved["state"]["destinations"] == {"1": [1]}
    act(p1, {"type": "MOVE", "to": 1})
    asked = until(p2, phase("AWAIT_ANSWER"))
    card = asked["state"]["question"]["card"]
    assert "correct_answer" not in card and card["question"].endswith("question?")  # MPL-6
    assert asked["state"]["question"]["deadline"] > asked["server_now"]

    act(p1, {"type": "ANSWER", "answer": " 42 "})
    answered = until(host, lambda m: m["state"] and m["state"]["last_answer"])
    assert answered["state"]["last_answer"]["result"] == "correct"
    assert answered["state"]["last_answer"]["card"]["correct_answer"] == "42"  # revealed once answered
    assert answered["state"]["players"][0]["score"] == 1



def test_host_controls(client, acme, world, connect):
    ana = acme["auth"]
    game = make_game(client, acme)
    gid = game["id"]
    mia = join(client, game, "Mia").json()
    join(client, game, "Leo")
    zoe = client.post(f"/api/games/{gid}/players", json={"name": "Zoe"}, headers=ana).json()["players"][2]
    assert client.post(f"/api/games/{gid}/skip-turn", headers=ana).status_code == 409  # not running yet
    client.post(f"/api/games/{gid}/start", headers=ana)

    # Other organizations can't touch it (404)
    gus = login(client, "gus@globex.dev", "guspass123")
    assert client.post(f"/api/games/{gid}/skip-turn", headers=gus).status_code == 404

    # MPL-8: skip Mia's turn; Leo is next
    host = connect(gid, token=ana["Authorization"][7:])
    assert client.post(f"/api/games/{gid}/skip-turn", headers=ana).status_code == 204
    msg = until(host, lambda m: m["state"] and m["state"]["active_player"] == 1)
    assert msg["state"]["log"][-1]["text"] == "had their turn skipped by the host."

    # MPL-9: removing the active player (Leo) passes the turn to Zoe
    detail = client.delete(f"/api/games/{gid}/players/{msg['game']['players'][1]['id']}", headers=ana).json()
    assert [p["removed"] for p in detail["players"]] == [False, True, False]
    msg = until(host, lambda m: m["state"]["players"][1].get("removed"))
    assert msg["state"]["active_player"] == 2 and msg["game"]["players"][1]["removed"]

    # Zoe was added by the host, so the host's screen plays her turns (MPL-6)
    act(host, {"type": "ROLL"})
    until(host, phase("AWAIT_MOVE"))
    p1 = connect(gid, player_token=mia["player_token"])
    until(p1, lambda m: m["type"] == "game")
    act(p1, {"type": "MOVE", "to": 1})
    assert error(p1) == "It's Zoe's turn."

    client.delete(f"/api/games/{gid}/players/{zoe['id']}", headers=ana)
    r = client.delete(f"/api/games/{gid}/players/{mia['player']['id']}", headers=ana)
    assert r.status_code == 409 and "last player" in r.json()["detail"]
    # Mia's device learns that it's still in the game; a removed player's device doesn't play anymore
    assert until(p1, lambda m: m["type"] == "game" and m["state"]["players"][2].get("removed"))["you"]["player_id"] == mia["player"]["id"]

    assert client.post(f"/api/games/{gid}/finish", headers=ana).status_code == 200
    assert until(host, lambda m: m["game"]["status"] == "finished")
    act(host, {"type": "ROLL"})
    assert error(host) == "This game isn't running."

    client.delete(f"/api/games/{gid}", headers=ana)
    assert until(p1, lambda m: m["type"] == "gone")


def test_server_times_out_unanswered_questions(client, acme, connect):
    """MPL-8: the server runs the question timer, so an absent player can't stall the game."""
    game = make_game(client, acme, answer_time_limit_sec=1)
    mia = join(client, game, "Mia").json()
    join(client, game, "Leo")
    client.post(f"/api/games/{game['id']}/start", headers=acme["auth"])
    p1 = connect(game["id"], player_token=mia["player_token"])
    act(p1, {"type": "ROLL"})
    until(p1, phase("AWAIT_MOVE"))
    act(p1, {"type": "MOVE", "to": 1})
    until(p1, phase("AWAIT_ANSWER"))
    started = time.monotonic()
    msg = until(p1, lambda m: m["state"]["last_answer"] is not None)  # nobody answers
    assert msg["state"]["last_answer"]["result"] == "timeout" and msg["state"]["active_player"] == 1
    assert time.monotonic() - started < 3


def test_winning_finishes_the_game(client, acme):
    """MPL-10: the game is finished as soon as the engine says GAME_OVER."""
    game = make_game(client, acme, win_conditions=["turn_limit"], max_rounds=1)
    join(client, game, "Solo")
    client.post(f"/api/games/{game['id']}/start", headers=acme["auth"])
    assert client.post(f"/api/games/{game['id']}/skip-turn", headers=acme["auth"]).status_code == 204
    detail = client.get(f"/api/games/{game['id']}", headers=acme["auth"]).json()
    assert detail["status"] == "finished" and detail["finished_at"]


@pytest.mark.parametrize("hello", [{"type": "hi"}, {"nothing": True}])
def test_socket_needs_a_hello(client, acme, hello):
    game = make_game(client, acme)
    with client.websocket_connect(f"/api/games/{game['id']}/ws") as ws:
        ws.send_json(hello)
        with pytest.raises(Exception):
            ws.receive_json()


def test_games_started_before_live_play_get_a_state(client, acme, connect):
    """Running games from before migration 0004 have no live state: the first viewer deals one."""
    import psycopg

    from app.config import get_settings

    game = make_game(client, acme)
    join(client, game, "Mia")
    client.post(f"/api/games/{game['id']}/start", headers=acme["auth"])
    with psycopg.connect(get_settings().database_url, autocommit=True) as conn:
        conn.execute("DELETE FROM trivia_game_states WHERE game_id = %s", (game["id"],))
    host = connect(game["id"], token=acme["auth"]["Authorization"][7:])
    msg = until(host, lambda m: m["type"] == "game")
    assert msg["state"]["phase"] == "AWAIT_ROLL" and msg["state"]["players"][0]["name"] == "Mia"
