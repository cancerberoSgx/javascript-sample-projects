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
}

export interface DeckState {
  draw: string[]; // card ids, top = index 0
  used: string[];
}

/** Phases that wait for input. Automatic phases (rules.md §3) run inside the engine. */
export type Phase = "AWAIT_ROLL" | "AWAIT_MOVE" | "AWAIT_CATEGORY" | "AWAIT_ANSWER" | "GAME_OVER";

export interface PendingQuestion {
  card: Card;
  deadline: number | null; // epoch ms; null = no time limit
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

export interface LogEntry {
  round: number;
  player_id: string | null;
  text: string;
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
  | { type: "FORCE_RESULT"; correct: boolean }; // dev shortcut: skip answering

export interface PlayerSetup {
  name: string;
  color: string;
}
