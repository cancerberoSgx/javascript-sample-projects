"""Pure-SQL data access for the public Library (rules.md §2.8, SHR-*): publishing, and reading
other organizations' public boards, decks, categories and images. Copies are written with the
ordinary repositories (boards, decks, categories, images)."""

from typing import Literal, LiteralString

from psycopg import sql
from psycopg.rows import class_row, scalar_row

from ..db import DbConn
from ..models import Board, Card, Category, Deck, Image, Visibility
from . import boards, categories, decks, images

Table = Literal["trivia_boards", "trivia_decks", "trivia_categories", "trivia_images"]


class PublicBoard(Board):
    organization_name: str  # joined


class PublicDeck(Deck):
    organization_name: str


class PublicCategory(Category):
    organization_name: str


class PublicImage(Image):
    organization_name: str


def set_visibility(conn: DbConn, table: Table, item_id: int, visibility: Visibility) -> bool:
    """SHR-1: publishing stamps published_at (kept when it's already public); unpublishing clears it."""
    query = sql.SQL(
        """
        UPDATE {} SET visibility = %(v)s, updated_at = now(),
               published_at = CASE WHEN %(v)s = 'public' THEN coalesce(published_at, now()) END
        WHERE id = %(id)s
        """
    ).format(sql.Identifier(table))
    return conn.execute(query, {"v": visibility, "id": item_id}).rowcount == 1


def _public(select: LiteralString, q: str | None, item_id: int | None, searchable: LiteralString) -> tuple[LiteralString, dict[str, object]]:
    """The public rows of one table (`select` is its repository's SELECT), with the publisher's
    name: newest first, optionally searched by name, description or publisher."""
    query: LiteralString = (
        "SELECT x.*, o.name AS organization_name FROM (" + select + ") x"
        " JOIN trivia_organizations o ON o.id = x.organization_id WHERE x.visibility = 'public'"
    )
    params: dict[str, object] = {}
    if item_id is not None:
        query += " AND x.id = %(id)s"
        params["id"] = item_id
    if q:
        query += " AND (o.name ILIKE %(q)s OR " + searchable + ")"
        params["q"] = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    query += " ORDER BY x.published_at DESC, x.id DESC LIMIT 500"
    return query, params


_TEXT: LiteralString = "x.name ILIKE %(q)s OR x.description ILIKE %(q)s"


def list_boards(conn: DbConn, q: str | None = None) -> list[PublicBoard]:
    query, params = _public(boards._SELECT, q, None, _TEXT)
    return conn.cursor(row_factory=class_row(PublicBoard)).execute(query, params).fetchall()


def get_board(conn: DbConn, board_id: int) -> PublicBoard | None:
    query, params = _public(boards._SELECT, None, board_id, _TEXT)
    return conn.cursor(row_factory=class_row(PublicBoard)).execute(query, params).fetchone()


def list_decks(conn: DbConn, q: str | None = None) -> list[PublicDeck]:
    query, params = _public(decks._SELECT, q, None, _TEXT)
    return conn.cursor(row_factory=class_row(PublicDeck)).execute(query, params).fetchall()


def get_deck(conn: DbConn, deck_id: int) -> PublicDeck | None:
    query, params = _public(decks._SELECT, None, deck_id, _TEXT)
    return conn.cursor(row_factory=class_row(PublicDeck)).execute(query, params).fetchone()


def list_categories(conn: DbConn, q: str | None = None) -> list[PublicCategory]:
    query, params = _public(categories._SELECT, q, None, _TEXT)
    return conn.cursor(row_factory=class_row(PublicCategory)).execute(query, params).fetchall()


def get_category(conn: DbConn, category_id: int) -> PublicCategory | None:
    query, params = _public(categories._SELECT, None, category_id, _TEXT)
    return conn.cursor(row_factory=class_row(PublicCategory)).execute(query, params).fetchone()


def list_images(conn: DbConn, q: str | None = None) -> list[PublicImage]:
    query, params = _public(images._SELECT, q, None, "x.name ILIKE %(q)s")
    return conn.cursor(row_factory=class_row(PublicImage)).execute(query, params).fetchall()


def get_image(conn: DbConn, image_id: int) -> PublicImage | None:
    query, params = _public(images._SELECT, None, image_id, "x.name ILIKE %(q)s")
    return conn.cursor(row_factory=class_row(PublicImage)).execute(query, params).fetchone()


def deck_categories(conn: DbConn, deck_id: int) -> list[Category]:
    """The categories a deck's cards use (they come along when the deck is shown or copied, SHR-5),
    public or not: publishing a deck publishes what its cards need."""
    query = categories._SELECT + " WHERE c.id IN (SELECT category_id FROM trivia_cards WHERE deck_id = %s) ORDER BY lower(c.name)"
    return conn.cursor(row_factory=class_row(Category)).execute(query, (deck_id,)).fetchall()


def cards(conn: DbConn, deck_id: int) -> list[Card]:
    return decks.list_cards(conn, deck_id)


def names_in_org(conn: DbConn, table: Table, organization_id: int) -> set[str]:
    """Lowercased names already taken in an organization (boards, decks and categories are unique by name)."""
    query = sql.SQL("SELECT lower(name) FROM {} WHERE organization_id = %s").format(sql.Identifier(table))
    return set(conn.cursor(row_factory=scalar_row).execute(query, (organization_id,)).fetchall())
