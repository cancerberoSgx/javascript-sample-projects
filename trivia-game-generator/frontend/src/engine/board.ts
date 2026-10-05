import { GRAND_PRIZE, type BoardDefinition, type DeckDefinition, type GameConfig, type Space } from "./types";

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

export function resolveConfig(board: BoardDefinition): GameConfig {
  return { ...DEFAULT_CONFIG, ...board.config };
}

export const isFork = (space: Space) => space.next.length > 1;

/** Indices reachable from `from` by following `next` edges (or reversed edges). */
function reachable(spaces: Space[], from: number, reverse = false): Set<number> {
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

/**
 * Checks a board (and its deck) against the BRD-* / CRD-* rules.
 * Returns human-readable errors; an empty array means the board is playable.
 */
export function validateBoard(board: BoardDefinition, deck: DeckDefinition | null): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);
  const config = resolveConfig(board);
  const spaces = board.spaces ?? [];

  if (board.schema_version !== 1) err(`Unsupported schema_version: ${board.schema_version}`);
  if (!spaces.length) return [...errors, "Board has no spaces"];

  // Indices must be exactly 0..N-1
  const indices = spaces.map((s) => s.index).sort((a, b) => a - b);
  if (indices.some((idx, i) => idx !== i)) err("Space indices must be unique and run 0..N-1");
  const byIndex = new Map(spaces.map((s) => [s.index, s]));

  const categoryIds = new Set(board.categories.map((c) => c.id));
  if (categoryIds.size !== board.categories.length) err("Category ids must be unique");
  if (categoryIds.has(GRAND_PRIZE)) err(`"${GRAND_PRIZE}" is reserved and cannot be a board category`);

  // BRD-1
  if (byIndex.get(0)?.type !== "start") err("BRD-1: space 0 must be of type 'start'");
  if (spaces.filter((s) => s.type === "start").length > 1) err("Only one 'start' space is allowed");

  const positions = new Set<string>();
  for (const s of spaces) {
    const where = `space ${s.index}`;
    if (s.type === "category" || s.type === "hq") {
      if (!s.category || !categoryIds.has(s.category)) err(`${where}: '${s.type}' needs a valid category (got ${s.category})`);
    } else if (s.category !== null) {
      err(`${where}: '${s.type}' spaces must have category null`);
    }
    for (const n of s.next) {
      if (!byIndex.has(n)) err(`${where}: next points to missing space ${n}`);
      if (n === s.index) err(`${where}: next points to itself`);
    }
    if (new Set(s.next).size !== s.next.length) err(`${where}: duplicate entries in next`);
    if (s.type !== "finish" && s.next.length === 0) err(`${where}: dead end (empty next) on a non-finish space`);
    if (!s.pos || !Number.isFinite(s.pos.x) || !Number.isFinite(s.pos.y)) err(`${where}: missing pos`);
    else {
      const key = `${s.pos.x},${s.pos.y}`;
      if (positions.has(key)) err(`${where}: pos ${key} is already used by another space`);
      positions.add(key);
    }
  }

  // Track shape: BRD-2 / BRD-3, FRK-4
  const finishes = spaces.filter((s) => s.type === "finish");
  const fromStart = reachable(spaces, 0);
  const unreachable = spaces.filter((s) => !fromStart.has(s.index)).map((s) => s.index);
  if (unreachable.length) err(`Spaces not reachable from start: ${unreachable.join(", ")}`);

  if (config.track_type === "linear") {
    if (finishes.length !== 1) err(`BRD-2: a linear track needs exactly one 'finish' space (found ${finishes.length})`);
    else {
      if (finishes[0].next.length) err("BRD-2: the 'finish' space must have an empty next");
      const toFinish = reachable(spaces, finishes[0].index, true);
      const trapped = spaces.filter((s) => !toFinish.has(s.index)).map((s) => s.index);
      if (trapped.length) err(`FRK-4: 'finish' cannot be reached from spaces: ${trapped.join(", ")}`);
    }
  } else {
    if (finishes.length) err("BRD-3: a loop track cannot have a 'finish' space");
    const toStart = reachable(spaces, 0, true);
    const trapped = spaces.filter((s) => !toStart.has(s.index)).map((s) => s.index);
    if (trapped.length) err(`BRD-3: these spaces never loop back to start: ${trapped.join(", ")}`);
  }

  // Config sanity
  if (config.win_conditions.includes("finish") && config.track_type !== "linear")
    err("Win condition 'finish' needs track_type 'linear'");
  if (config.win_conditions.includes("turn_limit") && !(config.max_rounds && config.max_rounds > 0))
    err("Win condition 'turn_limit' needs a positive max_rounds");
  if (!config.win_conditions.length) err("At least one win condition is required");
  if (config.dice_sides < 1) err("dice_sides must be >= 1");
  if (config.max_rolls_per_turn < 1) err("max_rolls_per_turn must be >= 1");

  // BRD-4
  if (config.win_conditions.includes("collection")) {
    for (const c of board.categories) {
      if (!spaces.some((s) => s.type === "hq" && s.category === c.id))
        err(`BRD-4: category '${c.id}' has no 'hq' space, so the collection win is impossible`);
    }
  }

  // BRD-5 and card checks
  if (!deck) err(`Deck '${board.deck}' could not be loaded`);
  else {
    for (const card of deck.cards) {
      const where = `card ${card.id}`;
      if (card.options) {
        if (typeof card.correct_answer !== "number" || card.correct_answer < 0 || card.correct_answer >= card.options.length)
          err(`${where}: correct_answer must be an index into options (CRD-1)`);
      } else if (typeof card.correct_answer !== "string") err(`${where}: open-ended correct_answer must be a string`);
      if (![1, 2, 3].includes(card.difficulty)) err(`${where}: difficulty must be 1, 2 or 3`);
    }
    // Every category may be drawn (wildcards let the player pick any), so each needs cards.
    for (const c of board.categories) {
      if (!deck.cards.some((card) => card.category === c.id)) err(`BRD-5: deck has no cards for category '${c.id}'`);
    }
    if (config.win_conditions.includes("finish") && !deck.cards.some((card) => card.category === GRAND_PRIZE))
      err(`Deck has no '${GRAND_PRIZE}' cards, required by the 'finish' win condition`);
  }

  return errors;
}
