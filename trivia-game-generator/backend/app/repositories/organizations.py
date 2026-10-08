"""Pure-SQL data access for trivia_organizations."""

from psycopg.rows import class_row

from ..db import DbConn, fetch_scalar
from ..models import Organization, OrganizationChanges
from ._sql import update_row

_SELECT = """
    SELECT o.id, o.name, o.openai_api_key_encrypted, o.gemini_api_key_encrypted,
           o.openai_model, o.gemini_model, o.language, o.created_at, o.updated_at,
           (SELECT count(*) FROM trivia_users u WHERE u.organization_id = o.id) AS user_count
    FROM trivia_organizations o
"""


def _rows(conn: DbConn):
    return conn.cursor(row_factory=class_row(Organization))


def list_all(conn: DbConn) -> list[Organization]:
    return _rows(conn).execute(_SELECT + " ORDER BY lower(o.name)").fetchall()


def get(conn: DbConn, org_id: int) -> Organization | None:
    return _rows(conn).execute(_SELECT + " WHERE o.id = %s", (org_id,)).fetchone()


def get_by_name(conn: DbConn, name: str) -> Organization | None:
    return _rows(conn).execute(_SELECT + " WHERE lower(o.name) = lower(%s)", (name,)).fetchone()


def create(conn: DbConn, name: str, openai_api_key_encrypted: str | None, gemini_api_key_encrypted: str | None = None) -> int:
    return fetch_scalar(
        conn,
        "INSERT INTO trivia_organizations (name, openai_api_key_encrypted, gemini_api_key_encrypted) VALUES (%s, %s, %s) RETURNING id",
        (name, openai_api_key_encrypted, gemini_api_key_encrypted),
    )


def update(conn: DbConn, org_id: int, changes: OrganizationChanges) -> bool:
    """Writes the fields set on `changes`. Returns False if the row doesn't exist."""
    return update_row(conn, "trivia_organizations", org_id, changes)


def delete(conn: DbConn, org_id: int) -> bool:
    return conn.execute("DELETE FROM trivia_organizations WHERE id = %s", (org_id,)).rowcount == 1
