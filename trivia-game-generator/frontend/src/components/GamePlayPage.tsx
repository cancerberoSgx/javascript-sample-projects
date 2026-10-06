// /games/:id/play: plays a running game (GAM-5) on its snapshot, hot-seat like the Boards
// demo, and saves / loads the play state (rules.md §2.7). ?save=<id> names the loaded save.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ApiError, api, type GameDetail, type GameSave } from "../api";
import { resolveConfig } from "../engine/board";
import { createGame, resumeGame, suspendGame } from "../engine/engine";
import { resolveGame } from "../engine/resolve";
import type { GameState } from "../engine/types";
import { ErrorBox, NotFound, StatusBadge, snapshotMapping, useAction, useList } from "./common";
import { BoardView, GamePanels, PLAYER_COLORS, useGamePlay } from "./PlayTable";

export function GamePlayPage() {
  const gameId = Number(useParams().id);
  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.getGame(gameId).then(setDetail, setError);
  }, [gameId]);

  if (error instanceof ApiError && error.status === 404) return <NotFound what="Game" back="/games" />;
  if (!detail) return <ErrorBox error={error} />;
  if (detail.status !== "running") {
    return (
      <section className="panel content-page">
        <h2>
          {detail.name} <StatusBadge status={detail.status} />
        </h2>
        <p>{detail.status === "not_started" ? "Start this game first: only a running game can be played." : "This game is finished, so it can't be played anymore."}</p>
        <Link to={`/games/${detail.id}`}>← Game details</Link>
      </section>
    );
  }
  return <PlayRunningGame detail={detail} onFinished={setDetail} />;
}

