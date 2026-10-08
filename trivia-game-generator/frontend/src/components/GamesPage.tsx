import { useEffect, useRef, useState } from "react";
import { api, type Board, type Category, type Deck, type GameDetail, type GameInput, type LiveMessage } from "../api";
import { BoardPreview, ErrorBox, NotFound, StatusBadge, categoryMapping, snapshotMapping, toBoardFile, useAction, useList, useRouteSelection } from "./common";
import type { Background, SlotMapping } from "../engine/types";
import { BackgroundEditor, boardAspect } from "./BackgroundEditor";
import { useI18n } from "../i18n";
import { FinalResult, HostControls, JoinForm, LeaveButton, LiveTable, LobbyPlayers, SharePanel, YouBanner, useLiveGame, type LiveGame } from "./LiveGame";

export function GamesPage({ orgId }: { orgId: number }) {
  const games = useList(() => api.listGames(orgId), [orgId]);
  const { selectedId, selected, select, missing } = useRouteSelection("/games", games, orgId);
  const [newName, setNewName] = useState("");
  const create = useAction();

  return (
    <div className="orgs-page">
      <section className="panel org-list">
        <h2>Games</h2>
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            await create.run(async () => {
              const g = await api.createGame({ organization_id: orgId, name: newName });
              setNewName("");
              await games.reload();
              select(g.id);
            });
          }}
        >
          <input placeholder="New game name" required value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="small primary">Create</button>
        </form>
        <ErrorBox error={games.error ?? create.error} />
        <ul>
          {games.items.map((g) => (
            <li key={g.id}>
              <button className={g.id === selectedId ? "on" : ""} onClick={() => select(g.id)}>
                <span>{g.name}</span>
                <StatusBadge status={g.status} />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div className="org-detail">
        {missing ? (
          <NotFound what="Game" back="/games" />
        ) : selected ? (
          <GameEditor
            key={selected.id}
            gameId={selected.id}
            orgId={orgId}
            onChanged={games.reload}
            onDeleted={async () => (await games.reload(), select(null, true))}
          />
        ) : (
          games.loaded && !games.items.length && <p className="muted">Create a game to get started.</p>
        )}
      </div>
    </div>
  );
}

function GameEditor({
  gameId,
  orgId,
  onChanged,
  onDeleted,
}: {
  gameId: number;
  orgId: number;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [game, setGame] = useState<GameDetail | null>(null);
  const boards = useList(() => api.listBoards(orgId), [orgId]);
  const decks = useList(() => api.listDecks(orgId), [orgId]);
  const categories = useList(() => api.listCategories(orgId), [orgId]);
  const action = useAction();
  const live = useLiveGame(gameId);
  const msg = live.msg;

  // The live view says when players join or leave and when the game starts or ends: re-read the
  // details then (setup errors depend on the players, the snapshot on the start)
  const liveKey = msg && `${msg.game.status}|${msg.game.players.map((p) => `${p.id}:${p.position}:${p.removed}`).join()}`;
  useEffect(() => {
    api.getGame(gameId).then(setGame, action.setError);
  }, [gameId, liveKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (liveKey) onChanged();
  }, [msg?.game.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) return <ErrorBox error={action.error} />;

  const apply = (next: GameDetail) => {
    setGame(next);
    return onChanged();
  };
  const update = (body: GameInput) => action.run(async () => apply(await api.updateGame(game.id, body)));
  const deleteButton = (
    <button className="danger" onClick={() => confirm(`Delete game "${game.name}"?`) && action.run(async () => (await api.deleteGame(game.id), onDeleted()))}>
      Delete game
    </button>
  );

  const header = (
    <div className="row between">
      <h2>
        {game.name} <StatusBadge status={game.status} />
      </h2>
      <span className="row">
        {msg && <YouBanner msg={msg} />}
        <span className="muted small">created by {game.creator_name ?? "a deleted user"}</span>
      </span>
    </div>
  );

  if (game.status !== "awaiting") {
    return (
      <>
        <StartedGame game={game} header={header} error={action.error}>
          {deleteButton}
        </StartedGame>
        {game.status === "running" && <SharePanel game={game} onChanged={setGame} />}
        {msg?.game.status === "finished" && <FinalResult msg={msg} />}
        {msg?.state ? (
          <LiveTable live={live} aside={<HostControls game={game} msg={msg} onChanged={apply} />} />
        ) : (
          <p className="muted">{live.fatal ?? (msg ? "This game ended before live play existed, so there's no board to show." : "Connecting to the game…")}</p>
        )}
      </>
    );
  }

  const board = boards.items.find((b) => b.id === game.board_id) ?? null;

  return (
    <>
      <section className="panel">
        {header}
        <SetupForm game={game} boards={boards.items} decks={decks.items} onSave={update} />
      </section>

      <section className="panel">
        <h2>Categories per slot</h2>
        {board ? (
          <SlotMappingEditor board={board} categories={categories.items} value={game.categories} onChange={(categories) => update({ categories })} />
        ) : (
          <p className="muted small">Choose a board first: its slots appear here.</p>
        )}
      </section>

      <GameLook game={game} board={board} mapping={board ? categoryMapping(board.definition, game.categories, categories.items) : {}} orgId={orgId} onSave={update} />

      <SharePanel game={game} onChanged={setGame} />

      <section className="panel">
        <h2>Players · {game.players.length}</h2>
        {msg ? <LobbyEditor game={game} msg={msg} live={live} onChanged={apply} /> : <p className="muted small">Connecting…</p>}
      </section>

      <section className="panel">
        <ErrorBox error={action.error} />
        {game.setup_errors.length > 0 ? (
          <div className="warn">
            <strong>Before starting:</strong>
            <ul>
              {game.setup_errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="ok">
            Ready to start with {game.players.length} player{game.players.length === 1 ? "" : "s"}. Starting closes the lobby and copies the board, deck and categories into
            the game, so later edits won't change it.
          </div>
        )}
        <div className="row between">
          <button className="primary" disabled={game.setup_errors.length > 0 || action.busy} onClick={() => action.run(async () => apply(await api.startGame(game.id)))}>
            ▶ Start game
          </button>
          {deleteButton}
        </div>
      </section>
    </>
  );
}

/** The lobby, live: who joined and who's online. The host can reorder, remove and add players. */
function LobbyEditor({ game, msg, live, onChanged }: { game: GameDetail; msg: LiveMessage; live: LiveGame; onChanged: (g: GameDetail) => void }) {
  const [draft, setDraft] = useState("");
  const [joining, setJoining] = useState(false);
  const action = useAction();
  const players = msg.game.players;
  const ids = players.map((p) => p.id);
  const move = (i: number, d: number) => {
    const next = [...ids];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    action.run(async () => onChanged(await api.orderPlayers(game.id, next)));
  };
  const full = players.length >= 12;

  return (
    <>
      <ErrorBox error={action.error} />
      <LobbyPlayers msg={msg}>
        {(p) => {
          const i = ids.indexOf(p.id);
          return (
            <span className="row">
              <button className="small" disabled={i === 0 || action.busy} onClick={() => move(i, -1)} title="Earlier in turn order">
                ↑
              </button>
              <button className="small" disabled={i === ids.length - 1 || action.busy} onClick={() => move(i, 1)} title="Later in turn order">
                ↓
              </button>
              {p.id === msg.you.player_id ? (
                <LeaveButton gameId={game.id} onLeft={live.reconnect} />
              ) : (
                <button className="small danger" disabled={action.busy} onClick={() => action.run(async () => onChanged(await api.removePlayer(game.id, p.id)))}>
                  Remove
                </button>
              )}
            </span>
          );
        }}
      </LobbyPlayers>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          action.run(async () => {
            onChanged(await api.addPlayer(game.id, draft.trim()));
            setDraft("");
          });
        }}
      >
        <input placeholder="Add a player who plays on this screen" maxLength={40} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="small" disabled={full || action.busy}>
          + Add
        </button>
      </form>
      {msg.you.player_id === null &&
        !full &&
        (joining ? (
          <JoinForm gameId={game.id} code={game.join_code} onJoined={() => (setJoining(false), live.reconnect())} />
        ) : (
          <button className="small self-start" onClick={() => setJoining(true)}>
            Join as a player from this device
          </button>
        ))}
      <p className="muted small">
        The order is the turn order. Players who join with the link play on their own devices; players added here play on the host's screen. Names must be unique.
      </p>
    </>
  );
}

type LookMode = "board" | "custom" | "none";
const SAVE_DELAY_MS = 400;

/** The game's background (BKG-5): the board's, its own, or none, with a preview of the board. */
function GameLook({
  game,
  board,
  mapping,
  orgId,
  onSave,
}: {
  game: GameDetail;
  board: Board | null;
  mapping: SlotMapping;
  orgId: number;
  onSave: (body: GameInput) => Promise<boolean>;
}) {
  const own = game.background;
  const [mode, setMode] = useState<LookMode>(own === null ? "board" : Object.keys(own).length ? "custom" : "none");
  const [draft, setDraft] = useState<Background>(own ?? {});
  // Slider drags send one request when they pause, not one per step
  const pending = useRef<{ timer: number; background: Background | null } | null>(null);
  const flush = () => {
    if (!pending.current) return;
    clearTimeout(pending.current.timer);
    const { background } = pending.current;
    pending.current = null;
    onSave({ background });
  };
  const save = (background: Background | null, delay = 0) => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { background, timer: window.setTimeout(flush, delay) };
  };
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  const boardBg = board?.definition.background;
  const pick = (next: LookMode) => {
    setMode(next);
    if (next === "board") save(null);
    else if (next === "none") save({});
    else {
      const start = draft.image || draft.color ? draft : (boardBg ?? {});
      setDraft(start);
      save(start);
    }
  };
  const shown = mode === "board" ? (boardBg ?? null) : mode === "none" ? null : draft;

  return (
    <section className="panel">
      <h2>Background</h2>
      <div className="game-look">
        <div className="stack">
          <div className="tabs self-start" role="group" aria-label="Background">
            {(
              [
                ["board", "Board's"],
                ["custom", "Custom"],
                ["none", "None"],
              ] as [LookMode, string][]
            ).map(([m, label]) => (
              <button key={m} className={mode === m ? "on" : ""} onClick={() => mode !== m && pick(m)}>
                {label}
              </button>
            ))}
          </div>
          {mode === "board" && (
            <p className="muted small">
              {!board ? "Choose a board first." : boardBg?.image || boardBg?.color ? `Uses the background set on the board "${board.name}".` : `The board "${board.name}" has no background.`}
            </p>
          )}
          {mode === "none" && <p className="muted small">No background image, even if the board has one.</p>}
          {mode === "custom" && (
            <BackgroundEditor
              orgId={orgId}
              value={draft}
              aspect={board ? boardAspect(board.definition) : null}
              onChange={(bg, coalesce) => {
                setDraft(bg);
                save(bg, coalesce ? SAVE_DELAY_MS : 0);
              }}
            />
          )}
          <p className="muted small">Starting the game freezes the background, like the board and deck.</p>
        </div>
        <div>{board ? <BoardPreview board={toBoardFile(board)} mapping={mapping} background={shown} /> : <p className="muted small">The preview appears once a board is chosen.</p>}</div>
      </div>
    </section>
  );
}

function SetupForm({ game, boards, decks, onSave }: { game: GameDetail; boards: Board[]; decks: Deck[]; onSave: (body: GameInput) => void }) {
  const [name, setName] = useState(game.name);
  const { languages } = useI18n();
  const nativeName = (code: string) => languages.find((l) => l.code === code)?.native_name ?? code;
  const toId = (v: string) => (v ? Number(v) : null);
  return (
    <div className="grid-form">
      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== game.name && onSave({ name })} />
      <label>Board</label>
      <select value={game.board_id ?? ""} onChange={(e) => onSave({ board_id: toId(e.target.value) })}>
        <option value="">Choose a board…</option>
        {boards.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.definition.slots.length} slots){b.issues.some((i) => i.severity === "error") ? " · draft, has problems" : ""}
          </option>
        ))}
      </select>
      <label>Language</label>
      <select value={game.language ?? ""} onChange={(e) => onSave({ language: e.target.value || null })}>
        <option value="">Organization's ({nativeName(game.organization_language)})</option>
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native_name}
          </option>
        ))}
      </select>
      <label>Deck</label>
      <select value={game.deck_id ?? ""} onChange={(e) => onSave({ deck_id: toId(e.target.value) })}>
        <option value="">Choose a deck…</option>
        {decks.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} ({d.card_count} cards)
          </option>
        ))}
      </select>
    </div>
  );
}

