import { Fragment, useCallback, useEffect, useState } from "react";
import { api, type Organization, type OrganizationImport, type Role, type User, type UserInput } from "../api";
import { useAuth } from "../auth";
import { ErrorBox, NotFound, useAction, useRouteSelection } from "./common";
import { downloadJson, fileName, ImportButton, readJsonFile } from "./files";

// The backend enforces every rule; the UI only hides actions that would be rejected.
// Root: all organizations and users. Member: own organization (read-only), create users
// there and edit member users (rules in backend/app/permissions.py).

export function OrganizationsPage() {
  const { user: me } = useAuth();
  const isRoot = me!.role === "root";
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Members only see their own organization, so /organizations opens it
  const { selectedId, selected, select, missing } = useRouteSelection("/organizations", { items: orgs, loaded, error });

  const reload = useCallback(async () => {
    try {
      setOrgs(await api.listOrganizations());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className={isRoot ? "orgs-page" : "orgs-page single"}>
      {isRoot && (
        <section className="panel org-list">
          <div className="row between">
            <h2>Organizations</h2>
            <button className="small" onClick={() => setCreating(true)}>
              + New
            </button>
          </div>
          {creating && (
            <NewOrganizationForm
              onDone={async (created) => {
                setCreating(false);
                await reload();
                if (created) select(created.id);
              }}
            />
          )}
          <ul>
            {orgs.map((o) => (
              <li key={o.id}>
                <button className={o.id === selectedId ? "on" : ""} onClick={() => select(o.id)}>
                  <span>{o.name}</span>
                  <span className="muted small">
                    {o.user_count} user{o.user_count === 1 ? "" : "s"}
                    {(o.has_openai_api_key || o.has_gemini_api_key) && " · 🔑"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="org-detail">
        {error && <div className="error">{error}</div>}
        {missing && <NotFound what="Organization" back="/organizations" />}
        {selected && (
          <>
            <OrganizationPanel
              key={selected.id}
              org={selected}
              canEdit={isRoot}
              onChanged={reload}
              onDeleted={async () => (await reload(), select(null, true))}
            />
            <BackupPanel key={`backup-${selected.id}`} org={selected} />
            <UsersPanel org={selected} orgs={orgs} onChanged={reload} />
          </>
        )}
      </div>
    </div>
  );
}

/** Rules.md SER-10, SER-11: the organization's categories, decks (with cards) and boards as one file, and back. */
function BackupPanel({ org }: { org: Organization }) {
  const action = useAction();
  const [result, setResult] = useState<string[] | null>(null);
  return (
    <section className="panel">
      <h2>Backup</h2>
      <p className="muted small">
        One <code>.json</code> file with every category, deck (with its cards) and board of {org.name}. Import it into any organization, for
        example a new empty one after a database reset. Decks and boards whose name the organization already has are skipped, so importing
        twice adds nothing. Not included: games, users, API keys and background image files (boards keep their background settings).
      </p>
      <div className="row">
        <button
          className="small"
          disabled={action.busy}
          onClick={() => (setResult(null), action.run(async () => downloadJson(fileName(org.name, "organization"), await api.exportOrganization(org.id))))}
        >
          ⬇ Export everything
        </button>
        <ImportButton
          label={`⬆ Import into ${org.name}`}
          disabled={action.busy}
          onFile={(file) =>
            confirm(`Add the decks, boards and categories of ${file.name} to ${org.name}?`) &&
            (setResult(null), action.run(async () => setResult(importSummary(await api.importOrganization(org.id, await readJsonFile(file))))))
          }
        />
      </div>
      <ErrorBox error={action.error} />
      {result && (
        <div className="ok small">
          {result.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
    </section>
  );
}

function importSummary(r: OrganizationImport): string[] {
  const list = (names: string[]) => names.join(", ");
  return [
    `Added ${r.decks_created.length} deck(s) with ${r.cards_created} cards and ${r.boards_created.length} board(s).`,
    r.decks_created.length ? `Decks: ${list(r.decks_created)}.` : "",
    r.boards_created.length ? `Boards: ${list(r.boards_created)}.` : "",
    r.categories_created.length ? `New categories: ${list(r.categories_created)}.` : "",
    r.categories_matched.length ? `Used existing categories: ${list(r.categories_matched)}.` : "",
    r.decks_skipped.length ? `Skipped decks (name already taken): ${list(r.decks_skipped)}.` : "",
    r.boards_skipped.length ? `Skipped boards (name already taken): ${list(r.boards_skipped)}.` : "",
    r.background_images_missing.length
      ? `Background images to pick again (not in this organization's image library): ${list(r.background_images_missing)}.`
      : "",
  ].filter(Boolean);
}

function NewOrganizationForm({ onDone }: { onDone: (created: Organization | null) => void }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          onDone(await api.createOrganization({ name, openai_api_key: key || null, gemini_api_key: geminiKey || null }));
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <input placeholder="Organization name" required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input placeholder="OpenAI API key (optional)" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
      <input placeholder="Gemini API key (optional)" type="password" autoComplete="off" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} />
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="primary small">Create</button>
        <button type="button" className="small" onClick={() => onDone(null)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function OrganizationPanel({
  org,
  canEdit,
  onChanged,
  onDeleted,
}: {
  org: Organization;
  canEdit: boolean;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [name, setName] = useState(org.name);
  const [newKey, setNewKey] = useState("");
  const [newGeminiKey, setNewGeminiKey] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string, after = onChanged) => {
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      setNewKey("");
      setNewGeminiKey("");
      await after();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <section className="panel">
      <h2>Organization</h2>
      {canEdit ? (
        <form
          className="grid-form"
          onSubmit={(e) => {
            e.preventDefault();
            const keys = { ...(newKey ? { openai_api_key: newKey } : {}), ...(newGeminiKey ? { gemini_api_key: newGeminiKey } : {}) };
            run(() => api.updateOrganization(org.id, { name, ...keys }), "Saved.");
          }}
        >
          <label>Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
          <KeyField
            label="OpenAI API key"
            masked={org.openai_api_key_masked}
            placeholder="sk-…  (stored encrypted, never shown again)"
            value={newKey}
            onChange={setNewKey}
            onRemove={() => run(() => api.updateOrganization(org.id, { openai_api_key: null }), "OpenAI key removed.")}
          />
          <KeyField
            label="Gemini API key"
            masked={org.gemini_api_key_masked}
            placeholder="AIza…  (stored encrypted, never shown again)"
            value={newGeminiKey}
            onChange={setNewGeminiKey}
            onRemove={() => run(() => api.updateOrganization(org.id, { gemini_api_key: null }), "Gemini key removed.")}
          />
          <span className="span muted small">The keys are used to generate deck cards. With both set, users pick one each time.</span>
          <span />
          <div className="row between">
            <button className="primary">Save</button>
            <button
              type="button"
              className="danger"
              disabled={org.user_count > 0}
              title={org.user_count > 0 ? "Delete or move its users first" : ""}
              onClick={() => confirm(`Delete organization "${org.name}"?`) && run(() => api.deleteOrganization(org.id), "Deleted.", onDeleted)}
            >
              Delete organization
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid-form">
          <dt>Name</dt>
          <dd>{org.name}</dd>
          <dt>OpenAI API key</dt>
          <dd>
            <code className="key">{org.openai_api_key_masked ?? "not set"}</code>
          </dd>
          <dt>Gemini API key</dt>
          <dd>
            <code className="key">{org.gemini_api_key_masked ?? "not set"}</code>
          </dd>
        </dl>
      )}
      {msg && <div className={msg.ok ? "ok" : "error"}>{msg.text}</div>}
      <ModelsForm org={org} onChanged={onChanged} />
    </section>
  );
}

// Suggestions only: any model the provider accepts can be typed (it's checked on save)
const MODEL_SUGGESTIONS = {
  openai: ["gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.4", "gpt-5.5", "gpt-4.1-mini"],
  gemini: ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.1-pro-preview"],
};

/** The organization's LLM models (rules.md GEN-1). Any user of the organization can change them. */
function ModelsForm({ org, onChanged }: { org: Organization; onChanged: () => Promise<void> }) {
  const [openai, setOpenai] = useState(org.openai_model ?? "");
  const [gemini, setGemini] = useState(org.gemini_model ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const changes = {
    ...((openai.trim() || null) !== org.openai_model ? { openai_model: openai.trim() || null } : {}),
    ...((gemini.trim() || null) !== org.gemini_model ? { gemini_model: gemini.trim() || null } : {}),
  };
  const dirty = Object.keys(changes).length > 0;
  return (
    <form
      className="grid-form models-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          await api.updateOrganization(org.id, changes);
          setMsg({ ok: true, text: "Models saved." });
          await onChanged();
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <strong className="span">Models for generating cards</strong>
      {(
        [
          ["openai", "OpenAI model", openai, setOpenai, org.default_openai_model, org.has_openai_api_key],
          ["gemini", "Gemini model", gemini, setGemini, org.default_gemini_model, org.has_gemini_api_key],
        ] as const
      ).map(([id, label, value, set, fallback, hasKey]) => (
        <Fragment key={id}>
          <label htmlFor={`model-${id}`}>{label}</label>
          <div className="row">
            <input id={`model-${id}`} list={`models-${id}`} value={value} placeholder={`default (${fallback})`} onChange={(e) => set(e.target.value)} />
            {!hasKey && <span className="muted small">no key yet</span>}
            <datalist id={`models-${id}`}>
              {MODEL_SUGGESTIONS[id].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        </Fragment>
      ))}
      <span className="span muted small">Leave empty for the default. A model is tried with the organization's key when saved, so typos and retired models are caught here.</span>
      <span />
      <div className="row">
        <button className="primary small" disabled={!dirty || busy}>
          {busy ? "Checking…" : "Save models"}
        </button>
      </div>
      {msg && <div className={`span ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
    </form>
  );
}

/** An organization's LLM key: the masked current one, Remove, and a field to replace it. */
function KeyField({
  label,
  masked,
  placeholder,
  value,
  onChange,
  onRemove,
}: {
  label: string;
  masked: string | null;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <label>{label}</label>
      <div className="row">
        <code className="key">{masked ?? "not set"}</code>
        {masked && (
          <button type="button" className="small" onClick={onRemove}>
            Remove
          </button>
        )}
        <input type="password" autoComplete="off" aria-label={`${masked ? "Replace" : "Set"} ${label}`} placeholder={masked ? `Replace: ${placeholder}` : placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </>
  );
}

function UsersPanel({ org, orgs, onChanged }: { org: Organization; orgs: Organization[]; onChanged: () => Promise<void> }) {
  const { user: me, refresh, impersonate } = useAuth();
  const isRoot = me!.role === "root";
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api.listUsers(org.id).then(setUsers, (e) => setError(e.message)), [org.id]);
  useEffect(() => {
    setEditing(null);
    load();
  }, [load]);

  const canEdit = (u: User) => isRoot || u.role === "member";

  const save = async (input: UserInput) => {
    if (editing === "new") await api.createUser({ ...input, organization_id: input.organization_id ?? org.id });
    else if (editing) await api.updateUser(editing.id, input);
    if (editing !== "new" && editing?.id === me!.id) await refresh();
    setEditing(null);
    await load();
    await onChanged(); // user counts
  };

  return (
    <section className="panel">
      <div className="row between">
        <h2>Users · {org.name}</h2>
        <button className="small" onClick={() => setEditing("new")}>
          + Add user
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {editing && (
        <UserForm key={editing === "new" ? "new" : editing.id} user={editing === "new" ? null : editing} orgs={orgs} isRoot={isRoot} onSave={save} onCancel={() => setEditing(null)} />
      )}
      <table className="players users">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.name}
                {u.id === me!.id && <span className="chip">you</span>}
              </td>
              <td>{u.email}</td>
              <td>
                <span className={`chip role-${u.role}`}>{u.role}</span>
              </td>
              <td className="actions">
                {isRoot && u.role === "member" && (
                  <button
                    className="small"
                    title="See the app exactly as this user does"
                    onClick={() => impersonate(u.id).catch((e) => setError((e as Error).message))}
                  >
                    Impersonate
                  </button>
                )}
                {canEdit(u) && (
                  <button className="small" onClick={() => setEditing(u)}>
                    Edit
                  </button>
                )}
                {isRoot && u.id !== me!.id && (
                  <button
                    className="small danger"
                    onClick={async () => {
                      if (!confirm(`Delete user ${u.email}?`)) return;
                      try {
                        await api.deleteUser(u.id);
                        await load();
                        await onChanged();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!users.length && (
            <tr>
              <td colSpan={4} className="muted">
                No users yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function UserForm({
  user,
  orgs,
  isRoot,
  onSave,
  onCancel,
}: {
  user: User | null;
  orgs: Organization[];
  isRoot: boolean;
  onSave: (input: UserInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user?.role ?? "member");
  const [orgId, setOrgId] = useState<number | undefined>(user?.organization_id);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid-form user-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const input: UserInput = { name, email };
        if (password) input.password = password;
        if (isRoot) {
          input.role = role;
          if (orgId) input.organization_id = orgId;
        }
        try {
          await onSave(input);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <strong className="span">{user ? `Edit ${user.email}` : "New user"}</strong>
      <label>Name</label>
      <input required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <label>Email</label>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <label>Password</label>
      <input
        type="password"
        autoComplete="new-password"
        required={!user}
        minLength={8}
        maxLength={72}
        placeholder={user ? "Leave blank to keep the current one" : "At least 8 characters"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {isRoot && (
        <>
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="member">member</option>
            <option value="root">root</option>
          </select>
          {user && (
            <>
              <label>Organization</label>
              <select value={orgId} onChange={(e) => setOrgId(Number(e.target.value))}>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </>
      )}
      {error && <div className="error span">{error}</div>}
      <span />
      <div className="row">
        <button className="primary small">{user ? "Save" : "Create"}</button>
        <button type="button" className="small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
