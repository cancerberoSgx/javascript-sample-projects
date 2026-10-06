from fastapi import APIRouter, HTTPException, Response, status
from psycopg import errors

from .. import play
from ..auth import Conn, CurrentUser, Me
from ..db import DbConn
from ..formats import (
    GameSnapshot,
    SnapshotBoard,
    SnapshotCard,
    SnapshotCategory,
    SnapshotDeck,
)
from ..live import hub
from ..models import Game, GameChanges, NewGame, Player
from ..permissions import conflict, list_org, not_found, target_org, visible
from ..repositories import boards, categories, decks, game_states, games
from ..schemas import GameCreate, GameDetailOut, GameOut, GameUpdate, PlayerOut
from ..validation import validate_game_setup
from .images import check_background

router = APIRouter(prefix="/api/games", tags=["games"])


def _out(game: Game, mapping: dict[str, int], players: list[Player]) -> GameOut:
    return GameOut(
        **game.model_dump(exclude={"snapshot"}),
        categories=mapping,
        players=[PlayerOut(**p.model_dump(include={"id", "name", "position", "joined", "removed"})) for p in players],
    )


def _detail(conn: DbConn, game: Game | None) -> GameDetailOut:
    if game is None:
        raise not_found("Game not found")
    mapping = games.get_mapping(conn, game.id)
    players = games.list_players(conn, game.id)
    base = _out(game, mapping, players)
    return GameDetailOut(
        **base.model_dump(),
        snapshot=game.snapshot,
        setup_errors=_setup_errors(conn, game, mapping, len(players)) if game.status == "awaiting" else [],
    )


def _setup_errors(conn: DbConn, game: Game, mapping: dict[str, int], player_count: int) -> list[str]:
    board = boards.get(conn, game.board_id) if game.board_id else None
    deck = decks.get(conn, game.deck_id) if game.deck_id else None
    missing = [what for what, item in (("board", board), ("deck", deck)) if item is None]
    if missing:
        return [f"Choose a {' and a '.join(missing)}"] + (["Wait for at least one player to join"] if player_count < 1 else [])
    assert board and deck
    names = {c.id: c.name for c in categories.get_many(conn, list(mapping.values()))}
    cards = [(c.category_id, c.grand_prize) for c in decks.list_cards(conn, deck.id)]
    return validate_game_setup(board.definition, mapping, names, cards, player_count)


def _visible_game(me: CurrentUser, conn: DbConn, game_id: int) -> Game:
    return visible(me, games.get(conn, game_id), "Game")


def _awaiting_game(me: CurrentUser, conn: DbConn, game_id: int) -> Game:
    game = _visible_game(me, conn, game_id)
    if game.status != "awaiting":
        raise conflict("This game has already started, so its setup can't change")
    return game


def _check_refs(conn: DbConn, org_id: int, board_id: int | None, deck_id: int | None, mapping: dict[str, int] | None) -> None:
    """Board, deck and categories must exist and belong to the game's organization."""
    if board_id is not None and ((b := boards.get(conn, board_id)) is None or b.organization_id != org_id):
        raise not_found("Board not found in this organization")
    if deck_id is not None and ((d := decks.get(conn, deck_id)) is None or d.organization_id != org_id):
        raise not_found("Deck not found in this organization")
    if mapping:
        found = categories.get_many(conn, list(set(mapping.values())))
        if len(found) != len(set(mapping.values())) or any(c.organization_id != org_id for c in found):
            raise not_found("Category not found in this organization")
        if len(set(mapping.values())) != len(mapping):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=["Each slot needs a different category"])


@router.get("", response_model=list[GameOut])
def list_games(me: Me, conn: Conn, organization_id: int | None = None):
    rows = games.list_for_org(conn, list_org(me, organization_id))
    ids = [g.id for g in rows]
    mappings = games.get_mappings(conn, ids)
    players = games.list_players_for(conn, ids)
    return [_out(g, mappings[g.id], players[g.id]) for g in rows]


@router.post("", response_model=GameDetailOut, status_code=status.HTTP_201_CREATED)
def create_game(body: GameCreate, me: Me, conn: Conn):
    org_id = target_org(me, body.organization_id)
    _check_refs(conn, org_id, body.board_id, body.deck_id, body.categories)
    try:
        with conn.transaction():
            game_id = games.create(
                conn, NewGame(organization_id=org_id, name=body.name, creator_id=me.id, board_id=body.board_id, deck_id=body.deck_id)
            )
            games.replace_mapping(conn, game_id, body.categories)
            games.replace_players(conn, game_id, [p.name for p in body.players])
    except errors.ForeignKeyViolation:
        raise not_found("Organization not found")
    except errors.UniqueViolation:
        raise conflict("Player names must be unique (MPL-3)")
    return _detail(conn, games.get(conn, game_id))


