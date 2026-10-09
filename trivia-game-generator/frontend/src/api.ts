// REST client for the backend. Requests go to /api on the same origin; Vite proxies them
// to FastAPI in dev (see vite.config.ts).

import type { Background, BoardFile, BoardIssue, DeckFile, GameConfig, GameView, SpaceType } from "./engine/types";

export type Role = "root" | "member";

export interface User {
  id: number;
  organization_id: number;
  organization_name: string;
  name: string;
  email: string;
  role: Role;
  /** Preferred UI language; null = automatic (I18N-3). */
  language: string | null;
  /** The organization's language, the default of its games. */
  organization_language: string;
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
  /** null = the app's default (default_*_model). */
  openai_model: string | null;
  gemini_model: string | null;
  default_openai_model: string;
  default_gemini_model: string;
  /** The UI language of its games, unless a game picks another (I18N-3). */
  language: string;
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
  language?: string | null;
}

// ---------- sharing (rules.md §2.8, SHR-*) ----------

export type Visibility = "private" | "public";

/** Where a copy came from, as it was then (SHR-3). The original may have changed or be gone. */
export interface CopiedFrom {
  id: number;
  name: string;
  organization_name: string;
}

/** Fields every shareable item has: boards, decks, categories and images. */
export interface Sharing {
  /** public: listed in the Library for every organization, which can copy it (SHR-1). */
  visibility: Visibility;
  published_at: string | null;
  copied_from: CopiedFrom | null;
}

export type ShareableKind = "boards" | "decks" | "categories" | "images";

export interface Category extends Sharing {
  id: number;
  organization_id: number;
  name: string;
  description: string;
  color: string;
  card_count: number;
}

export interface Deck extends Sharing {
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
  /** The saved deck generation it was started from (GEN-9). */
  deck_generation_id: number | null;
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

/** A saved, reusable generation request (rules.md §2.2.2, GEN-8). Its categories are the
 *  organization's, so any deck of the organization can load it. */
export interface DeckGeneration {
  id: number;
  deck_id: number;
  deck_name: string;
  name: string;
  description: string;
  provider: Provider | null; // preferred; null = none
  /** May list no categories after one was deleted (GEN-10). */
  spec: GenerationSpec;
  creator_name: string | null;
  use_count: number; // generations started from it (GEN-9)
  last_used_at: string | null;
  cards_accepted: number;
  created_at: string;
  updated_at: string;
}

export type DeckGenerationInput = Pick<DeckGeneration, "name" | "description" | "provider" | "spec">;

/** What a board stores: its file minus name/description (see BoardFile in engine/types.ts). */
export interface BoardDefinition {
  config: Partial<GameConfig>;
  slots: string[];
  spaces: { index: number; type: SpaceType; slot: string | null; next: number[]; pos: { x: number; y: number }; label?: string }[];
  background?: Background;
}

/** An image in an organization's library (rules.md §2.1.2). `key` is what a Background's `image` holds. */
export interface LibraryImage extends Sharing {
  id: number;
  organization_id: number;
  key: string;
  /** /media/<key>: a public file that never changes (BKG-8). */
  url: string;
  name: string;
  source_url: string | null;
  content_type: string;
  width: number;
  height: number;
  bytes: number;
  creator_name: string | null;
  board_count: number;
  game_count: number;
  created_at: string;
}

export interface Board extends Sharing {
  id: number;
  organization_id: number;
  name: string;
  description: string;
  definition: BoardDefinition;
  /** Validation results (rules.md §2.1.1). Any error makes the board a draft that games can't start with. */
  issues: BoardIssue[];
}

// ---------- the public Library (rules.md §2.8) ----------

/** A public item, with the organization that published it (SHR-2). */
export type Published<T> = T & { organization_name: string };

export type PublicImage = Published<Sharing & Pick<LibraryImage, "id" | "organization_id" | "key" | "url" | "name" | "width" | "height" | "bytes">>;

export interface PublicDeckDetail extends Published<Deck> {
  /** The categories its cards and saved generations use. */
  categories: Pick<Category, "id" | "name" | "description" | "color">[];
  cards: Card[];
  /** Its saved generations (GEN-8), copied with the deck. */
  generations: Pick<DeckGeneration, "name" | "description" | "spec">[];
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
  /** The game's own background; null = the board's (BKG-5). One without `image` means "no image". */
  background: Background | null;
  /** Players join with /games/:id?code=<join_code> (MPL-1). */
  join_code: string;
  /** The UI language players get by default; null = the organization's (I18N-3). */
  language: string | null;
  organization_language: string;
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
  background?: Background | null;
  language?: string | null;
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
    /** What the started game draws (frozen in its snapshot, BKG-6). */
    background: Background | null;
    /** The language players see by default: the game's, else its organization's (I18N-3). */
    language: string;
    players: (GamePlayer & { online: boolean })[];
  };
  /** The engine state without its secrets (MPL-6); null until the game starts. */
  state: GameView | null;
  version: number | null;
  /** Epoch ms on the server, so question timers run on server time. */
  server_now: number;
  you: { player_id: number | null; can_host: boolean };
}

