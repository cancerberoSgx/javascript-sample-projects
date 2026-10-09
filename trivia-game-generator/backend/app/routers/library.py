"""The public Library (rules.md §2.8, SHR-*): publishing boards, decks, categories and images, and
browsing and copying what other organizations published.

Public items are never used across organizations directly. Copying makes an independent item in
the caller's organization (SHR-3), so every other endpoint keeps its "own organization only" rules.
"""

from typing import Literal

from fastapi import APIRouter, HTTPException, status
from psycopg import errors

from ..auth import Conn, CurrentUser, Me
from ..db import DbConn
from ..generation import Deduper
from ..models import (
    Card,
    Category,
    CopiedFrom,
    Deck,
    NewBoard,
    NewCard,
    NewCategory,
    NewDeck,
    NewDeckGeneration,
    NewImage,
)
from ..permissions import conflict, not_found, target_org, visible
from ..repositories import boards, categories, deck_generations, decks, images, library
from ..schemas import (
    BoardOut,
    CardOut,
    CardsCopyIn,
    CardsCopyOut,
    CategoryOut,
    CopyIn,
    DeckCopyOut,
    DeckOut,
    ImageOut,
    LibraryBoardOut,
    LibraryCardCategory,
    LibraryCategoryOut,
    LibraryDeckDetailOut,
    LibraryDeckGeneration,
    LibraryDeckOut,
    LibraryImageOut,
    VisibilityIn,
)
from ..storage import MEDIA_URL
from ..transfer import CategoryMatcher, new_name
from ..validation import validate_board
from . import boards as boards_router
from . import categories as categories_router
from . import decks as decks_router
from . import images as images_router

router = APIRouter(tags=["library"])

Kind = Literal["boards", "decks", "categories", "images"]


def _invalid(message: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=[message])


# ---------- publishing (SHR-1, SHR-2) ----------


@router.put("/api/{kind}/{item_id}/visibility", response_model=BoardOut | DeckOut | CategoryOut | ImageOut)
def set_visibility(kind: Kind, item_id: int, body: VisibilityIn, me: Me, conn: Conn):
    """Public items are listed in the Library for every organization; private ones only in their own.
    Unpublishing hides it from the Library. Copies already made stay (SHR-3). Who may: like editing
    the item (its organization's users, and root, who can also unpublish anything for moderation)."""
    table: library.Table
    match kind:
        case "boards":
            board = visible(me, boards.get(conn, item_id), "Board")
            if body.visibility == "public" and any(i.severity == "error" for i in validate_board(board.definition)):
                raise _invalid("Fix the board's errors before publishing it (SHR-2). Drafts can't be public.")
            table, out = "trivia_boards", lambda: boards_router._out(boards.get(conn, item_id))
        case "decks":
            deck = visible(me, decks.get(conn, item_id), "Deck")
            if body.visibility == "public" and not deck.card_count:
                raise _invalid("Add cards to the deck before publishing it (SHR-2).")
            table, out = "trivia_decks", lambda: decks_router._out(decks.get(conn, item_id))
        case "categories":
            visible(me, categories.get(conn, item_id), "Category")
            table, out = "trivia_categories", lambda: categories_router._out(categories.get(conn, item_id))
        case "images":
            visible(me, images.get(conn, item_id), "Image")
            table, out = "trivia_images", lambda: images_router._out(images.get(conn, item_id))
    with conn.transaction():
        library.set_visibility(conn, table, item_id, body.visibility)
    return out()


# ---------- browsing (SHR-2) ----------
# Any logged-in user sees every organization's public items, their own included.


def _board_out(board: library.PublicBoard | None) -> LibraryBoardOut:
    if board is None:
        raise not_found("Board not found in the Library")
    return LibraryBoardOut(**board.model_dump(exclude={"definition"}), definition=board.definition, issues=validate_board(board.definition))


def _deck_out(deck: library.PublicDeck) -> LibraryDeckOut:
    return LibraryDeckOut(**deck.model_dump())


def _image_out(image: library.PublicImage) -> LibraryImageOut:
    return LibraryImageOut(**image.model_dump(include=set(LibraryImageOut.model_fields)), url=f"{MEDIA_URL}/{image.key}")


@router.get("/api/library/boards", response_model=list[LibraryBoardOut])
def list_public_boards(_: Me, conn: Conn, q: str | None = None):
    return [_board_out(b) for b in library.list_boards(conn, q)]


@router.get("/api/library/boards/{board_id}", response_model=LibraryBoardOut)
def get_public_board(board_id: int, _: Me, conn: Conn):
    return _board_out(library.get_board(conn, board_id))


@router.get("/api/library/decks", response_model=list[LibraryDeckOut])
def list_public_decks(_: Me, conn: Conn, q: str | None = None):
    return [_deck_out(d) for d in library.list_decks(conn, q)]


def _public_deck(conn: DbConn, deck_id: int) -> library.PublicDeck:
    deck = library.get_deck(conn, deck_id)
    if deck is None:
        raise not_found("Deck not found in the Library")
    return deck


