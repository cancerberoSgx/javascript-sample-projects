import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateBoardFile } from "./board";
import type { BoardFile, BoardFileSpace } from "./types";

// Board validation has two implementations: validateBoardFile (here) and validate_board in
// backend/app/validation.py. This test writes every case below with its issues to a fixture;
// backend/tests/test_validation.py checks Python gives the same issues. After changing a rule:
//   UPDATE_CONFORMANCE=1 npx vitest run src/engine
const FIXTURE = join(__dirname, "../../../backend/tests/fixtures/board_validation.json");
const PUBLIC = join(__dirname, "../../public");
const example = (id: string): BoardFile => JSON.parse(readFileSync(join(PUBLIC, `boards/${id}.json`), "utf8"));

const sp = (index: number, type: BoardFileSpace["type"], next: number[], slot: string | null = null, x = index): BoardFileSpace => ({
  index,
  type,
  slot,
  next,
  pos: { x, y: 0 },
});
const tiny = (spaces: BoardFileSpace[], extra: Partial<BoardFile> = {}): BoardFile => ({
  schema_version: 2,
  name: "t",
  config: { win_conditions: ["finish"] },
  slots: ["A"],
  spaces,
  ...extra,
});
const ok = () => [sp(0, "start", [1]), sp(1, "category", [2], "A"), sp(2, "finish", [])];

/** Every case: a name and a board. Each must parse as a backend BoardDefinition. */
function cases(): { name: string; board: BoardFile }[] {
  const out: { name: string; board: BoardFile }[] = [];
  const edit = (name: string, base: string, fn: (b: BoardFile) => void) => {
    const b = structuredClone(example(base));
    fn(b);
    out.push({ name, board: b });
  };
  for (const id of ["linear-basic", "linear-forks", "loop-classic", "loop-shortcut", "special-sandbox"]) edit(id, id, () => {});

  out.push({ name: "valid tiny", board: tiny(ok()) });
  out.push({ name: "no spaces", board: tiny([]) });
  out.push({ name: "no slots", board: tiny(ok(), { slots: [] }) });
  out.push({ name: "duplicate and empty slots", board: tiny(ok(), { slots: ["A", "B", "A", " "] }) });
  out.push({ name: "index gap", board: tiny([sp(0, "start", [2]), sp(2, "finish", [])]) });
  out.push({ name: "missing target, self arrow, duplicate arrow", board: tiny([sp(0, "start", [1, 1]), sp(1, "category", [1, 9], "A"), sp(2, "finish", [])]) });
  out.push({ name: "no start", board: tiny([sp(0, "category", [1], "A"), sp(1, "finish", [])]) });
  out.push({ name: "two starts", board: tiny([sp(0, "start", [2]), sp(1, "start", [2]), sp(2, "finish", [], null, 3)]) });
  out.push({ name: "start not at 0", board: tiny([sp(0, "category", [1], "A"), sp(1, "start", [0, 2]), sp(2, "finish", [])]) });
  out.push({
    name: "slot problems",
    board: tiny([sp(0, "start", [1], "A"), sp(1, "category", [2], null), sp(2, "hq", [3], "Z"), sp(3, "finish", [])], { slots: ["A", "B"] }),
  });
  out.push({ name: "dead ends", board: tiny([sp(0, "start", [1, 2, 3]), sp(1, "category", [], "A"), sp(2, "wildcard", []), sp(3, "finish", [])]) });
  out.push({ name: "same spot", board: tiny([sp(0, "start", [1]), sp(1, "category", [2], "A", 0), sp(2, "finish", [], null, 0)]) });
  out.push({ name: "unreachable", board: tiny([sp(0, "start", [2]), sp(1, "category", [2], "A"), sp(2, "finish", [])]) });
  out.push({ name: "no finish", board: tiny([sp(0, "start", [1]), sp(1, "category", [0], "A")]) });
  out.push({ name: "two finishes", board: tiny([sp(0, "start", [1, 2]), sp(1, "finish", []), sp(2, "finish", [])]) });
  out.push({ name: "finish with arrows", board: tiny([sp(0, "start", [1]), sp(1, "category", [2], "A"), sp(2, "finish", [1])]) });
  out.push({
    name: "circle without exit",
    board: tiny([sp(0, "start", [1, 3]), sp(1, "category", [2], "A"), sp(2, "category", [1], "A"), sp(3, "finish", [])]),
  });
  out.push({ name: "loop with finish", board: tiny(ok(), { config: { track_type: "loop", win_conditions: ["collection"] } }) });
  out.push({
    name: "loop that never returns",
    board: tiny([sp(0, "start", [1]), sp(1, "hq", [2], "A"), sp(2, "category", [3], "A"), sp(3, "category", [2], "A")], {
      config: { track_type: "loop", win_conditions: ["collection"] },
    }),
  });
  out.push({ name: "no win conditions", board: tiny(ok(), { config: { win_conditions: [] } }) });
  out.push({ name: "finish win on a loop", board: tiny([sp(0, "start", [1]), sp(1, "hq", [0], "A")], { config: { track_type: "loop" } }) });
  out.push({ name: "round limit without rounds", board: tiny(ok(), { config: { win_conditions: ["turn_limit"] } }) });
  out.push({ name: "slot warnings and missing HQ", board: tiny([sp(0, "start", [1]), sp(1, "hq", [2], "A"), sp(2, "finish", [])], { slots: ["A", "B"], config: {} }) });
  edit("many unreachable (list is cut short)", "linear-basic", (b) => (b.spaces[0].next = [19]));
  return out;
}

describe("board validation", () => {
  it("points at the spaces and slots involved", () => {
    const issues = validateBoardFile(tiny([sp(0, "start", [1, 2, 3]), sp(1, "category", [], "A"), sp(2, "wildcard", []), sp(3, "finish", [])]));
    expect(issues).toEqual([{ code: "BRD-10", severity: "error", message: "Spaces 1, 2 have no arrow out. Only the finish can be a dead end.", spaces: [1, 2], slot: null }]);
    const warn = validateBoardFile(tiny(ok(), { slots: ["A", "B"] }));
    expect(warn).toEqual([expect.objectContaining({ code: "BRD-W1", severity: "warning", slot: "B" })]);
  });

  it("matches backend/tests/fixtures/board_validation.json", () => {
    const fresh = cases().map((c) => ({ ...c, issues: validateBoardFile(c.board) }));
    if (process.env.UPDATE_CONFORMANCE) writeFileSync(FIXTURE, JSON.stringify(fresh, null, 1) + "\n");
    if (!existsSync(FIXTURE)) return; // the backend isn't checked out next to the frontend
    expect(JSON.parse(readFileSync(FIXTURE, "utf8"))).toEqual(JSON.parse(JSON.stringify(fresh)));
  });
});