/** An error the server sent over the socket. code + params: its translation (I18N-7). */
export interface LiveError {
  type: "error";
  message: string;
  code?: string;
  params?: Record<string, string | number>;
  fatal?: boolean;
}

export type LiveServerMessage = LiveMessage | LiveError | { type: "gone" };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Individual messages, when the server sent a list (e.g. board validation errors). */
    public details: string[] = [],
    /** Catalog key of errors players can see, so the UI can translate them (I18N-7). */
    public code?: string,
    public params: Record<string, string | number> = {},
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
  const form = body instanceof FormData;
  if (body !== undefined && !form) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : form ? body : JSON.stringify(body) });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // A 401 from login is a wrong password, and from logout an already-invalid token: neither means "session lost"
    if (res.status === 401 && path !== "/auth/login" && path !== "/auth/logout") onUnauthorized(token);
    const details = errorList(data);
    const coded = data as { code?: string; params?: Record<string, string | number> } | null;
    throw new ApiError(res.status, details.join("; ") || `${res.status} ${res.statusText}`, details, coded?.code, coded?.params);
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

/** What an organization file added (SER-11). Decks and boards whose name was taken are skipped. */
export interface OrganizationImport {
  decks_created: string[];
  decks_skipped: string[];
  boards_created: string[];
  boards_skipped: string[];
  cards_created: number;
  categories_created: string[];
  categories_matched: string[];
  background_images_missing: string[];
}

/** Where a copy goes (default: your organization) and its name (default: the original's, "(copy)" if taken). */
export interface CopyInput {
  organization_id?: number;
  name?: string;
}

