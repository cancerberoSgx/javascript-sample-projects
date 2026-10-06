import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { api, type Board } from "../api";
import { DEFAULT_CONFIG, SPACE_TYPE_NAMES, WIN_CONDITION_NAMES, resolveConfig, validateBoardFile } from "../engine/board";
import { SLOT_COLORS, placeholderMapping, resolveBoard } from "../engine/resolve";
import type { BoardIssue, GameConfig, SpaceType, WinCondition } from "../engine/types";
import { ErrorBox, boardFile, useAction } from "../components/common";
import { BackgroundEditor, boardAspect } from "../components/BackgroundEditor";
import { EditorCanvas, type Pending, type Selection } from "./EditorCanvas";
import * as ops from "./ops";
import type { Def, Pos } from "./ops";

// ---------- state: the definition with undo/redo, the selection, a pending arrow ----------

interface State {
  past: Def[];
  present: Def;
  future: Def[];
  selection: Selection;
  pending: Pending;
  /** Edits with the same key in a row (typing in a field or the JSON) are one undo step. */
  coalesce: string | null;
}

type Action =
  | { type: "edit"; def: Def; select?: Selection; coalesce?: string; raw?: boolean }
  | { type: "select"; selection: Selection }
  | { type: "pending"; pending: Pending }
  | { type: "undo" | "redo" };

const HISTORY = 100;

function remap(selection: Selection, map: Map<number, number>, def: Def): Selection {
  if (!selection) return null;
  if (selection.kind === "space") return map.has(selection.index) ? { kind: "space", index: map.get(selection.index)! } : null;
  const from = map.get(selection.from);
  const to = map.get(selection.to);
  return from !== undefined && to !== undefined && def.spaces.find((s) => s.index === from)?.next.includes(to) ? { kind: "arrow", from, to } : null;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "edit": {
      // Visual edits renumber the spaces in path order; raw JSON edits are kept as typed
      const { def, map } = action.raw ? { def: action.def, map: new Map(action.def.spaces.map((s) => [s.index, s.index])) } : ops.normalize(action.def);
      if (JSON.stringify(def) === JSON.stringify(state.present)) return { ...state, selection: remap(action.select === undefined ? state.selection : action.select, map, def), pending: null };
      const merge = action.coalesce && action.coalesce === state.coalesce;
      return {
        past: merge ? state.past : [...state.past, state.present].slice(-HISTORY),
        present: def,
        future: [],
        selection: remap(action.select === undefined ? state.selection : action.select, map, def),
        pending: null,
        coalesce: action.coalesce ?? null,
      };
    }
    case "select":
      return { ...state, selection: action.selection, pending: null };
    case "pending":
      return { ...state, pending: action.pending };
    case "undo":
    case "redo": {
      const [from, to] = action.type === "undo" ? [state.past, state.future] : [state.future, state.past];
      if (!from.length) return state;
      const present = from[from.length - 1];
      const rest = from.slice(0, -1);
      const other = [...to, state.present];
      const keep = (sel: Selection) => (sel?.kind === "space" && present.spaces.some((s) => s.index === sel.index) ? sel : null);
      return action.type === "undo"
        ? { ...state, past: rest, present, future: other, selection: keep(state.selection), pending: null, coalesce: null }
        : { ...state, future: rest, present, past: other, selection: keep(state.selection), pending: null, coalesce: null };
    }
  }
}

/** Pretty-prints a definition with one space per line, like the example files. */
export function formatDefinition(d: Def): string {
  const spaces = d.spaces.map((s) => "    " + JSON.stringify(s)).join(",\n");
  const background = d.background ? `,\n  "background": ${JSON.stringify(d.background)}` : "";
  return `{\n  "config": ${JSON.stringify(d.config)},\n  "slots": ${JSON.stringify(d.slots)},\n  "spaces": [\n${spaces}\n  ]${background}\n}`;
}

const TYPES: SpaceType[] = ["category", "hq", "wildcard", "roll_again", "penalty", "start", "finish"];
const TYPE_COLORS: Partial<Record<SpaceType, string>> = {
  start: "var(--space-start)",
  finish: "var(--space-finish)",
  roll_again: "var(--space-roll)",
  penalty: "var(--space-penalty)",
  wildcard: "var(--space-wild)",
};
const slotColor = (def: Def, slot: string | null) => (slot && def.slots.includes(slot) ? SLOT_COLORS[def.slots.indexOf(slot) % SLOT_COLORS.length] : "var(--muted)");
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

