import { useEffect, useState } from "react";
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router";
import { api, type Organization } from "./api";
import { AuthProvider, useAuth } from "./auth";
import { BoardsDemo } from "./BoardsDemo";
import { BoardsPage } from "./components/BoardsPage";
import { CategoriesPage } from "./components/CategoriesPage";
import type { RouteState } from "./components/common";
import { DecksPage } from "./components/DecksPage";
import { GamePlayPage } from "./components/GamePlayPage";
import { GamesPage } from "./components/GamesPage";
import { LoginPage } from "./components/LoginPage";
import { OrganizationsPage } from "./components/OrganizationsPage";

// Every tab has its own URL: /games, /games/:id, /boards/:id, /decks/:id, /categories/:id,
// /organizations/:id, /games/:id/play and /demo. The list URL opens the first item (see useRouteSelection).

type ContentKind = "games" | "boards" | "decks" | "categories";
const CONTENT_KINDS: ContentKind[] = ["games", "boards", "decks", "categories"];

const PAGES: Record<ContentKind, (props: { orgId: number }) => React.ReactNode> = {
  games: GamesPage,
  boards: BoardsPage,
  decks: DecksPage,
  categories: CategoriesPage,
};

/** Which organization an item belongs to, for root users opening a link to it. */
const ORG_OF: Record<ContentKind, (id: number) => Promise<{ organization_id: number }>> = {
  games: api.getGame,
  boards: api.getBoard,
  decks: api.getDeck,
  categories: api.getCategory,
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}

function Shell() {
  const { user, loading, logout, stopImpersonating } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgId, setOrgId] = useState<number | null>(null);
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const kind = path.split("/")[1] as ContentKind;
  // The play page shows one game, so it needs no organization picker
  const showOrgPicker = CONTENT_KINDS.includes(kind) && !path.endsWith("/play");
  const isRoot = user?.role === "root";

  // Content belongs to one organization: members always work on theirs, root users pick one
  useEffect(() => {
    if (!user) return;
    setOrgId(user.organization_id);
    if (user.role === "root") api.listOrganizations().then(setOrgs, () => {});
  }, [user]);

  // Logged out: the login page shows on whatever URL was asked for, and opens it after login
  if (loading) return <div className="app muted">Loading…</div>;
  if (!user) return <LoginPage />;

  const tabs: [string, string][] = [
    ["/games", "Games"],
    ["/boards", "Boards"],
    ["/decks", "Decks"],
    ["/categories", "Categories"],
    ["/organizations", isRoot ? "Organizations" : "My organization"],
    ...(isRoot ? ([["/demo", "Boards demo"]] as [string, string][]) : []),
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
        <h1>
          <Link to="/">Trivia Game Generator</Link>
        </h1>
        <nav className="tabs">
          {tabs.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "on" : "")}>
              {label}
            </NavLink>
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

      {isRoot && showOrgPicker && (
        <div className="toolbar">
          <label className="small">
            Organization:{" "}
            <select
              value={orgId ?? ""}
              onFocus={() => api.listOrganizations().then(setOrgs, () => {})}
              onChange={(e) => {
                const id = Number(e.target.value);
                setOrgId(id);
                navigate(`/${kind}`, { state: { orgId: id } satisfies RouteState }); // the open item belongs to the old one
              }}
            >
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
        <Routes>
          <Route path="/" element={<Navigate to="/games" replace />} />
          {CONTENT_KINDS.flatMap((k) =>
            [`/${k}`, `/${k}/:id`].map((path) => (
              <Route key={path} path={path} element={<ContentRoute key={k} kind={k} orgId={orgId} setOrgId={setOrgId} />} />
            )),
          )}
          <Route path="/games/:id/play" element={<GamePlayPage />} />
          <Route path="/organizations" element={<OrganizationsPage />} />
          <Route path="/organizations/:id" element={<OrganizationsPage />} />
          <Route path="/demo" element={isRoot ? <BoardsDemo /> : <Navigate to="/games" replace />} />
          <Route
            path="*"
            element={
              <section className="panel">
                <h2>Page not found</h2>
                <Link to="/games">← Games</Link>
              </section>
            }
          />
        </Routes>
      )}
    </div>
  );
}

/**
 * A content page for the selected organization. A root user can open a link to an item of
 * any organization, so first look up which one it belongs to and switch the toolbar to it.
 * Links inside the app say it in their navigation state, which skips the lookup.
 */
function ContentRoute({ kind, orgId, setOrgId }: { kind: ContentKind; orgId: number; setOrgId: (id: number) => void }) {
  const { user } = useAuth();
  const { id } = useParams();
  const state = useLocation().state as RouteState | null;
  const [checked, setChecked] = useState<string | null>(null);
  const mustCheck = user!.role === "root" && id !== undefined && state?.orgId !== orgId && checked !== id;

  useEffect(() => {
    if (!mustCheck) return;
    let live = true;
    ORG_OF[kind](Number(id))
      .then((item) => live && setOrgId(item.organization_id))
      .catch(() => {}) // not found: the page says so
      .finally(() => live && setChecked(id!));
    return () => {
      live = false;
    };
  }, [mustCheck, kind, id, setOrgId]);

  if (mustCheck) return <p className="muted">Loading…</p>;
  const Page = PAGES[kind];
  // key: a different organization starts the page afresh (lists, selection)
  return <Page key={orgId} orgId={orgId} />;
}
