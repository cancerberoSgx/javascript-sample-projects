import { useCallback, useEffect, useRef, useState } from "react";
import { api, type BoardDefinition } from "../api";
import { BoardEditor } from "../boardEditor/BoardEditor";
import { loadManifest, type ManifestEntry } from "../engine/loader";
import type { BoardFile } from "../engine/types";
import { ErrorBox, hasErrors, NotFound, PublicChip, useAction, useList, useRouteSelection } from "./common";
import { NameForm } from "./DecksPage";
import { ImportButton, readJsonFile } from "./files";

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

export function BoardsPage({ orgId }: { orgId: number }) {
  const boards = useList(() => api.listBoards(orgId), [orgId]);
  const { selectedId, selected, select: navigateTo, missing } = useRouteSelection("/boards", boards, orgId);
  // Leaving a board with unsaved edits asks first
  const dirty = useRef(false);
  const onDirtyChange = useCallback((d: boolean) => void (dirty.current = d), []);
  const leaveOk = () => !dirty.current || confirm("This board has unsaved changes. Leave without saving?");
  const select = (id: number) => {
    if (id !== selectedId && leaveOk()) navigateTo(id);
  };
  const [creating, setCreating] = useState(false);
  const [examples, setExamples] = useState<ManifestEntry[]>([]);
  const [template, setTemplate] = useState("blank");
  const importing = useAction();
  const [imported, setImported] = useState<string | null>(null);

  const importFile = (file: File) => {
    if (!leaveOk()) return;
    setImported(null);
    importing.run(async () => {
      const { board, background_image_missing } = await api.importBoard(await readJsonFile(file), orgId);
      dirty.current = false;
      await boards.reload();
      navigateTo(board.id);
      setImported(
        [
          `Imported "${board.name}".`,
          hasErrors(board) && "It has errors, so it's a draft until they're fixed.",
          background_image_missing &&
            "Its background image isn't in your image library, so it was left out (the other background settings were kept). Pick an image in the Background panel.",
        ]
          .filter(Boolean)
          .join(" "),
      );
    });
  };

  useEffect(() => {
    loadManifest().then((m) => setExamples(m.boards), () => {});
  }, []);

  return (
    <div className="orgs-page">
      <section className="panel org-list">
        <div className="row between">
          <h2>Boards</h2>
          <div className="row">
            <ImportButton label="⬆ Import" disabled={importing.busy} onFile={importFile} />
            <button className="small" onClick={() => leaveOk() && setCreating(true)}>
              + New
            </button>
          </div>
        </div>
        <ErrorBox error={boards.error} />
        <ErrorBox error={importing.error} />
        {imported && <div className="ok small">{imported}</div>}
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
              navigateTo(b.id);
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
                  {hasErrors(b) && <span className="chip draft">draft</span>} <PublicChip item={b} /> {b.definition.spaces.length} spaces · {b.definition.slots.length} slots
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
          <BoardEditor
            key={selected.id}
            board={selected}
            onChanged={boards.reload}
            onDirtyChange={onDirtyChange}
            onDeleted={async () => {
              dirty.current = false;
              await boards.reload();
              navigateTo(null, true);
            }}
          />
        ) : (
          boards.loaded && !boards.items.length && <p className="muted">Create a board to get started.</p>
        )}
      </div>
    </div>
  );
}
