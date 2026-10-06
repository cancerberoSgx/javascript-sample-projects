// Multiplayer games (rules.md §2.7): the WebSocket every device watches a game through, and the
// pieces shown both on the host's game page (GamesPage) and on a player's own device
// (PlayerGamePage): the lobby, the live table and the host controls.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, joinLink, playerTokenStore, tokenStore, type GameDetail, type LiveMessage, type LiveServerMessage } from "../api";
import { activePlayer } from "../engine/engine";
import { resolveConfig } from "../engine/board";
import type { Action, GameView } from "../engine/types";
import { ErrorBox, useAction } from "./common";
import { BoardView, GamePanels, useGamePlay } from "./PlayTable";

export interface LiveGame {
  /** The latest view of the game, or null until the first one arrives. */
  msg: LiveMessage | null;
  /** Why this device can't watch (bad link, deleted game). The socket stays closed. */
  fatal: string | null;
  connected: boolean;
  /** Server time minus local time. */
  clockOffset: number;
  send: (action: Action) => void;
  /** Re-opens the socket, e.g. after joining (the new player token says who this device is). */
  reconnect: () => void;
  /** Errors the server sent for this device's actions. */
  onError: (fn: (message: string) => void) => void;
}

/**
 * Keeps a WebSocket open on a game and returns its latest view (MPL-5). The hello message
 * carries everything this device has: the login token, its player token, the link's code.
 * Reconnects with backoff when the connection drops.
 */
