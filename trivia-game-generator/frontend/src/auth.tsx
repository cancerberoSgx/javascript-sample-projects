import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore, type User } from "./api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the current user (e.g. after editing your own profile). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    if (!tokenStore.get()) return setLoading(false);
    api
      .me()
      .then(setUser, clear)
      .finally(() => setLoading(false));
  }, [clear]);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    tokenStore.set(res.access_token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.logout(); // revokes the token on the server
    } finally {
      clear();
    }
  };

  const refresh = async () => setUser(await api.me());

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
