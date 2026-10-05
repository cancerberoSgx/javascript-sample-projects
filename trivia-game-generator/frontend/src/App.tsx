import { useEffect, useState } from "react";
import { api, type Organization } from "./api";
import { AuthProvider, useAuth } from "./auth";
import { BoardsDemo } from "./BoardsDemo";
import { BoardsPage } from "./components/BoardsPage";
import { CategoriesPage } from "./components/CategoriesPage";
import { DecksPage } from "./components/DecksPage";
import { GamesPage } from "./components/GamesPage";
import { LoginPage } from "./components/LoginPage";
import { OrganizationsPage } from "./components/OrganizationsPage";

type Tab = "games" | "boards" | "decks" | "categories" | "organizations" | "demo";
const CONTENT_TABS: Tab[] = ["games", "boards", "decks", "categories"];

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const { user, loading, logout, stopImpersonating } = useAuth();
  const [tab, setTab] = useState<Tab>("games");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgId, setOrgId] = useState<number | null>(null);
  const isRoot = user?.role === "root";

  // Content belongs to one organization: members always work on theirs, root users pick one
  useEffect(() => {
    if (!user) return;
    setOrgId(user.organization_id);
    if (user.role === "root") api.listOrganizations().then(setOrgs, () => {});
  }, [user]);

  useEffect(() => {
    if (!isRoot && tab === "demo") setTab("games");
  }, [isRoot, tab]);

  if (loading) return <div className="app muted">Loading…</div>;
  if (!user) return <LoginPage />;

  const tabs: [Tab, string][] = [
    ["games", "Games"],
    ["boards", "Boards"],
    ["decks", "Decks"],
    ["categories", "Categories"],
    ["organizations", isRoot ? "Organizations" : "My organization"],
    ...(isRoot ? ([["demo", "Boards demo"]] as [Tab, string][]) : []),
  ];

  return (
    // key: switching user (impersonate / exit) remounts everything, so no state leaks between them
    <div className="app" key={user.id}>
      {user.impersonator && (
        <div className="impersonation-banner" role="status">
          <span>
            👁 You're seeing the app as <strong>{user.name}</strong> ({user.email}, member of {user.organization_name}). Signed in as{" "}
            {user.impersonator.name}.
          </span>
          <button className="small" onClick={stopImpersonating}>
            Exit impersonation
          </button>
        </div>
      )}
      <header>
        <h1>Trivia Game Generator</h1>
        <nav className="tabs">
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
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

      {isRoot && CONTENT_TABS.includes(tab) && (
        <div className="toolbar">
          <label className="small">
            Organization:{" "}
            <select value={orgId ?? ""} onFocus={() => api.listOrganizations().then(setOrgs, () => {})} onChange={(e) => setOrgId(Number(e.target.value))}>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {orgId !== null && (
        <>
          {tab === "games" && <GamesPage orgId={orgId} />}
          {tab === "boards" && <BoardsPage orgId={orgId} />}
          {tab === "decks" && <DecksPage orgId={orgId} />}
          {tab === "categories" && <CategoriesPage orgId={orgId} />}
        </>
      )}
      {tab === "organizations" && <OrganizationsPage />}
      {tab === "demo" && <BoardsDemo />}
    </div>
  );
}
