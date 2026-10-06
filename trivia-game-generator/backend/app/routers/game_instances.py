"""Saved games: named snapshots of a running game's play state (rules.md §2.7, SAV-*)."""

import json

from fastapi import APIRouter, HTTPException, Response, status

from ..auth import Conn, CurrentUser, Me
from ..db import DbConn
from ..formats import EngineState
from ..models import Game, GameInstance, GameInstanceChanges, NewGameInstance
from ..permissions import conflict, not_found, visible
from ..repositories import game_instances, games
from ..schemas import (
    GameInstanceCreate,
    GameInstanceDetailOut,
    GameInstanceOut,
    GameInstanceUpdate,
)

router = APIRouter(prefix="/api/games/{game_id}/instances", tags=["saved games"])

# A state holds the snapshot's board and cards plus the log: a few hundred KB for big decks
MAX_STATE_BYTES = 2_000_000


def _visible_game(me: CurrentUser, conn: DbConn, game_id: int) -> Game:
    return visible(me, games.get(conn, game_id), "Game")


def _visible_instance(me: CurrentUser, conn: DbConn, game_id: int, instance_id: int) -> tuple[Game, GameInstance]:
    game = _visible_game(me, conn, game_id)
    instance = game_instances.get(conn, instance_id)
    if instance is None or instance.game_id != game_id:
        raise not_found("Saved game not found")
    return game, instance


def _detail(conn: DbConn, instance_id: int) -> GameInstanceDetailOut:
    instance = game_instances.get(conn, instance_id)
    if instance is None:
        raise not_found("Saved game not found")
    return GameInstanceDetailOut(**instance.model_dump())


def _check_state(conn: DbConn, game: Game, state: EngineState) -> None:
    """SAV-4: only running games, and the state's players must be the game's players."""
    if game.status != "running":
        raise conflict("Only a running game can be saved")
    expected = [p.name for p in games.list_players(conn, game.id)]
    if [p.name for p in state.players] != expected:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=["The saved players don't match this game's players"])
    if len(json.dumps(state.model_dump(mode="json"))) > MAX_STATE_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, detail="The saved state is too large")


@router.get("", response_model=list[GameInstanceOut])
def list_instances(game_id: int, me: Me, conn: Conn):
    _visible_game(me, conn, game_id)
    return [GameInstanceOut(**i.model_dump()) for i in game_instances.list_for_game(conn, game_id)]


@router.post("", response_model=GameInstanceDetailOut, status_code=status.HTTP_201_CREATED)
def create_instance(game_id: int, body: GameInstanceCreate, me: Me, conn: Conn):
    game = _visible_game(me, conn, game_id)
    _check_state(conn, game, body.state)
    with conn.transaction():
        instance_id = game_instances.create(conn, NewGameInstance(game_id=game_id, name=body.name, state=body.state, saved_by_id=me.id))
    return _detail(conn, instance_id)


@router.get("/{instance_id}", response_model=GameInstanceDetailOut)
def get_instance(game_id: int, instance_id: int, me: Me, conn: Conn):
    _, instance = _visible_instance(me, conn, game_id, instance_id)
    return GameInstanceDetailOut(**instance.model_dump())


@router.patch("/{instance_id}", response_model=GameInstanceDetailOut)
def update_instance(game_id: int, instance_id: int, body: GameInstanceUpdate, me: Me, conn: Conn):
    """Overwrite a save with the current state, and/or rename it."""
    game, _ = _visible_instance(me, conn, game_id, instance_id)
    changes = GameInstanceChanges()
    if body.name is not None:
        changes.name = body.name
    if body.state is not None:
        _check_state(conn, game, body.state)
        changes.state = body.state
        changes.saved_by_id = me.id
    with conn.transaction():
        game_instances.update(conn, instance_id, changes)
    return _detail(conn, instance_id)


@router.delete("/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_instance(game_id: int, instance_id: int, me: Me, conn: Conn):
    _visible_instance(me, conn, game_id, instance_id)
    with conn.transaction():
        game_instances.delete(conn, instance_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
