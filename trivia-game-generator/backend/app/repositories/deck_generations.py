"""Pure-SQL data access for trivia_deck_generations: saved, reusable generation settings (rules.md §2.2.2)."""

from psycopg.rows import class_row
from psycopg.types.json import Jsonb

from ..db import DbConn, fetch_scalar
from ..models import DeckGeneration, DeckGenerationChanges, NewDeckGeneration
from ._sql import update_row

_SELECT = """
    SELECT g.id, d.organization_id, g.deck_id, d.name AS deck_name, g.name, g.description, g.provider, g.spec,
           g.creator_id, u.name AS creator_name, g.use_count, g.last_used_at, g.cards_accepted,
           g.created_at, g.updated_at
    FROM trivia_deck_generations g
    JOIN trivia_decks d ON d.id = g.deck_id
    LEFT JOIN trivia_users u ON u.id = g.creator_id
"""


def _rows(conn: DbConn):
    return conn.cursor(row_factory=class_row(DeckGeneration))


def list_for_deck(conn: DbConn, deck_id: int) -> list[DeckGeneration]:
    return _rows(conn).execute(_SELECT + " WHERE g.deck_id = %s ORDER BY lower(g.name)", (deck_id,)).fetchall()


def list_for_org(conn: DbConn, organization_id: int) -> list[DeckGeneration]:
    return _rows(conn).execute(_SELECT + " WHERE d.organization_id = %s ORDER BY lower(d.name), lower(g.name)", (organization_id,)).fetchall()


def get(conn: DbConn, generation_id: int) -> DeckGeneration | None:
    return _rows(conn).execute(_SELECT + " WHERE g.id = %s", (generation_id,)).fetchone()


def create(conn: DbConn, generation: NewDeckGeneration) -> int:
    return fetch_scalar(
        conn,
        """
        INSERT INTO trivia_deck_generations (deck_id, name, description, provider, spec, creator_id)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (
            generation.deck_id,
            generation.name,
            generation.description,
            generation.provider,
            Jsonb(generation.spec.model_dump()),
            generation.creator_id,
        ),
    )


def update(conn: DbConn, generation_id: int, changes: DeckGenerationChanges) -> bool:
    return update_row(conn, "trivia_deck_generations", generation_id, changes, json_columns=frozenset({"spec"}))


def delete(conn: DbConn, generation_id: int) -> bool:
    return conn.execute("DELETE FROM trivia_deck_generations WHERE id = %s", (generation_id,)).rowcount == 1


def record_use(conn: DbConn, generation_id: int) -> bool:
    """GEN-9: a generation was started from it."""
    return (
        conn.execute(
            "UPDATE trivia_deck_generations SET use_count = use_count + 1, last_used_at = now() WHERE id = %s",
            (generation_id,),
        ).rowcount
        == 1
    )


def add_accepted(conn: DbConn, generation_id: int, cards: int) -> bool:
    """GEN-9: cards generated from it were added to a deck."""
    return (
        conn.execute(
            "UPDATE trivia_deck_generations SET cards_accepted = cards_accepted + %s WHERE id = %s",
            (cards, generation_id),
        ).rowcount
        == 1
    )


def drop_category(conn: DbConn, category_id: int) -> int:
    """GEN-10: a deleted category leaves every saved generation that gave it a share."""
    return conn.execute(
        """
        UPDATE trivia_deck_generations
        SET spec = jsonb_set(spec, '{categories}', (
                SELECT coalesce(jsonb_agg(share), '[]'::jsonb)
                FROM jsonb_array_elements(spec -> 'categories') share
                WHERE (share ->> 'category_id')::bigint <> %(id)s)),
            updated_at = now()
        WHERE spec -> 'categories' @> jsonb_build_array(jsonb_build_object('category_id', %(id)s::bigint))
        """,
        {"id": category_id},
    ).rowcount
