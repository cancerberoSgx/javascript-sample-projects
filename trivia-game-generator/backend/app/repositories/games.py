"""Pure-SQL data access for trivia_games, their slot mapping (trivia_game_categories)
and their players (trivia_players)."""

from psycopg.rows import class_row
from psycopg.types.json import Jsonb

from ..db import DbConn, fetch_scalar
from ..formats import GameSnapshot
from ..models import Game, GameChanges, NewGame, Player
from ._sql import update_row

_SELECT = """
    SELECT g.id, g.organization_id, g.name, g.status,
           g.creator_id, u.name AS creator_name,
           g.board_id, b.name AS board_name,
           g.deck_id, d.name AS deck_name,
           g.snapshot, g.started_at, g.finished_at, g.created_at, g.updated_at
    FROM trivia_games g
    LEFT JOIN trivia_users u ON u.id = g.creator_id
    LEFT JOIN trivia_boards b ON b.id = g.board_id
    LEFT JOIN trivia_decks d ON d.id = g.deck_id
"""


def _games(conn: DbConn):
    return conn.cursor(row_factory=class_row(Game))


def list_for_org(conn: DbConn, organization_id: int) -> list[Game]:
    return _games(conn).execute(_SELECT + " WHERE g.organization_id = %s ORDER BY g.created_at DESC, g.id DESC", (organization_id,)).fetchall()


def get(conn: DbConn, game_id: int) -> Game | None:
    return _games(conn).execute(_SELECT + " WHERE g.id = %s", (game_id,)).fetchone()


def create(conn: DbConn, game: NewGame) -> int:
    return fetch_scalar(
        conn,
        "INSERT INTO trivia_games (organization_id, name, creator_id, board_id, deck_id) VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (game.organization_id, game.name, game.creator_id, game.board_id, game.deck_id),
    )


def update(conn: DbConn, game_id: int, changes: GameChanges) -> bool:
    return update_row(conn, "trivia_games", game_id, changes)


def mark_started(conn: DbConn, game_id: int, snapshot: GameSnapshot) -> bool:
    """not_started -> running. False if the game was no longer not_started (concurrent start)."""
    return (
        conn.execute(
            """
            UPDATE trivia_games SET status = 'running', snapshot = %s, started_at = now(), updated_at = now()
            WHERE id = %s AND status = 'not_started'
            """,
            (Jsonb(snapshot.model_dump(mode="json")), game_id),
        ).rowcount
        == 1
    )


def mark_finished(conn: DbConn, game_id: int) -> bool:
    """running -> finished."""
    return (
        conn.execute(
            "UPDATE trivia_games SET status = 'finished', finished_at = now(), updated_at = now() WHERE id = %s AND status = 'running'",
            (game_id,),
        ).rowcount
        == 1
    )


def delete(conn: DbConn, game_id: int) -> bool:
    return conn.execute("DELETE FROM trivia_games WHERE id = %s", (game_id,)).rowcount == 1


# ---------- slot mapping ----------


def get_mapping(conn: DbConn, game_id: int) -> dict[str, int]:
    rows = conn.execute("SELECT slot, category_id FROM trivia_game_categories WHERE game_id = %s ORDER BY slot", (game_id,)).fetchall()
    return {r["slot"]: r["category_id"] for r in rows}


def get_mappings(conn: DbConn, game_ids: list[int]) -> dict[int, dict[str, int]]:
    result: dict[int, dict[str, int]] = {gid: {} for gid in game_ids}
    rows = conn.execute("SELECT game_id, slot, category_id FROM trivia_game_categories WHERE game_id = ANY(%s)", (game_ids,)).fetchall()
    for r in rows:
        result[r["game_id"]][r["slot"]] = r["category_id"]
    return result


def replace_mapping(conn: DbConn, game_id: int, mapping: dict[str, int]) -> None:
    conn.execute("DELETE FROM trivia_game_categories WHERE game_id = %s", (game_id,))
    if mapping:
        conn.cursor().executemany(
            "INSERT INTO trivia_game_categories (game_id, slot, category_id) VALUES (%s, %s, %s)",
            [(game_id, slot, category_id) for slot, category_id in mapping.items()],
        )


# ---------- players ----------


def _players(conn: DbConn):
    return conn.cursor(row_factory=class_row(Player))


def list_players(conn: DbConn, game_id: int) -> list[Player]:
    return _players(conn).execute("SELECT id, game_id, name, position FROM trivia_players WHERE game_id = %s ORDER BY position", (game_id,)).fetchall()


def list_players_for(conn: DbConn, game_ids: list[int]) -> dict[int, list[Player]]:
    result: dict[int, list[Player]] = {gid: [] for gid in game_ids}
    rows = _players(conn).execute(
        "SELECT id, game_id, name, position FROM trivia_players WHERE game_id = ANY(%s) ORDER BY position", (game_ids,)
    ).fetchall()
    for p in rows:
        result[p.game_id].append(p)
    return result


def replace_players(conn: DbConn, game_id: int, names: list[str]) -> None:
    """Players are only editable before the game starts, so the list is simply replaced (order = turn order)."""
    conn.execute("DELETE FROM trivia_players WHERE game_id = %s", (game_id,))
    if names:
        conn.cursor().executemany(
            "INSERT INTO trivia_players (game_id, name, position) VALUES (%s, %s, %s)",
            [(game_id, name, i) for i, name in enumerate(names)],
        )
