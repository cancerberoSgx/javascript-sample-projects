"""Shared SQL helpers for the repositories."""

from typing import LiteralString

from psycopg import sql
from psycopg.types.json import Jsonb

from ..db import DbConn
from ..models import Changes, CopiedFrom


def update_row(
    conn: DbConn,
    table: LiteralString,
    row_id: int | str,
    changes: Changes,
    json_columns: frozenset[str] = frozenset(),
    id_column: LiteralString = "id",
) -> bool:
    """UPDATE <table> SET <the fields set on changes>, updated_at = now() WHERE <id_column> = row_id.

    Column names come from the Changes model's fields (extra="forbid"), never from user
    input, and are quoted with sql.Identifier. Returns False if the row doesn't exist.
    """
    fields = changes.set_fields()
    if not fields:
        return conn.execute(sql.SQL("SELECT 1 FROM {} WHERE {} = %s").format(sql.Identifier(table), sql.Identifier(id_column)), (row_id,)).fetchone() is not None
    values = [Jsonb(v) if k in json_columns and v is not None else v for k, v in fields.items()]
    assignments = sql.SQL(", ").join(sql.SQL("{} = %s").format(sql.Identifier(k)) for k in fields)
    query = sql.SQL("UPDATE {} SET {}, updated_at = now() WHERE {} = %s").format(sql.Identifier(table), assignments, sql.Identifier(id_column))
    return conn.execute(query, (*values, row_id)).rowcount == 1


def json_or_null(value: CopiedFrom | None) -> Jsonb | None:
    return Jsonb(value.model_dump()) if value is not None else None
