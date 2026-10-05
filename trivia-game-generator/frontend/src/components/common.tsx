import { useCallback, useEffect, useState } from "react";
import { ApiError, type Board, type BoardDefinition } from "../api";
import { placeholderMapping, resolveBoard, validateSlots } from "../engine/resolve";
import type { BoardFile, Category, SlotMapping } from "../engine/types";
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fn = useCallback(load, deps);
  const reload = useCallback(async () => {
    try {
      setItems(await fn());
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [fn]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { items, error, reload };
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

/** Draws a board. Slots without a category in `mapping` get placeholder colors ("Slot A"). */
export function BoardPreview({ board, mapping = {} }: { board: BoardFile; mapping?: SlotMapping }) {
  if (validateSlots(board).length) return <p className="muted small">Fix the slots to see a preview.</p>;
  let resolved;
  try {
    resolved = resolveBoard(board, { ...placeholderMapping(board), ...mapping });
    if (!resolved.spaces.every((s) => s.pos && Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y))) throw new Error();
  } catch {
    return <p className="muted small">This board can't be drawn yet.</p>;
  }
  return <BoardCanvas board={resolved} game={null} onSpaceClick={() => {}} onHover={() => {}} />;
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

export function StatusBadge({ status }: { status: string }) {
  return <span className={`chip status-${status}`}>{status.replace("_", " ")}</span>;
}
