"""The game engine, ported from frontend/src/engine (engine.ts, movement.ts, rng.ts, resolve.ts).

The server runs it for multiplayer games (rules.md §2.7): clients send actions, the server
applies them and broadcasts the result. Same rule IDs, same states, same error messages as
the TypeScript engine; tests/test_engine.py replays the TS-generated conformance fixture to
keep the two in step. Change one, change the other.

States are plain JSON-shaped dicts (TypedDicts) exactly like the TS GameState, so they can be
stored as jsonb and sent to the browser unchanged."""

from .core import (
    ActionOutcome,
    active_player,
    apply_action,
    create_game,
    normalize_answer,
    public_view,
)
from .resolve import resolve_snapshot
from .types import Action, GameState, Message, PlayerSetup

__all__ = [
    "Action",
    "ActionOutcome",
    "active_player",
    "GameState",
    "Message",
    "PlayerSetup",
    "apply_action",
    "create_game",
    "normalize_answer",
    "public_view",
    "resolve_snapshot",
]
