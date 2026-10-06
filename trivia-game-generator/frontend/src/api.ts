// REST client for the backend. Requests go to /api on the same origin; Vite proxies them
// to FastAPI in dev (see vite.config.ts).

import type { BoardFile, BoardIssue, DeckFile, GameConfig, GameView, SpaceType } from "./engine/types";

export type Role = "root" | "member";

export interface User {
  id: number;
  organization_id: number;
  organization_name: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: number;
  name: string;
  has_openai_api_key: boolean;
  openai_api_key_masked: string | null;
  has_gemini_api_key: boolean;
  gemini_api_key_masked: string | null;
  user_count: number;
  created_at: string;
  updated_at: string;
}

/** /auth/me: the user requests act as, plus the root user behind it when impersonating. */
export interface Me extends User {
  impersonator: User | null;
}

export interface UserInput {
  organization_id?: number;
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
}

export interface Category {
  id: number;
  organization_id: number;
  name: string;
  description: string;
  color: string;
  card_count: number;
}

export interface Deck {
  id: number;
  organization_id: number;
  name: string;
  description: string;
  card_count: number;
}

export interface Card {
  id: number;
  deck_id: number;
  category_id: number;
  question: string;
  options: string[] | null;
  answer: string;
  difficulty: number;
  grand_prize: boolean;
  position: number;
}

export type CardInput = Omit<Card, "id" | "deck_id" | "position">;

// ---------- card generation (rules.md §2.2.1) ----------

export type Provider = "openai" | "gemini";

export interface ProviderInfo {
  id: Provider;
  name: string; // "OpenAI"
  model: string;
}

/** What to generate (GEN-2). Weights are relative: 20 and 80 mean 20% and 80%. */
export interface GenerationSpec {
  count: number;
  categories: { category_id: number; weight: number }[];
  difficulty: { easy: number; medium: number; hard: number };
  types: { multiple_choice: number; open: number };
  instructions: string;
}

export type GeneratedCard = Pick<Card, "category_id" | "question" | "options" | "answer" | "difficulty">;

export interface GenerationJob {
  id: number;
  deck_id: number;
  creator_name: string | null;
  provider: Provider;
  model: string;
  request: GenerationSpec;
  status: "running" | "done" | "failed" | "accepted";
  /** The cards waiting for review. Nothing is in the deck until they're accepted (GEN-6). */
  cards: GeneratedCard[];
  batches_total: number;
  batches_done: number;
  dropped_duplicates: number;
  dropped_invalid: number;
  messages: string[];
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

/** What a board stores: its file minus name/description (see BoardFile in engine/types.ts). */
export interface BoardDefinition {
  config: Partial<GameConfig>;
  slots: string[];
  spaces: { index: number; type: SpaceType; slot: string | null; next: number[]; pos: { x: number; y: number }; label?: string }[];
}

export interface Board {
  id: number;
  organization_id: number;
  name: string;
  description: string;
  definition: BoardDefinition;
  /** Validation results (rules.md §2.1.1). Any error makes the board a draft that games can't start with. */
  issues: BoardIssue[];
}

export type GameStatus = "awaiting" | "running" | "finished";

export interface GameSnapshot {
  board: BoardFile;
  deck: DeckFile;
  mapping: Record<string, string>; // slot -> deck category id
}

export interface GamePlayer {
  id: number;
  name: string;
  position: number; // turn order
  joined: boolean; // joined with the link from their own device (MPL-4); false = added by the host
  removed: boolean; // removed from the running game by the host (MPL-9)
}

export interface Game {
  id: number;
  organization_id: number;
  name: string;
  status: GameStatus;
  creator_id: number | null;
  creator_name: string | null;
  board_id: number | null;
  board_name: string | null;
  deck_id: number | null;
  deck_name: string | null;
  categories: Record<string, number>; // slot -> category id
  players: GamePlayer[];
  /** Players join with /games/:id?code=<join_code> (MPL-1). */
  join_code: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface GameDetail extends Game {
  snapshot: GameSnapshot | null;
  setup_errors: string[];
}

export interface GameInput {
  name?: string;
  board_id?: number | null;
  deck_id?: number | null;
  categories?: Record<string, number>;
}

// ---------- multiplayer (rules.md §2.7) ----------

/** What a game's WebSocket sends after every change (MPL-5). */
export interface LiveMessage {
  type: "game";
  game: {
    id: number;
    name: string;
    status: GameStatus;
    board_name: string | null;
    players: (GamePlayer & { online: boolean })[];
  };
  /** The engine state without its secrets (MPL-6); null until the game starts. */
  state: GameView | null;
  version: number | null;
  /** Epoch ms on the server, so question timers run on server time. */
  server_now: number;
  you: { player_id: number | null; can_host: boolean };
}

export type LiveServerMessage = LiveMessage | { type: "error"; message: string; fatal?: boolean } | { type: "gone" };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Individual messages, when the server sent a list (e.g. board validation errors). */
    public details: string[] = [],
  ) {
    super(message);
  }
}

