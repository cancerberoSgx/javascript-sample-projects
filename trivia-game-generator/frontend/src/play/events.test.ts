import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyAction, createGame } from "../engine/engine";
import { resolveGame } from "../engine/resolve";
import type { Action, BoardFile, DeckFile, GameState } from "../engine/types";
import { diffEvents } from "./events";

const PUBLIC = join(__dirname, "../../public");
const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(PUBLIC, path), "utf8"));

function newGame(): GameState {
  const deck = readJson<DeckFile>("decks/general.json");
  const file = readJson<BoardFile>("boards/linear-basic.json");
  const r = resolveGame(file, Object.fromEntries(file.slots.map((s, i) => [s, deck.categories[i]])), deck);
  return createGame(
    r.board!,
    r.deck!,
    [
      { name: "Ana", color: "#e11d48" },
      { name: "Ben", color: "#2563eb" },
    ],
    7,
    0,
  );
}
function act(s: GameState, action: Action): GameState {
  const out = applyAction(s, action, 0);
  if (out.error) throw new Error(out.error);
  return out.state;
}
/** Rolls 1s until the active player lands on a question. */
function toQuestion(s: GameState): GameState {
  while (s.phase !== "AWAIT_ANSWER") {
    if (s.phase === "AWAIT_ROLL") s = act(s, { type: "ROLL", value: 1 });
    else if (s.phase === "AWAIT_MOVE") s = act(s, { type: "MOVE", to: Number(Object.keys(s.destinations)[0]) });
    else if (s.phase === "AWAIT_CATEGORY") s = act(s, { type: "CHOOSE_CATEGORY", category: s.board.categories[0].id });
    else throw new Error(s.phase);
  }
  return s;
}

describe("diffEvents", () => {
  it("has nothing to animate without a previous view", () => {
    expect(diffEvents(null, newGame())).toEqual([]);
  });

  it("sees a roll", () => {
    const s0 = newGame();
    const s1 = act(s0, { type: "ROLL", value: 3 });
    expect(diffEvents(s0, s1)).toMatchObject([{ kind: "roll", value: 3, player: { name: "Ana" } }]);
    expect(diffEvents(s1, s1)).toEqual([]);
  });

  it("sees a wrong answer, then the next player's turn", () => {
    const q = toQuestion(newGame());
    const after = act(q, { type: "ANSWER", answer: q.question!.card.options ? 99 : "certainly not this" });
    const events = diffEvents(q, after);
    expect(events.map((e) => e.kind)).toEqual(["answer", "turn"]);
    expect(events[0]).toMatchObject({ player: { name: "Ana" }, answer: { result: "incorrect" }, points: 0, token: null });
    expect(events[1]).toMatchObject({ player: { name: "Ben" } });
  });

  it("sees a correct answer with its points", () => {
    const q = toQuestion(newGame());
    const correct = q.cards[q.question!.card.id].correct_answer;
    const after = act(q, { type: "ANSWER", answer: correct });
    expect(diffEvents(q, after)[0]).toMatchObject({ kind: "answer", answer: { result: "correct" }, points: q.question!.card.difficulty });
  });

  it("a host skip during a question is a new turn, not an answer", () => {
    const q = toQuestion(newGame());
    expect(diffEvents(q, act(q, { type: "SKIP_TURN" })).map((e) => e.kind)).toEqual(["turn"]);
  });
});