// ---------- the editor ----------

export function BoardEditor({
  board,
  onChanged,
  onDeleted,
  onDirtyChange,
}: {
  board: Board;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description);
  const [state, dispatch] = useReducer(reducer, null, (): State => ({
    past: [],
    present: board.definition,
    future: [],
    selection: null,
    pending: null,
    coalesce: null,
  }));
  const [saved, setSaved] = useState({ def: board.definition, name: board.name, description: board.description });
  const [justSaved, setJustSaved] = useState(false);
  const [cell, setCell] = useState(64);
  const [focus, setFocus] = useState<BoardIssue | null>(null);
  const action = useAction();
  const def = state.present;

  const dirty = JSON.stringify(def) !== JSON.stringify(saved.def) || name !== saved.name || description !== saved.description;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const file = useMemo(() => boardFile(name, def, description), [name, def, description]);
  const issues = useMemo(() => validateBoardFile(file), [file]);
  const errors = issues.filter((i) => i.severity === "error");
  const resolved = useMemo(() => resolveBoard(file, placeholderMapping(file)), [file]);
  const config = resolveConfig(def);
  const marks = useMemo(() => {
    const m = new Map<number, "error" | "warning">();
    for (const i of issues) for (const s of i.spaces) if (m.get(s) !== "error") m.set(s, i.severity);
    return m;
  }, [issues]);

  const edit = (next: Def, select?: Selection, coalesce?: string) => {
    setJustSaved(false);
    dispatch({ type: "edit", def: next, select, coalesce });
  };
  const selected = state.selection?.kind === "space" ? def.spaces.find((s) => s.index === (state.selection as { index: number }).index) : undefined;

  const cellClick = (pos: Pos, space: number | null) => {
    const { selection, pending } = state;
    if (pending) {
      let target = space;
      let d = def;
      if (target === null) {
        ({ def: d, index: target } = ops.addSpace(def, pos, null));
        const slot = ops.slotAfter(def, pending.from);
        if (slot && d.spaces[target].type === "category") d = ops.setSlot(d, target, slot);
      }
      if (target === pending.from) return dispatch({ type: "pending", pending: null });
      d = pending.kind === "arrow" ? ops.setArrow(d, pending.from, target) : ops.addBranch(d, pending.from, target);
      return edit(d, { kind: "space", index: space === null ? target : pending.from });
    }
    if (space !== null) {
      const again = selection?.kind === "space" && selection.index === space;
      return dispatch({ type: "select", selection: again ? null : { kind: "space", index: space } });
    }
    const r =
      selection?.kind === "arrow"
        ? ops.insertOnArrow(def, selection.from, selection.to, pos)
        : ops.addSpace(def, pos, selection?.kind === "space" ? selection.index : null);
    edit(r.def, { kind: "space", index: r.index });
  };

  const deleteSelection = () => {
    const sel = state.selection;
    if (sel?.kind === "space" && def.spaces.length > 1) edit(ops.deleteSpace(def, sel.index), null);
    if (sel?.kind === "arrow") edit(ops.removeArrow(def, sel.from, sel.to), null);
  };

  // Keyboard: Esc, Delete, undo/redo, A = arrow, B = branch
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") dispatch({ type: e.shiftKey ? "redo" : "undo" });
    else if (mod && e.key.toLowerCase() === "y") dispatch({ type: "redo" });
    else if (e.key === "Escape") dispatch(state.pending ? { type: "pending", pending: null } : { type: "select", selection: null });
    else if (e.key === "Delete" || e.key === "Backspace") deleteSelection();
    else if (selected && selected.type !== "finish" && (e.key === "a" || e.key === "b"))
      dispatch({ type: "pending", pending: { kind: e.key === "a" ? "arrow" : "branch", from: selected.index } });
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const hint = state.pending
    ? `Click the space the new ${state.pending.kind === "arrow" ? "arrow" : "branch"} from space ${state.pending.from} should point to, or an empty cell to create it. Esc cancels.`
    : state.selection?.kind === "space"
      ? `Click an empty cell to add the next space after space ${state.selection.index}. Drag a space to move it. Esc deselects.`
      : state.selection?.kind === "arrow"
        ? "Click an empty cell to put a new space on this arrow, or use the panel to reverse or delete it."
        : def.spaces.length
          ? "Click an empty cell to add a space, click a space or an arrow to edit it, drag a space to move it."
          : "Click any cell to place the start space.";

  return (
    <>
      <section className="panel">
        <div className="row between wrap">
          <h2>Board</h2>
          <span className="row small">
            {dirty ? <span className="muted">● Unsaved changes</span> : justSaved && <span className="ok-text">✓ Saved</span>}
          </span>
        </div>
        <div className="grid-form">
          <label>Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
          <label>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <ErrorBox error={action.error} />
        <div className="row between wrap">
          <div className="row wrap">
            <button
              className="primary"
              disabled={!name.trim() || action.busy || !dirty}
              onClick={async () => {
                const snapshot = { def, name, description };
                const ok = await action.run(async () => (await api.updateBoard(board.id, { name, description, definition: def }), onChanged()));
                if (ok) (setSaved(snapshot), setJustSaved(true));
              }}
            >
              {errors.length ? "Save draft" : "Save board"}
            </button>
            <StatusLine errors={errors.length} warnings={issues.length - errors.length} />
          </div>
          <button
            className="danger"
            onClick={() => confirm(`Delete board "${board.name}"?`) && action.run(async () => (await api.deleteBoard(board.id), onDeleted()))}
          >
            Delete board
          </button>
        </div>
      </section>

      <div className="board-editor">
        <section className="panel editor-main">
          <div className="row between wrap">
            <div className="row">
              <button className="small" title="Undo (Ctrl+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })}>
                ↶ Undo
              </button>
              <button className="small" title="Redo (Ctrl+Shift+Z)" disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })}>
                ↷ Redo
              </button>
            </div>
            <div className="row">
              <span className="muted small">Zoom</span>
              <button className="small" aria-label="Zoom out" disabled={cell <= 40} onClick={() => setCell((c) => c - 12)}>
                −
              </button>
              <button className="small" aria-label="Zoom in" disabled={cell >= 112} onClick={() => setCell((c) => c + 12)}>
                +
              </button>
            </div>
          </div>
          <p className={`hint small ${state.pending ? "active" : ""}`}>{hint}</p>
          <EditorCanvas
            board={resolved}
            background={def.background}
            cell={cell}
            selection={state.selection}
            pending={state.pending}
            marks={marks}
            focus={focus?.spaces ?? []}
            onCellClick={cellClick}
            onArrowClick={(from, to) => dispatch({ type: "select", selection: { kind: "arrow", from, to } })}
            onMove={(index, pos) => edit(ops.moveSpace(def, index, pos), { kind: "space", index })}
            overlay={(center, tile) =>
              selected && (
                <Halo
                  key={selected.index}
                  center={center}
                  tile={tile}
                  def={def}
                  space={selected}
                  linear={config.track_type === "linear"}
                  onEdit={(d, coalesce) => edit(d, undefined, coalesce)}
                  onPending={(kind) => dispatch({ type: "pending", pending: { kind, from: selected.index } })}
                  onDelete={deleteSelection}
                />
              )
            }
          />
          <Legend />
        </section>

        <div className="editor-side">
          <Inspector def={def} state={state} dispatch={dispatch} edit={edit} onDelete={deleteSelection} />
          <ChecksPanel
            issues={issues}
            linear={config.track_type === "linear"}
            collection={config.win_conditions.includes("collection")}
            onFocus={setFocus}
            onPick={(i) => i.spaces.length && dispatch({ type: "select", selection: { kind: "space", index: i.spaces[0] } })}
          />
          <SlotsPanel def={def} edit={edit} focusSlot={focus?.slot ?? null} />
          <SettingsPanel def={def} edit={edit} />
          <section className="panel">
            <h2>Background</h2>
            <p className="muted small">The board's default look. Each game can choose its own instead.</p>
            <BackgroundEditor
              orgId={board.organization_id}
              value={def.background ?? {}}
              aspect={boardAspect(def)}
              onChange={(bg, coalesce) => edit(ops.setBackground(def, bg), undefined, coalesce)}
            />
          </section>
        </div>
      </div>

      <JsonPanel def={def} onChange={(d) => (setJustSaved(false), dispatch({ type: "edit", def: d, raw: true, coalesce: "json" }))} />
    </>
  );
}

