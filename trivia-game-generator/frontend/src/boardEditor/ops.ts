// Pure edit operations for the visual board editor. Each takes a board definition and returns
// a new one (never mutates). The editor runs normalize() after every operation, so spaces are
// always numbered in path order: start = 0, finish last (rules.md BRD-1, BRD-2, BRD-7).

import type { BoardDefinition } from "../api";
import { DEFAULT_CONFIG } from "../engine/board";
import type { Background, BoardFileSpace, GameConfig, SpaceType } from "../engine/types";

export type Def = BoardDefinition;
export type Pos = { x: number; y: number };

const clone = (def: Def): Def => structuredClone(def);
const at = (def: Def, index: number) => def.spaces.find((s) => s.index === index);
const without = <T,>(list: T[], item: T) => list.filter((x) => x !== item);

/** The space on the grid cell `pos` (spaces may sit on fractional positions). */
export function spaceAt(def: Def, pos: Pos): BoardFileSpace | undefined {
  return def.spaces.find((s) => s.pos && Math.abs(s.pos.x - pos.x) < 0.5 && Math.abs(s.pos.y - pos.y) < 0.5);
}

/** The slot a new space after `from` should get: the one after the nearest slot behind it. */
export function slotAfter(def: Def, from: number | null): string | null {
  if (!def.slots.length) return null;
  let current = from === null ? undefined : at(def, from);
  for (let guard = 0; current && guard < def.spaces.length; guard++) {
    if (current.slot && def.slots.includes(current.slot)) return def.slots[(def.slots.indexOf(current.slot) + 1) % def.slots.length];
    const idx: number = current.index;
    current = def.spaces.find((s) => s.next.includes(idx));
  }
  return def.slots[0];
}

function newSpace(def: Def, pos: Pos, slot: string | null, next: number[] = []): BoardFileSpace {
  return { index: def.spaces.length, type: slot ? "category" : "wildcard", slot, next, pos: { x: pos.x, y: pos.y } };
}

/**
 * Adds a space on an empty cell. With `after`, it is chained after that space: it takes over
 * the arrow out of `after` (so it is inserted into the track), it becomes a new branch when
 * `after` is a fork, and when `after` is the finish the finish moves forward to the new space.
 */
export function addSpace(def: Def, pos: Pos, after: number | null): { def: Def; index: number } {
  const d = clone(def);
  if (!d.spaces.length) {
    d.spaces.push({ index: 0, type: "start", slot: null, next: [], pos });
    return { def: d, index: 0 };
  }
  const prev = after === null ? undefined : at(d, after);
  const space = newSpace(d, pos, slotAfter(d, after));
  if (prev?.type === "finish") {
    prev.type = space.type;
    prev.slot = space.slot;
    prev.next = [space.index];
    space.type = "finish";
    space.slot = null;
  } else if (prev && prev.next.length <= 1) {
    space.next = prev.next;
    prev.next = [space.index];
  } else if (prev) {
    prev.next.push(space.index);
  }
  d.spaces.push(space);
  return { def: d, index: space.index };
}

/** Puts a new space in the middle of the arrow from -> to. */
export function insertOnArrow(def: Def, from: number, to: number, pos: Pos): { def: Def; index: number } {
  const d = clone(def);
  const space = newSpace(d, pos, slotAfter(d, from), [to]);
  const src = at(d, from)!;
  src.next = src.next.map((n) => (n === to ? space.index : n));
  d.spaces.push(space);
  return { def: d, index: space.index };
}

/** Deletes a space. Arrows into it are passed on to its single next space, so the track stays connected. */
export function deleteSpace(def: Def, index: number): Def {
  if (def.spaces.length <= 1) return def;
  const d = clone(def);
  const gone = at(d, index);
  if (!gone) return def;
  for (const s of d.spaces) {
    if (!s.next.includes(index)) continue;
    const heal = gone.next.length === 1 && s.type !== "finish" ? gone.next : [];
    s.next = [...new Set(s.next.flatMap((n) => (n === index ? heal : [n])))].filter((n) => n !== s.index);
  }
  d.spaces = d.spaces.filter((s) => s !== gone);
  const shift = (n: number) => (n > index ? n - 1 : n);
  for (const s of d.spaces) {
    s.index = shift(s.index);
    s.next = s.next.map(shift);
  }
  return d;
}

