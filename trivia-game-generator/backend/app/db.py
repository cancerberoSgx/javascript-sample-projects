from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, LiteralString

from psycopg import Connection
from psycopg.rows import DictRow, dict_row, scalar_row
from psycopg_pool import ConnectionPool

# Repositories pick a row factory per cursor (class_row / scalar_row), so the
# connection's default row type doesn't matter to them.
DbConn = Connection[Any]

_pool: ConnectionPool[Connection[DictRow]] | None = None


def open_pool(database_url: str) -> None:
    global _pool
    _pool = ConnectionPool(
        database_url,
        min_size=1,
        max_size=10,
        # autocommit: reads run on their own; writes use an explicit `with conn.transaction():`
        kwargs={"row_factory": dict_row, "autocommit": True},
        open=True,
    )


def close_pool() -> None:
    global _pool
    if _pool:
        _pool.close()
        _pool = None


def fetch_scalar(conn: DbConn, query: LiteralString, params: tuple = ()) -> Any:
    """First column of the first row. For queries that always return a row (count(*), RETURNING)."""
    value = conn.cursor(row_factory=scalar_row).execute(query, params).fetchone()
    if value is None:
        raise RuntimeError(f"Query returned no rows: {query.strip().splitlines()[0]}")
    return value


@contextmanager
def connection() -> Iterator[Connection[DictRow]]:
    """A pooled connection, for code outside a request (WebSockets, timers)."""
    assert _pool, "Connection pool is not open"
    with _pool.connection() as conn:
        yield conn


def get_conn() -> Iterator[Connection[DictRow]]:
    """FastAPI dependency: one pooled connection per request."""
    with connection() as conn:
        yield conn
