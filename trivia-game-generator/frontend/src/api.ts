// REST client for the backend. Requests go to /api on the same origin; Vite proxies them
// to FastAPI in dev (see vite.config.ts).

import type { BoardFile, DeckFile, GameConfig, SpaceType } from "./engine/types";

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
}

export type GameStatus = "not_started" | "running" | "finished";

export interface GameSnapshot {
  board: BoardFile;
  deck: DeckFile;
  mapping: Record<string, string>; // slot -> deck category id
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
  players: { id: number; name: string; position: number }[];
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
  players?: { name: string }[];
}

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

let onUnauthorized: (tokenUsed: string | null) => void = () => {};
/** Called when a request gets a 401, with the token that request sent, so the app can tell
 *  a lost session from a stale response that arrived after the session already changed. */
export function setUnauthorizedHandler(fn: (tokenUsed: string | null) => void) {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
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
  createOrganization: (body: { name: string; openai_api_key?: string | null }) => request<Organization>("POST", "/organizations", body),
  /** openai_api_key: omit to keep, null to remove, string to replace. */
  updateOrganization: (id: number, body: { name?: string; openai_api_key?: string | null }) =>
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
};