function PlayRunningGame({ detail, onFinished }: { detail: GameDetail; onFinished: (g: GameDetail) => void }) {
  const [params, setParams] = useSearchParams();
  const saveId = params.get("save") ? Number(params.get("save")) : null;
  const saves = useList(() => api.listSaves(detail.id), [detail.id]);
  const [game, setGame] = useState<GameState | null>(null);
  /** The state as last saved or loaded: anything else is unsaved progress. */
  const [savedState, setSavedState] = useState<GameState | null>(null);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const { dispatch, onSpaceClick, toast } = useGamePlay(game, setGame);
  const action = useAction();

  const snap = detail.snapshot!;
  const resolved = useMemo(() => resolveGame(snap.board, snapshotMapping(snap), snap.deck), [snap]);
  const dirty = game !== null && game !== savedState;

  // Leaving the page (reload, close, typed URL) with unsaved progress asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const show = useCallback((state: GameState | null, id: number | null) => {
    setGame(state);
    setSavedState(state);
    setLoadedId(id);
  }, []);

  // ?save=<id> loads that save (on open, and when a link or Back changes it)
  useEffect(() => {
    if (saveId === loadedId) return;
    if (saveId === null) return show(null, null);
    api.getSave(detail.id, saveId).then((s) => show(resumeGame(s.state), s.id), action.setError);
  }, [saveId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openSave = (id: number) => {
    if (dirty && !confirm("You have unsaved progress. Discard it?")) return;
    setParams({ save: String(id) });
  };

  const save = async (name: string, asNew: boolean) => {
    if (!game) return;
    const state = suspendGame(game); // SAV-3: store the question timer as time left
    await action.run(async () => {
      const s =
        loadedId !== null && !asNew
          ? await api.updateSave(detail.id, loadedId, { name, state })
          : await api.createSave(detail.id, { name, state });
      setSavedState(game);
      setLoadedId(s.id);
      setParams({ save: String(s.id) }, { replace: true });
      await saves.reload();
    });
  };

  const newPlaythrough = (noTimer: boolean, seed: number) => {
    if (!resolved.board || !resolved.deck) return;
    const board = structuredClone(resolved.board);
    if (noTimer) board.config = { ...board.config, answer_time_limit_sec: 0 };
    const players = detail.players.map((p, i) => ({ name: p.name, color: PLAYER_COLORS[i % PLAYER_COLORS.length] }));
    setGame(createGame(board, resolved.deck, players, seed));
    setSavedState(null);
    setLoadedId(null);
    setParams({});
  };

  const board = game?.board ?? resolved.board;
  const current = saves.items.find((s) => s.id === loadedId);

  return (
    <div className="boards-demo">
      <div className="toolbar">
        <Link to={`/games/${detail.id}`}>← Game details</Link>
        <strong>{detail.name}</strong>
        <StatusBadge status={detail.status} />
        {current && (
          <span className="muted small">
            Save “{current.name}”{dirty ? " · unsaved progress" : ""}
          </span>
        )}
      </div>
      <ErrorBox error={action.error} />
      {resolved.errors.length > 0 && <ErrorBox error={new Error(`This game's snapshot can't be played: ${resolved.errors.join("; ")}`)} />}

      {board && (
        <main>
          <div className="left">
            <p className="desc">
              <strong>{board.name}</strong> · {resolveConfig(board).track_type} track · {board.spaces.length} spaces · wins: {resolveConfig(board).win_conditions.join(", ")}
              <br />
              <span className="muted">Hot-seat: the players take turns on this screen, in their order ({detail.players.map((p) => p.name).join(", ")}).</span>
            </p>
            <BoardView board={board} game={game} onSpaceClick={onSpaceClick} />
          </div>

          <aside>
            {game ? (
              <>
                <SavePanel key={loadedId ?? "new"} game={game} current={current ?? null} dirty={dirty} busy={action.busy} onSave={save} />
                {game.phase === "GAME_OVER" && (
                  <section className="panel">
                    <p className="small">This playthrough is over. Mark the game as finished when you're done: a finished game can't be played or saved anymore.</p>
                    <button className="primary" onClick={() => action.run(async () => onFinished(await api.finishGame(detail.id)))}>
                      Mark game as finished
                    </button>
                  </section>
                )}
                <GamePanels game={game} dispatch={dispatch} />
                <button onClick={() => (!dirty || confirm("You have unsaved progress. Discard it?")) && (show(null, null), setParams({}))}>↺ New playthrough</button>
              </>
            ) : (
              <NewPlaythrough disabled={!resolved.board} onStart={newPlaythrough} />
            )}
            <SavesPanel saves={saves.items} error={saves.error} currentId={loadedId} gameId={detail.id} onOpen={openSave} onDeleted={saves.reload} />
          </aside>
        </main>
      )}
      {toast}
    </div>
  );
}

function NewPlaythrough({ disabled, onStart }: { disabled: boolean; onStart: (noTimer: boolean, seed: number) => void }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [noTimer, setNoTimer] = useState(false);
  return (
    <section className="panel">
      <h2>New playthrough</h2>
      <label>
        Seed <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
      </label>
      <label className="check">
        <input type="checkbox" checked={noTimer} onChange={(e) => setNoTimer(e.target.checked)} /> Disable answer timer
      </label>
      <button className="primary" disabled={disabled} onClick={() => onStart(noTimer, seed)}>
        ▶ Play
      </button>
      <p className="muted small">Or continue a saved game below.</p>
    </section>
  );
}

const defaultName = (g: GameState) => `Round ${g.round} · ${new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;

function SavePanel({
  game,
  current,
  dirty,
  busy,
  onSave,
}: {
  game: GameState;
  current: GameSave | null;
  dirty: boolean;
  busy: boolean;
  onSave: (name: string, asNew: boolean) => void;
}) {
  const [name, setName] = useState(() => current?.name ?? defaultName(game));
  return (
    <section className="panel">
      <div className="row between">
        <h2>Save</h2>
        <span className={`small ${dirty ? "muted" : "ok-text"}`}>{dirty ? "Unsaved progress" : current ? `✓ Saved ${time(current.updated_at)}` : ""}</span>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name.trim(), false);
        }}
      >
        <input required value={name} onChange={(e) => setName(e.target.value)} aria-label="Save name" />
        <button className="primary small" disabled={busy || !name.trim()}>
          Save
        </button>
        {current && (
          <button type="button" className="small" disabled={busy || !name.trim()} onClick={() => onSave(name.trim(), true)} title="Keep the loaded save and add a new one">
            Save as new
          </button>
        )}
      </form>
      <p className="muted small">
        {current ? `“Save” overwrites “${current.name}”.` : "Saves positions, scores, tokens, the card piles, the dice and the log."} Anyone in the organization can continue it later.
      </p>
    </section>
  );
}

const time = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/** A save's one-line summary: round, and score + tokens per player (or the result). */
export function SaveSummary({ save }: { save: GameSave }) {
  const result = save.result;
  const winner = result?.type === "win" ? save.players.find((p) => p.id === result.player_id)?.name : null;
  return (
    <span className="muted small">
      {save.phase === "GAME_OVER" ? (winner ? `🏆 ${winner} won` : "Game over: draw") : `Round ${save.round}`} ·{" "}
      {save.players.map((p) => `${p.name} ${p.score}${p.inventory.length ? ` (${p.inventory.length}★)` : ""}`).join(", ")}
      <br />
      {save.saved_by_name ?? "a deleted user"}, {time(save.updated_at)}
    </span>
  );
}

export function SavesPanel({
  saves,
  error,
  currentId,
  gameId,
  onOpen,
  onDeleted,
  canOpen = true,
}: {
  saves: GameSave[];
  error: unknown;
  currentId: number | null;
  gameId: number;
  onOpen: (id: number) => void;
  onDeleted: () => Promise<void>;
  canOpen?: boolean;
}) {
  const del = useAction();
  return (
    <section className="panel">
      <h2>Saved games · {saves.length}</h2>
      <ErrorBox error={error ?? del.error} />
      {!saves.length && <p className="muted small">No saves yet.</p>}
      <ul className="saves">
        {saves.map((s) => (
          <li key={s.id} className={s.id === currentId ? "on" : ""}>
            <div>
              <strong>{s.name}</strong>
              <br />
              <SaveSummary save={s} />
            </div>
            <div className="row">
              {canOpen && (
                <button className="small" disabled={s.id === currentId} onClick={() => onOpen(s.id)}>
                  {s.id === currentId ? "Loaded" : "Continue"}
                </button>
              )}
              <button
                className="small danger"
                onClick={() => confirm(`Delete the save “${s.name}”?`) && del.run(async () => (await api.deleteSave(gameId, s.id), onDeleted()))}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
