// Turn engine for rules.md §3–§7. It has no React or DOM code, so a future server can reuse it.
//
// applyAction(state, action, now) is pure: it returns a new state (or an error) and never
// changes its input. Automatic phases (resolve space, draw, evaluate, apply result, turn end,
// win check) run inside it, so a returned state is always waiting for input or GAME_OVER.

import { resolveConfig } from "./board";
import { legalDestinations } from "./movement";
import { randomInt, shuffle } from "./rng";
import {
  GRAND_PRIZE,
  type Action,
  type AnswerResult,
  type BoardDefinition,
  type DeckDefinition,
  type GameState,
  type Player,
  type PlayerSetup,
} from "./types";

export interface ActionOutcome {
  state: GameState;
  error?: string;
}

export function createGame(
  board: BoardDefinition,
  deck: DeckDefinition,
  players: PlayerSetup[],
  seed: number,
  now: number = Date.now(),
): GameState {
  if (!players.length) throw new Error("At least one player is required");
  let rng = seed | 0;

  const cards = Object.fromEntries(deck.cards.map((c) => [c.id, c]));
  const decks: GameState["decks"] = {};
  for (const category of [...board.categories.map((c) => c.id), GRAND_PRIZE]) {
    const ids = deck.cards.filter((c) => c.category === category).map((c) => c.id);
    let draw: string[];
    [draw, rng] = shuffle(ids, rng);
    decks[category] = { draw, used: [] };
  }

  const s: GameState = {
    config: resolveConfig(board),
    board,
    cards,
    decks,
    players: players.map(
      (p, i): Player => ({
        id: p.id ?? `p${i + 1}`,
        name: p.name,
        color: p.color,
        current_space: 0,
        inventory: [],
        score: 0,
        skip_next_turn: false,
      }),
    ),
    active_player: 0,
    round: 1,
    rolls_this_turn: 0,
    phase: "AWAIT_ROLL",
    last_roll: null,
    destinations: {},
    last_move: null,
    question: null,
    last_answer: null,
    result: null,
    rng,
    log: [],
  };
  log(s, `Game started on "${board.name}" with ${players.length} player(s).`, null);
  startTurn(s, now);
  return s;
}

export function applyAction(state: GameState, action: Action, now: number = Date.now()): ActionOutcome {
  if (state.phase === "GAME_OVER") return { state, error: "The game is over (INV-4)." };
  const s = structuredClone(state);
  const error = dispatch(s, action, now);
  return error ? { state, error } : { state: s };
}

export const activePlayer = (s: Pick<GameState, "players" | "active_player">) => s.players[s.active_player];
export const spaceAt = (s: GameState, index: number) => s.board.spaces.find((sp) => sp.index === index)!;
export const categoryName = (s: Pick<GameState, "board">, id: string) =>
  id === GRAND_PRIZE ? "Grand Prize" : (s.board.categories.find((c) => c.id === id)?.name ?? id);

// ---------------------------------------------------------------------------

