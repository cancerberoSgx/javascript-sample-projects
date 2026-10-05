"""Pure-SQL data access for trivia_revoked_tokens (JWT logout)."""

import uuid
from datetime import datetime

from ..db import DbConn


def revoke(conn: DbConn, jti: uuid.UUID, user_id: int, expires_at: datetime) -> None:
    conn.execute(
        "INSERT INTO trivia_revoked_tokens (jti, user_id, expires_at) VALUES (%s, %s, %s) ON CONFLICT (jti) DO NOTHING",
        (jti, user_id, expires_at),
    )


def is_revoked(conn: DbConn, jti: uuid.UUID) -> bool:
    return conn.execute("SELECT 1 FROM trivia_revoked_tokens WHERE jti = %s", (jti,)).fetchone() is not None


def purge_expired(conn: DbConn) -> int:
    """Expired tokens are rejected by their exp claim anyway, so their rows can go."""
    return conn.execute("DELETE FROM trivia_revoked_tokens WHERE expires_at < now()").rowcount