@router.get("/api/library/decks/{deck_id}", response_model=LibraryDeckDetailOut)
def get_public_deck(deck_id: int, _: Me, conn: Conn):
    """The deck with its cards and the categories they use (whether or not those are public themselves)."""
    deck = _public_deck(conn, deck_id)
    return LibraryDeckDetailOut(
        **deck.model_dump(),
        categories=[LibraryCardCategory(**c.model_dump(include={"id", "name", "description", "color"})) for c in library.deck_categories(conn, deck_id)],
        cards=[CardOut(**c.model_dump()) for c in library.cards(conn, deck_id)],
        generations=[LibraryDeckGeneration(**g.model_dump()) for g in deck_generations.list_for_deck(conn, deck_id)],
    )


@router.get("/api/library/categories", response_model=list[LibraryCategoryOut])
def list_public_categories(_: Me, conn: Conn, q: str | None = None):
    return [LibraryCategoryOut(**c.model_dump()) for c in library.list_categories(conn, q)]


@router.get("/api/library/images", response_model=list[LibraryImageOut])
def list_public_images(_: Me, conn: Conn, q: str | None = None):
    return [_image_out(i) for i in library.list_images(conn, q)]


# ---------- copying (SHR-3 … SHR-7) ----------


def _copy_name(conn: DbConn, table: library.Table, org_id: int, original: str, requested: str | None) -> str:
    return new_name(conn, table, org_id, original, requested, "copy")


def _origin(item_id: int, name: str, organization_name: str) -> CopiedFrom:
    return CopiedFrom(id=item_id, name=name, organization_name=organization_name)


class _CategoryMatcher(CategoryMatcher):
    """SHR-5: the original's categories, matched by name or created (remembering where they came from)."""

    def __init__(self, conn: DbConn, org_id: int, organization_name: str):
        super().__init__(conn, org_id)
        self.organization_name = organization_name

    def source(self, c: Category) -> int:
        return self.target(c.id, c.name, c.description, c.color, _origin(c.id, c.name, self.organization_name))


def _copy_card(card: Card, deck_id: int, category_id: int) -> NewCard:
    return NewCard(
        deck_id=deck_id,
        category_id=category_id,
        question=card.question,
        options=card.options,
        answer=card.answer,
        difficulty=card.difficulty,
        grand_prize=card.grand_prize,
    )


def _ensure_image(conn: DbConn, me: CurrentUser, source_org: int, key: str, org_id: int, organization_name: str) -> bool:
    """SHR-7: puts the original's image file into the target library (a new row, the same file).
    False if the original's library no longer has it."""
    images_router.lock_key(conn, key)  # a concurrent delete of the last row mustn't remove the file meanwhile
    if images.exists(conn, org_id, key):
        return True
    source = images.get_by_key(conn, source_org, key)
    if source is None:
        return False
    images.create(
        conn,
        NewImage(
            organization_id=org_id,
            key=key,
            name=source.name,
            source_url=None,
            content_type=source.content_type,
            width=source.width,
            height=source.height,
            bytes=source.bytes,
            creator_id=me.id,
            copied_from=_origin(source.id, source.name, organization_name),
        ),
    )
    return True


@router.post("/api/library/boards/{board_id}/copy", response_model=BoardOut, status_code=status.HTTP_201_CREATED)
def copy_board(board_id: int, body: CopyIn, me: Me, conn: Conn):
    """SHR-7: the board with its background; the background's image is added to the target library."""
    original = library.get_board(conn, board_id)
    if original is None:
        raise not_found("Board not found in the Library")
    org_id = target_org(me, body.organization_id)
    definition = original.definition
    try:
        with conn.transaction():
            name = _copy_name(conn, "trivia_boards", org_id, original.name, body.name)
            bg = definition.background
            if bg and bg.image and not _ensure_image(conn, me, original.organization_id, bg.image, org_id, original.organization_name):
                definition = definition.model_copy(update={"background": bg.model_copy(update={"image": None})})
            new_id = boards.create(
                conn,
                NewBoard(
                    organization_id=org_id,
                    name=name,
                    description=original.description,
                    definition=definition,
                    copied_from=_origin(original.id, original.name, original.organization_name),
                ),
            )
    except errors.UniqueViolation:
        raise conflict("That name was just taken. Try again.")
    except errors.ForeignKeyViolation:
        raise not_found("Organization not found")
    return boards_router._out(boards.get(conn, new_id))


