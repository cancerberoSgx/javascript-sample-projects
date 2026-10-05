"""Pure-SQL data access for trivia_organizations."""

from psycopg import sql
from psycopg.rows import class_row

from ..db import DbConn, fetch_scalar
from ..models import Organization, OrganizationChanges

_SELECT = """
    SELECT o.id, o.name, o.openai_api_key_encrypted, o.created_at, o.updated_at,
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


def create(conn: DbConn, name: str, openai_api_key_encrypted: str | None) -> int:
    return fetch_scalar(
        conn,
        "INSERT INTO trivia_organizations (name, openai_api_key_encrypted) VALUES (%s, %s) RETURNING id",
        (name, openai_api_key_encrypted),
    )


def update(conn: DbConn, org_id: int, changes: OrganizationChanges) -> bool:
    """Writes the fields set on `changes`. Returns False if the row doesn't exist."""
    fields = changes.set_fields()
    if not fields:
        return get(conn, org_id) is not None
    assignments = sql.SQL(", ").join(sql.SQL("{} = %s").format(sql.Identifier(k)) for k in fields)
    query = sql.SQL("UPDATE trivia_organizations SET {}, updated_at = now() WHERE id = %s").format(assignments)
    return conn.execute(query, (*fields.values(), org_id)).rowcount == 1


def delete(conn: DbConn, org_id: int) -> bool:
    return conn.execute("DELETE FROM trivia_organizations WHERE id = %s", (org_id,)).rowcount == 1