function SlotMappingEditor({
  board,
  categories,
  value,
  onChange,
}: {
  board: Board;
  categories: Category[];
  value: Record<string, number>;
  onChange: (mapping: Record<string, number>) => void;
}) {
  const taken = new Set(Object.values(value));
  return (
    <div className="grid-form">
      {board.definition.slots.map((slot) => (
        <SlotRow
          key={slot}
          slot={slot}
          categories={categories}
          value={value[slot]}
          taken={taken}
          onChange={(id) => {
            const next = { ...value };
            if (id) next[slot] = id;
            else delete next[slot];
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

function SlotRow({ slot, categories, value, taken, onChange }: { slot: string; categories: Category[]; value?: number; taken: Set<number>; onChange: (id: number | null) => void }) {
  const current = categories.find((c) => c.id === value);
  return (
    <>
      <label>
        <span className="dot" style={{ background: current?.color ?? "var(--border)" }} /> Slot {slot}
      </label>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Choose a category…</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id} disabled={taken.has(c.id) && c.id !== value}>
            {c.name} ({c.card_count} cards)
          </option>
        ))}
      </select>
    </>
  );
}

function StartedGame({ game, header, error, children }: { game: GameDetail; header: React.ReactNode; error: unknown; children: React.ReactNode }) {
  const snap = game.snapshot!;
  const mapping = snapshotMapping(snap);
  return (
    <section className="panel">
      {header}
      <ErrorBox error={error} />
      <details>
        <summary className="small muted">
          Started {new Date(game.started_at!).toLocaleString()}
          {game.finished_at && ` · finished ${new Date(game.finished_at).toLocaleString()}`} · {snap.board.name} · {snap.deck.name}
        </summary>
        <p className="muted small">This is the snapshot taken at start: later edits to the board, deck or categories don't change it.</p>
        <dl className="grid-form">
          <dt>Board</dt>
          <dd>{snap.board.name}</dd>
          <dt>Deck</dt>
          <dd>
            {snap.deck.name} ({snap.deck.cards.length} cards)
          </dd>
          {Object.entries(mapping).map(([slot, c]) => (
            <SnapshotSlot key={slot} slot={slot} name={c.name} color={c.color} />
          ))}
        </dl>
        <div className="row between">{children}</div>
      </details>
    </section>
  );
}

function SnapshotSlot({ slot, name, color }: { slot: string; name: string; color: string }) {
  return (
    <>
      <dt>Slot {slot}</dt>
      <dd>
        <span className="dot" style={{ background: color }} /> {name}
      </dd>
    </>
  );
}
