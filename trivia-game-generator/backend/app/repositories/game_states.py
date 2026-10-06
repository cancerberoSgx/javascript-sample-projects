"""Pure-SQL data access for trivia_game_states: the live engine state of running games (rules.md §2.7)."""

from psycopg.rows import class_row
from psycopg.types.json import Jsonb

from ..db import DbConn, fetch_scalar
from ..formats import EngineState
from ..models import GameLiveState

_SELECT = "SELECT game_id, state, version, updated_at FROM trivia_game_states WHERE game_id = %s"


def get(conn: DbConn, game_id: int, *, for_update: bool = False) -> GameLiveState | None:
    """for_update: lock the row until the transaction ends, so actions on one game apply one at a time."""
    cur = conn.cursor(row_factory=class_row(GameLiveState))
    return cur.execute(_SELECT + (" FOR UPDATE" if for_update else ""), (game_id,)).fetchone()


def create(conn: DbConn, game_id: int, state: EngineState) -> None:
    conn.execute("INSERT INTO trivia_game_states (game_id, state) VALUES (%s, %s)", (game_id, Jsonb(state.to_engine())))


def save(conn: DbConn, game_id: int, state: EngineState) -> int:
    """Stores a new state and returns its version."""
    return fetch_scalar(
        conn,
        "UPDATE trivia_game_states SET state = %s, version = version + 1, updated_at = now() WHERE game_id = %s RETURNING version",
        (Jsonb(state.to_engine()), game_id),
    )
