// REST client for the backend. Requests go to /api on the same origin; Vite proxies them
// to FastAPI in dev (see vite.config.ts).

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

export interface UserInput {
  organization_id?: number;
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const TOKEN_KEY = "trivia.token";

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // storage unavailable (private mode): the session lasts until reload
    }
  },
};

let onUnauthorized: () => void = () => {};
/** Called when any request gets a 401, so the app can return to the login screen. */
export function setUnauthorizedHandler(fn: () => void) {
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
    if (res.status === 401 && path !== "/auth/login") onUnauthorized();
    throw new ApiError(res.status, formatError(data) ?? `${res.status} ${res.statusText}`);
  }
  return data as T;
}

/** FastAPI errors are {detail: string} or, for validation, {detail: [{loc, msg}]}. */
function formatError(data: unknown): string | null {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((d: { loc?: unknown[]; msg?: string }) => `${d.loc?.slice(1).join(".") || "request"}: ${d.msg}`).join("; ");
  return null;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; expires_at: string; user: User }>("POST", "/auth/login", { email, password }),
  logout: () => request<void>("POST", "/auth/logout"),
  me: () => request<User>("GET", "/auth/me"),

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
};
