import { useState } from "react";
import { useAuth } from "../auth";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="login-wrap">
      <form
        className="panel login"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await login(email, password);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>Trivia Game Generator</h1>
        <p className="muted small">Sign in to continue.</p>
        <label className="stack">
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label className="stack">
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
