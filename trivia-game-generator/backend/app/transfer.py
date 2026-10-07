"""Moving boards and decks between organizations: as files (export / import, rules.md SER-7 … SER-11)
and through the Library (SHR-4, SHR-5). Both name their new items the same way and match
categories by name the same way."""

import re
from collections.abc import Hashable
from datetime import UTC, datetime

from fastapi import HTTPException, status
from pydantic import ValidationError

from .db import DbConn
from .formats import (
    Background,
    BoardDefinition,
    BoardFile,
    DeckFile,
    DeckFileCard,
    DeckFileCategory,
    OrganizationFile,
)
from .models import (
    Board,
    CopiedFrom,
    Deck,
    NewBoard,
    NewCard,
    NewCategory,
    NewDeck,
    Organization,
)
from .permissions import conflict
from .repositories import boards, categories, decks, images, library
from .schemas import CardIn, OrganizationImportOut


def unique_name(name: str, taken: set[str], label: str = "copy") -> str:
    """SHR-4 / SER-8: the name, or "<name> (copy)", "<name> (copy 2)", … when the organization has it."""
    candidate, n = name, 1
    while candidate.lower() in taken:
        suffix = f" ({label})" if n == 1 else f" ({label} {n})"
        candidate = name[: 200 - len(suffix)] + suffix
        n += 1
    return candidate


def new_name(conn: DbConn, table: library.Table, org_id: int, original: str, requested: str | None, label: str) -> str:
    """A name the user asked for must be free (409); the default name is made free (SHR-4, SER-8)."""
    taken = library.names_in_org(conn, table, org_id)
    if requested:
        if requested.lower() in taken:
            raise conflict(f"'{requested}' is already taken in this organization. Pick another name.")
        return requested
    return unique_name(original, taken, label)


class CategoryMatcher:
    """SHR-5 / SER-8: maps categories from elsewhere (another organization's, or a file's) to the
    target organization's, by name (ignoring case). A category the organization doesn't have is
    created with the given description and color. `key` identifies the source category."""

    def __init__(self, conn: DbConn, org_id: int):
        self.conn, self.org_id = conn, org_id
        self.by_name = {c.name.lower(): c.id for c in categories.list_for_org(conn, org_id)}
        self.ids: dict[Hashable, int] = {}
        self.created: list[str] = []
        self.matched: list[str] = []

    def target(self, key: Hashable, name: str, description: str, color: str, copied_from: CopiedFrom | None = None) -> int:
        if key not in self.ids:
            if (found := self.by_name.get(name.lower())) is not None:
                self.matched.append(name)
            else:
                found = categories.create(
                    self.conn,
                    NewCategory(organization_id=self.org_id, name=name, description=description, color=color, copied_from=copied_from),
                )
                self.by_name[name.lower()] = found
                self.created.append(name)
            self.ids[key] = found
        return self.ids[key]


# ---------- export (SER-7) ----------


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "item"


def file_name(name: str, kind: str) -> str:
    """What the downloaded file is called: "<slug>.<kind>.json", e.g. "general-knowledge.deck.json"."""
    return f"{slug(name)[:80]}.{kind}.json"


def deck_file(conn: DbConn, deck: Deck) -> DeckFile:
    """The deck as a file: its cards in deck order, and the categories they use. Ids become readable
    labels (a category's slug, "<category>-<n>" for cards), so the file is easy to edit by hand."""
    cards = decks.list_cards(conn, deck.id)
    order = list(dict.fromkeys(c.category_id for c in cards))  # in order of first use, so re-exports match
    by_id = {c.id: c for c in categories.get_many(conn, order)}
    used = [by_id[i] for i in order]
    label: dict[int, str] = {}
    for c in used:
        base = candidate = slug(c.name)
        n = 2
        while candidate in label.values():
            candidate, n = f"{base}-{n}", n + 1
        label[c.id] = candidate
    count: dict[int, int] = {}
    file_cards: list[DeckFileCard] = []
    for c in cards:
        count[c.category_id] = count.get(c.category_id, 0) + 1
        file_cards.append(
            DeckFileCard(
                id=f"{label[c.category_id]}-{count[c.category_id]}",
                category=label[c.category_id],
                question=c.question,
                options=c.options,
                answer=c.answer,
                difficulty=c.difficulty,
                grand_prize=c.grand_prize,
            )
        )
    return DeckFile(
        schema_version=2,
        id=slug(deck.name),
        name=deck.name,
        description=deck.description,
        categories=[DeckFileCategory(id=label[c.id], name=c.name, description=c.description, color=c.color) for c in used],
        cards=file_cards,
    )


