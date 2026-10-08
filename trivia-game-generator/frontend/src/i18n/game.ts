// Translating the game's own words: space types, ways to win, answer results, category names of
// the Grand Prize, and the engine's log lines (I18N-6).

import type { AnswerResult, GameView, LogEntry, SpaceType, WinCondition } from "../engine/types";
import { GRAND_PRIZE } from "../engine/types";
import { isMessageKey } from "./catalog";
import type { Translator } from "./index";

export const spaceName = (t: Translator, type: SpaceType) => t(`board.space.${type}`);
export const winName = (t: Translator, w: WinCondition) => t(`board.win.${w}`);
export const resultName = (t: Translator, r: AnswerResult) => t(`board.result.${r}`);

/** "A, B or C" in the shown language. */
export function joinList(t: Translator, items: string[], type: "conjunction" | "disjunction" = "conjunction") {
  try {
    return new Intl.ListFormat(t.lang, { type }).format(items);
  } catch {
    return items.join(", ");
  }
}

/** A category's name; the Grand Prize pile is translated. */
export function categoryLabel(t: Translator, game: Pick<GameView, "board">, id: string) {
  if (id === GRAND_PRIZE) return t("common.grandPrize");
  return game.board.categories.find((c) => c.id === id)?.name ?? id;
}

/** A log line in the shown language. Lines saved before they had keys keep their English text. */
export function logText(t: Translator, game: Pick<GameView, "board">, e: LogEntry): string {
  if (!e.key || !isMessageKey(e.key)) return e.text;
  const params = { ...e.params };
  if (typeof params.category === "string") params.category = categoryLabel(t, game, params.category);
  return t(e.key, params);
}