function storage(key: string) {
  return {
    get(): string | null {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(token: string | null) {
      try {
        if (token) localStorage.setItem(key, token);
        else localStorage.removeItem(key);
      } catch {
        // storage unavailable (private mode): the session lasts until reload
      }
    },
  };
}

/** The token sent with every request. */
export const tokenStore = storage("trivia.token");
/** While impersonating: the root user's own token, restored on exit. */
export const impersonatorTokenStore = storage("trivia.token.impersonator");
/** This device's player token for a game it joined (MPL-4). */
export const playerTokenStore = (gameId: number) => storage(`trivia.player.${gameId}`);

let onUnauthorized: (tokenUsed: string | null) => void = () => {};
/** Called when a request gets a 401, with the token that request sent, so the app can tell
 *  a lost session from a stale response that arrived after the session already changed. */
export function setUnauthorizedHandler(fn: (tokenUsed: string | null) => void) {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // A 401 from login is a wrong password, and from logout an already-invalid token: neither means "session lost"
    if (res.status === 401 && path !== "/auth/login" && path !== "/auth/logout") onUnauthorized(token);
    const details = errorList(data);
    throw new ApiError(res.status, details.join("; ") || `${res.status} ${res.statusText}`, details);
  }
  return data as T;
}

/** FastAPI errors are {detail: string}, {detail: string[]} (our validation lists) or {detail: [{loc, msg}]}. */
function errorList(data: unknown): string[] {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return [detail];
  if (Array.isArray(detail))
    return detail.map((d: string | { loc?: unknown[]; msg?: string }) =>
      typeof d === "string" ? d : `${d.loc?.slice(1).join(".") || "request"}: ${d.msg}`,
    );
  return [];
}