export function useLiveGame(gameId: number, code: string | null = null): LiveGame {
  const [msg, setMsg] = useState<LiveMessage | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const errorHandler = useRef<(message: string) => void>(() => {});

  useEffect(() => {
    let closedByUs = false;
    let retry: number | undefined;
    let failures = 0;

    const open = () => {
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/games/${gameId}/ws`);
      wsRef.current = ws;
      const playerToken = playerTokenStore(gameId).get();
      ws.onopen = () => {
        failures = 0;
        setConnected(true);
        ws.send(JSON.stringify({ type: "hello", token: tokenStore.get(), player_token: playerToken, code }));
      };
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data) as LiveServerMessage;
        if (data.type === "game") {
          // A token the server doesn't recognize anymore (left, or removed by the host)
          if (playerToken && data.you.player_id === null) playerTokenStore(gameId).set(null);
          setClockOffset(data.server_now - Date.now());
          setMsg(data);
        } else if (data.type === "gone") {
          setFatal("This game was deleted.");
        } else if (data.fatal) {
          setFatal(data.message);
        } else {
          errorHandler.current(data.message);
        }
      };
      ws.onclose = (e) => {
        setConnected(false);
        if (closedByUs || e.code === 4404 || e.code === 4400) return;
        retry = window.setTimeout(open, Math.min(10_000, 500 * 2 ** failures++));
      };
    };
    open();
    return () => {
      closedByUs = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [gameId, code, attempt]);

  const send = useCallback((action: Action) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "action", action }));
    else errorHandler.current("Not connected. Reconnecting…");
  }, []);
  const reconnect = useCallback(() => setAttempt((n) => n + 1), []);
  const onError = useCallback((fn: (message: string) => void) => {
    errorHandler.current = fn;
  }, []);

  return { msg, fatal, connected, clockOffset, send, reconnect, onError };
}

/** May this device act for the active player? Its own player, or (host) a player added by name (MPL-6). */
export function canActNow(msg: LiveMessage, state: GameView): boolean {
  if (msg.game.status !== "running" || state.phase === "GAME_OVER") return false;
  const active = activePlayer(state);
  if (msg.you.player_id !== null && String(msg.you.player_id) === active.id) return true;
  return msg.you.can_host && msg.game.players.some((p) => String(p.id) === active.id && !p.joined);
}

/** The board and the turn, scoreboard and log panels, driven by the server's state. */
export function LiveTable({ live, aside }: { live: LiveGame; aside?: React.ReactNode }) {
  const msg = live.msg!;
  const state = msg.state!;
  const canAct = canActNow(msg, state);
  const { dispatch, onSpaceClick, showToast, toast } = useGamePlay(state, live.send, canAct);
  useEffect(() => live.onError(showToast), [live, showToast]);
  const online = useMemo(() => Object.fromEntries(msg.game.players.map((p) => [String(p.id), p.online || !p.joined])), [msg.game.players]);
  const config = resolveConfig(state.board);

  return (
    <div className="boards-demo">
      <main>
        <div className="left">
          <p className="desc">
            <strong>{state.board.name}</strong> · {config.track_type} track · wins: {config.win_conditions.join(", ")}
            {!live.connected && <span className="chip warn">reconnecting…</span>}
          </p>
          <BoardView board={state.board} background={msg.game.background} game={state} onSpaceClick={onSpaceClick} />
        </div>
        <aside>
          {aside}
          <GamePanels
            game={state}
            dispatch={dispatch}
            canAct={canAct}
            dev={false}
            clockOffset={live.clockOffset}
            online={online}
            you={msg.you.player_id === null ? null : String(msg.you.player_id)}
            ended={msg.game.status === "finished" && state.phase !== "GAME_OVER"}
          />
        </aside>
      </main>
      {toast}
    </div>
  );
}

/** Whose device this is: the player it joined as, or a spectator. */
export function YouBanner({ msg }: { msg: LiveMessage }) {
  const me = msg.game.players.find((p) => p.id === msg.you.player_id);
  if (me) return <span className="chip you">Playing as {me.name}</span>;
  return <span className="chip">{msg.you.can_host ? "Host" : "Watching"}</span>;
}

/** The lobby: who joined and who's online, live (MPL-5). */
export function LobbyPlayers({ msg, children }: { msg: LiveMessage; children?: (p: LiveMessage["game"]["players"][number]) => React.ReactNode }) {
  const players = msg.game.players;
  return (
    <>
      {!players.length && <p className="muted small">No one has joined yet.</p>}
      <ol className="players-list lobby">
        {players.map((p) => (
          <li key={p.id} className="row between">
            <span>
              <span className={`presence ${p.online ? "on" : ""}`} title={p.joined ? (p.online ? "Online" : "Offline") : "Added by the host: plays on the host's screen"} /> {p.name}
              {p.id === msg.you.player_id && <span className="chip">you</span>}
              {!p.joined && <span className="chip">host's screen</span>}
            </span>
            {children?.(p)}
          </li>
        ))}
      </ol>
    </>
  );
}

/** Asks for a name and joins the game from this device (MPL-1..4). */
export function JoinForm({ gameId, code, onJoined }: { gameId: number; code: string; onJoined: () => void }) {
  const [name, setName] = useState("");
  const action = useAction();
  return (
    <form
      className="join-form"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(async () => {
          const res = await api.joinGame(gameId, { code, name: name.trim() });
          playerTokenStore(gameId).set(res.player_token);
          onJoined();
        });
      }}
    >
      <label className="stack">
        Your name
        <input autoFocus required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="How the others will see you" />
      </label>
      <ErrorBox error={action.error} />
      <button className="primary" disabled={action.busy || !name.trim()}>
        Join the game
      </button>
    </form>
  );
}

/** Leave the lobby from this device (only before the game starts). */
export function LeaveButton({ gameId, onLeft }: { gameId: number; onLeft: () => void }) {
  const action = useAction();
  const token = playerTokenStore(gameId).get();
  if (!token) return null;
  return (
    <>
      <button
        className="small"
        disabled={action.busy}
        onClick={() =>
          action.run(async () => {
            await api.leaveGame(gameId, token);
            playerTokenStore(gameId).set(null);
            onLeft();
          })
        }
      >
        Leave
      </button>
      <ErrorBox error={action.error} />
    </>
  );
}

/** The link to share, with copy and "new link" (MPL-1). */
export function SharePanel({ game, onChanged }: { game: GameDetail; onChanged: (g: GameDetail) => void }) {
  const link = joinLink(game);
  const [copied, setCopied] = useState(false);
  const action = useAction();
  return (
    <section className="panel">
      <h2>Invite players</h2>
      <p className="small">
        {game.status === "awaiting"
          ? "Share this link. Everyone who opens it picks a name and joins from their own device."
          : "The game has started, so no one can join anymore. The link still lets people watch."}
      </p>
      <div className="row">
        <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Join link" />
        <button
          className="small"
          onClick={() =>
            navigator.clipboard?.writeText(link).then(
              () => (setCopied(true), setTimeout(() => setCopied(false), 1500)),
              () => {},
            )
          }
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
        <button
          className="small"
          title="The current link stops working. Players who already joined stay in."
          onClick={() => confirm("Make a new link? The current one will stop working.") && action.run(async () => onChanged(await api.newJoinCode(game.id)))}
        >
          New link
        </button>
      </div>
      <ErrorBox error={action.error} />
    </section>
  );
}

/** Skip the active player's turn, remove players, end the game (MPL-8, MPL-9). */
export function HostControls({ game, msg, onChanged }: { game: GameDetail; msg: LiveMessage; onChanged: (g: GameDetail) => void }) {
  const action = useAction();
  const state = msg.state;
  if (!state || msg.game.status !== "running") return null;
  const active = state.phase === "GAME_OVER" ? null : activePlayer(state);
  const remaining = msg.game.players.filter((p) => !p.removed);
  return (
    <section className="panel">
      <h2>Host</h2>
      <ErrorBox error={action.error} />
      {active && (
        <button disabled={action.busy} onClick={() => action.run(() => api.skipTurn(game.id))}>
          ⏭ Skip {active.name}'s turn
        </button>
      )}
      <LobbyPlayers msg={msg}>
        {(p) =>
          !p.removed &&
          remaining.length > 1 && (
            <button
              className="small danger"
              disabled={action.busy}
              onClick={() => confirm(`Remove ${p.name} from the game? They can't come back.`) && action.run(async () => onChanged(await api.removePlayer(game.id, p.id)))}
            >
              Remove
            </button>
          )
        }
      </LobbyPlayers>
      <button
        className="danger"
        disabled={action.busy}
        onClick={() => confirm("End the game now, for everyone? There will be no winner.") && action.run(async () => onChanged(await api.finishGame(game.id)))}
      >
        End game
      </button>
    </section>
  );
}

/** Who won (or that it ended early), shown when a game is finished. */
export function FinalResult({ msg }: { msg: LiveMessage }) {
  const state = msg.state;
  const result = state?.result;
  const winner = result?.type === "win" ? state!.players.find((p) => p.id === result.player_id) : null;
  return (
    <section className="panel">
      <h2>Game over</h2>
      <p className="big">{winner ? `🏆 ${winner.name} wins!` : result?.type === "draw" ? "It's a draw." : "The host ended the game before anyone won."}</p>
    </section>
  );
}