function dispatch(s: GameState, action: Action, now: number): string | undefined {
  const expect = (phase: GameState["phase"]) =>
    s.phase === phase ? undefined : `Can't ${action.type} now: waiting for ${s.phase} (SM-1).`;

  switch (action.type) {
    case "ROLL": {
      const bad = expect("AWAIT_ROLL");
      if (bad) return bad;
      let value = action.value;
      if (value === undefined) [value, s.rng] = randomInt(s.rng, 1, s.config.dice_sides);
      else if (!Number.isInteger(value) || value < 1 || value > s.config.dice_sides)
        return `Roll must be between 1 and ${s.config.dice_sides}.`;
      s.rolls_this_turn++;
      s.last_roll = value;
      s.destinations = legalDestinations(s.board.spaces, activePlayer(s).current_space, value);
      s.phase = "AWAIT_MOVE";
      const options = Object.keys(s.destinations);
      log(s, `rolled a ${value}${action.value !== undefined ? " (rigged)" : ""}. Can move to: ${options.join(", ")}.`);
      return;
    }

    case "MOVE": {
      const bad = expect("AWAIT_MOVE");
      if (bad) return bad;
      const path = s.destinations[action.to];
      if (!path) {
        const legal = Object.keys(s.destinations).join(", ");
        return `Space ${action.to} can't be reached with a roll of ${s.last_roll}. Legal: ${legal}.`;
      }
      const p = activePlayer(s);
      s.last_move = { seq: (s.last_move?.seq ?? 0) + 1, player_id: p.id, path: [p.current_space, ...path] };
      p.current_space = action.to;
      s.destinations = {};
      log(s, `moved along ${path.join(" → ")}.`);
      resolveSpace(s, now);
      return;
    }

    case "CHOOSE_CATEGORY": {
      const bad = expect("AWAIT_CATEGORY");
      if (bad) return bad;
      if (!s.board.categories.some((c) => c.id === action.category)) return `Unknown category '${action.category}'.`;
      log(s, `chose ${categoryName(s, action.category)} on the wildcard.`);
      drawCard(s, action.category, { grand_prize: false, from_hq: false }, now);
      return;
    }

    case "ANSWER": {
      const bad = expect("AWAIT_ANSWER");
      if (bad) return bad;
      const q = s.question!;
      const late = q.deadline !== null && now > q.deadline;
      const result: AnswerResult = late ? "timeout" : isCorrect(q.card, action.answer) ? "correct" : "incorrect";
      const given = q.card.options && typeof action.answer === "number" ? q.card.options[action.answer] : String(action.answer);
      applyResult(s, result, given ?? String(action.answer), now);
      return;
    }

    case "TIMEOUT": {
      const bad = expect("AWAIT_ANSWER");
      if (bad) return bad;
      const q = s.question!;
      if (q.deadline === null || now < q.deadline) return "The timer hasn't expired yet.";
      applyResult(s, "timeout", "", now);
      return;
    }

    case "FORCE_RESULT": {
      const bad = expect("AWAIT_ANSWER");
      if (bad) return bad;
      applyResult(s, action.correct ? "correct" : "incorrect", action.correct ? "(forced correct)" : "(forced wrong)", now);
      return;
    }

    case "SKIP_TURN": {
      log(s, "had their turn skipped by the host.");
      endTurn(s, now);
      return;
    }

    case "REMOVE_PLAYER": {
      const p = s.players.find((x) => x.id === action.player_id);
      if (!p || p.removed) return `Unknown player '${action.player_id}'.`;
      if (s.players.filter((x) => !x.removed).length === 1) return "Can't remove the last player: finish the game instead.";
      p.removed = true;
      p.skip_next_turn = false;
      log(s, "was removed from the game by the host.", p.id);
      if (p === activePlayer(s)) endTurn(s, now);
      return;
    }
  }
}

// §4.1 TURN_START
function startTurn(s: GameState, now: number) {
  s.rolls_this_turn = 0;
  s.last_roll = null;
  s.destinations = {};
  s.question = null;
  const p = activePlayer(s);

  if (p.skip_next_turn) {
    p.skip_next_turn = false; // TS-2 / PEN-2
    log(s, "skips this turn (penalty).");
    endTurn(s, now);
    return;
  }
  if (s.config.track_type === "linear" && spaceAt(s, p.current_space).type === "finish") {
    log(s, "is still on the finish space and tries another Grand Prize question (TS-3).");
    drawCard(s, GRAND_PRIZE, { grand_prize: true, from_hq: false }, now);
    return;
  }
  s.phase = "AWAIT_ROLL";
}

// §4.4 RESOLVE_SPACE
function resolveSpace(s: GameState, now: number) {
  const p = activePlayer(s);
  const space = spaceAt(s, p.current_space);

  switch (space.type) {
    case "start":
      log(s, "landed on Start. No card.");
      return endTurn(s, now);
    case "category":
    case "hq":
      return drawCard(s, space.category!, { grand_prize: false, from_hq: space.type === "hq" }, now);
    case "wildcard":
      log(s, "landed on a Wildcard and picks a category.");
      s.phase = "AWAIT_CATEGORY";
      return;
    case "roll_again":
      if (s.rolls_this_turn < s.config.max_rolls_per_turn) {
        log(s, "landed on Roll Again.");
        s.phase = "AWAIT_ROLL";
        return;
      }
      log(s, `landed on Roll Again but already used ${s.config.max_rolls_per_turn} rolls this turn.`);
      return endTurn(s, now);
    case "penalty":
      p.skip_next_turn = true; // PEN-1
      log(s, "landed on a Penalty space and will skip their next turn.");
      return endTurn(s, now);
    case "finish":
      log(s, "reached the finish and gets a Grand Prize question!");
      return drawCard(s, GRAND_PRIZE, { grand_prize: true, from_hq: false }, now);
  }
}

