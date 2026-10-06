// What just happened between two views of a live game, for the play screen's animations:
// the server only sends states, so a roll, an answer or a new turn is a difference between
// the previous view and the new one.

import type { Category, GameView, LastAnswer, Player } from "../engine/types";

export type PlayEvent =
  | { kind: "roll"; key: string; player: Player; value: number }
  | { kind: "answer"; key: string; player: Player; answer: LastAnswer; points: number; token: Category | null }
  | { kind: "turn"; key: string; player: Player }
  | { kind: "over"; key: string };

/** Events from `prev` to `next`, in the order they happened. No previous view: nothing to animate. */
export function diffEvents(prev: GameView | null, next: GameView): PlayEvent[] {
  if (!prev) return [];
  const events: PlayEvent[] = [];
  const key = String(next.log.length);
  const player = (id: string) => next.players.find((p) => p.id === id)!;

  // The question on screen was answered (or ran out of time); a host skip leaves no answer
  const q = prev.question;
  const a = next.last_answer;
  if (prev.phase === "AWAIT_ANSWER" && q && a && a.card.id === q.card.id && (next.phase !== "AWAIT_ANSWER" || next.question?.card.id !== q.card.id)) {
    const before = prev.players[prev.active_player];
    const after = player(before.id);
    const gained = after.inventory.find((c) => !before.inventory.includes(c));
    events.push({
      kind: "answer",
      key: `answer-${key}`,
      player: after,
      answer: a,
      points: after.score - before.score,
      token: next.board.categories.find((c) => c.id === gained) ?? null,
    });
  }

  if (next.phase === "GAME_OVER") {
    if (prev.phase !== "GAME_OVER") events.push({ kind: "over", key: `over-${key}` });
    return events;
  }

  const active = next.players[next.active_player];
  if (prev.active_player !== next.active_player || prev.round !== next.round)
    events.push({ kind: "turn", key: `turn-${next.round}-${next.active_player}-${key}`, player: active });

  // A roll always waits for a move
  if (next.phase === "AWAIT_MOVE" && prev.phase !== "AWAIT_MOVE" && next.last_roll !== null)
    events.push({ kind: "roll", key: `roll-${key}`, player: active, value: next.last_roll });

  return events;
}
