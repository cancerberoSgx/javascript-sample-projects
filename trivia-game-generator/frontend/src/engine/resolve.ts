// Converts the file/API formats (board with slots, deck with categories) into the engine
// formats (board with categories, engine cards). See rules.md §2.1 and SER-*.

import { validateBoard } from "./board";
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

/** Slot-level checks that only make sense on the file format. */
export function validateSlots(board: BoardFile): string[] {
  const errors: string[] = [];
  const slots = board.slots ?? [];
  if (!slots.length) errors.push("Board needs at least one slot");
  if (new Set(slots).size !== slots.length) errors.push("Slot names must be unique");
  if (slots.some((s) => !s.trim())) errors.push("Slot names can't be empty");
  for (const s of board.spaces ?? []) {
    const needsSlot = s.type === "category" || s.type === "hq";
    if (needsSlot && (!s.slot || !slots.includes(s.slot))) errors.push(`space ${s.index}: '${s.type}' needs one of the slots ${slots.join(", ")} (got ${s.slot})`);
    if (!needsSlot && s.slot != null) errors.push(`space ${s.index}: '${s.type}' spaces must have slot null`);
  }
  return errors;
}

export function validateMapping(board: BoardFile, mapping: SlotMapping): string[] {
  const errors: string[] = [];
  const missing = board.slots.filter((s) => !mapping[s]);
  if (missing.length) errors.push(`No category chosen for slot(s): ${missing.join(", ")}`);
  const ids = board.slots.map((s) => mapping[s]?.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push("Each slot needs a different category");
  return errors;
}

export function resolveBoard(board: BoardFile, mapping: SlotMapping): BoardDefinition {
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    config: board.config ?? {},
    categories: board.slots.map((slot): Category => mapping[slot]),
    spaces: board.spaces.map(({ slot, ...s }) => ({ ...s, category: slot ? mapping[slot].id : null })),
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

/** Validates a board on its own: slot checks plus the structural BRD-* checks. */
export function validateBoardFile(board: BoardFile): string[] {
  const slotErrors = validateSlots(board);
  if (slotErrors.length) return slotErrors;
  return validateBoard(resolveBoard(board, placeholderMapping(board)), null);
}

/** Everything a game needs: board + mapping + deck, ready for createGame(). */
export function resolveGame(board: BoardFile, mapping: SlotMapping, deck: DeckFile) {
  const errors = [...validateSlots(board), ...validateMapping(board, mapping), ...validateDeck(deck)];
  if (errors.length) return { errors, board: null, deck: null };
  const resolvedBoard = resolveBoard(board, mapping);
  const resolvedDeck = resolveDeck(deck);
  return { errors: validateBoard(resolvedBoard, resolvedDeck), board: resolvedBoard, deck: resolvedDeck };
}
