import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { activePlayer, applyAction, createGame, normalizeAnswer } from "./engine";
import { legalDestinations } from "./movement";
import { resolveGame, validateBoardFile } from "./resolve";
import type { Action, BoardDefinition, BoardFile, DeckFile, GameState, SlotMapping } from "./types";

const PUBLIC = join(__dirname, "../../public");
const readJson = <T,>(path: string): T => JSON.parse(readFileSync(join(PUBLIC, path), "utf8"));
const deckFile = readJson<DeckFile>("decks/general.json");
const manifest = readJson<{ boards: { file: string }[] }>("boards/index.json");
const loadBoardFile = (id: string) => readJson<BoardFile>(`boards/${id}.json`);
/** Slots A, B, C, D play science, history, art, pop. */
const mappingFor = (b: BoardFile): SlotMapping => Object.fromEntries(b.slots.map((s, i) => [s, deckFile.categories[i]]));

function resolve(file: BoardFile) {
  const r = resolveGame(file, mappingFor(file), deckFile);
  if (!r.board) throw new Error(r.errors.join("\n"));
  return { ...r, board: r.board, deck: r.deck! };
}
const loadBoard = (id: string): BoardDefinition => resolve(loadBoardFile(id)).board;

const PLAYERS = [
  { name: "Ana", color: "#e11d48" },
  { name: "Ben", color: "#2563eb" },
];
const NOW = 1_000_000;

function newGame(id: string, patch: (b: BoardFile) => void = () => {}) {
  const file = structuredClone(loadBoardFile(id));
  patch(file);
  const { board, deck } = resolve(file);
  return createGame(board, deck, PLAYERS, 42, NOW);
}

function act(s: GameState, action: Action, now = NOW): GameState {
  const out = applyAction(s, action, now);
  if (out.error) throw new Error(out.error);
  return out.state;
}

describe("example boards", () => {
  it.each(manifest.boards.map((b) => b.file))("%s is valid on its own and with the sample deck", (file) => {
    const board = readJson<BoardFile>(file);
    expect(validateBoardFile(board)).toEqual([]);
    expect(resolveGame(board, mappingFor(board), deckFile).errors).toEqual([]);
  });

  it("reports broken boards", () => {
    const board = structuredClone(loadBoardFile("linear-basic"));
    board.spaces[3].next = [99];
    board.spaces[0].type = "category";
    board.spaces[0].slot = "A";
    board.config.track_type = "loop";
    const errors = validateBoardFile(board).join("\n");
    expect(errors).toMatch(/BRD-1/);
    expect(errors).toMatch(/missing space 99/);
    expect(errors).toMatch(/loop track cannot have a 'finish'/);
  });

  it("reports slot and mapping problems", () => {
    const board = structuredClone(loadBoardFile("linear-basic"));
    board.spaces[1].slot = "Z";
    expect(validateBoardFile(board).join()).toMatch(/needs one of the slots A, B, C, D \(got Z\)/);

    const ok = loadBoardFile("linear-basic");
    const sameTwice = { ...mappingFor(ok), B: deckFile.categories[0] };
    expect(resolveGame(ok, sameTwice, deckFile).errors.join()).toMatch(/different category/);
    const { D: _omit, ...missing } = mappingFor(ok);
    expect(resolveGame(ok, missing, deckFile).errors.join()).toMatch(/slot\(s\): D/);
  });

  it("resolves deck cards for the engine", () => {
    const { deck } = resolve(loadBoardFile("linear-basic"));
    const mc = deck.cards.find((c) => c.id === "science-1")!;
    expect(mc.correct_answer).toBe(1); // "Au" is options[1]
    expect(deck.cards.filter((c) => c.category === "grand_prize")).toHaveLength(4);
  });
});

