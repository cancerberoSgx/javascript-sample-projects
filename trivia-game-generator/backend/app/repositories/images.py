"""Pure-SQL data access for trivia_images, the organizations' image libraries (rules.md §2.1.2).
The files themselves are in app/storage.py."""

from psycopg.rows import class_row, scalar_row

from ..db import DbConn, fetch_scalar
from ..models import Image, ImageChanges, NewImage
from ._sql import json_or_null, update_row

# Where an image is used (BKG-7): board backgrounds, game backgrounds and started games' snapshots
_BOARDS_USING = """
    FROM trivia_boards b
    WHERE b.organization_id = i.organization_id AND b.definition -> 'background' ->> 'image' = i.key
"""
_GAMES_USING = """
    FROM trivia_games g
    WHERE g.organization_id = i.organization_id
      AND (g.background ->> 'image' = i.key OR g.snapshot -> 'board' -> 'background' ->> 'image' = i.key)
"""

_SELECT = f"""
    SELECT i.id, i.organization_id, i.key, i.name, i.source_url, i.content_type, i.width, i.height, i.bytes,
           i.creator_id, u.name AS creator_name, i.visibility, i.published_at, i.copied_from,
           (SELECT count(*) {_BOARDS_USING}) AS board_count,
           (SELECT count(*) {_GAMES_USING}) AS game_count,
           i.created_at, i.updated_at
    FROM trivia_images i
    LEFT JOIN trivia_users u ON u.id = i.creator_id
"""


def _rows(conn: DbConn):
    return conn.cursor(row_factory=class_row(Image))


def list_for_org(conn: DbConn, organization_id: int) -> list[Image]:
    return _rows(conn).execute(_SELECT + " WHERE i.organization_id = %s ORDER BY i.created_at DESC, i.id DESC", (organization_id,)).fetchall()


def get(conn: DbConn, image_id: int) -> Image | None:
    return _rows(conn).execute(_SELECT + " WHERE i.id = %s", (image_id,)).fetchone()


def get_by_key(conn: DbConn, organization_id: int, key: str) -> Image | None:
    return _rows(conn).execute(_SELECT + " WHERE i.organization_id = %s AND i.key = %s", (organization_id, key)).fetchone()


def exists(conn: DbConn, organization_id: int, key: str) -> bool:
    return conn.execute("SELECT 1 FROM trivia_images WHERE organization_id = %s AND key = %s", (organization_id, key)).fetchone() is not None


def create(conn: DbConn, image: NewImage) -> int:
    """Adds an image to the library. The same file twice in one organization keeps the first row
    (ON CONFLICT): returns the id either way."""
    return fetch_scalar(
        conn,
        """
        WITH inserted AS (
            INSERT INTO trivia_images (organization_id, key, name, source_url, content_type, width, height, bytes, creator_id, copied_from)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (organization_id, key) DO NOTHING
            RETURNING id
        )
        SELECT id FROM inserted
        UNION ALL
        SELECT id FROM trivia_images WHERE organization_id = %s AND key = %s
        LIMIT 1
        """,
        (
            image.organization_id,
            image.key,
            image.name,
            image.source_url,
            image.content_type,
            image.width,
            image.height,
            image.bytes,
            image.creator_id,
            json_or_null(image.copied_from),
            image.organization_id,
            image.key,
        ),
    )


def update(conn: DbConn, image_id: int, changes: ImageChanges) -> bool:
    return update_row(conn, "trivia_images", image_id, changes)


def used_by(conn: DbConn, image_id: int) -> list[str]:
    """What uses the image, for the "can't delete" message: 'board "X"', 'game "Y"'."""
    query = f"""
        SELECT 'board "' || b.name || '"' FROM trivia_images i, LATERAL (SELECT b.name {_BOARDS_USING}) b WHERE i.id = %(id)s
        UNION ALL
        SELECT 'game "' || g.name || '"' FROM trivia_images i, LATERAL (SELECT g.name {_GAMES_USING}) g WHERE i.id = %(id)s
    """
    return conn.cursor(row_factory=scalar_row).execute(query, {"id": image_id}).fetchall()


def delete(conn: DbConn, image_id: int) -> bool:
    return conn.execute("DELETE FROM trivia_images WHERE id = %s", (image_id,)).rowcount == 1


def key_in_use(conn: DbConn, key: str) -> bool:
    """Whether any organization still has this file in its library (files are shared by key)."""
    return conn.execute("SELECT 1 FROM trivia_images WHERE key = %s LIMIT 1", (key,)).fetchone() is not None


def keys_for_org(conn: DbConn, organization_id: int) -> list[str]:
    return conn.cursor(row_factory=scalar_row).execute("SELECT key FROM trivia_images WHERE organization_id = %s", (organization_id,)).fetchall()
