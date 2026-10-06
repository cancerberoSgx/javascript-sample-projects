// Converts the file/API formats (board with slots, deck with categories) into the engine
// formats (board with categories, engine cards). See rules.md §2.1 and SER-*.

import { boardErrors, resolveConfig, validateBoardFile } from "./board";
import {
  GRAND_PRIZE,
  type BoardDefinition,
  type BoardFile,
  type Card,
  type Category,
  type DeckDefinition,
  type DeckFile,
  type SlotMapping,
} from "./types";

/** Colors for slots that have no category yet (board editor previews). */
export const SLOT_COLORS = ["#3b82f6", "#d97706", "#db2777", "#16a34a", "#7c3aed", "#0891b2", "#ca8a04", "#64748b"];

export function placeholderMapping(board: BoardFile): SlotMapping {
  return Object.fromEntries(
    board.slots.map((slot, i) => [slot, { id: `slot:${slot}`, name: `Slot ${slot}`, color: SLOT_COLORS[i % SLOT_COLORS.length] }]),
  );
}

export function validateMapping(board: BoardFile, mapping: SlotMapping): string[] {
  const errors: string[] = [];
  const slots = board.slots ?? [];
  const missing = slots.filter((s) => !mapping[s]);
  if (slots.some((s) => mapping[s]?.id === GRAND_PRIZE)) errors.push(`"${GRAND_PRIZE}" is reserved and can't be a category id`);
  if (missing.length) errors.push(`No category chosen for slot(s): ${missing.join(", ")}`);
  const ids = slots.map((s) => mapping[s]?.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push("Each slot needs a different category");
  return errors;
}

export function resolveBoard(board: BoardFile, mapping: SlotMapping): BoardDefinition {
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    config: board.config ?? {},
    // Tolerates unknown slots (category null), so a board being edited can still be drawn
    categories: board.slots.flatMap((slot): Category[] => (mapping[slot] ? [mapping[slot]] : [])),
    spaces: board.spaces.map(({ slot, ...s }) => ({ ...s, category: slot ? (mapping[slot]?.id ?? null) : null })),
  };
}

export function resolveDeck(deck: DeckFile): DeckDefinition {
  return {
    name: deck.name,
    cards: deck.cards.map(
      (c): Card => ({
        id: c.id,
        category: c.grand_prize ? GRAND_PRIZE : c.category,
        question: c.question,
        options: c.options,
        correct_answer: c.options ? c.options.indexOf(c.answer) : c.answer,
        difficulty: c.difficulty,
      }),
    ),
  };
}

/** Checks a deck's own consistency (CRD-*). */
export function validateDeck(deck: DeckFile): string[] {
  const errors: string[] = [];
  const categoryIds = new Set(deck.categories.map((c) => c.id));
  for (const c of deck.cards) {
    if (!categoryIds.has(c.category)) errors.push(`card ${c.id}: unknown category '${c.category}'`);
    if (c.options && !c.options.includes(c.answer)) errors.push(`card ${c.id}: answer must be one of its options (CRD-1)`);
    if (![1, 2, 3].includes(c.difficulty)) errors.push(`card ${c.id}: difficulty must be 1, 2 or 3`);
  }
  return errors;
}

/** BRD-5 and CRD-4: the deck must have cards for every slot's category, and grand prize
 *  cards for the finish win. Port: validate_game_setup in backend/app/validation.py. */
export function validateDeckForBoard(board: BoardFile, mapping: SlotMapping, deck: DeckFile): string[] {
  const errors: string[] = [];
  for (const slot of board.slots) {
    const c = mapping[slot];
    if (c && !deck.cards.some((card) => card.category === c.id && !card.grand_prize)) errors.push(`BRD-5: the deck has no cards for ${c.name} (slot ${slot})`);
  }
  if (resolveConfig(board).win_conditions.includes("finish") && !deck.cards.some((card) => card.grand_prize))
    errors.push("The board's 'finish' win needs at least one grand prize card in the deck");
  return errors;
}

/** Board errors as the plain strings a game setup shows. */
export const boardErrorStrings = (board: BoardFile) => boardErrors(validateBoardFile(board)).map((i) => `Board: ${i.message}`);

/** Everything a game needs: board + mapping + deck, ready for createGame(). */
export function resolveGame(board: BoardFile, mapping: SlotMapping, deck: DeckFile) {
  const errors = [...boardErrorStrings(board), ...validateMapping(board, mapping), ...validateDeck(deck)];
  if (!errors.length) errors.push(...validateDeckForBoard(board, mapping, deck));
  if (errors.length) return { errors, board: null, deck: null };
  return { errors, board: resolveBoard(board, mapping), deck: resolveDeck(deck) };
}
