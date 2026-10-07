from typing import Annotated

from fastapi import APIRouter, Query, Response, status
from fastapi.exceptions import RequestValidationError
from psycopg import errors
from pydantic import ValidationError

from ..auth import Conn, CurrentUser, Me
from ..db import DbConn
from ..formats import DeckFile
from ..models import Card, CardChanges, Deck, DeckChanges, NewCard, NewDeck
from ..permissions import conflict, list_org, not_found, target_org, visible
from ..repositories import categories, decks
from ..schemas import (
    CardIn,
    CardOut,
    CardUpdate,
    DeckCreate,
    DeckDetailOut,
    DeckImportOut,
    DeckOut,
    DeckUpdate,
)
from ..transfer import (
    CategoryMatcher,
    checked_cards,
    create_deck_from_file,
    deck_file,
    file_name,
    new_name,
)

router = APIRouter(prefix="/api/decks", tags=["decks"])


def _out(deck: Deck | None) -> DeckOut:
    if deck is None:
        raise not_found("Deck not found")
    return DeckOut(**deck.model_dump())


def _card_out(card: Card | None) -> CardOut:
    if card is None:
        raise not_found("Card not found")
    return CardOut(**card.model_dump())


def _visible_deck(me: CurrentUser, conn: DbConn, deck_id: int) -> Deck:
    return visible(me, decks.get(conn, deck_id), "Deck")


def _check_category(conn: DbConn, deck: Deck, category_id: int) -> None:
    category = categories.get(conn, category_id)
    if category is None or category.organization_id != deck.organization_id:
        raise not_found("Category not found in this deck's organization")


@router.get("", response_model=list[DeckOut])
def list_decks(me: Me, conn: Conn, organization_id: int | None = None):
    return [_out(d) for d in decks.list_for_org(conn, list_org(me, organization_id))]


@router.post("", response_model=DeckOut, status_code=status.HTTP_201_CREATED)
def create_deck(body: DeckCreate, me: Me, conn: Conn):
    org_id = target_org(me, body.organization_id)
    try:
        with conn.transaction():
            new_id = decks.create(conn, NewDeck(organization_id=org_id, name=body.name, description=body.description))
    except errors.UniqueViolation:
        raise conflict(f"A deck named '{body.name}' already exists")
    except errors.ForeignKeyViolation:
        raise not_found("Organization not found")
    return _out(decks.get(conn, new_id))


@router.post("/import", response_model=DeckImportOut, status_code=status.HTTP_201_CREATED)
def import_deck(
    file: DeckFile,
    me: Me,
    conn: Conn,
    organization_id: int | None = None,
    name: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
):
    """SER-8: a new deck from a deck file (the body). Its categories are matched by name or created.
    `name` overrides the file's; the file's name gets " (imported)" when the organization has it."""
    org_id = target_org(me, organization_id)
    cards = checked_cards(file)
    try:
        with conn.transaction():
            deck_name = new_name(conn, "trivia_decks", org_id, file.name, name and name.strip(), "imported")
            matcher = CategoryMatcher(conn, org_id)
            new_id = create_deck_from_file(conn, org_id, file, deck_name, cards, matcher)
    except errors.UniqueViolation:
        raise conflict("That name was just taken. Try again.")
    except errors.ForeignKeyViolation:
        raise not_found("Organization not found")
    return DeckImportOut(deck=_out(decks.get(conn, new_id)), categories_created=matcher.created, categories_matched=matcher.matched)


@router.get("/{deck_id}/export", response_model=DeckFile)
def export_deck(deck_id: int, me: Me, conn: Conn, response: Response):
    """SER-7: the deck as a deck file, with the categories its cards use."""
    deck = _visible_deck(me, conn, deck_id)
    response.headers["Content-Disposition"] = f'attachment; filename="{file_name(deck.name, "deck")}"'
    return deck_file(conn, deck)


@router.get("/{deck_id}", response_model=DeckDetailOut)
def get_deck(deck_id: int, me: Me, conn: Conn):
    deck = _visible_deck(me, conn, deck_id)
    return DeckDetailOut(**deck.model_dump(), cards=[_card_out(c) for c in decks.list_cards(conn, deck_id)])


@router.patch("/{deck_id}", response_model=DeckOut)
def update_deck(deck_id: int, body: DeckUpdate, me: Me, conn: Conn):
    _visible_deck(me, conn, deck_id)
    try:
        with conn.transaction():
            decks.update(conn, deck_id, DeckChanges(**body.model_dump(exclude_unset=True, exclude_none=True)))
    except errors.UniqueViolation:
        raise conflict(f"A deck named '{body.name}' already exists")
    return _out(decks.get(conn, deck_id))


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(deck_id: int, me: Me, conn: Conn):
    deck = _visible_deck(me, conn, deck_id)
    if n := decks.count_pending_games_using(conn, deck_id):
        raise conflict(f"'{deck.name}' is used by {n} game(s) that haven't started yet.")
    with conn.transaction():
        decks.delete(conn, deck_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- cards ----------


@router.post("/{deck_id}/cards", response_model=CardOut, status_code=status.HTTP_201_CREATED)
def create_card(deck_id: int, body: CardIn, me: Me, conn: Conn):
    deck = _visible_deck(me, conn, deck_id)
    _check_category(conn, deck, body.category_id)
    with conn.transaction():
        card_id = decks.create_card(conn, NewCard(deck_id=deck_id, **body.model_dump()))
    return _card_out(decks.get_card(conn, card_id))


def _visible_card(me: CurrentUser, conn: DbConn, deck_id: int, card_id: int) -> tuple[Deck, Card]:
    deck = _visible_deck(me, conn, deck_id)
    card = decks.get_card(conn, card_id)
    if card is None or card.deck_id != deck_id:
        raise not_found("Card not found")
    return deck, card


@router.patch("/{deck_id}/cards/{card_id}", response_model=CardOut)
def update_card(deck_id: int, card_id: int, body: CardUpdate, me: Me, conn: Conn):
    deck, card = _visible_card(me, conn, deck_id, card_id)
    sent = body.model_dump(exclude_unset=True)
    # Validate the card as it will be after the change (e.g. answer still one of the options)
    try:
        merged = CardIn(**{**card.model_dump(include=set(CardIn.model_fields)), **{k: v for k, v in sent.items() if v is not None or k == "options"}})
    except ValidationError as e:
        raise RequestValidationError(e.errors())
    if "category_id" in sent:
        _check_category(conn, deck, merged.category_id)
    changes = CardChanges(**{k: getattr(merged, k) for k in sent})
    with conn.transaction():
        decks.update_card(conn, card_id, changes)
    return _card_out(decks.get_card(conn, card_id))


@router.delete("/{deck_id}/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(deck_id: int, card_id: int, me: Me, conn: Conn):
    _visible_card(me, conn, deck_id, card_id)
    with conn.transaction():
        decks.delete_card(conn, card_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
