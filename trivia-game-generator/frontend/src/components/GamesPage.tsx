import { useEffect, useState } from "react";
import { api, type Board, type Category, type Deck, type GameDetail, type GameInput } from "../api";
import type { SlotMapping } from "../engine/types";
import { BoardPreview, ErrorBox, StatusBadge, categoryMapping, toBoardFile, useAction, useList } from "./common";

export function GamesPage({ orgId }: { orgId: number }) {
  const games = useList(() => api.listGames(orgId), [orgId]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const create = useAction();

  useEffect(() => {
    if (!games.items.some((g) => g.id === selectedId)) setSelectedId(games.items[0]?.id ?? null);
  }, [games.items, selectedId]);

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
              setSelectedId(g.id);
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
              <button className={g.id === selectedId ? "on" : ""} onClick={() => setSelectedId(g.id)}>
                <span>{g.name}</span>
                <StatusBadge status={g.status} />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div className="org-detail">
        {selectedId ? <GameEditor key={selectedId} gameId={selectedId} orgId={orgId} onChanged={games.reload} /> : <p className="muted">Create a game to get started.</p>}
      </div>
    </div>
  );
}

function GameEditor({ gameId, orgId, onChanged }: { gameId: number; orgId: number; onChanged: () => Promise<void> }) {
  const [game, setGame] = useState<GameDetail | null>(null);
  const boards = useList(() => api.listBoards(orgId), [orgId]);
  const decks = useList(() => api.listDecks(orgId), [orgId]);
  const categories = useList(() => api.listCategories(orgId), [orgId]);
  const action = useAction();

  useEffect(() => {
    api.getGame(gameId).then(setGame, action.setError);
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) return <ErrorBox error={action.error} />;

  const apply = (next: GameDetail) => {
    setGame(next);
    return onChanged();
  };
  const update = (body: GameInput) => action.run(async () => apply(await api.updateGame(game.id, body)));

  const header = (
    <div className="row between">
      <h2>
        {game.name} <StatusBadge status={game.status} />
      </h2>
      <span className="muted small">created by {game.creator_name ?? "a deleted user"}</span>
    </div>
  );

  if (game.status !== "not_started") {
    return (
      <StartedGame game={game} header={header} error={action.error}>
        {game.status === "running" && (
          <button className="primary" onClick={() => action.run(async () => apply(await api.finishGame(game.id)))}>
            Mark as finished
          </button>
        )}
        <button className="danger" onClick={() => confirm(`Delete game "${game.name}"?`) && action.run(async () => (await api.deleteGame(game.id), onChanged()))}>
          Delete game
        </button>
      </StartedGame>
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
        {board && <BoardPreview board={toBoardFile(board)} mapping={categoryMapping(board.definition, game.categories, categories.items)} />}
      </section>

      <section className="panel">
        <h2>Players · {game.players.length}</h2>
        <PlayersEditor names={game.players.map((p) => p.name)} onChange={(names) => update({ players: names.map((name) => ({ name })) })} />
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
          <div className="ok">Ready to start. Starting copies the board, deck and categories into the game, so later edits won't change it.</div>
        )}
        <div className="row between">
          <button className="primary" disabled={game.setup_errors.length > 0 || action.busy} onClick={() => action.run(async () => apply(await api.startGame(game.id)))}>
            ▶ Start game
          </button>
          <button className="danger" onClick={() => confirm(`Delete game "${game.name}"?`) && action.run(async () => (await api.deleteGame(game.id), onChanged()))}>
            Delete game
          </button>
        </div>
      </section>
    </>
  );
}

function SetupForm({ game, boards, decks, onSave }: { game: GameDetail; boards: Board[]; decks: Deck[]; onSave: (body: GameInput) => void }) {
  const [name, setName] = useState(game.name);
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
            {b.name} ({b.definition.slots.length} slots)
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

function PlayersEditor({ names, onChange }: { names: string[]; onChange: (names: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const move = (i: number, d: number) => {
    const next = [...names];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <>
      <ol className="players-list">
        {names.map((n, i) => (
          <li key={`${i}-${n}`} className="row between">
            <span>{n}</span>
            <span className="row">
              <button className="small" disabled={i === 0} onClick={() => move(i, -1)} title="Earlier in turn order">
                ↑
              </button>
              <button className="small" disabled={i === names.length - 1} onClick={() => move(i, 1)} title="Later in turn order">
                ↓
              </button>
              <button className="small danger" onClick={() => onChange(names.filter((_, j) => j !== i))}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ol>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onChange([...names, draft.trim()]);
          setDraft("");
        }}
      >
        <input placeholder="Player name (doesn't need an account)" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="small" disabled={names.length >= 12}>
          + Add player
        </button>
      </form>
      <p className="muted small">The order is the turn order.</p>
    </>
  );
}

function StartedGame({ game, header, error, children }: { game: GameDetail; header: React.ReactNode; error: unknown; children: React.ReactNode }) {
  const snap = game.snapshot!;
  const byId = new Map(snap.deck.categories.map((c) => [c.id, c]));
  const mapping: SlotMapping = Object.fromEntries(Object.entries(snap.mapping).map(([slot, id]) => [slot, byId.get(id)!]));
  return (
    <>
      <section className="panel">
        {header}
        <p className="muted small">
          Started {new Date(game.started_at!).toLocaleString()}
          {game.finished_at && ` · finished ${new Date(game.finished_at).toLocaleString()}`}. This is the snapshot taken at start: later edits to the board, deck or
          categories don't change it.
        </p>
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
          <dt>Players</dt>
          <dd>{game.players.map((p) => p.name).join(", ")}</dd>
        </dl>
        <BoardPreview board={snap.board} mapping={mapping} />
      </section>
      <section className="panel">
        <ErrorBox error={error} />
        <p className="muted small">Playing a stored game in the browser comes in a later step.</p>
        <div className="row between">{children}</div>
      </section>
    </>
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