// §4.5 DRAW_CARD (CRD-2, CRD-3)
function drawCard(s: GameState, category: string, opts: { grand_prize: boolean; from_hq: boolean }, now: number) {
  const deck = s.decks[category];
  let cardId: string;
  if (s.config.reuse_cards) {
    const all = [...deck.draw, ...deck.used];
    let i: number;
    [i, s.rng] = randomInt(s.rng, 0, all.length - 1);
    cardId = all[i];
  } else {
    if (!deck.draw.length) {
      [deck.draw, s.rng] = shuffle(deck.used, s.rng);
      deck.used = [];
      log(s, `${categoryName(s, category)} deck ran out and was reshuffled.`, null);
    }
    cardId = deck.draw.shift()!;
    deck.used.push(cardId);
  }
  const limit = s.config.answer_time_limit_sec;
  s.question = {
    card: s.cards[cardId],
    deadline: limit > 0 ? now + limit * 1000 : null,
    ...opts,
  };
  s.phase = "AWAIT_ANSWER";
}

// §4.6 EVALUATE (EVL-1, EVL-2). EVL-3 (LLM judge) needs the server, so it isn't done here.
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCorrect(card: GameState["cards"][string], answer: string | number): boolean {
  if (card.options) return answer === card.correct_answer;
  return normalizeAnswer(String(answer)) === normalizeAnswer(String(card.correct_answer));
}

// §4.7 APPLY_RESULT
function applyResult(s: GameState, result: AnswerResult, given: string, now: number) {
  const q = s.question!;
  const p = activePlayer(s);
  s.last_answer = { card: q.card, given, result };
  s.question = null;

  if (result !== "correct") {
    log(s, result === "timeout" ? "ran out of time." : `answered wrong (${given}).`);
    return endTurn(s, now); // RES-6
  }

  p.score += q.card.difficulty; // RES-1
  log(s, `answered correctly (+${q.card.difficulty}).`);
  if (q.from_hq && !p.inventory.includes(q.card.category)) {
    p.inventory = [...p.inventory, q.card.category].sort(); // RES-2, PLY-2
    log(s, `earned the ${categoryName(s, q.card.category)} token!`);
  }

  // RES-3 / RES-4: check for a win before any bonus roll
  if (q.grand_prize && s.config.win_conditions.includes("finish")) return win(s, p, "finish");
  if (
    s.config.win_conditions.includes("collection") &&
    s.board.categories.every((c) => p.inventory.includes(c.id))
  )
    return win(s, p, "collection");

  // RES-5
  if (s.config.bonus_roll_on_correct && s.rolls_this_turn < s.config.max_rolls_per_turn) {
    log(s, "gets a bonus roll.");
    s.phase = "AWAIT_ROLL";
    return;
  }
  endTurn(s, now);
}

// §4.8 TURN_END. Removed players are passed over (MPL-9).
function endTurn(s: GameState, now: number) {
  s.question = null;
  s.destinations = {};
  do {
    s.active_player = (s.active_player + 1) % s.players.length;
    if (s.active_player === 0) {
      s.round++;
      if (s.config.win_conditions.includes("turn_limit") && s.config.max_rounds && s.round > s.config.max_rounds)
        return finishByTurnLimit(s);
    }
  } while (activePlayer(s).removed);
  startTurn(s, now);
}

// §7.3 (WIN-T1, WIN-T2)
function finishByTurnLimit(s: GameState) {
  const key = (p: Player) => [p.score, p.inventory.length, p.current_space];
  const ranked = s.players.filter((p) => !p.removed).sort((a, b) => {
    const [ka, kb] = [key(a), key(b)];
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return 0;
  });
  s.round = s.config.max_rounds!;
  if (ranked.length > 1 && key(ranked[0]).join() === key(ranked[1]).join()) {
    s.result = { type: "draw" };
    s.phase = "GAME_OVER";
    log(s, `Round limit reached. It's a draw!`, null);
    return;
  }
  win(s, ranked[0], "turn_limit");
}

function win(s: GameState, p: Player, reason: "finish" | "collection" | "turn_limit") {
  s.result = { type: "win", player_id: p.id, reason };
  s.phase = "GAME_OVER";
  const why = { finish: "answered the Grand Prize", collection: "collected every category", turn_limit: "had the best score at the round limit" };
  log(s, `WINS: ${why[reason]}!`, p.id);
}

function log(s: GameState, text: string, playerId: string | null = activePlayer(s).id) {
  s.log.push({ round: s.round, player_id: playerId, text });
}