/** The single arrow out of `from` now points to `to` (replaces the old ones). */
export function setArrow(def: Def, from: number, to: number): Def {
  if (from === to) return def;
  const d = clone(def);
  at(d, from)!.next = [to];
  return d;
}

/** Adds an extra arrow out of `from`, which makes it a fork. */
export function addBranch(def: Def, from: number, to: number): Def {
  const src = at(def, from);
  if (from === to || !src || src.next.includes(to)) return def;
  const d = clone(def);
  at(d, from)!.next.push(to);
  return d;
}

export function removeArrow(def: Def, from: number, to: number): Def {
  const d = clone(def);
  const src = at(d, from)!;
  src.next = without(src.next, to);
  return d;
}

export function reverseArrow(def: Def, from: number, to: number): Def {
  const d = clone(def);
  const src = at(d, from)!;
  const dst = at(d, to)!;
  src.next = without(src.next, to);
  if (!dst.next.includes(from)) dst.next.push(from);
  return d;
}

/**
 * Changes a space's type. There is only one start and one finish: making a space the start
 * (or finish) turns the old one into a category space. The finish loses its arrows out (BRD-2).
 */
export function setType(def: Def, index: number, type: SpaceType): Def {
  const d = clone(def);
  const s = at(d, index)!;
  if (type === "start" || type === "finish") {
    for (const other of d.spaces) {
      if (other.type === type && other !== s) {
        other.slot = slotAfter(d, other.index);
        other.type = other.slot ? "category" : "wildcard";
      }
    }
  }
  s.type = type;
  if (type === "category" || type === "hq") s.slot = s.slot && d.slots.includes(s.slot) ? s.slot : slotAfter(d, index);
  else s.slot = null;
  if (type === "finish") s.next = [];
  return d;
}

export function setSlot(def: Def, index: number, slot: string): Def {
  const d = clone(def);
  at(d, index)!.slot = slot;
  return d;
}

export function setLabel(def: Def, index: number, label: string): Def {
  const d = clone(def);
  const s = at(d, index)!;
  if (label.trim()) s.label = label;
  else delete s.label;
  return d;
}

/** Moves a space to a grid cell. Dropping it on another space swaps the two. */
export function moveSpace(def: Def, index: number, pos: Pos): Def {
  const d = clone(def);
  const s = at(d, index)!;
  const other = spaceAt(d, pos);
  if (other === s) return def;
  if (other) other.pos = { ...s.pos };
  s.pos = { x: pos.x, y: pos.y };
  return d;
}

// ---------- slots ----------

export function newSlotName(def: Def): string {
  for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!def.slots.includes(c)) return c;
  for (let i = 1; ; i++) if (!def.slots.includes(`S${i}`)) return `S${i}`;
}

export function addSlot(def: Def, name = newSlotName(def)): Def {
  if (def.slots.includes(name)) return def;
  return { ...clone(def), slots: [...def.slots, name] };
}

/** Why a slot can't be renamed to `name`, or null if it can. */
export function slotNameProblem(def: Def, old: string, name: string): string | null {
  if (!name.trim()) return "Slot names can't be empty";
  if (name !== old && def.slots.includes(name)) return `There is already a slot ${name}`;
  return null;
}

/** Renames a slot everywhere it is used. */
export function renameSlot(def: Def, old: string, name: string): Def {
  if (slotNameProblem(def, old, name)) return def;
  const d = clone(def);
  d.slots = d.slots.map((s) => (s === old ? name : s));
  for (const s of d.spaces) if (s.slot === old) s.slot = name;
  return d;
}

export const slotUses = (def: Def, slot: string) => def.spaces.filter((s) => s.slot === slot).length;

/** Removes a slot. Spaces that used it switch to `replacement`. */
export function removeSlot(def: Def, slot: string, replacement: string | null): Def {
  const d = clone(def);
  d.slots = without(d.slots, slot);
  for (const s of d.spaces) if (s.slot === slot) s.slot = replacement;
  return d;
}

/** Moves a slot one place left (-1) or right (+1). Slot order decides the preview colors. */
export function moveSlot(def: Def, slot: string, dir: -1 | 1): Def {
  const i = def.slots.indexOf(slot);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= def.slots.length) return def;
  const d = clone(def);
  [d.slots[i], d.slots[j]] = [d.slots[j], d.slots[i]];
  return d;
}

