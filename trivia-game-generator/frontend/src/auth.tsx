import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { api, impersonatorTokenStore, setUnauthorizedHandler, tokenStore, type Me } from "./api";

interface AuthState {
  /** The user the app acts as (the member, while impersonating). */
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the current user (e.g. after editing your own profile). */
  refresh: () => Promise<void>;
  /** Root only: act as a member user. */
  impersonate: (userId: number) => Promise<void>;
  /** Back to the root user's own session. */
  stopImpersonating: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const clear = useCallback(() => {
    tokenStore.set(null);
    impersonatorTokenStore.set(null);
    setUser(null);
  }, []);

  /** Restores the stashed root token. Returns false if there is none or it no longer works. */
  const restoreImpersonator = useCallback(async () => {
    const rootToken = impersonatorTokenStore.get();
    impersonatorTokenStore.set(null);
    if (!rootToken) return false;
    tokenStore.set(rootToken); // set before awaiting, so late 401s for the old token are ignored
    try {
      setUser(await api.me());
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    // A 401 while impersonating (e.g. the short-lived token expired) returns to the root
    // session; otherwise back to the login screen.
    setUnauthorizedHandler((tokenUsed) => {
      // Several requests can fail together: only react once, for the token still in use
      if (tokenUsed !== tokenStore.get()) return;
      if (impersonatorTokenStore.get()) restoreImpersonator().then((ok) => ok || clear());
      else clear();
    });
    if (!tokenStore.get()) return setLoading(false);
    api
      .me()
      .then(setUser, clear)
      .finally(() => setLoading(false));
  }, [clear, restoreImpersonator]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    impersonatorTokenStore.set(null);
    tokenStore.set(res.access_token);
    setUser(await api.me());
  };

  const logout = async () => {
    const rootToken = impersonatorTokenStore.get();
    await api.logout().catch(() => {}); // revokes the current token on the server
    if (rootToken) {
      tokenStore.set(rootToken); // logging out while impersonating ends the root session too
      await api.logout().catch(() => {});
    }
    clear();
    navigate("/"); // the next user starts on the home page, not on this one's last item
  };

  const impersonate = async (userId: number) => {
    const res = await api.impersonate(userId);
    impersonatorTokenStore.set(tokenStore.get());
    tokenStore.set(res.access_token);
    setUser(await api.me());
    navigate("/games"); // the current URL is root's view, maybe of another organization
  };

  const stopImpersonating = async () => {
    try {
      await api.logout(); // revokes the impersonation token
    } catch {
      // already expired or revoked: nothing to undo
    }
    const memberOrg = user?.organization_id;
    if (!(await restoreImpersonator())) return clear();
    navigate(memberOrg ? `/organizations/${memberOrg}` : "/"); // back where impersonation usually starts
  };

  const refresh = async () => setUser(await api.me());

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh, impersonate, stopImpersonating }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
