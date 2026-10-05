import { useEffect, useMemo, useState } from "react";
import { api, type Board, type BoardDefinition } from "../api";
import { resolveConfig } from "../engine/board";
import { loadManifest, type ManifestEntry } from "../engine/loader";
import { validateBoardFile } from "../engine/resolve";
import type { BoardFile } from "../engine/types";
import { BoardPreview, ErrorBox, NotFound, boardFile, useAction, useList, useRouteSelection } from "./common";
import { NameForm } from "./DecksPage";

const BLANK: BoardDefinition = {
  config: { track_type: "linear", win_conditions: ["finish"] },
  slots: ["A", "B"],
  spaces: [
    { index: 0, type: "start", slot: null, next: [1], pos: { x: 0, y: 0 } },
    { index: 1, type: "category", slot: "A", next: [2], pos: { x: 1, y: 0 } },
    { index: 2, type: "category", slot: "B", next: [3], pos: { x: 2, y: 0 } },
    { index: 3, type: "category", slot: "A", next: [4], pos: { x: 3, y: 0 } },
    { index: 4, type: "finish", slot: null, next: [], pos: { x: 4, y: 0 } },
  ],
};

/** Pretty-prints a definition with one space per line, like the example files. */
export function formatDefinition(d: BoardDefinition): string {
  const spaces = d.spaces.map((s) => "    " + JSON.stringify(s)).join(",\n");
  return `{\n  "config": ${JSON.stringify(d.config)},\n  "slots": ${JSON.stringify(d.slots)},\n  "spaces": [\n${spaces}\n  ]\n}`;
}

export function BoardsPage({ orgId }: { orgId: number }) {
  const boards = useList(() => api.listBoards(orgId), [orgId]);
  const { selectedId, selected, select, missing } = useRouteSelection("/boards", boards, orgId);
  const [creating, setCreating] = useState(false);
  const [examples, setExamples] = useState<ManifestEntry[]>([]);
  const [template, setTemplate] = useState("blank");

  useEffect(() => {
    loadManifest().then((m) => setExamples(m.boards), () => {});
  }, []);

  return (
    <div className="orgs-page">
      <section className="panel org-list">
        <div className="row between">
          <h2>Boards</h2>
          <button className="small" onClick={() => setCreating(true)}>
            + New
          </button>
        </div>
        <ErrorBox error={boards.error} />
        {creating && (
          <NameForm
            placeholder="Board name"
            onCancel={() => setCreating(false)}
            onSave={async (name, description) => {
              let definition = BLANK;
              if (template !== "blank") {
                const file: BoardFile = await (await fetch(import.meta.env.BASE_URL + template)).json();
                definition = { config: file.config, slots: file.slots, spaces: file.spaces };
              }
              const b = await api.createBoard({ organization_id: orgId, name, description, definition });
              setCreating(false);
              await boards.reload();
              select(b.id);
            }}
          >
            <select value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="blank">Start from: blank board</option>
              {examples.map((e) => (
                <option key={e.file} value={e.file}>
                  Start from: {e.name}
                </option>
              ))}
            </select>
          </NameForm>
        )}
        <ul>
          {boards.items.map((b) => (
            <li key={b.id}>
              <button className={b.id === selectedId ? "on" : ""} onClick={() => select(b.id)}>
                <span>{b.name}</span>
                <span className="muted small">
                  {b.definition.spaces.length} spaces · {b.definition.slots.length} slots
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div className="org-detail">
        {missing ? (
          <NotFound what="Board" back="/boards" />
        ) : selected ? (
          <BoardEditor key={selected.id} board={selected} onChanged={boards.reload} onDeleted={async () => (await boards.reload(), select(null, true))} />
        ) : (
          boards.loaded && !boards.items.length && <p className="muted">Create a board to get started.</p>
        )}
      </div>
    </div>
  );
}

function BoardEditor({ board, onChanged, onDeleted }: { board: Board; onChanged: () => Promise<void>; onDeleted: () => Promise<void> }) {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description);
  const [json, setJson] = useState(() => formatDefinition(board.definition));
  const action = useAction();
  const [saved, setSaved] = useState(false);

  // Parse + validate as you type (same rules as the backend, rules.md BRD-*)
  const parsed = useMemo((): { file: BoardFile | null; errors: string[] } => {
    try {
      const d = JSON.parse(json) as BoardDefinition;
      if (!Array.isArray(d.slots) || !Array.isArray(d.spaces)) return { file: null, errors: ["Needs \"slots\" and \"spaces\" arrays"] };
      const file = boardFile(name, d, description);
      return { file, errors: validateBoardFile(file) };
    } catch (e) {
      return { file: null, errors: [`Invalid JSON: ${(e as Error).message}`] };
    }
  }, [json, name, description]);

  const config = parsed.file ? resolveConfig({ ...parsed.file, categories: [], spaces: [] }) : null;

  return (
    <>
      <section className="panel">
        <h2>Board</h2>
        <div className="grid-form">
          <label>Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
          <label>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {parsed.file && <BoardPreview board={parsed.file} />}
        {config && (
          <p className="muted small">
            {config.track_type} track · {parsed.file!.spaces.length} spaces · slots {parsed.file!.slots.join(", ")} · wins: {config.win_conditions.join(", ")}. A game
            chooses which category plays each slot.
          </p>
        )}
      </section>
      <section className="panel">
        <div className="row between">
          <h2>Definition (JSON)</h2>
          <span className={`small ${parsed.errors.length ? "error-text" : "ok-text"}`}>
            {parsed.errors.length ? `${parsed.errors.length} problem(s)` : "✓ valid"}
          </span>
        </div>
        <p className="muted small">
          <code>config</code> overrides the defaults in rules.md §1. Each space has a <code>type</code>, a <code>slot</code> (for category and hq spaces),{" "}
          <code>next</code> (more than one = fork) and a grid <code>pos</code>.
        </p>
        <textarea className="json-edit" spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} rows={18} />
        {parsed.errors.length > 0 && (
          <div className="error">
            <ul>
              {parsed.errors.slice(0, 10).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        <ErrorBox error={action.error} />
        {saved && !action.error && <div className="ok">Saved.</div>}
        <div className="row between">
          <button
            className="primary"
            disabled={!parsed.file || parsed.errors.length > 0 || action.busy}
            onClick={async () => {
              setSaved(false);
              const d = JSON.parse(json) as BoardDefinition;
              const ok = await action.run(async () => (await api.updateBoard(board.id, { name, description, definition: d }), onChanged()));
              setSaved(ok);
            }}
          >
            Save board
          </button>
          <button
            className="danger"
            onClick={() => confirm(`Delete board "${board.name}"?`) && action.run(async () => (await api.deleteBoard(board.id), onDeleted()))}
          >
            Delete board
          </button>
        </div>
      </section>
    </>
  );
}