def board_file(board: Board) -> BoardFile:
    """SER-7: the board with its background settings. The image itself isn't in the file, only its key."""
    return BoardFile(
        schema_version=2,
        id=slug(board.name),
        name=board.name,
        description=board.description,
        **board.definition.model_dump(exclude_unset=True, exclude={"background"}),
        background=board.definition.background,
    )


# ---------- import (SER-8, SER-9) ----------


def _invalid(problems: list[str]) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=problems)


CheckedCards = list[tuple[DeckFileCategory, CardIn]]


def checked_cards(file: DeckFile) -> CheckedCards:
    """SER-9: every card of a deck file, checked like a card added by hand (CRD-*), with its category.
    Raises 422 listing every problem found, each naming its card, so a file can be fixed in one go."""
    cards, problems = deck_problems(file)
    if problems:
        raise invalid_file(problems)
    return cards


def invalid_file(problems: list[str]) -> HTTPException:
    more = len(problems) - 50
    return _invalid(problems[:50] + ([f"… and {more} more problems"] if more > 0 else []))


def deck_problems(file: DeckFile) -> tuple[CheckedCards, list[str]]:
    """The checked cards and every problem found (SER-9)."""
    problems: list[str] = []
    by_id: dict[str, DeckFileCategory] = {}
    names: set[str] = set()
    for c in file.categories:
        if c.id in by_id:
            problems.append(f"categories: the id '{c.id}' is used by more than one category")
        if c.name.strip().lower() in names:
            problems.append(f"categories: the name '{c.name}' appears more than once")
        by_id[c.id] = c
        names.add(c.name.strip().lower())
    result: list[tuple[DeckFileCategory, CardIn]] = []
    for i, card in enumerate(file.cards):
        where = f"cards[{i}]" + (f" ({card.id})" if card.id else "") + f" '{card.question.strip()[:60]}'"
        category = by_id.get(card.category)
        if category is None:
            problems.append(f"{where}: category '{card.category}' isn't one of the file's categories")
        try:
            checked = CardIn(category_id=0, **card.model_dump(exclude={"id", "category"}))
        except ValidationError as e:
            problems += [f"{where}: {_message(err)}" for err in e.errors()]
            continue
        if category is not None:
            result.append((category, checked))
    return result, problems


def create_deck_from_file(
    conn: DbConn, org_id: int, file: DeckFile, name: str, cards: CheckedCards, matcher: CategoryMatcher, scope: Hashable = None
) -> int:
    """SER-8: the deck, all the file's categories (matched or created) and the checked cards. Inside a
    transaction. `scope` tells apart the decks of one organization file, whose category ids may repeat."""
    new_id = decks.create(conn, NewDeck(organization_id=org_id, name=name, description=file.description))
    for c in file.categories:  # all of them, even ones no card uses yet
        matcher.target((scope, c.id), c.name, c.description, c.color)
    for category, card in cards:
        decks.create_card(conn, NewCard(deck_id=new_id, **{**card.model_dump(), "category_id": matcher.ids[(scope, category.id)]}))
    return new_id


def board_definition(conn: DbConn, org_id: int, file: BoardFile) -> tuple[BoardDefinition, bool]:
    """SER-8: what a board file stores, and whether its background image was left out (not in the library)."""
    background = file.background
    has_image = bool(background and background.image and images.exists(conn, org_id, background.image))
    background, missing = without_missing_image(background, has_image)
    data = file.model_dump(mode="json", exclude_unset=True, include={"config", "slots", "spaces"})
    if background:
        data["background"] = background.model_dump(mode="json")
    return BoardDefinition.model_validate(data), missing


