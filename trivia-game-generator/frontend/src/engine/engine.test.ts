import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { activePlayer, applyAction, createGame, normalizeAnswer, resumeGame, suspendGame } from "./engine";
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

describe("saved games", () => {
  const play = (s: GameState, steps: number) => {
    for (let i = 0; i < steps && s.phase !== "GAME_OVER"; i++) {
      if (s.phase === "AWAIT_ROLL") s = act(s, { type: "ROLL" });
      else if (s.phase === "AWAIT_MOVE") s = act(s, { type: "MOVE", to: Number(Object.keys(s.destinations)[0]) });
      else if (s.phase === "AWAIT_CATEGORY") s = act(s, { type: "CHOOSE_CATEGORY", category: "pop" });
      else s = act(s, { type: "FORCE_RESULT", correct: i % 3 === 0 });
    }
    return s;
  };

  it("a save survives JSON and continues exactly like the original (SAV-2)", () => {
    const original = play(newGame("loop-shortcut"), 12);
    const loaded = resumeGame(JSON.parse(JSON.stringify(suspendGame(original, NOW))), NOW);
    expect(loaded).toEqual(original);
    expect(play(loaded, 20)).toEqual(play(original, 20));
  });

  it("stores the question timer as time left and restarts it on load (SAV-3)", () => {
    let s = newGame("linear-basic");
    s = act(s, { type: "ROLL", value: 1 });
    s = act(s, { type: "MOVE", to: 1 });
    const saved = suspendGame(s, NOW + 10_000); // 30 s limit, 10 s used
    expect(saved.question).toMatchObject({ deadline: null, time_left_ms: 20_000 });
    expect(s.question!.deadline).toBe(NOW + 30_000); // the original is untouched

    const later = NOW + 86_400_000; // continued the next day
    const loaded = resumeGame(saved, later);
    expect(loaded.question!.deadline).toBe(later + 20_000);
    expect(loaded.question).not.toHaveProperty("time_left_ms");
    expect(applyAction(loaded, { type: "TIMEOUT" }, later + 1000).error).toMatch(/hasn't expired/);

    const expired = suspendGame(s, NOW + 40_000);
    expect(expired.question!.time_left_ms).toBe(0);
  });
});
