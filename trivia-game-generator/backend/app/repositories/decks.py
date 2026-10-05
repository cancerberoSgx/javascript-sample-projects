"""Pure-SQL data access for trivia_decks and their trivia_cards."""

from psycopg.rows import class_row
from psycopg.types.json import Jsonb

from ..db import DbConn, fetch_scalar
from ..models import Card, CardChanges, Deck, DeckChanges, NewCard, NewDeck
from ._sql import update_row

_SELECT = """
    SELECT d.id, d.organization_id, d.name, d.description, d.created_at, d.updated_at,
           (SELECT count(*) FROM trivia_cards k WHERE k.deck_id = d.id) AS card_count
    FROM trivia_decks d
"""
_SELECT_CARD = """
    SELECT id, deck_id, category_id, question, options, answer, difficulty, grand_prize, position, created_at, updated_at
    FROM trivia_cards
"""


def _decks(conn: DbConn):
    return conn.cursor(row_factory=class_row(Deck))


def _cards(conn: DbConn):
    return conn.cursor(row_factory=class_row(Card))


# ---------- decks ----------


def list_for_org(conn: DbConn, organization_id: int) -> list[Deck]:
    return _decks(conn).execute(_SELECT + " WHERE d.organization_id = %s ORDER BY lower(d.name)", (organization_id,)).fetchall()


def get(conn: DbConn, deck_id: int) -> Deck | None:
    return _decks(conn).execute(_SELECT + " WHERE d.id = %s", (deck_id,)).fetchone()


def create(conn: DbConn, deck: NewDeck) -> int:
    return fetch_scalar(
        conn,
        "INSERT INTO trivia_decks (organization_id, name, description) VALUES (%s, %s, %s) RETURNING id",
        (deck.organization_id, deck.name, deck.description),
    )


def update(conn: DbConn, deck_id: int, changes: DeckChanges) -> bool:
    return update_row(conn, "trivia_decks", deck_id, changes)


def count_pending_games_using(conn: DbConn, deck_id: int) -> int:
    return fetch_scalar(conn, "SELECT count(*) FROM trivia_games WHERE deck_id = %s AND status = 'not_started'", (deck_id,))


def delete(conn: DbConn, deck_id: int) -> bool:
    return conn.execute("DELETE FROM trivia_decks WHERE id = %s", (deck_id,)).rowcount == 1


# ---------- cards ----------


def list_cards(conn: DbConn, deck_id: int) -> list[Card]:
    return _cards(conn).execute(_SELECT_CARD + " WHERE deck_id = %s ORDER BY position, id", (deck_id,)).fetchall()


def get_card(conn: DbConn, card_id: int) -> Card | None:
    return _cards(conn).execute(_SELECT_CARD + " WHERE id = %s", (card_id,)).fetchone()


def create_card(conn: DbConn, card: NewCard) -> int:
    """Appends the card at the end of its deck."""
    return fetch_scalar(
        conn,
        """
        INSERT INTO trivia_cards (deck_id, category_id, question, options, answer, difficulty, grand_prize, position)
        VALUES (%s, %s, %s, %s, %s, %s, %s,
                (SELECT coalesce(max(position), -1) + 1 FROM trivia_cards WHERE deck_id = %s))
        RETURNING id
        """,
        (
            card.deck_id,
            card.category_id,
            card.question,
            Jsonb(card.options) if card.options is not None else None,
            card.answer,
            card.difficulty,
            card.grand_prize,
            card.deck_id,
        ),
    )


def update_card(conn: DbConn, card_id: int, changes: CardChanges) -> bool:
    return update_row(conn, "trivia_cards", card_id, changes, json_columns=frozenset({"options"}))


def delete_card(conn: DbConn, card_id: int) -> bool:
    return conn.execute("DELETE FROM trivia_cards WHERE id = %s", (card_id,)).rowcount == 1