const withOrg = (path: string, orgId?: number) => (orgId ? `${path}?organization_id=${orgId}` : path);

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; expires_at: string; user: User }>("POST", "/auth/login", { email, password }),
  logout: () => request<void>("POST", "/auth/logout"),
  me: () => request<Me>("GET", "/auth/me"),
  impersonate: (userId: number) =>
    request<{ access_token: string; expires_at: string; user: User }>("POST", `/auth/impersonate/${userId}`),

  listOrganizations: () => request<Organization[]>("GET", "/organizations"),
  createOrganization: (body: { name: string; openai_api_key?: string | null; gemini_api_key?: string | null }) =>
    request<Organization>("POST", "/organizations", body),
  /** Keys: omit to keep, null to remove, string to replace. */
  updateOrganization: (id: number, body: { name?: string; openai_api_key?: string | null; gemini_api_key?: string | null }) =>
    request<Organization>("PATCH", `/organizations/${id}`, body),
  deleteOrganization: (id: number) => request<void>("DELETE", `/organizations/${id}`),

  listUsers: (organizationId?: number) =>
    request<User[]>("GET", `/users${organizationId ? `?organization_id=${organizationId}` : ""}`),
  createUser: (body: UserInput) => request<User>("POST", "/users", body),
  updateUser: (id: number, body: UserInput) => request<User>("PATCH", `/users/${id}`, body),
  deleteUser: (id: number) => request<void>("DELETE", `/users/${id}`),

  // Content. orgId is only needed by root users working on another organization.
  listCategories: (orgId?: number) => request<Category[]>("GET", withOrg("/categories", orgId)),
  getCategory: (id: number) => request<Category>("GET", `/categories/${id}`),
  createCategory: (body: { organization_id?: number; name: string; description: string; color: string }) =>
    request<Category>("POST", "/categories", body),
  updateCategory: (id: number, body: Partial<Pick<Category, "name" | "description" | "color">>) =>
    request<Category>("PATCH", `/categories/${id}`, body),
  deleteCategory: (id: number) => request<void>("DELETE", `/categories/${id}`),

  listDecks: (orgId?: number) => request<Deck[]>("GET", withOrg("/decks", orgId)),
  getDeck: (id: number) => request<Deck & { cards: Card[] }>("GET", `/decks/${id}`),
  createDeck: (body: { organization_id?: number; name: string; description: string }) => request<Deck>("POST", "/decks", body),
  updateDeck: (id: number, body: { name?: string; description?: string }) => request<Deck>("PATCH", `/decks/${id}`, body),
  deleteDeck: (id: number) => request<void>("DELETE", `/decks/${id}`),
  createCard: (deckId: number, body: CardInput) => request<Card>("POST", `/decks/${deckId}/cards`, body),
  updateCard: (deckId: number, cardId: number, body: Partial<CardInput>) => request<Card>("PATCH", `/decks/${deckId}/cards/${cardId}`, body),
  deleteCard: (deckId: number, cardId: number) => request<void>("DELETE", `/decks/${deckId}/cards/${cardId}`),

  // Card generation (rules.md §2.2.1). A deck has at most one generation running or under review.
  generationProviders: (deckId: number) => request<ProviderInfo[]>("GET", `/decks/${deckId}/generation/providers`),
  getGeneration: (deckId: number) => request<GenerationJob | null>("GET", `/decks/${deckId}/generation`),
  startGeneration: (deckId: number, body: GenerationSpec & { provider: Provider | null }) =>
    request<GenerationJob>("POST", `/decks/${deckId}/generation`, body),
  discardGeneration: (deckId: number) => request<void>("DELETE", `/decks/${deckId}/generation`),
  acceptGeneration: (deckId: number, body: { job_id: number; cards: CardInput[] }) =>
    request<{ added: number; skipped_duplicates: string[] }>("POST", `/decks/${deckId}/generation/accept`, body),

  listBoards: (orgId?: number) => request<Board[]>("GET", withOrg("/boards", orgId)),
  getBoard: (id: number) => request<Board>("GET", `/boards/${id}`),
  createBoard: (body: { organization_id?: number; name: string; description: string; definition: BoardDefinition }) =>
    request<Board>("POST", "/boards", body),
  updateBoard: (id: number, body: { name?: string; description?: string; definition?: BoardDefinition }) =>
    request<Board>("PATCH", `/boards/${id}`, body),
  deleteBoard: (id: number) => request<void>("DELETE", `/boards/${id}`),

  listGames: (orgId?: number) => request<Game[]>("GET", withOrg("/games", orgId)),
  getGame: (id: number) => request<GameDetail>("GET", `/games/${id}`),
  createGame: (body: GameInput & { organization_id?: number; name: string }) => request<GameDetail>("POST", "/games", body),
  updateGame: (id: number, body: GameInput) => request<GameDetail>("PATCH", `/games/${id}`, body),
  deleteGame: (id: number) => request<void>("DELETE", `/games/${id}`),
  startGame: (id: number) => request<GameDetail>("POST", `/games/${id}/start`),
  finishGame: (id: number) => request<GameDetail>("POST", `/games/${id}/finish`),


  // Multiplayer (rules.md §2.7). Joining and leaving need no login: the code and the player token are the proof.
  joinGame: (id: number, body: { code: string; name: string }) =>
    request<{ player: GamePlayer; player_token: string }>("POST", `/games/${id}/join`, body),
  leaveGame: (id: number, playerToken: string) => request<void>("POST", `/games/${id}/leave`, undefined, { "X-Player-Token": playerToken }),
  addPlayer: (id: number, name: string) => request<GameDetail>("POST", `/games/${id}/players`, { name }),
  orderPlayers: (id: number, playerIds: number[]) => request<GameDetail>("PUT", `/games/${id}/players/order`, { player_ids: playerIds }),
  removePlayer: (id: number, playerId: number) => request<GameDetail>("DELETE", `/games/${id}/players/${playerId}`),
  skipTurn: (id: number) => request<void>("POST", `/games/${id}/skip-turn`),
  newJoinCode: (id: number) => request<GameDetail>("POST", `/games/${id}/join-code`),
};

/** The link players open on their own devices (MPL-1). */
export const joinLink = (game: Pick<Game, "id" | "join_code">) => `${location.origin}/games/${game.id}?code=${game.join_code}`;