function StatusLine({ errors, warnings }: { errors: number; warnings: number }) {
  if (!errors)
    return (
      <span className="small ok-text">
        ✓ Playable{warnings ? <span className="warn-text"> · {warnings} warning{warnings === 1 ? "" : "s"}</span> : null}
      </span>
    );
  return (
    <span className="small error-text">
      ✗ {errors} problem{errors === 1 ? "" : "s"}: saved as a draft, games can't use it until they're fixed
    </span>
  );
}

function Legend() {
  return (
    <div className="legend">
      <span>
        <i className="ring-error" /> problem
      </span>
      <span>
        <i className="ring-warning" /> warning
      </span>
      <span>Shortcuts: Del delete · A arrow · B branch · Esc cancel · Ctrl+Z undo</span>
    </div>
  );
}

// ---------- halo: actions around the selected space ----------

function Halo({
  center,
  tile,
  def,
  space,
  linear,
  onEdit,
  onPending,
  onDelete,
}: {
  center: Pos;
  tile: number;
  def: Def;
  space: Def["spaces"][number];
  linear: boolean;
  onEdit: (d: Def, coalesce?: string) => void;
  onPending: (kind: "arrow" | "branch") => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState<"type" | "slot" | "label" | null>(null);
  const radius = tile / 2 + 22;
  const hasSlot = space.type === "category" || space.type === "hq";
  const isFinish = space.type === "finish";
  const buttons: { angle: number; label: string; title: string; onClick: () => void; disabled?: boolean; on?: boolean; style?: React.CSSProperties }[] = [
    { angle: -135, label: "◆", title: `Type: ${SPACE_TYPE_NAMES[space.type]}`, onClick: () => setMenu(menu === "type" ? null : "type"), on: menu === "type" },
    {
      angle: -90,
      label: hasSlot ? (space.slot ?? "?") : "–",
      title: hasSlot ? `Slot ${space.slot ?? "(none)"}: change or rename` : `${SPACE_TYPE_NAMES[space.type]} spaces have no slot`,
      onClick: () => setMenu(menu === "slot" ? null : "slot"),
      disabled: !hasSlot,
      on: menu === "slot",
      style: hasSlot ? { background: slotColor(def, space.slot), color: "#fff", borderColor: "transparent" } : undefined,
    },
    { angle: -45, label: "→", title: isFinish ? "The finish has no arrows out" : "Arrow: point this space at another (A)", onClick: () => onPending("arrow"), disabled: isFinish },
    { angle: 0, label: "⑂", title: isFinish ? "The finish has no arrows out" : "Fork: add another arrow out (B)", onClick: () => onPending("branch"), disabled: isFinish },
    { angle: 45, label: "▶", title: "Make this the start", onClick: () => onEdit(ops.setType(def, space.index, "start")), disabled: space.type === "start" },
    {
      angle: 90,
      label: "⚑",
      title: linear ? "Make this the finish" : "Loop tracks have no finish",
      onClick: () => onEdit(ops.setType(def, space.index, "finish")),
      disabled: !linear || isFinish,
    },
    { angle: 135, label: "🗑", title: "Delete space (Del)", onClick: onDelete, disabled: def.spaces.length <= 1 },
    { angle: 180, label: "✎", title: "Label", onClick: () => setMenu(menu === "label" ? null : "label"), on: menu === "label" },
  ];
  return (
    <div className="halo" style={{ left: center.x, top: center.y }}>
      {buttons.map((b) => (
        <button
          key={b.angle}
          className={`halo-btn ${b.on ? "on" : ""}`}
          style={{ ...b.style, transform: `translate(${Math.cos((b.angle * Math.PI) / 180) * radius}px, ${Math.sin((b.angle * Math.PI) / 180) * radius}px)` }}
          title={b.title}
          aria-label={b.title}
          disabled={b.disabled}
          onClick={(e) => (e.stopPropagation(), b.onClick())}
        >
          {b.label}
        </button>
      ))}
      {menu && (
        <div className="halo-menu" style={{ left: radius + 22, top: -radius }} onPointerDown={(e) => e.stopPropagation()}>
          {menu === "type" && (
            <TypePicker value={space.type} linear={linear} onPick={(t) => (onEdit(ops.setType(def, space.index, t)), setMenu(null))} />
          )}
          {menu === "slot" && (
            <SlotPicker
              def={def}
              value={space.slot}
              onEdit={onEdit}
              onPick={(slot) => (onEdit(ops.setSlot(def, space.index, slot)), setMenu(null))}
              onNew={() => (onEdit(ops.setSlot(ops.addSlot(def), space.index, ops.newSlotName(def))), setMenu(null))}
            />
          )}
          {menu === "label" && (
            <label className="stack small">
              Label (optional, shown on the space)
              <input
                autoFocus
                maxLength={24}
                value={space.label ?? ""}
                onChange={(e) => onEdit(ops.setLabel(def, space.index, e.target.value), `label:${space.index}`)}
                onKeyDown={(e) => e.key === "Enter" && setMenu(null)}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function TypePicker({ value, linear, onPick }: { value: SpaceType; linear: boolean; onPick: (t: SpaceType) => void }) {
  return (
    <div className="picker">
      {TYPES.map((t) => (
        <button key={t} className={t === value ? "on" : ""} disabled={t === "finish" && !linear} onClick={() => onPick(t)}>
          <i className="swatch" style={{ background: TYPE_COLORS[t] ?? "linear-gradient(135deg, #3b82f6, #db2777)" }} />
          {SPACE_TYPE_NAMES[t]}
        </button>
      ))}
    </div>
  );
}

function SlotPicker({
  def,
  value,
  onEdit,
  onPick,
  onNew,
}: {
  def: Def;
  value: string | null;
  onEdit: (d: Def) => void;
  onPick: (slot: string) => void;
  onNew: () => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  return (
    <div className="picker">
      {def.slots.map((slot) => (
        <button key={slot} className={slot === value ? "on" : ""} onClick={() => onPick(slot)}>
          <i className="swatch" style={{ background: slotColor(def, slot) }} />
          Slot {slot}
        </button>
      ))}
      <button className="small" disabled={def.slots.length >= 12} onClick={onNew}>
        + New slot {ops.newSlotName(def)}
      </button>
      {value && def.slots.includes(value) && (
        renaming === null ? (
          <button className="small" onClick={() => setRenaming(value)}>
            ✎ Rename slot {value}
          </button>
        ) : (
          <SlotRename def={def} slot={value} onDone={(d) => (d && onEdit(d), setRenaming(null))} />
        )
      )}
    </div>
  );
}

/** Inline rename: Enter or blur saves, Esc cancels. Renames the slot on every space using it. */
function SlotRename({ def, slot, onDone }: { def: Def; slot: string; onDone: (d: Def | null) => void }) {
  const [text, setText] = useState(slot);
  const problem = ops.slotNameProblem(def, slot, text.trim());
  const finish = () => onDone(problem || text.trim() === slot ? null : ops.renameSlot(def, slot, text.trim()));
  return (
    <span className="stack">
      <input
        autoFocus
        maxLength={40}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === "Enter") finish();
          if (e.key === "Escape") (e.stopPropagation(), onDone(null));
        }}
      />
      {problem && <span className="small error-text">{problem}</span>}
    </span>
  );
}

// ---------- side panels ----------

function Inspector({
  def,
  state,
  dispatch,
  edit,
  onDelete,
}: {
  def: Def;
  state: State;
  dispatch: (a: Action) => void;
  edit: (d: Def, select?: Selection, coalesce?: string) => void;
  onDelete: () => void;
}) {
  const sel = state.selection;
  if (sel?.kind === "arrow") {
    const back = def.spaces.find((s) => s.index === sel.to)?.next.includes(sel.from);
    return (
      <section className="panel">
        <h2>
          Arrow {sel.from} → {sel.to}
        </h2>
        <p className="muted small">Click an empty cell to put a new space on this arrow.</p>
        <div className="row wrap">
          <button className="small" disabled={back} title={back ? "There is already an arrow back" : ""} onClick={() => edit(ops.reverseArrow(def, sel.from, sel.to), { kind: "arrow", from: sel.to, to: sel.from })}>
            ⇄ Reverse
          </button>
          <button className="small danger" onClick={onDelete}>
            Delete arrow
          </button>
        </div>
      </section>
    );
  }
  const space = sel?.kind === "space" ? def.spaces.find((s) => s.index === sel.index) : undefined;
  if (!space)
    return (
      <section className="panel">
        <h2>Editing</h2>
        <ul className="help small">
          <li>Click an empty cell to add a space. With a space selected, the new one comes right after it.</li>
          <li>Click a space to select it: the buttons around it change its type and slot, draw arrows, add a fork, make it the start or finish, or delete it.</li>
          <li>Click an arrow to select it, then reverse it, delete it, or click an empty cell to put a space on it.</li>
          <li>Drag a space to move it. Drop it on another space to swap them.</li>
          <li>Numbers follow the track: start is 0, the finish is last.</li>
        </ul>
      </section>
    );
  const into = def.spaces.filter((s) => s.next.includes(space.index)).map((s) => s.index);
  const hasSlot = space.type === "category" || space.type === "hq";
  return (
    <section className="panel">
      <div className="row between">
        <h2>Space {space.index}</h2>
        <button className="small" onClick={() => dispatch({ type: "select", selection: null })}>
          Done
        </button>
      </div>
      <div className="grid-form compact">
        <label>Type</label>
        <select value={space.type} onChange={(e) => edit(ops.setType(def, space.index, e.target.value as SpaceType))}>
          {TYPES.map((t) => (
            <option key={t} value={t} disabled={t === "finish" && resolveConfig(def).track_type === "loop"}>
              {SPACE_TYPE_NAMES[t]}
            </option>
          ))}
        </select>
        {hasSlot && (
          <>
            <label>Slot</label>
            <select value={space.slot ?? ""} onChange={(e) => edit(ops.setSlot(def, space.index, e.target.value))}>
              {!def.slots.includes(space.slot ?? "") && <option value={space.slot ?? ""}>{space.slot ?? "(none)"}</option>}
              {def.slots.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </>
        )}
        <label>Label</label>
        <input placeholder="optional" maxLength={24} value={space.label ?? ""} onChange={(e) => edit(ops.setLabel(def, space.index, e.target.value), undefined, `label:${space.index}`)} />
        <label>Arrows out</label>
        <div className="row wrap">
          {space.next.map((n) => (
            <span key={n} className="chip arrow-chip">
              → {n}
              <button className="link" aria-label={`Remove arrow to ${n}`} title="Remove arrow" onClick={() => edit(ops.removeArrow(def, space.index, n))}>
                ✕
              </button>
            </span>
          ))}
          {space.type !== "finish" && (
            <>
              <button className="small" onClick={() => dispatch({ type: "pending", pending: { kind: space.next.length ? "branch" : "arrow", from: space.index } })}>
                + Arrow
              </button>
            </>
          )}
          {!space.next.length && space.type === "finish" && <span className="muted small">none (finish)</span>}
        </div>
        <label>Arrows in</label>
        <span className="small">{into.length ? into.map((i) => `${i} →`).join(", ") : <span className="muted">none</span>}</span>
      </div>
      <button className="small danger" disabled={def.spaces.length <= 1} onClick={onDelete}>
        Delete space
      </button>
    </section>
  );
}

const CHECKS = (linear: boolean, collection: boolean) => [
  { label: "One start space", codes: ["BRD-1"] },
  linear ? { label: "One finish space, with no arrows out", codes: ["BRD-2"] } : { label: "Every space leads back to the start", codes: ["BRD-3"] },
  { label: "Every space is on a path from the start", codes: ["BRD-7", "BRD-8", "BRD-10", "BRD-12", "FRK-4"] },
  { label: "Slots are valid", codes: ["BRD-6", "BRD-9"] },
  ...(collection ? [{ label: "An HQ for every slot", codes: ["BRD-4"] }] : []),
  { label: "Settings fit together", codes: ["CFG-1", "CFG-2", "CFG-3", "CFG-4"] },
  { label: "One space per cell", codes: ["BRD-11"] },
];

function ChecksPanel({
  issues,
  linear,
  collection,
  onFocus,
  onPick,
}: {
  issues: BoardIssue[];
  linear: boolean;
  collection: boolean;
  onFocus: (i: BoardIssue | null) => void;
  onPick: (i: BoardIssue) => void;
}) {
  const checks = CHECKS(linear, collection);
  return (
    <section className="panel">
      <h2>Playable?</h2>
      <ul className="checks">
        {checks.map((c) => {
          const n = issues.filter((i) => i.severity === "error" && c.codes.includes(i.code)).length;
          return (
            <li key={c.label} className={n ? "bad" : "good"}>
              <span aria-hidden>{n ? "✗" : "✓"}</span> {c.label}
              {n > 1 && <span className="muted"> ({n})</span>}
            </li>
          );
        })}
      </ul>
      {issues.length > 0 && (
        <ul className="issues">
          {issues.map((i) => (
            <li key={i.code + i.message}>
              <button
                className={`issue ${i.severity}`}
                onMouseEnter={() => onFocus(i)}
                onMouseLeave={() => onFocus(null)}
                onFocus={() => onFocus(i)}
                onBlur={() => onFocus(null)}
                onClick={() => onPick(i)}
                title={i.spaces.length ? "Show on the board" : undefined}
              >
                <span aria-hidden>{i.severity === "error" ? "✗" : "⚠"}</span>
                <span>{i.message}</span>
                <code className="rule">{i.code}</code>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        Point at a problem to light up its spaces. Rule IDs refer to <code>rules.md</code>.
      </p>
    </section>
  );
}

function SlotsPanel({ def, edit, focusSlot }: { def: Def; edit: (d: Def) => void; focusSlot: string | null }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  return (
    <section className="panel">
      <div className="row between">
        <h2>Slots</h2>
        <button className="small" disabled={def.slots.length >= 12} onClick={() => edit(ops.addSlot(def))}>
          + Slot
        </button>
      </div>
      <p className="muted small">A game picks a category for each slot. Category and HQ spaces each belong to one slot.</p>
      <ul className="slots">
        {def.slots.map((slot, i) => {
          const uses = ops.slotUses(def, slot);
          return (
            <li key={slot} className={focusSlot === slot ? "focus" : ""}>
              <i className="swatch" style={{ background: slotColor(def, slot) }} />
              {renaming === slot ? (
                <SlotRename def={def} slot={slot} onDone={(d) => (d && edit(d), setRenaming(null))} />
              ) : (
                <button className="link slot-name" title="Rename" onClick={() => setRenaming(slot)}>
                  {slot}
                </button>
              )}
              <span className="muted small">
                {uses} space{uses === 1 ? "" : "s"}
              </span>
              <span className="row slot-actions">
                <button className="small" aria-label={`Move slot ${slot} up`} disabled={i === 0} onClick={() => edit(ops.moveSlot(def, slot, -1))}>
                  ↑
                </button>
                <button className="small" aria-label={`Move slot ${slot} down`} disabled={i === def.slots.length - 1} onClick={() => edit(ops.moveSlot(def, slot, 1))}>
                  ↓
                </button>
                <button
                  className="small danger"
                  aria-label={`Remove slot ${slot}`}
                  disabled={def.slots.length <= 1}
                  onClick={() => (uses ? setRemoving(slot) : edit(ops.removeSlot(def, slot, null)))}
                >
                  ✕
                </button>
              </span>
              {removing === slot && (
                <div className="inline-form span-all">
                  <span className="small">
                    {uses} space{uses === 1 ? " uses" : "s use"} slot {slot}. Move {uses === 1 ? "it" : "them"} to:
                  </span>
                  <div className="row wrap">
                    {def.slots
                      .filter((s) => s !== slot)
                      .map((s) => (
                        <button key={s} className="small" onClick={() => (edit(ops.removeSlot(def, slot, s)), setRemoving(null))}>
                          Slot {s}
                        </button>
                      ))}
                    <button className="small" onClick={() => setRemoving(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SettingsPanel({ def, edit }: { def: Def; edit: (d: Def, select?: Selection, coalesce?: string) => void }) {
  const config = resolveConfig(def);
  const set = (patch: Partial<GameConfig>, key?: string) => edit(ops.setConfig(def, patch), undefined, key);
  const toggleWin = (w: WinCondition, on: boolean) => {
    const wins = on ? [...config.win_conditions, w] : config.win_conditions.filter((x) => x !== w);
    set({ win_conditions: (["finish", "collection", "turn_limit"] as WinCondition[]).filter((x) => wins.includes(x)), ...(w === "turn_limit" && on && !config.max_rounds ? { max_rounds: 10 } : {}) });
  };
  const num = (key: "dice_sides" | "answer_time_limit_sec" | "max_rolls_per_turn" | "max_rounds", min: number, max: number) => (
    <input
      type="number"
      min={min}
      max={max}
      value={config[key] ?? ""}
      onChange={(e) => {
        const v = e.target.valueAsNumber;
        if (Number.isInteger(v) && v >= min && v <= max) set({ [key]: v }, `cfg:${key}`);
      }}
    />
  );
  return (
    <section className="panel">
      <h2>Settings</h2>
      <div className="grid-form compact">
        <label>Track</label>
        <div className="tabs">
          {(["linear", "loop"] as const).map((t) => (
            <button key={t} className={config.track_type === t ? "on" : ""} onClick={() => config.track_type !== t && set({ track_type: t })}>
              {t === "linear" ? "Linear" : "Loop"}
            </button>
          ))}
        </div>
        <label>Ways to win</label>
        <div className="stack">
          {(["finish", "collection", "turn_limit"] as WinCondition[]).map((w) => (
            <label key={w} className="check small">
              <input
                type="checkbox"
                checked={config.win_conditions.includes(w)}
                disabled={w === "finish" && config.track_type === "loop" && !config.win_conditions.includes(w)}
                onChange={(e) => toggleWin(w, e.target.checked)}
              />
              {WIN_CONDITION_NAMES[w]}
              {w === "finish" && config.track_type === "loop" && <span className="muted"> (linear only)</span>}
            </label>
          ))}
        </div>
        {config.win_conditions.includes("turn_limit") && (
          <>
            <label>Rounds</label>
            {num("max_rounds", 1, 200)}
          </>
        )}
        <label>Dice sides</label>
        {num("dice_sides", 1, 20)}
        <label>Answer time (s)</label>
        {num("answer_time_limit_sec", 5, 600)}
        <label>Rolls per turn</label>
        {num("max_rolls_per_turn", 1, 10)}
        <label>Bonus roll</label>
        <label className="check small">
          <input type="checkbox" checked={config.bonus_roll_on_correct} onChange={(e) => set({ bonus_roll_on_correct: e.target.checked })} />
          Roll again after a correct answer
        </label>
        <label>Reuse cards</label>
        <label className="check small">
          <input type="checkbox" checked={config.reuse_cards} onChange={(e) => set({ reuse_cards: e.target.checked })} />
          Cards can repeat before a deck runs out
        </label>
      </div>
      <p className="muted small">Only settings that differ from the defaults are stored (dice {DEFAULT_CONFIG.dice_sides}, {DEFAULT_CONFIG.answer_time_limit_sec} s, …).</p>
    </section>
  );
}

/** The definition as JSON, editable. Visual edits rewrite it; valid JSON edits update the board. */
function JsonPanel({ def, onChange }: { def: Def; onChange: (d: Def) => void }) {
  const [text, setText] = useState(() => formatDefinition(def));
  const [problem, setProblem] = useState<string | null>(null);
  const mine = useRef(def);
  useEffect(() => {
    if (def !== mine.current) {
      setText(formatDefinition(def));
      setProblem(null);
      mine.current = def;
    }
  }, [def]);
  return (
    <details className="panel json-advanced">
      <summary>Advanced: JSON definition</summary>
      <p className="muted small">
        <code>config</code> overrides the defaults in rules.md §1. Each space has a <code>type</code>, a <code>slot</code> (for category and hq spaces),{" "}
        <code>next</code> (more than one = fork), a grid <code>pos</code> and an optional <code>label</code>. The optional <code>background</code> is rules.md §2.1.2.
        Edits here are kept as typed (no renumbering).
      </p>
      <textarea
        className="json-edit"
        spellCheck={false}
        rows={18}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const d = JSON.parse(e.target.value) as Def;
            if (!d || typeof d !== "object" || !Array.isArray(d.slots) || !Array.isArray(d.spaces)) throw new Error('needs "slots" and "spaces" arrays');
            if (d.spaces.some((s) => !s || !Array.isArray(s.next))) throw new Error('every space needs a "next" array');
            setProblem(null);
            if (d.background !== undefined && (typeof d.background !== "object" || d.background === null || Array.isArray(d.background)))
              throw new Error('"background" must be an object');
            const parsed: Def = { config: d.config ?? {}, slots: d.slots, spaces: d.spaces, ...(d.background ? { background: d.background } : {}) };
            mine.current = parsed;
            onChange(parsed);
          } catch (err) {
            setProblem((err as Error).message);
          }
        }}
      />
      {problem && <div className="error">Not applied: {problem}</div>}
    </details>
  );
}
