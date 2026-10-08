// Types mirror rules.md §1–§2. Rule IDs in comments refer to that file.

// ---------- File / API formats (schema_version 2) ----------
// What lives in the JSON files and in the backend. A board has no categories, only
// category *slots*. A game maps each slot to a real category (rules.md §2.1, SER-*).
// resolve.ts turns these into the engine formats below.

export interface BoardFileSpace {
  index: number;
  type: SpaceType;
  slot: string | null; // required for "category" and "hq"
  next: number[];
  pos: { x: number; y: number };
  label?: string;
}

export interface BoardFile {
  schema_version: 2;
  id?: string;
  name: string;
  description?: string;
  config: Partial<GameConfig>; // merged over DEFAULT_CONFIG
  slots: string[];
  spaces: BoardFileSpace[];
  background?: Background; // BKG-*: drawn under the board. Not part of the engine (resolveBoard drops it)
}

export type BackgroundFit = "cover" | "contain" | "stretch" | "tile";

/** A board's (or a game's) background image, rules.md §2.1.2. Fields left out use the defaults
 *  there (see BACKGROUND_DEFAULTS in components/background.ts). Python: formats.Background. */
export interface Background {
  image?: string; // key in the organization's image library ("<sha256>.webp"), served at /media/<key>
  fit?: BackgroundFit;
  crop?: { x: number; y: number; w: number; h: number }; // fractions of the image
  position?: { x: number; y: number }; // 0..1
  zoom?: number; // 0.25..4 (cover, contain)
  tile_size?: number; // 0.02..1 of the board's width (tile)
  opacity?: number; // 0..1
  fade?: number; // 0..0.9
  blur?: number; // 0..20
  grayscale?: boolean;
  color?: string; // "#rrggbb"
}

export interface CategoryDef {
  id: string;
  name: string;
  description?: string;
  color: string;
}

export interface DeckCard {
  id: string;
  category: string; // category id
  question: string;
  options: string[] | null; // null = open-ended
  answer: string; // for multiple choice, one of `options`
  difficulty: 1 | 2 | 3;
  grand_prize?: boolean; // only drawn for the final question (WIN-F1)
}

export interface DeckFile {
  schema_version: 2;
  id?: string;
  name: string;
  description?: string;
  categories: CategoryDef[];
  cards: DeckCard[];
}

/** One problem found by validateBoardFile (rules.md §2.1.1). Errors make a board unplayable;
 *  warnings are only advice. `spaces` and `slot` say what to highlight in the editor. */
export interface BoardIssue {
  code: string; // rule ID, e.g. "BRD-2"
  severity: "error" | "warning";
  message: string;
  spaces: number[];
  slot: string | null;
}

/** Which category plays each board slot. */
export type SlotMapping = Record<string, Category>;

// ---------- Engine formats ----------
// A board whose slots are resolved to categories, and a deck in the engine's card shape.

export type TrackType = "linear" | "loop";
export type WinCondition = "finish" | "collection" | "turn_limit";

export interface GameConfig {
  track_type: TrackType;
  dice_sides: number;
  answer_time_limit_sec: number;
  bonus_roll_on_correct: boolean;
  max_rolls_per_turn: number;
  win_conditions: WinCondition[];
  max_rounds: number | null;
  fuzzy_answer_check: boolean;
  reuse_cards: boolean;
}

export type SpaceType = "start" | "category" | "hq" | "wildcard" | "roll_again" | "penalty" | "finish";

