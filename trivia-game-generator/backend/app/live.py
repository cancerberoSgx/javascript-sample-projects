"""The live side of multiplayer games (rules.md §2.7, MPL-5, MPL-11).

Every device that shows a game (the host's page, each player's, spectators) keeps a
WebSocket open. After anything about the game changes (a player joins, the game starts, an
action is applied, someone connects or drops), the hub sends every one of them the game's
current view: the lobby, the players with who's online, and the state without its secrets.
It also times out unanswered questions on the server, so an absent player can't stall a game.

The hub lives in this process's memory. That's enough for the single uvicorn process the app
runs as; several workers would need to share broadcasts (e.g. Postgres LISTEN/NOTIFY). The
state itself is in Postgres, so a restart loses nothing: clients reconnect and catch up.
"""

import asyncio
import logging
from dataclasses import dataclass

from fastapi import WebSocket
from starlette.concurrency import run_in_threadpool

from . import db, engine, play
from .models import Game, GameLiveState, Player
from .repositories import game_states, games
from .schemas import LiveGameOut, LiveMessage, LivePlayerOut, LiveYouOut

log = logging.getLogger(__name__)


@dataclass(eq=False)
class Viewer:
    """One open WebSocket on one game."""

    ws: WebSocket
    game_id: int
    can_host: bool  # an organization user (or root): may run the game
    player_id: int | None  # the player this device joined as (database id), if any


def _load(game_id: int) -> tuple[Game, list[Player], GameLiveState | None] | None:
    with db.connection() as conn:
        game = games.get(conn, game_id)
        if game is None:
            return None
        return game, games.list_players(conn, game_id), game_states.get(conn, game_id)


def _apply_timeout(game_id: int) -> play.Applied:
    with db.connection() as conn:
        return play.apply(conn, game_id, {"type": "TIMEOUT"})


class Hub:
    def __init__(self) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._viewers: dict[int, set[Viewer]] = {}
        self._locks: dict[int, asyncio.Lock] = {}
        self._timers: dict[int, tuple[int, asyncio.Task[None]]] = {}  # game -> (deadline, task)

    # ---------- lifecycle ----------

    def attach(self, loop: asyncio.AbstractEventLoop) -> None:
        """Called on startup with the server's event loop."""
        self._loop = loop
        self._viewers.clear()
        self._locks.clear()
        self._timers.clear()

    async def close(self) -> None:
        for _, task in self._timers.values():
            task.cancel()
        for viewers in list(self._viewers.values()):
            for v in list(viewers):
                await _close(v.ws, 1001)
        self._loop = None

    # ---------- connections ----------

    def add(self, viewer: Viewer) -> None:
        self._viewers.setdefault(viewer.game_id, set()).add(viewer)

    def remove(self, viewer: Viewer) -> None:
        viewers = self._viewers.get(viewer.game_id)
        if viewers is not None:
            viewers.discard(viewer)
            if not viewers:
                del self._viewers[viewer.game_id]

    def online(self, game_id: int) -> set[int]:
        """Players with at least one open connection (MPL-5)."""
        return {v.player_id for v in self._viewers.get(game_id, ()) if v.player_id is not None}

    # ---------- broadcasting ----------

    def publish_soon(self, game_id: int) -> None:
        """Broadcast a game from a request handler, after its transaction committed. Safe from any thread."""
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is loop:
            loop.create_task(self.publish(game_id))
        else:
            asyncio.run_coroutine_threadsafe(self.publish(game_id), loop)

    async def publish(self, game_id: int) -> None:
        """Sends the game's current view to everyone watching it."""
        # One broadcast per game at a time, so a slower, older view never overtakes a newer one
        async with self._locks.setdefault(game_id, asyncio.Lock()):
            viewers = list(self._viewers.get(game_id, ()))
            if not viewers:
                return
            loaded = await run_in_threadpool(_load, game_id)
            if loaded is None:  # deleted
                for v in viewers:
                    await _send(v, {"type": "gone"})
                    await _close(v.ws, 4404)
                return
            game, players, live = loaded
            online = self.online(game_id)
            message = LiveMessage(
                game=LiveGameOut(
                    id=game.id,
                    name=game.name,
                    status=game.status,
                    board_name=game.board_name if game.snapshot is None else game.snapshot.board.name,
                    players=[LivePlayerOut(**p.model_dump(include={"id", "name", "position", "joined", "removed"}), online=p.id in online) for p in players],
                ),
                state=engine.public_view(live.state.to_engine()) if live else None,
                version=live.version if live else None,
                server_now=play.now_ms(),
                you=LiveYouOut(player_id=None, can_host=False),
            )
            current = {p.id for p in players if not p.removed}
            for v in viewers:
                if v.player_id is not None and v.player_id not in current:
                    v.player_id = None  # left, or removed by the host (MPL-9)
                you = LiveYouOut(player_id=v.player_id, can_host=v.can_host)
                if not await _send(v, message.model_copy(update={"you": you}).model_dump(mode="json")):
                    self.remove(v)
            self._sync_timer(game_id, game, live)

    # ---------- question timer (MPL-8) ----------

    def _sync_timer(self, game_id: int, game: Game, live: GameLiveState | None) -> None:
        deadline = None
        if game.status == "running" and live and live.state.phase == "AWAIT_ANSWER" and live.state.question:
            deadline = live.state.question.get("deadline")
        current = self._timers.get(game_id)
        if current and current[0] == deadline:
            return
        if current:
            current[1].cancel()
            del self._timers[game_id]
        if deadline is not None and self._loop is not None:
            self._timers[game_id] = (deadline, self._loop.create_task(self._timeout(game_id, deadline)))

    async def _timeout(self, game_id: int, deadline: int) -> None:
        await asyncio.sleep(max(0, deadline - play.now_ms()) / 1000 + 0.05)
        if self._timers.get(game_id, (None,))[0] == deadline:
            del self._timers[game_id]
        try:
            # Rejected if it was answered meanwhile (a later deadline hasn't expired, or the phase changed)
            if (await run_in_threadpool(_apply_timeout, game_id)).error is None:
                await self.publish(game_id)
        except Exception:
            log.exception("question timeout failed for game %s", game_id)


async def _send(viewer: Viewer, data: dict) -> bool:
    try:
        await viewer.ws.send_json(data)
        return True
    except Exception:  # the socket closed meanwhile
        return False


async def _close(ws: WebSocket, code: int) -> None:
    try:
        await ws.close(code)
    except Exception:
        pass


hub = Hub()
