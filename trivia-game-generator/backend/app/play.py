"""Multiplayer play (rules.md §2.7, MPL-*): the server runs the engine on each running game's
live state. Routers and the live hub (live.py) change a game's state only through apply()."""

import hashlib
import secrets
import time
from dataclasses import dataclass

from . import engine
from .db import DbConn
from .formats import EngineState, GameSnapshot
from .models import Game, Player
from .repositories import game_states, games

# Same colors, in turn order, as PLAYER_COLORS in frontend/src/components/PlayTable.tsx
PLAYER_COLORS = ["#e11d48", "#7c3aed", "#0891b2", "#ea580c", "#16a34a", "#db2777", "#2563eb", "#ca8a04", "#0d9488", "#9333ea", "#dc2626", "#475569"]
MAX_PLAYERS = 12


def now_ms() -> int:
    return int(time.time() * 1000)


def new_player_token() -> tuple[str, str]:
    """A player token for a device and the hash stored for it (MPL-4)."""
    token = secrets.token_urlsafe(24)
    return token, hash_player_token(token)


def hash_player_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def engine_player_id(player: Player) -> str:
    """Engine players are named by their database id, so they stay the same after removals."""
    return str(player.id)


def initial_state(snapshot: GameSnapshot, players: list[Player]) -> EngineState:
    """The state a game starts with (GAM-3): its snapshot, its players in turn order, a random seed."""
    board, deck = engine.resolve_snapshot(snapshot)
    setup: list[engine.PlayerSetup] = [
        {"id": engine_player_id(p), "name": p.name, "color": PLAYER_COLORS[i % len(PLAYER_COLORS)]} for i, p in enumerate(players)
    ]
    return EngineState.model_validate(engine.create_game(board, deck, setup, secrets.randbits(32), now_ms()))


def ensure_live_state(conn: DbConn, game: Game) -> None:
    """Games started before live play (migration 0004) have no state yet: deal one when first opened."""
    if game.status != "running" or game.snapshot is None:
        return
    with conn.transaction():
        games.lock(conn, game.id)
        players = [p for p in games.list_players(conn, game.id) if not p.removed]
        if players and game_states.get(conn, game.id) is None:
            game_states.create(conn, game.id, initial_state(game.snapshot, players))


@dataclass(frozen=True)
class Device:
    """Who sent an action from a game's WebSocket."""

    player_id: int | None  # the player this device joined as
    can_host: bool  # an organization user: also plays for the players the host added by name


@dataclass(frozen=True)
class Applied:
    error: str | None = None
    error_i18n: engine.Message | None = None  # the error as a translatable message (I18N-7)
    finished: bool = False  # this action ended the game


def apply(conn: DbConn, game_id: int, action: engine.Action, *, device: Device | None = None) -> Applied:
    """Applies one action to a running game's state and saves the result (MPL-7, MPL-11).

    device: where a player's action came from; it must be that player's turn (MPL-6). None
    means the server (timer) or a host control. Actions on one game are applied one at a
    time: the state row stays locked until the transaction ends."""
    with conn.transaction():
        live = game_states.get(conn, game_id, for_update=True)
        game = games.get(conn, game_id)
        if live is None or game is None or game.status != "running":
            return Applied("This game isn't running.", {"key": "error.notRunning", "params": {}})
        state = live.state.to_engine()
        if device is not None and not _may_play(conn, game_id, engine.active_player(state)["id"], device):
            name = engine.active_player(state)["name"]
            return Applied(f"It's {name}'s turn.", {"key": "error.notYourTurn", "params": {"name": name}})
        out = engine.apply_action(state, action, now_ms())
        if out.error:
            return Applied(out.error, out.error_i18n)
        game_states.save(conn, game_id, EngineState.model_validate(out.state))
        # MPL-10: a game that reaches GAME_OVER is finished
        finished = out.state["phase"] == "GAME_OVER" and games.mark_finished(conn, game_id)
        return Applied(finished=finished)


def _may_play(conn: DbConn, game_id: int, active_id: str, device: Device) -> bool:
    """MPL-6: each player plays from their own device; players added by the host (no device) from the host's."""
    if device.player_id is not None and str(device.player_id) == active_id:
        return True
    if device.can_host:
        player = games.get_player(conn, game_id, int(active_id))
        return player is not None and not player.joined
    return False
