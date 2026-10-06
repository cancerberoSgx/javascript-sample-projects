"""The server's engine (app/engine) against the TypeScript engine it was ported from.

fixtures/engine_conformance.json is written by frontend/src/engine/engine.test.ts: scripted
games on every example board, with the action, the time and the resulting state (or error) of
every step. Replaying them here must give the same states and the same error messages."""

import json
from pathlib import Path
from typing import Any

import pytest

from app.engine import (
    apply_action,
    create_game,
    normalize_answer,
    public_view,
    resolve_snapshot,
)
from app.engine.rng import next_random, random_int
from app.formats import GameSnapshot, SnapshotBoard, SnapshotDeck

FIXTURE = Path(__file__).parent / "fixtures" / "engine_conformance.json"
PUBLIC = Path(__file__).resolve().parents[2] / "frontend" / "public"
SCENARIOS = json.loads(FIXTURE.read_text())
DECK = json.loads((PUBLIC / "decks" / "general.json").read_text()) if PUBLIC.exists() else None
NOW = 1_000_000


def snapshot(board_path: str, config_patch: dict[str, Any]) -> GameSnapshot:
    """An example board played with the example deck: slot i gets the deck's category i (like the demo)."""
    assert DECK is not None
    file = json.loads((PUBLIC / board_path).read_text())
    file["config"] = {**file["config"], **config_patch}
    board = SnapshotBoard.model_validate({k: v for k, v in file.items() if k != "id"})
    deck = SnapshotDeck.model_validate({**{k: v for k, v in DECK.items() if k != "id"}})
    return GameSnapshot(board=board, deck=deck, mapping={slot: DECK["categories"][i]["id"] for i, slot in enumerate(file["slots"])})


def digest(s: dict[str, Any]) -> dict[str, Any]:
    """Same as digest() in engine.test.ts."""
    rest = {k: v for k, v in s.items() if k not in ("board", "cards", "config", "log", "question", "last_answer")}
    q, a = s["question"], s["last_answer"]
    return {
        **rest,
        "question": q and {"card": q["card"]["id"], "deadline": q["deadline"], "grand_prize": q["grand_prize"], "from_hq": q["from_hq"]},
        "last_answer": a and {"card": a["card"]["id"], "given": a["given"], "result": a["result"]},
        "log_length": len(s["log"]),
        "last_log": s["log"][-2:],
    }


def test_rng_matches_mulberry32():
    # Values from rng.ts: nextRandom(42) and randomInt(-7, 1, 6)
    value, state = next_random(42)
    assert state == 1831565855
    assert value == pytest.approx(0.6011037519201636, abs=0)
    assert random_int(-7, 1, 6) == (3, 1831565806)


@pytest.mark.skipif(DECK is None, reason="frontend/public isn't checked out next to the backend")
@pytest.mark.parametrize("scenario", SCENARIOS, ids=[f"{s['board']}#{s['seed']}" for s in SCENARIOS])
def test_replays_typescript_games(scenario):
    board, deck = resolve_snapshot(snapshot(scenario["board"], scenario["config"]))
    s = create_game(board, deck, scenario["players"], scenario["seed"], NOW)
    assert digest(dict(s)) == scenario["initial"]
    for i, step in enumerate(scenario["steps"]):
        out = apply_action(s, step["action"], step["now"])
        assert out.error == step.get("error"), f"step {i}: {step['action']}"
        s = out.state
        assert digest(dict(s)) == step["state"], f"step {i}: {step['action']}"
    final = {k: v for k, v in s.items() if k not in ("board", "cards")}
    assert json.loads(json.dumps(final)) == scenario["final"]


def test_normalize_answer():
    assert normalize_answer("  Café,   ÜNÏCODE!! ") == "cafe unicode"
    assert normalize_answer("Rock & Roll") == "rock roll"


def test_public_view_hides_answers_and_the_future():
    file = SCENARIOS[0]
    board, deck = resolve_snapshot(snapshot(file["board"], {}))
    s = create_game(board, deck, [{"name": "A", "color": "#000"}], 1, NOW)
    s = apply_action(s, {"type": "ROLL", "value": 1}, NOW).state
    s = apply_action(s, {"type": "MOVE", "to": 1}, NOW).state
    assert s["phase"] == "AWAIT_ANSWER"
    view = public_view(s)
    assert {"cards", "decks", "rng"}.isdisjoint(view)
    assert "correct_answer" not in view["question"]["card"]
    assert view["question"]["card"]["question"] == s["question"]["card"]["question"]  # pyright: ignore[reportOptionalSubscript]
    assert "correct_answer" in s["question"]["card"]  # pyright: ignore[reportOptionalSubscript]  # the original is untouched