@router.post("/api/library/decks/{deck_id}/copy", response_model=DeckCopyOut, status_code=status.HTTP_201_CREATED)
def copy_deck(deck_id: int, body: CopyIn, me: Me, conn: Conn):
    """SHR-5: the deck and all its cards. Its categories are matched by name or created."""
    original = _public_deck(conn, deck_id)
    org_id = target_org(me, body.organization_id)
    source_categories = {c.id: c for c in library.deck_categories(conn, deck_id)}
    try:
        with conn.transaction():
            name = _copy_name(conn, "trivia_decks", org_id, original.name, body.name)
            new_id = decks.create(
                conn,
                NewDeck(
                    organization_id=org_id,
                    name=name,
                    description=original.description,
                    copied_from=_origin(original.id, original.name, original.organization_name),
                ),
            )
            matcher = _CategoryMatcher(conn, org_id, original.organization_name)
            for card in library.cards(conn, deck_id):
                decks.create_card(conn, _copy_card(card, new_id, matcher.source(source_categories[card.category_id])))
            saved = deck_generations.list_for_deck(conn, deck_id)
            for g in saved:  # GEN-8: its saved generations, with the copy's categories
                spec = g.spec.model_copy(
                    update={"categories": [share.model_copy(update={"category_id": matcher.source(source_categories[share.category_id])}) for share in g.spec.categories]}
                )
                deck_generations.create(
                    conn,
                    NewDeckGeneration(deck_id=new_id, name=g.name, description=g.description, provider=g.provider, spec=spec, creator_id=me.id),
                )
    except errors.UniqueViolation:
        raise conflict("That name was just taken. Try again.")
    except errors.ForeignKeyViolation:
        raise not_found("Organization not found")
    return DeckCopyOut(
        deck=decks_router._out(decks.get(conn, new_id)),
        categories_created=matcher.created,
        categories_matched=matcher.matched,
        generations_copied=len(saved),
    )


@router.post("/api/library/decks/{deck_id}/cards/copy", response_model=CardsCopyOut)
def copy_cards(deck_id: int, body: CardsCopyIn, me: Me, conn: Conn):
    """SHR-6: chosen cards of a public deck, added to one of the caller's decks. Cards that repeat
    the deck (as in GEN-3) are skipped. Their categories are matched by name or created (SHR-5)."""
    original = _public_deck(conn, deck_id)
    target: Deck = visible(me, decks.get(conn, body.deck_id), "Deck")
    by_id = {c.id: c for c in library.cards(conn, deck_id)}
    if missing := [i for i in body.card_ids if i not in by_id]:
        raise not_found(f"Card {missing[0]} isn't in this deck")
    source_categories = {c.id: c for c in library.deck_categories(conn, deck_id)}
    seen = Deduper()
    for card in decks.list_cards(conn, target.id):
        seen.add(card.question, card.answer)
    skipped: list[str] = []
    added = 0
    with conn.transaction():
        matcher = _CategoryMatcher(conn, target.organization_id, original.organization_name)
        for card_id in dict.fromkeys(body.card_ids):  # in the order given, once each
            card = by_id[card_id]
            if not seen.add_new(card.question, card.answer):
                skipped.append(card.question)
                continue
            decks.create_card(conn, _copy_card(card, target.id, matcher.source(source_categories[card.category_id])))
            added += 1
    return CardsCopyOut(added=added, skipped_duplicates=skipped, categories_created=matcher.created)


@router.post("/api/library/categories/{category_id}/copy", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def copy_category(category_id: int, body: CopyIn, me: Me, conn: Conn):
    """Name, description and color. Categories are matched by name elsewhere (SHR-5), so a name the
    organization already has is a conflict rather than a "(copy)"."""
    original = library.get_category(conn, category_id)
    if original is None:
        raise not_found("Category not found in the Library")
    org_id = target_org(me, body.organization_id)
    name = body.name or original.name
    try:
        with conn.transaction():
            new_id = categories.create(
                conn,
                NewCategory(
                    organization_id=org_id,
                    name=name,
                    description=original.description,
                    color=original.color,
                    copied_from=_origin(original.id, original.name, original.organization_name),
                ),
            )
    except errors.UniqueViolation:
        raise conflict(f"This organization already has a category named '{name}'.")
    except errors.ForeignKeyViolation:
        raise not_found("Organization not found")
    return categories_router._out(categories.get(conn, new_id))


@router.post("/api/library/images/{image_id}/copy", response_model=ImageOut, status_code=status.HTTP_201_CREATED)
def copy_image(image_id: int, body: CopyIn, me: Me, conn: Conn):
    """The same file, added to the target library. If the library already has it, that image is returned."""
    original = library.get_image(conn, image_id)
    if original is None:
        raise not_found("Image not found in the Library")
    org_id = target_org(me, body.organization_id)
    try:
        with conn.transaction():
            images_router.lock_key(conn, original.key)
            new_id = images.create(
                conn,
                NewImage(
                    organization_id=org_id,
                    key=original.key,
                    name=body.name or original.name,
                    source_url=None,
                    content_type=original.content_type,
                    width=original.width,
                    height=original.height,
                    bytes=original.bytes,
                    creator_id=me.id,
                    copied_from=_origin(original.id, original.name, original.organization_name),
                ),
            )
    except errors.ForeignKeyViolation:
        raise not_found("Organization not found")
    return images_router._out(images.get(conn, new_id))
