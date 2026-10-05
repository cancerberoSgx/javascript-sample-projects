"""Pure-SQL data access for trivia_users."""

from psycopg import sql
from psycopg.rows import class_row

from ..db import DbConn, fetch_scalar
from ..models import NewUser, User, UserChanges

_SELECT = """
    SELECT u.id, u.organization_id, o.name AS organization_name, u.name, u.email,
           u.password_hash, u.role, u.created_at, u.updated_at
    FROM trivia_users u
    JOIN trivia_organizations o ON o.id = u.organization_id
"""


def _rows(conn: DbConn):
    return conn.cursor(row_factory=class_row(User))


def list_users(conn: DbConn, organization_id: int | None = None) -> list[User]:
    if organization_id is None:
        return _rows(conn).execute(_SELECT + " ORDER BY lower(o.name), lower(u.name)").fetchall()
    return _rows(conn).execute(_SELECT + " WHERE u.organization_id = %s ORDER BY lower(u.name)", (organization_id,)).fetchall()


def get(conn: DbConn, user_id: int) -> User | None:
    return _rows(conn).execute(_SELECT + " WHERE u.id = %s", (user_id,)).fetchone()


def get_by_email(conn: DbConn, email: str) -> User | None:
    return _rows(conn).execute(_SELECT + " WHERE lower(u.email) = lower(%s)", (email,)).fetchone()


def count_roots(conn: DbConn) -> int:
    return fetch_scalar(conn, "SELECT count(*) FROM trivia_users WHERE role = 'root'")


def create(conn: DbConn, user: NewUser) -> int:
    return fetch_scalar(
        conn,
        """
        INSERT INTO trivia_users (organization_id, name, email, password_hash, role)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """,
        (user.organization_id, user.name, user.email, user.password_hash, user.role),
    )


def update(conn: DbConn, user_id: int, changes: UserChanges) -> bool:
    """Writes the fields set on `changes`. Returns False if the row doesn't exist."""
    fields = changes.set_fields()
    if not fields:
        return get(conn, user_id) is not None
    assignments = sql.SQL(", ").join(sql.SQL("{} = %s").format(sql.Identifier(k)) for k in fields)
    query = sql.SQL("UPDATE trivia_users SET {}, updated_at = now() WHERE id = %s").format(assignments)
    return conn.execute(query, (*fields.values(), user_id)).rowcount == 1


def delete(conn: DbConn, user_id: int) -> bool:
    return conn.execute("DELETE FROM trivia_users WHERE id = %s", (user_id,)).rowcount == 1
