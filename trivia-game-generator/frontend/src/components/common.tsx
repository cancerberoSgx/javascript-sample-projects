import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ApiError, type Board, type BoardDefinition, type GameSnapshot } from "../api";
import { placeholderMapping, resolveBoard } from "../engine/resolve";
import type { Background, BoardFile, Category, SlotMapping } from "../engine/types";
import { BoardCanvas } from "./BoardCanvas";

/** Shows an error; server validation lists are shown as bullet points. */
export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const details = error instanceof ApiError ? error.details : [];
  return (
    <div className="error">
      {details.length > 1 ? (
        <ul>
          {details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : (
        String((error as Error).message ?? error)
      )}
    </div>
  );
}

/** Loads a list and reloads it on demand. Re-runs when `deps` change. */
export function useList<T>(load: () => Promise<T[]>, deps: unknown[]) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<unknown>(null);
  /** True once the first load finished (successfully or not). */
  const [loaded, setLoaded] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fn = useCallback(load, deps);
  const reload = useCallback(async () => {
    try {
      setItems(await fn());
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoaded(true);
    }
  }, [fn]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { items, error, loaded, reload };
}

/** Navigation state saying which organization the target item belongs to, so the app
 *  doesn't have to look it up (see ContentRoute in App.tsx). */
export interface RouteState {
  orgId?: number;
}

/**
 * The list item selected by the URL (`/games/:id`). On the bare list URL (`/games`) it opens
 * the first item, so the address bar always names what's on screen. `missing` is true when
 * the URL names an item that isn't in the loaded list (deleted, other organization, typo).
 */
export function useRouteSelection<T extends { id: number }>(
  base: string,
  list: { items: T[]; loaded: boolean; error: unknown },
  orgId?: number,
  { autoSelect = true } = {},
) {
  const { id } = useParams();
  const navigate = useNavigate();
  const selectedId = id === undefined ? null : Number(id);
  const first = list.items[0]?.id;

  const select = useCallback(
    (itemId: number | null, replace = false) => navigate(itemId === null ? base : `${base}/${itemId}`, { replace, state: { orgId } satisfies RouteState }),
    [navigate, base, orgId],
  );

  useEffect(() => {
    if (autoSelect && id === undefined && first !== undefined) select(first, true);
  }, [autoSelect, id, first, select]);

  const selected = list.items.find((i) => i.id === selectedId) ?? null;
  const missing = list.loaded && !list.error && selectedId !== null && !selected;
  return { selectedId, selected, select, missing };
}

/** Shown when the URL names something that doesn't exist (or that you can't see). */
export function NotFound({ what, back }: { what: string; back?: string }) {
  return (
    <section className="panel">
      <h2>{what} not found</h2>
      <p className="muted">It may have been deleted, or it belongs to another organization.</p>
      {back && <Link to={back}>← Back to the list</Link>}
    </section>
  );
}

/** Runs an async action, keeping its error for display. */
export function useAction() {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, error, busy, setError };
}

export function boardFile(name: string, definition: BoardDefinition, description = ""): BoardFile {
  return { schema_version: 2, name, description, ...definition };
}

export const toBoardFile = (b: Board) => boardFile(b.name, b.definition, b.description);

/** Draws a board. Slots without a category in `mapping` get placeholder colors ("Slot A").
 *  `background` replaces the board's own (a game's background, BKG-5); undefined keeps it. */
export function BoardPreview({ board, mapping = {}, background }: { board: BoardFile; mapping?: SlotMapping; background?: Background | null }) {
  let resolved;
  try {
    resolved = resolveBoard(board, { ...placeholderMapping(board), ...mapping });
    if (!resolved.spaces.every((s) => s.pos && Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y))) throw new Error();
  } catch {
    return <p className="muted small">This board can't be drawn yet.</p>;
  }
  return <BoardCanvas board={resolved} background={background === undefined ? board.background : background} game={null} onSpaceClick={() => {}} onHover={() => {}} />;
}

export function categoryMapping(board: BoardFile | BoardDefinition, slots: Record<string, number>, categories: { id: number; name: string; color: string; description?: string }[]): SlotMapping {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out: SlotMapping = {};
  for (const slot of board.slots) {
    const c = byId.get(slots[slot]);
    if (c) out[slot] = { id: String(c.id), name: c.name, color: c.color } satisfies Category;
  }
  return out;
}

/** A started game's slot mapping, from its snapshot (slot -> the deck's category). */
export function snapshotMapping(snap: GameSnapshot): SlotMapping {
  const byId = new Map(snap.deck.categories.map((c) => [c.id, c]));
  return Object.fromEntries(Object.entries(snap.mapping).map(([slot, id]) => [slot, byId.get(id)!]));
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`chip status-${status}`}>{status}</span>;
}
