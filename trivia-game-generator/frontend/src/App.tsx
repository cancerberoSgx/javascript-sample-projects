import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./auth";
import { BoardsDemo } from "./BoardsDemo";
import { LoginPage } from "./components/LoginPage";
import { OrganizationsPage } from "./components/OrganizationsPage";

type Tab = "organizations" | "boards";

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("organizations");
  const isRoot = user?.role === "root";

  // Members can't open the boards demo
  useEffect(() => {
    if (!isRoot && tab === "boards") setTab("organizations");
  }, [isRoot, tab]);

  if (loading) return <div className="app muted">Loading…</div>;
  if (!user) return <LoginPage />;

  return (
    <div className="app">
      <header>
        <h1>Trivia Game Generator</h1>
        <nav className="tabs">
          <button className={tab === "organizations" ? "on" : ""} onClick={() => setTab("organizations")}>
            {isRoot ? "Organizations" : "My organization"}
          </button>
          {isRoot && (
            <button className={tab === "boards" ? "on" : ""} onClick={() => setTab("boards")}>
              Boards demo
            </button>
          )}
        </nav>
        <div className="whoami">
          <span>
            {user.name} <span className={`chip role-${user.role}`}>{user.role}</span>
          </span>
          <span className="muted small">{user.organization_name}</span>
          <button className="small" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      {tab === "organizations" ? <OrganizationsPage /> : <BoardsDemo />}
    </div>
  );
}