describe("movement", () => {
  it("linear: stops at finish when the roll overshoots (MOV-2)", () => {
    const { spaces } = loadBoard("linear-basic");
    expect(legalDestinations(spaces, 17, 6)).toEqual({ 19: [18, 19] });
  });

  it("loop: wraps around (MOV-3)", () => {
    const { spaces } = loadBoard("loop-classic");
    expect(Object.keys(legalDestinations(spaces, 22, 4))).toEqual(["2"]);
  });

  it("fork: one destination per branch (FRK-1)", () => {
    const { spaces } = loadBoard("linear-forks");
    // From 2, a roll of 3: 3 → upper (4, 5) or lower (6, 7)
    const dest = legalDestinations(spaces, 2, 3);
    expect(dest).toEqual({ 5: [3, 4, 5], 7: [3, 6, 7] });
  });

  it("fork on a loop: shortcut vs perimeter", () => {
    const { spaces } = loadBoard("loop-shortcut");
    expect(Object.keys(legalDestinations(spaces, 0, 4)).map(Number).sort((a, b) => a - b)).toEqual([4, 21]);
  });
});

describe("turn flow", () => {
  it("rejects moves to unreachable spaces and actions out of phase", () => {
    let s = newGame("linear-basic");
    expect(applyAction(s, { type: "MOVE", to: 1 }).error).toMatch(/waiting for AWAIT_ROLL/);
    s = act(s, { type: "ROLL", value: 2 });
    expect(applyAction(s, { type: "MOVE", to: 3 }).error).toMatch(/can't be reached/);
    s = act(s, { type: "MOVE", to: 2 });
    expect(s.phase).toBe("AWAIT_ANSWER");
  });

  it("correct answer scores, grants bonus roll; wrong answer passes the turn", () => {
    let s = newGame("linear-basic");
    s = act(s, { type: "ROLL", value: 1 });
    s = act(s, { type: "MOVE", to: 1 });
    const difficulty = s.question!.card.difficulty;
    s = act(s, { type: "FORCE_RESULT", correct: true });
    expect(s.players[0].score).toBe(difficulty);
    expect(s.phase).toBe("AWAIT_ROLL");
    expect(s.active_player).toBe(0); // bonus roll (RES-5)

    s = act(s, { type: "ROLL", value: 1 });
    s = act(s, { type: "MOVE", to: 2 });
    s = act(s, { type: "FORCE_RESULT", correct: false });
    expect(s.active_player).toBe(1);
  });

  it("evaluates multiple-choice and open-ended answers", () => {
    let s = newGame("linear-basic");
    s = act(s, { type: "ROLL", value: 1 });
    s = act(s, { type: "MOVE", to: 1 });
    const card = s.question!.card;
    const answer = card.options ? (card.correct_answer as number) : String(card.correct_answer).toUpperCase() + "!";
    s = act(s, { type: "ANSWER", answer });
    expect(s.last_answer!.result).toBe("correct");
    expect(normalizeAnswer("  Van  Góght ")).toBe("van goght");
  });

  it("late answers count as timeout (TRV-5)", () => {
    let s = newGame("linear-basic");
    s = act(s, { type: "ROLL", value: 1 });
    s = act(s, { type: "MOVE", to: 1 });
    expect(applyAction(s, { type: "TIMEOUT" }, NOW + 1000).error).toMatch(/hasn't expired/);
    s = act(s, { type: "TIMEOUT" }, NOW + 31_000);
    expect(s.last_answer!.result).toBe("timeout");
    expect(s.active_player).toBe(1);
  });

  it("roll-again is capped by max_rolls_per_turn", () => {
    // Sandbox: 1 = roll_again, 4 = roll_again, 8 = roll_again; cap = 3 rolls
    let s = newGame("special-sandbox");
    s = act(s, { type: "ROLL", value: 1 });
    s = act(s, { type: "MOVE", to: 1 });
    expect(s.phase).toBe("AWAIT_ROLL");
    s = act(s, { type: "ROLL", value: 3 });
    s = act(s, { type: "MOVE", to: 4 });
    expect(s.phase).toBe("AWAIT_ROLL");
    s = act(s, { type: "ROLL", value: 4 });
    s = act(s, { type: "MOVE", to: 8 });
    expect(s.active_player).toBe(1); // third roll used: turn ends
    expect(s.rolls_this_turn).toBe(0);
  });

  it("penalty skips exactly the next turn (PEN-1, PEN-2)", () => {
    let s = newGame("special-sandbox");
    s = act(s, { type: "ROLL", value: 2 });
    s = act(s, { type: "MOVE", to: 2 }); // penalty
    expect(s.players[0].skip_next_turn).toBe(true);
    expect(s.active_player).toBe(1);
    s = act(s, { type: "ROLL", value: 2 });
    s = act(s, { type: "MOVE", to: 2 }); // Ben also penalized
    // Ana's turn is skipped, then Ben's: back to Ana with both flags cleared
    expect(s.active_player).toBe(0);
    expect(s.players.every((p) => !p.skip_next_turn)).toBe(true);
    expect(s.round).toBe(3);
  });

  it("wildcard asks for a category first", () => {
    let s = newGame("special-sandbox");
    s = act(s, { type: "ROLL", value: 3 });
    s = act(s, { type: "MOVE", to: 3 });
    expect(s.phase).toBe("AWAIT_CATEGORY");
    s = act(s, { type: "CHOOSE_CATEGORY", category: "art" });
    expect(s.question!.card.category).toBe("art");
  });

  it("finish: missed Grand Prize retries next turn, correct one wins (WIN-F*)", () => {
    let s = newGame("special-sandbox", (b) => (b.config.bonus_roll_on_correct = false));
    s.players[0].current_space = 10;
    s = act(s, { type: "ROLL", value: 4 });
    s = act(s, { type: "MOVE", to: 11 });
    expect(s.question!.grand_prize).toBe(true);
    s = act(s, { type: "FORCE_RESULT", correct: false });
    s = act(s, { type: "ROLL", value: 1 }); // Ben
    s = act(s, { type: "MOVE", to: 1 }); // roll again
    s = act(s, { type: "ROLL", value: 1 });
    s = act(s, { type: "MOVE", to: 2 }); // penalty, turn ends
    expect(activePlayer(s).id).toBe("p1");
    expect(s.phase).toBe("AWAIT_ANSWER"); // TS-3: no roll on finish
    s = act(s, { type: "FORCE_RESULT", correct: true });
    expect(s.result).toEqual({ type: "win", player_id: "p1", reason: "finish" });
    expect(applyAction(s, { type: "ROLL" }).error).toMatch(/game is over/);
  });

  it("collection: winning the last HQ token wins the game (WIN-C1)", () => {
    let s = newGame("linear-basic");
    s.players[0].inventory = ["art", "history", "pop"];
    s = act(s, { type: "ROLL", value: 3 });
    s = act(s, { type: "MOVE", to: 3 }); // science HQ
    s = act(s, { type: "FORCE_RESULT", correct: true });
    expect(s.result).toEqual({ type: "win", player_id: "p1", reason: "collection" });
  });

  it("turn limit: best score wins after max_rounds (WIN-T1)", () => {
    let s = newGame("loop-classic", (b) => (b.config.max_rounds = 1));
    s.players[1].score = 5;
    s = act(s, { type: "ROLL", value: 1 });
    s = act(s, { type: "MOVE", to: 1 });
    s = act(s, { type: "FORCE_RESULT", correct: false });
    s = act(s, { type: "ROLL", value: 1 });
    s = act(s, { type: "MOVE", to: 1 });
    s = act(s, { type: "FORCE_RESULT", correct: false });
    expect(s.result).toEqual({ type: "win", player_id: "p2", reason: "turn_limit" });
  });

  it("is deterministic for the same seed and inputs (INV-5)", () => {
    const run = () => {
      let s = newGame("loop-shortcut");
      for (let i = 0; i < 30 && s.phase !== "GAME_OVER"; i++) {
        if (s.phase === "AWAIT_ROLL") s = act(s, { type: "ROLL" });
        else if (s.phase === "AWAIT_MOVE") s = act(s, { type: "MOVE", to: Number(Object.keys(s.destinations)[0]) });
        else if (s.phase === "AWAIT_CATEGORY") s = act(s, { type: "CHOOSE_CATEGORY", category: "pop" });
        else s = act(s, { type: "FORCE_RESULT", correct: i % 2 === 0 });
      }
      return s;
    };
    expect(run()).toEqual(run());
  });
});

describe("multiplayer host actions", () => {
  it("uses the given player ids", () => {
    const { board, deck } = resolve(loadBoardFile("linear-basic"));
    const s = createGame(board, deck, [{ name: "Ana", color: "#000", id: "17" }, { name: "Ben", color: "#111", id: "4" }], 1, NOW);
    expect(s.players.map((p) => p.id)).toEqual(["17", "4"]);
  });

  it("SKIP_TURN ends the active player's turn in any phase (MPL-8)", () => {
    let s = newGame("linear-basic");
    s = act(s, { type: "ROLL", value: 1 });
    s = act(s, { type: "MOVE", to: 1 });
    expect(s.phase).toBe("AWAIT_ANSWER");
    s = act(s, { type: "SKIP_TURN" });
    expect(activePlayer(s).name).toBe("Ben");
    expect(s.phase).toBe("AWAIT_ROLL");
    expect(s.question).toBeNull();
  });

  it("REMOVE_PLAYER passes over the player from then on (MPL-9)", () => {
    const { board, deck } = resolve(loadBoardFile("linear-basic"));
    let s = createGame(board, deck, [...PLAYERS, { name: "Cy", color: "#000" }], 42, NOW);
    s = act(s, { type: "REMOVE_PLAYER", player_id: "p2" });
    expect(activePlayer(s).name).toBe("Ana"); // not Ana's turn that ended
    s = act(s, { type: "SKIP_TURN" });
    expect(activePlayer(s).name).toBe("Cy");
    s = act(s, { type: "SKIP_TURN" });
    expect([activePlayer(s).name, s.round]).toEqual(["Ana", 2]);

    // Removing the active player starts the next turn
    s = act(s, { type: "REMOVE_PLAYER", player_id: "p1" });
    expect(activePlayer(s).name).toBe("Cy");
    expect(applyAction(s, { type: "REMOVE_PLAYER", player_id: "p3" }).error).toMatch(/last player/);
    expect(applyAction(s, { type: "REMOVE_PLAYER", player_id: "p1" }).error).toMatch(/Unknown player/);
    expect(s.players.map((p) => !!p.removed)).toEqual([true, true, false]);
  });

  it("the turn-limit ranking ignores removed players", () => {
    let s = newGame("loop-classic", (b) => {
      b.config.max_rounds = 1;
      b.config.win_conditions = ["turn_limit"];
    });
    s.players[1].score = 5;
    s = act(s, { type: "REMOVE_PLAYER", player_id: "p2" });
    s = act(s, { type: "SKIP_TURN" });
    expect(s.result).toEqual({ type: "win", player_id: "p1", reason: "turn_limit" });
  });
});

// ---------------------------------------------------------------------------
// Conformance fixture for the server's Python port of the engine (backend/app/engine/).
// Scripted games on every example board; the Python test replays the same actions and must
// produce the same states and errors. Regenerate after an engine change with:
//   UPDATE_CONFORMANCE=1 npx vitest run src/engine
// then port the change to Python until backend/tests/test_engine.py passes.

const FIXTURE = join(__dirname, "../../../backend/tests/fixtures/engine_conformance.json");

interface Step {
  action: Action;
  now: number;
  error?: string;
  state: unknown; // digest, see digest()
}

/** The parts of the state that matter, without the (static) board and cards. */
function digest(s: GameState) {
  const { board: _b, cards: _c, config: _f, log, question, last_answer, ...rest } = s;
  return {
    ...rest,
    question: question && { card: question.card.id, deadline: question.deadline, grand_prize: question.grand_prize, from_hq: question.from_hq },
    last_answer: last_answer && { card: last_answer.card.id, given: last_answer.given, result: last_answer.result },
    log_length: log.length,
    last_log: log.slice(-2),
  };
}

function scriptedGame(boardFile: string, patch: Partial<BoardFile["config"]>, seed: number, steps: number) {
  const file = structuredClone(readJson<BoardFile>(boardFile));
  file.config = { ...file.config, ...patch };
  const { board, deck } = resolve(file);
  const players = [...PLAYERS, { name: "Cy", color: "#0891b2", id: "77" }];
  let s = createGame(board, deck, players, seed, NOW);
  const initial = s;
  let r = seed;
  const rand = (n: number) => {
    r = (Math.imul(r, 1103515245) + 12345) | 0;
    return ((r >>> 8) % n + n) % n;
  };
  const out: Step[] = [];
  let now = NOW;
  let removed = false;
  for (let i = 0; i < steps && s.phase !== "GAME_OVER"; i++) {
    now += 1000;
    let action: Action;
    const roll = rand(100);
    const dests = Object.keys(s.destinations);
    if (roll < 3) action = { type: "SKIP_TURN" };
    else if (roll < 5 && !removed && i > 20) {
      action = { type: "REMOVE_PLAYER", player_id: s.players[rand(s.players.length)].id };
      removed = true;
    } else if (roll < 7) action = [{ type: "MOVE", to: 999 }, { type: "CHOOSE_CATEGORY", category: "nope" }, { type: "TIMEOUT" }, { type: "ROLL", value: 99 }][rand(4)] as Action;
    else if (s.phase === "AWAIT_ROLL") action = roll < 15 ? { type: "ROLL", value: 1 + rand(s.config.dice_sides) } : { type: "ROLL" };
    else if (s.phase === "AWAIT_MOVE") action = { type: "MOVE", to: Number(dests[rand(dests.length)]) };
    else if (s.phase === "AWAIT_CATEGORY") action = { type: "CHOOSE_CATEGORY", category: s.board.categories[rand(s.board.categories.length)].id };
    else {
      const card = s.question!.card;
      const kind = rand(6);
      if (kind === 0 && s.question!.deadline !== null) {
        now = s.question!.deadline + 1;
        action = rand(2) ? { type: "TIMEOUT" } : { type: "ANSWER", answer: card.options ? 0 : "x" };
      } else if (kind <= 2) {
        // correct, written loosely for open questions (EVL-2 normalization)
        action = { type: "ANSWER", answer: card.options ? (card.correct_answer as number) : `  ${String(card.correct_answer).toUpperCase()}!! ` };
      } else if (kind === 3) action = { type: "ANSWER", answer: card.options ? (rand(card.options.length + 1) as number) : "Café, Ünïcode" };
      else action = { type: "FORCE_RESULT", correct: rand(2) === 1 };
    }
    const result = applyAction(s, action, now);
    s = result.state;
    out.push({ action, now, ...(result.error ? { error: result.error } : {}), state: digest(s) });
  }
  return { board: boardFile, config: patch, players, seed, initial: digest(initial), steps: out, final: { ...s, board: undefined, cards: undefined } };
}

describe("engine conformance fixture", () => {
  const scenarios = () =>
    manifest.boards.flatMap((b, i) => [
      scriptedGame(b.file, {}, 1000 + i, 150),
      scriptedGame(b.file, { reuse_cards: true, bonus_roll_on_correct: false, max_rounds: 4, win_conditions: b.file.includes("loop") ? ["turn_limit", "collection"] : ["finish", "turn_limit"] }, 2000 + i, 150),
    ]);

  it("matches backend/tests/fixtures/engine_conformance.json", () => {
    const fresh = JSON.parse(JSON.stringify(scenarios()));
    if (process.env.UPDATE_CONFORMANCE) writeFileSync(FIXTURE, JSON.stringify(fresh) + "\n");
    if (!existsSync(FIXTURE)) return; // the backend isn't checked out next to the frontend (e.g. in its container)
    expect(JSON.parse(readFileSync(FIXTURE, "utf8"))).toEqual(fresh);
  });
});
