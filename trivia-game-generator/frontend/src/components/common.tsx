import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api, ApiError, type Board, type BoardDefinition, type GameSnapshot, type ShareableKind, type Sharing } from "../api";
import { placeholderMapping, resolveBoard } from "../engine/resolve";
import type { Background, BoardFile, Category, SlotMapping } from "../engine/types";
import { errorText, useT } from "../i18n";
import { BoardCanvas } from "./BoardCanvas";

/** Shows an error; server validation lists are shown as bullet points. */
export function ErrorBox({ error }: { error: unknown }) {
  const t = useT();
  if (!error) return null;
  const details = error instanceof ApiError ? error.details : [];
  // Errors players can see come with a catalog key (I18N-7)
  if (error instanceof ApiError && error.code) return <div className="error">{errorText(t, error)}</div>;
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

/** Any validation error makes a board a draft (SER-5): no games, no publishing (SHR-2). */
export const hasErrors = (b: Pick<Board, "issues">) => b.issues.some((i) => i.severity === "error");

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

// ---------- sharing (rules.md §2.8, SHR-*) ----------

/** "public" marker for lists. */
export function PublicChip({ item }: { item: Sharing }) {
  return item.visibility === "public" ? (
    <span className="chip public" title="Public: listed in the Library, where every organization can copy it">
      🌐 public
    </span>
  ) : null;
}

/** "Copied from “General” by Default", for copies made from the Library (SHR-3). */
export function CopiedFromNote({ item }: { item: Sharing }) {
  if (!item.copied_from) return null;
  return (
    <p className="muted small copied-from">
      ⧉ Copied from “{item.copied_from.name}” by {item.copied_from.organization_name}
    </p>
  );
}

/**
 * Publishes an item to the Library or makes it private again (SHR-1). Copies others already made
 * stay theirs. `blocked` says why it can't be published right now (SHR-2: drafts, empty decks).
 */
export function PublishControl<T extends Sharing & { id: number; name: string }>({
  kind,
  item,
  onChanged,
  blocked,
  compact = false,
}: {
  kind: ShareableKind;
  item: T;
  onChanged: (updated: T) => unknown;
  blocked?: string | null;
  compact?: boolean;
}) {
  const action = useAction();
  const isPublic = item.visibility === "public";
  const toggle = () => {
    const ok = isPublic
      ? confirm(`Make “${item.name}” private? It leaves the Library. Copies other organizations already made stay theirs.`)
      : confirm(`Publish “${item.name}” to the Library? Every organization will be able to see it and copy it.`);
    if (ok) action.run(async () => onChanged(await api.setVisibility<T>(kind, item.id, isPublic ? "private" : "public")));
  };
  const button = (
    <button
      className={`small ${compact ? "tiny" : ""}`}
      disabled={action.busy || (!isPublic && !!blocked)}
      title={!isPublic && blocked ? blocked : isPublic ? "Remove it from the Library" : "List it in the Library for every organization"}
      onClick={toggle}
    >
      {isPublic ? (compact ? "Unpublish" : "Make private") : compact ? "Publish" : "🌐 Publish to Library"}
    </button>
  );
  if (compact)
    return (
      <>
        {button}
        <ErrorBox error={action.error} />
      </>
    );
  return (
    <div className="publish-control">
      <span className={`chip ${isPublic ? "public" : ""}`}>{isPublic ? "🌐 Public" : "🔒 Private"}</span>
      <span className="muted small">
        {isPublic
          ? `In the Library since ${new Date(item.published_at!).toLocaleDateString()}: every organization can copy it.`
          : blocked ?? "Only your organization sees it."}
      </span>
      {button}
      <ErrorBox error={action.error} />
    </div>
  );
}
