"""Pure-SQL data access for trivia_game_instances (saved games, rules.md §2.7)."""

from psycopg.rows import class_row
from psycopg.types.json import Jsonb

from ..db import DbConn, fetch_scalar
from ..models import (
    GameInstance,
    GameInstanceChanges,
    GameInstanceSummary,
    NewGameInstance,
)
from ._sql import update_row

_SUMMARY = """
    SELECT i.id, i.game_id, i.name, i.saved_by_id, u.name AS saved_by_name,
           (i.state->>'round')::int AS round, i.state->>'phase' AS phase,
           i.state->'players' AS players, i.state->'result' AS result,
           i.created_at, i.updated_at
"""
_FROM = """
    FROM trivia_game_instances i
    LEFT JOIN trivia_users u ON u.id = i.saved_by_id
"""


def list_for_game(conn: DbConn, game_id: int) -> list[GameInstanceSummary]:
    cur = conn.cursor(row_factory=class_row(GameInstanceSummary))
    return cur.execute(_SUMMARY + _FROM + " WHERE i.game_id = %s ORDER BY i.updated_at DESC, i.id DESC", (game_id,)).fetchall()


def get(conn: DbConn, instance_id: int) -> GameInstance | None:
    cur = conn.cursor(row_factory=class_row(GameInstance))
    return cur.execute(_SUMMARY + ", i.state" + _FROM + " WHERE i.id = %s", (instance_id,)).fetchone()


def create(conn: DbConn, instance: NewGameInstance) -> int:
    return fetch_scalar(
        conn,
        "INSERT INTO trivia_game_instances (game_id, name, state, saved_by_id) VALUES (%s, %s, %s, %s) RETURNING id",
        (instance.game_id, instance.name, Jsonb(instance.state.model_dump(mode="json", exclude_unset=True)), instance.saved_by_id),
    )


def update(conn: DbConn, instance_id: int, changes: GameInstanceChanges) -> bool:
    return update_row(conn, "trivia_game_instances", instance_id, changes, json_columns=frozenset({"state"}))


def delete(conn: DbConn, instance_id: int) -> bool:
    return conn.execute("DELETE FROM trivia_game_instances WHERE id = %s", (instance_id,)).rowcount == 1