@router.get("/{game_id}", response_model=GameDetailOut)
def get_game(game_id: int, me: Me, conn: Conn):
    return _detail(conn, _visible_game(me, conn, game_id))


@router.patch("/{game_id}", response_model=GameDetailOut)
def update_game(game_id: int, body: GameUpdate, me: Me, conn: Conn):
    game = _awaiting_game(me, conn, game_id)
    sent = body.model_fields_set
    _check_refs(conn, game.organization_id, body.board_id, body.deck_id, body.categories)
    check_background(conn, game.organization_id, body.background)
    # name: null is ignored; board_id/deck_id: null clears the reference; background: null = the board's (BKG-5)
    changes = GameChanges(**{k: getattr(body, k) for k in ("name", "board_id", "deck_id", "background") if k in sent and (k != "name" or body.name)})
    with conn.transaction():
        games.update(conn, game_id, changes)
        if body.categories is not None:
            games.replace_mapping(conn, game_id, body.categories)
    hub.publish_soon(game_id)
    return _detail(conn, games.get(conn, game_id))


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_game(game_id: int, me: Me, conn: Conn):
    _visible_game(me, conn, game_id)
    with conn.transaction():
        games.delete(conn, game_id)
    hub.publish_soon(game_id)  # tells everyone watching that it's gone
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{game_id}/start", response_model=GameDetailOut)
def start_game(game_id: int, me: Me, conn: Conn):
    """awaiting -> running. Copies board, deck and categories into the game's snapshot (GAM-3)
    and deals the opening state to the players who joined (MPL-2)."""
    game = _visible_game(me, conn, game_id)
    if game.status != "awaiting":
        raise conflict("This game has already started")
    with conn.transaction():
        games.lock(conn, game_id)  # no one joins between reading the players and starting
        mapping = games.get_mapping(conn, game_id)
        players = games.list_players(conn, game_id)
        if setup_errors := _setup_errors(conn, game, mapping, len(players)):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=setup_errors)
        snapshot = _snapshot(conn, game, mapping)
        if not games.mark_started(conn, game_id, snapshot):
            raise conflict("This game has already started")
        game_states.create(conn, game_id, play.initial_state(snapshot, players))
    hub.publish_soon(game_id)
    return _detail(conn, games.get(conn, game_id))


@router.post("/{game_id}/finish", response_model=GameDetailOut)
def finish_game(game_id: int, me: Me, conn: Conn):
    """running -> finished, before anyone won: ends the game for everyone."""
    _visible_game(me, conn, game_id)
    with conn.transaction():
        games.lock(conn, game_id)
        if not games.mark_finished(conn, game_id):
            raise conflict("Only a running game can be finished")
    hub.publish_soon(game_id)
    return _detail(conn, games.get(conn, game_id))


def _snapshot(conn: DbConn, game: Game, mapping: dict[str, int]) -> GameSnapshot:
    assert game.board_id and game.deck_id  # checked by _setup_errors
    board = boards.get(conn, game.board_id)
    deck = decks.get(conn, game.deck_id)
    assert board and deck
    cards = decks.list_cards(conn, deck.id)
    used = categories.get_many(conn, sorted({c.category_id for c in cards} | set(mapping.values())))
    # BKG-6: the background the game shows (its own, else the board's) is frozen with the board
    background = game.background if game.background is not None else board.definition.background
    return GameSnapshot(
        board=SnapshotBoard(
            name=board.name,
            description=board.description,
            **board.definition.model_dump(exclude_unset=True, exclude={"background"}),
            background=background if background and (background.image or background.color) else None,
        ),
        deck=SnapshotDeck(
            name=deck.name,
            description=deck.description,
            categories=[SnapshotCategory(id=str(c.id), name=c.name, description=c.description, color=c.color) for c in used],
            cards=[
                SnapshotCard(
                    id=str(c.id),
                    category=str(c.category_id),
                    question=c.question,
                    options=c.options,
                    answer=c.answer,
                    difficulty=c.difficulty,
                    grand_prize=c.grand_prize,
                )
                for c in cards
            ],
        ),
        mapping={slot: str(cid) for slot, cid in mapping.items()},
    )