// ---------- settings ----------

/**
 * Changes settings. The stored config is partial (rules.md §1): a value equal to the default
 * is dropped. Switching to a loop closes the track: the finish becomes a category space that
 * leads back to the start, and the finish win is turned off.
 */
/** Sets the board's background (rules.md §2.1.2). An empty one removes the field. */
export function setBackground(def: Def, background: Background | undefined): Def {
  const { background: _old, ...rest } = def;
  return background && Object.keys(background).length ? { ...rest, background } : rest;
}

export function setConfig(def: Def, patch: Partial<GameConfig>): Def {
  const d = clone(def);
  const config: Partial<GameConfig> = { ...d.config, ...patch };
  if (patch.track_type === "loop" && (def.config.track_type ?? DEFAULT_CONFIG.track_type) !== "loop") {
    const wins = (config.win_conditions ?? DEFAULT_CONFIG.win_conditions).filter((w) => w !== "finish");
    config.win_conditions = wins.length ? wins : ["collection"];
    const start = d.spaces.find((s) => s.type === "start");
    for (const s of d.spaces) {
      if (s.type !== "finish") continue;
      s.slot = slotAfter(d, s.index);
      s.type = s.slot ? "category" : "wildcard";
      s.next = start ? [start.index] : [];
    }
  }
  for (const key of Object.keys(config) as (keyof GameConfig)[]) {
    if (JSON.stringify(config[key]) === JSON.stringify(DEFAULT_CONFIG[key]) || config[key] === undefined) delete config[key];
  }
  d.config = config;
  return d;
}

// ---------- numbering ----------

/**
 * Renumbers spaces in path order: the start is 0, then spaces in the order a player meets
 * them (each branch of a fork in turn, a space where branches meet after all of them), then
 * spaces that can't be reached, and the finish last. Returns the old -> new index map.
 * Boards with broken numbering or arrows to missing spaces are left alone.
 */
export function normalize(def: Def): { def: Def; map: Map<number, number> } {
  const identity = { def, map: new Map(def.spaces.map((s) => [s.index, s.index])) };
  const byIndex = new Map(def.spaces.map((s) => [s.index, s]));
  if (byIndex.size !== def.spaces.length || def.spaces.some((s) => s.next.some((n) => !byIndex.has(n)))) return identity;

  const start = def.spaces.find((s) => s.type === "start") ?? def.spaces.find((s) => s.index === 0);
  const order: number[] = [];
  const seen = new Set<number>();
  if (start) {
    const reachable = new Set([start.index]);
    const queue = [start.index];
    while (queue.length) for (const n of byIndex.get(queue.shift()!)!.next) if (!reachable.has(n)) (reachable.add(n), queue.push(n));

    // Arrows still to be walked into each space (arrows back into the start don't count)
    const waiting = new Map<number, number>();
    for (const i of reachable) for (const n of byIndex.get(i)!.next) if (n !== start.index) waiting.set(n, (waiting.get(n) ?? 0) + 1);

    const stack = [start.index];
    while (order.length < reachable.size) {
      if (!stack.length) {
        // Only circles are left: enter the first one from the spaces already numbered
        const entry = [...reachable].filter((i) => !seen.has(i)).sort((a, b) => a - b).find((i) => order.some((o) => byIndex.get(o)!.next.includes(i)));
        stack.push(entry!);
      }
      const v = stack.pop()!;
      if (seen.has(v)) continue;
      seen.add(v);
      order.push(v);
      for (const n of [...byIndex.get(v)!.next].reverse()) {
        if (n === start.index || seen.has(n)) continue;
        const left = waiting.get(n)! - 1;
        waiting.set(n, left);
        if (left <= 0) stack.push(n);
      }
    }
  }
  for (const s of [...def.spaces].sort((a, b) => a.index - b.index)) if (!seen.has(s.index)) order.push(s.index);
  const finishes = order.filter((i) => byIndex.get(i)!.type === "finish");
  const final = [...order.filter((i) => !finishes.includes(i)), ...finishes];

  const map = new Map(final.map((old, i) => [old, i]));
  if (final.every((old, i) => old === i)) return identity;
  const spaces = final.map((old) => {
    const s = byIndex.get(old)!;
    return { ...s, index: map.get(old)!, next: s.next.map((n) => map.get(n)!) };
  });
  return { def: { ...def, spaces }, map };
}