export interface Space {
  index: number;
  type: SpaceType;
  category: string | null; // category id; required for "category" and "hq"
  next: number[]; // more than one entry = fork (FRK-*)
  pos: { x: number; y: number }; // grid coordinates used by the renderer
  label?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

/** A resolved board: each space's category is a real category id. Built by resolveBoard(). */
export interface BoardDefinition {
  id?: string;
  name: string;
  description?: string;
  config: Partial<GameConfig>; // merged over DEFAULT_CONFIG
  categories: Category[];
  spaces: Space[];
}

export interface Card {
  id: string;
  category: string; // category id, or GRAND_PRIZE
  question: string;
  options: string[] | null;
  correct_answer: string | number;
  difficulty: 1 | 2 | 3;
}

/** Engine deck: grand prize cards use the GRAND_PRIZE category. Built by resolveDeck(). */
export interface DeckDefinition {
  name: string;
  cards: Card[];
}

export const GRAND_PRIZE = "grand_prize";

// ---------- Runtime state ----------

export interface Player {
  id: string;
  name: string;
  color: string;
  current_space: number;
  inventory: string[]; // stored as a sorted unique array (PLY-2) so state stays JSON-serializable
  score: number;
  skip_next_turn: boolean;
  /** Removed by the host during a multiplayer game (MPL-9): keeps its log and score, never plays again. */
  removed?: boolean;
}

export interface DeckState {
  draw: string[]; // card ids, top = index 0
  used: string[];
}

/** Phases that wait for input. Automatic phases (rules.md §3) run inside the engine. */
export type Phase = "AWAIT_ROLL" | "AWAIT_MOVE" | "AWAIT_CATEGORY" | "AWAIT_ANSWER" | "GAME_OVER";

export interface PendingQuestion {
  card: Card;
  deadline: number | null; // epoch ms (server time in multiplayer); null = no time limit
  grand_prize: boolean;
  from_hq: boolean; // landing space is an HQ (RES-2)
}

export interface LastAnswer {
  card: Card;
  given: string;
  result: AnswerResult;
}

export type AnswerResult = "correct" | "incorrect" | "timeout";

export type GameResult =
  | { type: "win"; player_id: string; reason: WinCondition }
  | { type: "draw" };

/** Values for a message's {placeholders} (I18N-6). Only JSON scalars, so states stay serializable. */
export type MessageParams = Record<string, string | number>;

/** A translatable message: a key of the i18n catalog and its params (rules.md §2.9). */
export interface Message {
  key: string;
  params: MessageParams;
}

export interface LogEntry {
  round: number;
  player_id: string | null;
  /** English. Shown as is for entries written before log lines had keys (I18N-6). */
  text: string;
  /** Catalog key and params. A `category` param holds a category id, shown as its name. */
  key?: string;
  params?: MessageParams;
}

export interface GameState {
  config: GameConfig;
  board: BoardDefinition;
  cards: Record<string, Card>;
  decks: Record<string, DeckState>;
  players: Player[];
  active_player: number;
  round: number;
  rolls_this_turn: number;
  phase: Phase;
  last_roll: number | null;
  /** Legal landing spaces after a roll, each with one path that reaches it (AWAIT_MOVE). */
  destinations: Record<number, number[]>;
  /** The most recent move, for UI animation. `seq` increases with every move. */
  last_move: { seq: number; player_id: string; path: number[] } | null;
  question: PendingQuestion | null;
  last_answer: LastAnswer | null;
  result: GameResult | null;
  rng: number; // seedable RNG state (DIE-2, INV-5)
  log: LogEntry[];
}

export type Action =
  | { type: "ROLL"; value?: number } // value = rigged roll for testing
  | { type: "MOVE"; to: number }
  | { type: "CHOOSE_CATEGORY"; category: string }
  | { type: "ANSWER"; answer: string | number }
  | { type: "TIMEOUT" }
  | { type: "FORCE_RESULT"; correct: boolean } // dev shortcut: skip answering
  | { type: "SKIP_TURN" } // host: end the active player's turn (MPL-8)
  | { type: "REMOVE_PLAYER"; player_id: string }; // host: take a player out of the game (MPL-9)

export interface PlayerSetup {
  name: string;
  color: string;
  id?: string; // default "p1", "p2"… in turn order. Multiplayer games use the database id.
}

/**
 * What a multiplayer client receives (MPL-6): the state minus everything that would give away
 * answers or the future (all cards, the draw piles, the RNG), and the pending card without
 * its answer. A full GameState is also a GameView, so the play UI takes this type.
 */
export interface GameView extends Omit<GameState, "cards" | "decks" | "rng" | "question"> {
  question: (Omit<PendingQuestion, "card"> & { card: Omit<Card, "correct_answer"> & { correct_answer?: Card["correct_answer"] } }) | null;
}
