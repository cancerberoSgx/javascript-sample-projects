import type { BoardFile, BoardIssue, GameConfig, SpaceType } from "./types";

export const DEFAULT_CONFIG: GameConfig = {
  track_type: "linear",
  dice_sides: 6,
  answer_time_limit_sec: 30,
  bonus_roll_on_correct: true,
  max_rolls_per_turn: 3,
  win_conditions: ["finish", "collection"],
  max_rounds: null,
  fuzzy_answer_check: false,
  reuse_cards: false,
};

export function resolveConfig(board: { config?: Partial<GameConfig> }): GameConfig {
  return { ...DEFAULT_CONFIG, ...board.config };
}

export const isFork = (space: { next: number[] }) => space.next.length > 1;

/** Names shown to people (the JSON uses the keys). */
export const SPACE_TYPE_NAMES: Record<SpaceType, string> = {
  start: "Start",
  category: "Category",
  hq: "HQ",
  wildcard: "Wildcard",
  roll_again: "Roll again",
  penalty: "Skip turn",
  finish: "Finish",
};

export const WIN_CONDITION_NAMES = { finish: "Reach the finish", collection: "Collect every category", turn_limit: "Round limit" };

/** Indices reachable from `from` by following `next` edges (or reversed edges). */
function reachable(spaces: { index: number; next: number[] }[], from: number, reverse = false): Set<number> {
  const edges = new Map<number, number[]>();
  for (const s of spaces) {
    for (const n of s.next) {
      const [a, b] = reverse ? [n, s.index] : [s.index, n];
      edges.set(a, [...(edges.get(a) ?? []), b]);
    }
  }
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    for (const n of edges.get(queue.shift()!) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

/** "3, 4, 5", cut short after `limit` items. */
function joinList(items: (number | string)[], limit = 15): string {
  const shown = items.slice(0, limit).join(", ");
  return shown + (items.length > limit ? ` (+${items.length - limit} more)` : "");
}

/** "Space 3" or "Spaces 3, 4". */
const spacesText = (items: number[]) => `${items.length === 1 ? "Space" : "Spaces"} ${joinList(items)}`;
/** Picks the verb form for spacesText(): one(items) = true for a single space. */
const one = (items: unknown[]) => items.length === 1;

/**
 * Checks a board file against the board rules (rules.md §2.1.1). Returns every issue found;
 * a board is playable when no issue is an error. Line-by-line port: backend/app/validation.py
 * (validate_board). backend/tests/fixtures/board_validation.json checks they agree.
 */
export function validateBoardFile(board: BoardFile): BoardIssue[] {
  const issues: BoardIssue[] = [];
  const add = (code: string, message: string, spaces: number[] = [], slot: string | null = null, severity: BoardIssue["severity"] = "error") =>
    issues.push({ code, severity, message, spaces, slot });
  const config = resolveConfig(board);
  const spaces = board.spaces ?? [];
  const slots = board.slots ?? [];

  // Slots (BRD-6)
  if (!slots.length) add("BRD-6", "Add at least one slot.");
  for (const slot of new Set(slots.filter((s, i) => slots.indexOf(s) !== i)))
    add("BRD-6", `Slot "${slot}" is listed more than once. Slot names must be unique.`, [], slot);
  if (slots.some((s) => !s.trim())) add("BRD-6", "Slot names can't be empty.");

  if (!spaces.length) {
    add("BRD-1", "The board has no spaces. Add a start space.");
    return issues;
  }

  // Structure (BRD-7, BRD-8). The graph checks further down need these to hold.
  let broken = false;
  const indices = spaces.map((s) => s.index).sort((a, b) => a - b);
  if (indices.some((idx, i) => idx !== i)) {
    add("BRD-7", `Space numbers must run 0..${spaces.length - 1} with no gaps or repeats.`);
    broken = true;
  }
  const byIndex = new Map(spaces.map((s) => [s.index, s]));
  for (const s of spaces) {
    for (const n of s.next) {
      if (!byIndex.has(n)) add("BRD-8", `Space ${s.index} has an arrow to space ${n}, which doesn't exist.`, [s.index]);
      if (n === s.index) add("BRD-8", `Space ${s.index} has an arrow to itself.`, [s.index]);
      broken ||= !byIndex.has(n) || n === s.index;
    }
    if (new Set(s.next).size !== s.next.length) {
      add("BRD-8", `Space ${s.index} has two arrows to the same space.`, [s.index]);
      broken = true;
    }
  }

  // Start (BRD-1)
  const starts = spaces.filter((s) => s.type === "start").map((s) => s.index);
  if (!starts.length) add("BRD-1", "The board needs a start space.");
  else if (starts.length > 1) add("BRD-1", `Only one start space is allowed (found spaces ${joinList(starts)}).`, starts);
  else if (starts[0] !== 0) add("BRD-1", `The start must be space 0 (it is space ${starts[0]}).`, starts);

  // Each space: slot (BRD-9), position (BRD-11), arrows out (BRD-10)
  const deadEnds: number[] = [];
  const positions = new Map<string, number[]>();
  for (const s of spaces) {
    const kind = SPACE_TYPE_NAMES[s.type] ?? s.type;
    if (s.type === "category" || s.type === "hq") {
      if (!s.slot) add("BRD-9", `Space ${s.index} is a ${kind} space, so it needs a slot.`, [s.index]);
      else if (!slots.includes(s.slot))
        add("BRD-9", `Space ${s.index} uses slot "${s.slot}", which isn't one of the board's slots (${joinList(slots) || "none"}).`, [s.index], s.slot);
    } else if (s.slot != null) add("BRD-9", `Space ${s.index} is a ${kind} space, so it can't have a slot.`, [s.index]);
    if (s.type !== "finish" && !s.next.length) deadEnds.push(s.index);
    if (!s.pos || !Number.isFinite(s.pos.x) || !Number.isFinite(s.pos.y)) add("BRD-11", `Space ${s.index} has no position.`, [s.index]);
    else {
      const key = `${s.pos.x},${s.pos.y}`;
      positions.set(key, [...(positions.get(key) ?? []), s.index]);
    }
  }
  if (deadEnds.length)
    add("BRD-10", `${spacesText(deadEnds)} ${one(deadEnds) ? "has" : "have"} no arrow out. Only the finish can be a dead end.`, deadEnds);
  for (const same of positions.values()) if (same.length > 1) add("BRD-11", `${spacesText(same)} are on the same spot.`, same);

  if (!broken && starts.length === 1) {
    // Reachability (BRD-12) and track shape (BRD-2, BRD-3, FRK-4)
    const start = starts[0];
    const fromStart = reachable(spaces, start);
    const unreachable = spaces.filter((s) => !fromStart.has(s.index)).map((s) => s.index);
    if (unreachable.length) add("BRD-12", `${spacesText(unreachable)} can never be reached: no path leads there from the start.`, unreachable);

    const finishes = spaces.filter((s) => s.type === "finish").map((s) => s.index);
    if (config.track_type === "linear") {
      if (!finishes.length) add("BRD-2", "A linear track needs a finish space.");
      else if (finishes.length > 1) add("BRD-2", `A linear track has exactly one finish (found spaces ${joinList(finishes)}).`, finishes);
      else {
        if (byIndex.get(finishes[0])!.next.length) add("BRD-2", `The finish (space ${finishes[0]}) can't have arrows out.`, finishes);
        const toFinish = reachable(spaces, finishes[0], true);
        const trapped = spaces.filter((s) => !toFinish.has(s.index) && !deadEnds.includes(s.index)).map((s) => s.index);
        if (trapped.length)
          add("FRK-4", `${spacesText(trapped)} can't reach the finish: every path from ${one(trapped) ? "it" : "them"} ends in a dead end or a circle.`, trapped);
      }
    } else {
      if (finishes.length) add("BRD-3", `A loop track has no finish: change ${spacesText(finishes).toLowerCase()} to another type, or make the track linear.`, finishes);
      const toStart = reachable(spaces, start, true);
      const trapped = spaces.filter((s) => !toStart.has(s.index) && !deadEnds.includes(s.index)).map((s) => s.index);
      if (trapped.length) add("BRD-3", `${spacesText(trapped)} never ${one(trapped) ? "leads" : "lead"} back to the start.`, trapped);
    }
  }

  // Settings (CFG-*)
  const wins = config.win_conditions;
  if (!wins.length) add("CFG-1", "Choose at least one way to win.");
  if (wins.includes("finish") && config.track_type !== "linear") add("CFG-2", `"${WIN_CONDITION_NAMES.finish}" needs a linear track.`);
  if (wins.includes("turn_limit") && !(config.max_rounds && config.max_rounds > 0))
    add("CFG-3", `"${WIN_CONDITION_NAMES.turn_limit}" needs a number of rounds.`);
  if (config.dice_sides < 1) add("CFG-4", "The dice need at least 1 side.");
  if (config.max_rolls_per_turn < 1) add("CFG-4", "Allow at least 1 roll per turn.");

  // HQs (BRD-4) and slot use (BRD-W1, BRD-W2)
  for (const slot of new Set(slots.filter((s) => s.trim()))) {
    const hqs = spaces.filter((s) => s.type === "hq" && s.slot === slot).length;
    const plain = spaces.filter((s) => s.type === "category" && s.slot === slot).length;
    if (wins.includes("collection") && !hqs)
      add("BRD-4", `Slot ${slot} has no HQ space, so nobody can collect it ("${WIN_CONDITION_NAMES.collection}" needs one).`, [], slot);
    if (!hqs && !plain) add("BRD-W1", `Slot ${slot} isn't used by any space. A game still has to choose a category for it.`, [], slot, "warning");
    else if (!plain) add("BRD-W2", `Slot ${slot} has no category spaces, so its questions only come up on HQ and wildcard spaces.`, [], slot, "warning");
  }
  return issues;
}

export const boardErrors = (issues: BoardIssue[]) => issues.filter((i) => i.severity === "error");
