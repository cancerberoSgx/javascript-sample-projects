"""Pure-SQL data access for trivia_boards."""

from psycopg.rows import class_row
from psycopg.types.json import Jsonb

from ..db import DbConn, fetch_scalar
from ..models import Board, BoardChanges, NewBoard
from ._sql import update_row

_SELECT = """
    SELECT id, organization_id, name, description, definition, created_at, updated_at
    FROM trivia_boards
"""


def _rows(conn: DbConn):
    return conn.cursor(row_factory=class_row(Board))


def list_for_org(conn: DbConn, organization_id: int) -> list[Board]:
    return _rows(conn).execute(_SELECT + " WHERE organization_id = %s ORDER BY lower(name)", (organization_id,)).fetchall()


def get(conn: DbConn, board_id: int) -> Board | None:
    return _rows(conn).execute(_SELECT + " WHERE id = %s", (board_id,)).fetchone()


def create(conn: DbConn, board: NewBoard) -> int:
    return fetch_scalar(
        conn,
        "INSERT INTO trivia_boards (organization_id, name, description, definition) VALUES (%s, %s, %s, %s) RETURNING id",
        (board.organization_id, board.name, board.description, Jsonb(board.definition.to_json())),
    )


def update(conn: DbConn, board_id: int, changes: BoardChanges) -> bool:
    return update_row(conn, "trivia_boards", board_id, changes, json_columns=frozenset({"definition"}))


def count_pending_games_using(conn: DbConn, board_id: int) -> int:
    return fetch_scalar(conn, "SELECT count(*) FROM trivia_games WHERE board_id = %s AND status = 'not_started'", (board_id,))


def delete(conn: DbConn, board_id: int) -> bool:
    return conn.execute("DELETE FROM trivia_boards WHERE id = %s", (board_id,)).rowcount == 1