const query = (q: string) => (q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "");

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
  /** Keys: omit to keep, null to remove, string to replace. Models: null = back to the default. Members may only send models. */
  updateOrganization: (
    id: number,
    body: {
      name?: string;
      openai_api_key?: string | null;
      gemini_api_key?: string | null;
      openai_model?: string | null;
      gemini_model?: string | null;
      language?: string;
    },
  ) =>
    request<Organization>("PATCH", `/organizations/${id}`, body),
  deleteOrganization: (id: number) => request<void>("DELETE", `/organizations/${id}`),
  // Organization files (rules.md SER-10, SER-11): every category, deck and board in one file
  exportOrganization: (id: number) => request<object>("GET", `/organizations/${id}/export`),
  importOrganization: (id: number, file: unknown) => request<OrganizationImport>("POST", `/organizations/${id}/import`, file),

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
  // Deck files (rules.md SER-7 … SER-9). An import is a new deck; its categories are matched by name or created.
  exportDeck: (id: number) => request<DeckFile>("GET", `/decks/${id}/export`),
  importDeck: (file: unknown, orgId?: number) =>
    request<{ deck: Deck; categories_created: string[]; categories_matched: string[] }>("POST", withOrg("/decks/import", orgId), file),

  // Card generation (rules.md §2.2.1). A deck has at most one generation running or under review.
  generationProviders: (deckId: number) => request<ProviderInfo[]>("GET", `/decks/${deckId}/generation/providers`),
  getGeneration: (deckId: number) => request<GenerationJob | null>("GET", `/decks/${deckId}/generation`),
  startGeneration: (deckId: number, body: GenerationSpec & { provider: Provider | null; deck_generation_id: number | null }) =>
    request<GenerationJob>("POST", `/decks/${deckId}/generation`, body),
  discardGeneration: (deckId: number) => request<void>("DELETE", `/decks/${deckId}/generation`),
  acceptGeneration: (deckId: number, body: { job_id: number; cards: CardInput[] }) =>
    request<{ added: number; skipped_duplicates: string[] }>("POST", `/decks/${deckId}/generation/accept`, body),
  // Saved deck generations (rules.md §2.2.2). The organization's list feeds the form's Load picker.
  listOrgDeckGenerations: (orgId?: number) => request<DeckGeneration[]>("GET", withOrg("/deck-generations", orgId)),
  listDeckGenerations: (deckId: number) => request<DeckGeneration[]>("GET", `/decks/${deckId}/generations`),
  createDeckGeneration: (deckId: number, body: DeckGenerationInput) => request<DeckGeneration>("POST", `/decks/${deckId}/generations`, body),
  updateDeckGeneration: (deckId: number, id: number, body: Partial<DeckGenerationInput>) =>
    request<DeckGeneration>("PATCH", `/decks/${deckId}/generations/${id}`, body),
  deleteDeckGeneration: (deckId: number, id: number) => request<void>("DELETE", `/decks/${deckId}/generations/${id}`),

  listBoards: (orgId?: number) => request<Board[]>("GET", withOrg("/boards", orgId)),
  getBoard: (id: number) => request<Board>("GET", `/boards/${id}`),
  createBoard: (body: { organization_id?: number; name: string; description: string; definition: BoardDefinition }) =>
    request<Board>("POST", "/boards", body),
  updateBoard: (id: number, body: { name?: string; description?: string; definition?: BoardDefinition }) =>
    request<Board>("PATCH", `/boards/${id}`, body),
  deleteBoard: (id: number) => request<void>("DELETE", `/boards/${id}`),
  // Board files (SER-7 … SER-9). The background travels as settings; its image only if your library has it.
  exportBoard: (id: number) => request<BoardFile>("GET", `/boards/${id}/export`),
  importBoard: (file: unknown, orgId?: number) =>
    request<{ board: Board; background_image_missing: boolean }>("POST", withOrg("/boards/import", orgId), file),

  // Image library (rules.md §2.1.2). The files are served at /media/<key>, not under /api.
  listImages: (orgId?: number) => request<LibraryImage[]>("GET", withOrg("/images", orgId)),
  uploadImage: (file: File, orgId?: number) => {
    const form = new FormData();
    form.append("file", file);
    if (orgId) form.append("organization_id", String(orgId));
    return request<LibraryImage>("POST", "/images", form);
  },
  importImage: (url: string, orgId?: number) => request<LibraryImage>("POST", "/images/import", { url, organization_id: orgId }),
  renameImage: (id: number, name: string) => request<LibraryImage>("PATCH", `/images/${id}`, { name }),
  deleteImage: (id: number) => request<void>("DELETE", `/images/${id}`),

  // Sharing (rules.md §2.8): publish or unpublish one of your items
  setVisibility: <T extends Sharing>(kind: ShareableKind, id: number, visibility: Visibility) =>
    request<T>("PUT", `/${kind}/${id}/visibility`, { visibility }),

  // The Library: every organization's public items. Copies go into orgId (root) or your own organization.
  libraryBoards: (q = "") => request<Published<Board>[]>("GET", `/library/boards${query(q)}`),
  libraryBoard: (id: number) => request<Published<Board>>("GET", `/library/boards/${id}`),
  libraryDecks: (q = "") => request<Published<Deck>[]>("GET", `/library/decks${query(q)}`),
  libraryDeck: (id: number) => request<PublicDeckDetail>("GET", `/library/decks/${id}`),
  libraryCategories: (q = "") => request<Published<Category>[]>("GET", `/library/categories${query(q)}`),
  libraryImages: (q = "") => request<PublicImage[]>("GET", `/library/images${query(q)}`),
  copyBoard: (id: number, body: CopyInput) => request<Board>("POST", `/library/boards/${id}/copy`, body),
  copyDeck: (id: number, body: CopyInput) =>
    request<{ deck: Deck; categories_created: string[]; categories_matched: string[]; generations_copied: number }>("POST", `/library/decks/${id}/copy`, body),
  copyCards: (deckId: number, body: { deck_id: number; card_ids: number[] }) =>
    request<{ added: number; skipped_duplicates: string[]; categories_created: string[] }>("POST", `/library/decks/${deckId}/cards/copy`, body),
  copyCategory: (id: number, body: CopyInput) => request<Category>("POST", `/library/categories/${id}/copy`, body),
  copyImage: (id: number, body: CopyInput) => request<LibraryImage>("POST", `/library/images/${id}/copy`, body),

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

  // UI translations (rules.md §2.9). Public: the enabled languages and one language's messages.
  languages: () => request<Language[]>("GET", "/i18n/languages"),
  messages: (code: string) => request<{ language: string; version: string; messages: Record<string, string> }>("GET", `/i18n/messages/${code}`),
  // Root only: keys with their context, languages, translations, AI and files
  translationKeys: () => request<TranslationKey[]>("GET", "/translations/keys"),
  translationLanguages: () => request<LanguageStats[]>("GET", "/translations/languages"),
  createLanguage: (body: { code: string; name: string; native_name: string }) => request<LanguageStats>("POST", "/translations/languages", body),
  updateLanguage: (code: string, body: { name?: string; native_name?: string; enabled?: boolean }) =>
    request<LanguageStats>("PATCH", `/translations/languages/${code}`, body),
  deleteLanguage: (code: string) => request<void>("DELETE", `/translations/languages/${code}`),
  translations: (code: string) => request<Translation[]>("GET", `/translations/${code}`),
  saveTranslation: (code: string, key: string, body: { message: string; status?: TranslationStatus }) =>
    request<Translation>("PUT", `/translations/${code}/${key}`, body),
  deleteTranslation: (code: string, key: string) => request<void>("DELETE", `/translations/${code}/${key}`),
  translateWithAi: (code: string, body: { organization_id: number; provider: Provider | null; keys: string[] }) =>
    request<{ translated: Translation[]; failed: { key: string; reason: string }[] }>("POST", `/translations/${code}/ai`, body),
  exportTranslations: (code: string) => request<object>("GET", `/translations/${code}/export`),
  importTranslations: (code: string, file: unknown) => request<{ imported: number; unchanged: number }>("POST", `/translations/${code}/import`, file),
};

// ---------- translations (rules.md §2.9, I18N-*) ----------

export interface Language {
  code: string; // "es", "pt-BR"
  name: string; // in English
  native_name: string; // "Español"
}

export interface LanguageStats extends Language {
  enabled: boolean;
  translated: number;
  missing: number;
  outdated: number;
  machine: number;
}

export interface TranslationKey {
  key: string;
  area: string;
  source: string; // the English message (ICU MessageFormat)
  description: string;
  placeholders: Record<string, string>;
  max_length: number | null;
  obsolete: boolean;
  updated_at: string;
}

export type TranslationStatus = "machine" | "reviewed";

export interface Translation {
  key: string;
  message: string;
  status: TranslationStatus;
  /** Written for an older English text (I18N-5). */
  outdated: boolean;
  /** Placeholders or tags of the English text the translation leaves out. */
  warnings: string[];
  updated_by_name: string | null;
  updated_at: string;
}

/** The link players open on their own devices (MPL-1). */
export const joinLink = (game: Pick<Game, "id" | "join_code">) => `${location.origin}/games/${game.id}?code=${game.join_code}`;
