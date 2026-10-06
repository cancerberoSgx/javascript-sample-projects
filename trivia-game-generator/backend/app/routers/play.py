"""Multiplayer games (rules.md §2.7, MPL-*): joining with the game's link, the lobby, host
controls, and the WebSocket every device watches the game through."""

import asyncio
import json
from typing import Annotated

from fastapi import (
    APIRouter,
    Header,
    HTTPException,
    Response,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from psycopg import errors
from pydantic import TypeAdapter, ValidationError
from starlette.concurrency import run_in_threadpool

from .. import db, play
from ..auth import Conn, CurrentUser, Me, user_from_token
from ..live import Viewer, hub
from ..permissions import can_access_org, can_watch, check_join, conflict, not_found
from ..repositories import games
from ..schemas import (
    GameDetailOut,
    JoinIn,
    JoinOut,
    PlayerIn,
    PlayerOrderIn,
    PlayerOut,
    SocketAction,
    SocketHello,
)
from .games import _awaiting_game, _detail, _visible_game

router = APIRouter(prefix="/api/games", tags=["multiplayer"])

NAME_TAKEN = "That name is already taken in this game. Pick another one (MPL-3)."
GAME_FULL = f"This game is full ({play.MAX_PLAYERS} players)."


def _add_player(conn: Conn, game_id: int, name: str, token_hash: str | None, code: str | None = None) -> int:
    """MPL-1..3: (with a valid code) only while awaiting, names unique, at most MAX_PLAYERS."""
    try:
        with conn.transaction():
            games.lock(conn, game_id)  # read the status after locking, so a start can't slip in between
            game = games.get(conn, game_id)
            if game is None:
                raise not_found("Game not found")
            if token_hash is not None:
                check_join(game, code)
            elif game.status != "awaiting":
                raise conflict("This game has already started, so its players can't change")
            if games.player_count(conn, game_id) >= play.MAX_PLAYERS:
                raise conflict(GAME_FULL)
            return games.add_player(conn, game_id, name, token_hash)
    except errors.UniqueViolation:
        raise conflict(NAME_TAKEN)


# ---------- players (no account needed) ----------


@router.post("/{game_id}/join", response_model=JoinOut, status_code=status.HTTP_201_CREATED)
def join_game(game_id: int, body: JoinIn, conn: Conn):
    """Join with the game's link from this device (MPL-1..4). No login: the code is the invitation."""
    token, token_hash = play.new_player_token()
    player_id = _add_player(conn, game_id, body.name, token_hash, body.code)
    player = games.get_player(conn, game_id, player_id)
    assert player is not None
    hub.publish_soon(game_id)
    return JoinOut(player=PlayerOut(**player.model_dump(include={"id", "name", "position", "joined", "removed"})), player_token=token)


@router.post("/{game_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_game(game_id: int, conn: Conn, x_player_token: Annotated[str, Header()]):
    """A player leaves the lobby from their own device. Once the game runs, only the host can remove players."""
    player = games.player_by_token(conn, game_id, play.hash_player_token(x_player_token))
    if player is None:
        raise not_found("Player not found")
    with conn.transaction():
        games.lock(conn, game_id)
        game = games.get(conn, game_id)
        if game is None or game.status != "awaiting":
            raise conflict("The game has already started: ask the host to remove you")
        games.delete_player(conn, game_id, player.id)
    hub.publish_soon(game_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- host (organization users) ----------


@router.post("/{game_id}/players", response_model=GameDetailOut, status_code=status.HTTP_201_CREATED)
def add_player(game_id: int, body: PlayerIn, me: Me, conn: Conn):
    """The host adds a player by name, e.g. someone sharing another player's device."""
    _visible_game(me, conn, game_id)
    _add_player(conn, game_id, body.name, None)
    hub.publish_soon(game_id)
    return _detail(conn, games.get(conn, game_id))


@router.put("/{game_id}/players/order", response_model=GameDetailOut)
def order_players(game_id: int, body: PlayerOrderIn, me: Me, conn: Conn):
    """New turn order (PLY-1). The list must name every player exactly once."""
    _awaiting_game(me, conn, game_id)
    with conn.transaction():
        games.lock(conn, game_id)
        current = sorted(p.id for p in games.list_players(conn, game_id))
        if sorted(body.player_ids) != current:
            raise conflict("The player list changed meanwhile (someone joined or left). Try again.")
        games.set_order(conn, game_id, body.player_ids)
    hub.publish_soon(game_id)
    return _detail(conn, games.get(conn, game_id))


@router.delete("/{game_id}/players/{player_id}", response_model=GameDetailOut)
def remove_player(game_id: int, player_id: int, me: Me, conn: Conn):
    """Awaiting: the player is deleted. Running: they're out of the game from now on (MPL-9)."""
    game = _visible_game(me, conn, game_id)
    if games.get_player(conn, game_id, player_id) is None:
        raise not_found("Player not found")
    if game.status == "awaiting":
        with conn.transaction():
            games.lock(conn, game_id)
            games.delete_player(conn, game_id, player_id)
    elif game.status == "running":
        with conn.transaction():
            if (applied := play.apply(conn, game_id, {"type": "REMOVE_PLAYER", "player_id": str(player_id)})).error:
                raise conflict(applied.error)
            games.mark_player_removed(conn, game_id, player_id)
    else:
        raise conflict("This game is finished")
    hub.publish_soon(game_id)
    return _detail(conn, games.get(conn, game_id))


@router.post("/{game_id}/skip-turn", status_code=status.HTTP_204_NO_CONTENT)
def skip_turn(game_id: int, me: Me, conn: Conn):
    """Ends the active player's turn, e.g. when they're away (MPL-8)."""
    _visible_game(me, conn, game_id)
    if (applied := play.apply(conn, game_id, {"type": "SKIP_TURN"})).error:
        raise conflict(applied.error)
    hub.publish_soon(game_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{game_id}/join-code", response_model=GameDetailOut)
def new_join_code(game_id: int, me: Me, conn: Conn):
    """A new link: the old one stops working for joining and watching (MPL-1). Joined players keep playing."""
    _visible_game(me, conn, game_id)
    with conn.transaction():
        games.new_join_code(conn, game_id)
    return _detail(conn, games.get(conn, game_id))


# ---------- the live view (WebSocket) ----------
# Protocol: the client's first message is a SocketHello saying who is watching. The server
# then sends a LiveMessage after every change, and accepts {"type": "action", "action": …}
# from the active player's device. Problems with a message come back as {"type": "error"}.
# Close codes: 4400 bad hello, 4404 game not found or no access.

_incoming = TypeAdapter(SocketAction)


def _authorize(game_id: int, hello: SocketHello) -> tuple[bool, int | None] | str:
    """(can_host, the device's player) for a newcomer, or why they can't watch."""
    with db.connection() as conn:
        game = games.get(conn, game_id)
        if game is None:
            return "Game not found"
        me: CurrentUser | None = None
        if hello.token:
            try:
                me = user_from_token(conn, hello.token)
            except HTTPException:
                pass  # an expired session can still watch with the link or a player token
        player = games.player_by_token(conn, game_id, play.hash_player_token(hello.player_token)) if hello.player_token else None
        if not can_watch(me, game, player, hello.code):
            return "Game not found. The link may be out of date: ask the host for a new one."
        play.ensure_live_state(conn, game)
        can_host = me is not None and can_access_org(me, game.organization_id)
        return can_host, player.id if player and not player.removed else None


def _apply_device_action(game_id: int, action: dict, device: play.Device) -> play.Applied:
    with db.connection() as conn:
        return play.apply(conn, game_id, action, device=device)


@router.websocket("/{game_id}/ws")
async def live_game(ws: WebSocket, game_id: int):
    await ws.accept()
    try:
        hello = SocketHello.model_validate(await asyncio.wait_for(ws.receive_json(), timeout=10))
    except (TimeoutError, ValidationError, ValueError, WebSocketDisconnect):
        await ws.close(4400, "Expected a hello message")
        return
    access = await run_in_threadpool(_authorize, game_id, hello)
    if isinstance(access, str):
        await ws.send_json({"type": "error", "message": access, "fatal": True})
        await ws.close(4404)
        return
    viewer = Viewer(ws=ws, game_id=game_id, can_host=access[0], player_id=access[1])
    hub.add(viewer)
    try:
        await hub.publish(game_id)  # the newcomer gets the game, everyone else sees them online
        while True:
            try:
                message = _incoming.validate_python(json.loads(await ws.receive_text()))
            except (ValidationError, ValueError) as e:
                await ws.send_json({"type": "error", "message": f"Invalid message: {e}"})
                continue
            if viewer.player_id is None and not viewer.can_host:
                await ws.send_json({"type": "error", "message": "Join the game to play."})
                continue
            device = play.Device(player_id=viewer.player_id, can_host=viewer.can_host)
            applied = await run_in_threadpool(_apply_device_action, game_id, message.action.model_dump(), device)
            if applied.error:
                await ws.send_json({"type": "error", "message": applied.error})
            else:
                await hub.publish(game_id)
    except WebSocketDisconnect:
        pass
    finally:
        hub.remove(viewer)
        if viewer.player_id is not None:
            hub.publish_soon(game_id)  # shows them offline