def _message(err) -> str:  # pyright: ignore[reportMissingParameterType]
    field = ".".join(str(p) for p in err["loc"])
    msg = str(err["msg"]).removeprefix("Value error, ")
    return f"{field}: {msg}" if field else msg


def without_missing_image(background: Background | None, has_image: bool) -> tuple[Background | None, bool]:
    """SER-8: a file's background keeps its image only if the organization's library has it. The other
    settings stay, ready for the image picked next. Returns the background and whether an image was dropped."""
    if background is None or not background.image or has_image:
        return background, False
    return background.model_copy(update={"image": None}), True


# ---------- whole organizations (SER-10, SER-11) ----------


def organization_file(conn: DbConn, org: Organization) -> OrganizationFile:
    """SER-10: every category, deck (with its cards) and board of the organization."""
    cats = sorted(categories.list_for_org(conn, org.id), key=lambda c: c.name.lower())
    ids: set[str] = set()
    file_categories: list[DeckFileCategory] = []
    for c in cats:
        base = candidate = slug(c.name)
        n = 2
        while candidate in ids:
            candidate, n = f"{base}-{n}", n + 1
        ids.add(candidate)
        file_categories.append(DeckFileCategory(id=candidate, name=c.name, description=c.description, color=c.color))
    return OrganizationFile(
        schema_version=2,
        kind="organization",
        name=org.name,
        exported_at=datetime.now(UTC).isoformat(timespec="seconds"),
        categories=file_categories,
        decks=[deck_file(conn, d) for d in decks.list_for_org(conn, org.id)],
        boards=[board_file(b) for b in boards.list_for_org(conn, org.id)],
    )


def _duplicates(names: list[str]) -> list[str]:
    seen: set[str] = set()
    return [n for n in names if n.lower() in seen or seen.add(n.lower())]


def import_organization(conn: DbConn, org_id: int, file: OrganizationFile) -> OrganizationImportOut:
    """SER-11: adds an organization file's content to the organization, all or nothing. Decks and boards
    whose name the organization already has are skipped, so importing the same file twice adds nothing."""
    problems: list[str] = []
    checked: list[CheckedCards] = []
    for i, deck in enumerate(file.decks):
        cards, deck_issues = deck_problems(deck)
        checked.append(cards)
        problems += [f"decks[{i}] '{deck.name}': {p}" for p in deck_issues]
    problems += [f"decks: the name '{n}' appears more than once" for n in _duplicates([d.name for d in file.decks])]
    problems += [f"boards: the name '{n}' appears more than once" for n in _duplicates([b.name for b in file.boards])]
    if problems:
        raise invalid_file(problems)

    out = OrganizationImportOut(
        decks_created=[], decks_skipped=[], boards_created=[], boards_skipped=[], cards_created=0,
        categories_created=[], categories_matched=[], background_images_missing=[],
    )  # fmt: skip
    with conn.transaction():
        matcher = CategoryMatcher(conn, org_id)
        for c in file.categories:
            matcher.target(("org", c.id), c.name, c.description, c.color)
        deck_names = library.names_in_org(conn, "trivia_decks", org_id)
        for i, (deck, cards) in enumerate(zip(file.decks, checked)):
            if deck.name.lower() in deck_names:
                out.decks_skipped.append(deck.name)
                continue
            create_deck_from_file(conn, org_id, deck, deck.name, cards, matcher, scope=i)
            out.decks_created.append(deck.name)
            out.cards_created += len(cards)
        board_names = library.names_in_org(conn, "trivia_boards", org_id)
        for board in file.boards:
            if board.name.lower() in board_names:
                out.boards_skipped.append(board.name)
                continue
            definition, missing = board_definition(conn, org_id, board)
            boards.create(conn, NewBoard(organization_id=org_id, name=board.name, description=board.description, definition=definition))
            out.boards_created.append(board.name)
            if missing:
                out.background_images_missing.append(board.name)
    # Decks reuse the categories made a moment ago: "matched" only lists ones the organization already had
    created = {n.lower() for n in matcher.created}
    out.categories_created = matcher.created
    out.categories_matched = list({n.lower(): n for n in matcher.matched if n.lower() not in created}.values())
    return out
