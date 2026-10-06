"""Pure-SQL data access for trivia_categories."""

from psycopg.rows import class_row

from ..db import DbConn, fetch_scalar
from ..models import Category, CategoryChanges, NewCategory
from ._sql import update_row

_SELECT = """
    SELECT c.id, c.organization_id, c.name, c.description, c.color, c.created_at, c.updated_at,
           (SELECT count(*) FROM trivia_cards k WHERE k.category_id = c.id) AS card_count
    FROM trivia_categories c
"""


def _rows(conn: DbConn):
    return conn.cursor(row_factory=class_row(Category))


def list_for_org(conn: DbConn, organization_id: int) -> list[Category]:
    return _rows(conn).execute(_SELECT + " WHERE c.organization_id = %s ORDER BY lower(c.name)", (organization_id,)).fetchall()


def get(conn: DbConn, category_id: int) -> Category | None:
    return _rows(conn).execute(_SELECT + " WHERE c.id = %s", (category_id,)).fetchone()


def get_many(conn: DbConn, ids: list[int]) -> list[Category]:
    return _rows(conn).execute(_SELECT + " WHERE c.id = ANY(%s)", (ids,)).fetchall()


def create(conn: DbConn, category: NewCategory) -> int:
    return fetch_scalar(
        conn,
        "INSERT INTO trivia_categories (organization_id, name, description, color) VALUES (%s, %s, %s, %s) RETURNING id",
        (category.organization_id, category.name, category.description, category.color),
    )


def update(conn: DbConn, category_id: int, changes: CategoryChanges) -> bool:
    return update_row(conn, "trivia_categories", category_id, changes)


def count_pending_games_using(conn: DbConn, category_id: int) -> int:
    """Not-started games whose slot mapping uses this category (started games use their snapshot)."""
    return fetch_scalar(
        conn,
        """
        SELECT count(*) FROM trivia_game_categories gc
        JOIN trivia_games g ON g.id = gc.game_id
        WHERE gc.category_id = %s AND g.status = 'awaiting'
        """,
        (category_id,),
    )


def delete(conn: DbConn, category_id: int) -> bool:
    return conn.execute("DELETE FROM trivia_categories WHERE id = %s", (category_id,)).rowcount == 1
