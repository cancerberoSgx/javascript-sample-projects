import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boardErrors, validateBoardFile } from "../engine/board";
import type { BoardFile } from "../engine/types";
import * as ops from "./ops";
import type { Def } from "./ops";

const PUBLIC = join(__dirname, "../../public");
const example = (id: string): Def => {
  const f: BoardFile = JSON.parse(readFileSync(join(PUBLIC, `boards/${id}.json`), "utf8"));
  return { config: f.config, slots: f.slots, spaces: f.spaces };
};
const asFile = (def: Def): BoardFile => ({ schema_version: 2, name: "t", ...def });
const errors = (def: Def) => boardErrors(validateBoardFile(asFile(def))).map((i) => i.message);
/** Runs an operation the way the editor does: then renumbers. */
const norm = (def: Def) => ops.normalize(def).def;
const path = (def: Def) => def.spaces.map((s) => `${s.index}:${s.type}${s.slot ?? ""}>${s.next.join(",")}`).join(" ");

const EMPTY: Def = { config: { win_conditions: ["finish"] }, slots: ["A", "B"], spaces: [] };

describe("building a board by clicking", () => {
  it("chains each new space after the selected one and cycles the slots", () => {
    let d = ops.addSpace(EMPTY, { x: 0, y: 0 }, null).def; // first space = start
    let sel = 0;
    for (let x = 1; x <= 3; x++) ({ def: d, index: sel } = ops.addSpace(d, { x, y: 0 }, sel));
    d = norm(ops.setType(d, 3, "finish"));
    expect(path(d)).toBe("0:start>1 1:categoryA>2 2:categoryB>3 3:finish>");
    expect(errors(d)).toEqual([]);
  });

  it("extends the track past the finish: the finish moves to the new space", () => {
    const base = norm(ops.setType(ops.addSpace(ops.addSpace(EMPTY, { x: 0, y: 0 }, null).def, { x: 1, y: 0 }, 0).def, 1, "finish"));
    const { def } = ops.addSpace(base, { x: 2, y: 0 }, 1);
    expect(path(norm(def))).toBe("0:start>1 1:categoryA>2 2:finish>");
  });

  it("inserts into the middle of the track", () => {
    const d = norm(ops.addSpace(example("linear-basic"), { x: 0, y: 5 }, 2).def);
    expect(d.spaces[3]).toMatchObject({ pos: { x: 0, y: 5 }, next: [4] });
    expect(d.spaces[2].next).toEqual([3]);
    expect(d.spaces.at(-1)!.type).toBe("finish");
    expect(errors(d)).toEqual([]);
  });

  it("puts a space on an arrow", () => {
    const d = norm(ops.insertOnArrow(example("linear-basic"), 0, 1, { x: 0, y: 5 }).def);
    expect(d.spaces[1]).toMatchObject({ pos: { x: 0, y: 5 }, next: [2], slot: "A" });
    expect(errors(d)).toEqual([]);
  });
});

describe("editing", () => {
  it("heals the track when a space is deleted", () => {
    const d = norm(ops.deleteSpace(example("linear-basic"), 5));
    expect(d.spaces).toHaveLength(19);
    expect(d.spaces[4].next).toEqual([5]);
    expect(errors(d)).toEqual([]);
  });

  it("makes forks with branches, and numbers each branch in turn", () => {
    // 0 start > 1 > 2 > 3 finish, plus a detour 1 > 4 > 5 > 2
    let d: Def = {
      config: { win_conditions: ["finish"] },
      slots: ["A"],
      spaces: [
        { index: 0, type: "start", slot: null, next: [1], pos: { x: 0, y: 0 } },
        { index: 1, type: "category", slot: "A", next: [2], pos: { x: 1, y: 0 } },
        { index: 2, type: "category", slot: "A", next: [3], pos: { x: 2, y: 0 } },
        { index: 3, type: "finish", slot: null, next: [], pos: { x: 3, y: 0 } },
        { index: 4, type: "category", slot: "A", next: [5], pos: { x: 1, y: 1 } },
        { index: 5, type: "category", slot: "A", next: [2], pos: { x: 2, y: 1 } },
      ],
    };
    expect(errors(d)).toContain("Spaces 4, 5 can never be reached: no path leads there from the start.");
    d = ops.addBranch(d, 1, 4);
    const { def, map } = ops.normalize(d);
    // branch 1 (just space 2) can't be numbered before the detour joins it
    expect(path(def)).toBe("0:start>1 1:categoryA>4,2 2:categoryA>3 3:categoryA>4 4:categoryA>5 5:finish>");
    expect(map.get(4)).toBe(2);
    expect(errors(def)).toEqual([]);
    expect(ops.normalize(def).def).toBe(def); // already numbered: unchanged
  });

  it("keeps every example board valid and its numbering stable", () => {
    for (const id of ["linear-basic", "linear-forks", "loop-classic", "loop-shortcut", "special-sandbox"]) {
      const d = norm(example(id));
      expect(errors(d), id).toEqual([]);
      expect(norm(d), id).toEqual(d);
    }
  });

  it("allows one start and one finish", () => {
    const d = norm(ops.setType(example("linear-basic"), 4, "start"));
    expect(d.spaces.filter((s) => s.type === "start")).toHaveLength(1);
    expect(d.spaces[0].pos).toEqual(example("linear-basic").spaces[4].pos);
    const f = ops.setType(example("linear-basic"), 10, "finish");
    expect(f.spaces.filter((s) => s.type === "finish").map((s) => s.index)).toEqual([10]);
    expect(f.spaces[10].next).toEqual([]);
  });

  it("closes the track when switching to a loop", () => {
    const d = norm(ops.setConfig(example("linear-basic"), { track_type: "loop" }));
    expect(d.config).toEqual({ track_type: "loop", win_conditions: ["collection"] });
    expect(d.spaces.at(-1)).toMatchObject({ type: "category", next: [0] });
    expect(errors(d)).toEqual([]);
  });

  it("stores only settings that differ from the defaults", () => {
    const d = ops.setConfig(example("linear-basic"), { dice_sides: 6, answer_time_limit_sec: 20 });
    expect(d.config).toEqual({ answer_time_limit_sec: 20 });
  });

  it("swaps two spaces when one is dropped on the other", () => {
    const d = ops.moveSpace(example("linear-basic"), 0, example("linear-basic").spaces[1].pos);
    expect(d.spaces[0].pos).toEqual(example("linear-basic").spaces[1].pos);
    expect(d.spaces[1].pos).toEqual(example("linear-basic").spaces[0].pos);
  });

  it("renames and removes slots everywhere", () => {
    let d = ops.renameSlot(example("linear-basic"), "A", "Science");
    expect(d.slots[0]).toBe("Science");
    expect(d.spaces[1].slot).toBe("Science");
    expect(ops.slotNameProblem(d, "B", "Science")).toMatch(/already/);
    d = ops.removeSlot(d, "Science", "B");
    expect(d.slots).toEqual(["B", "C", "D"]);
    expect(d.spaces.some((s) => s.slot === "Science")).toBe(false);
    expect(ops.newSlotName(d)).toBe("A");
  });
});
