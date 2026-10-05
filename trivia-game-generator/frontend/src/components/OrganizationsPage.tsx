import { useCallback, useEffect, useState } from "react";
import { api, type Organization, type Role, type User, type UserInput } from "../api";
import { useAuth } from "../auth";

// The backend enforces every rule; the UI only hides actions that would be rejected.
// Root: all organizations and users. Member: own organization (read-only), create users
// there and edit member users (rules in backend/app/permissions.py).

export function OrganizationsPage() {
  const { user: me } = useAuth();
  const isRoot = me!.role === "root";
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const list = await api.listOrganizations();
      setOrgs(list);
      setSelectedId((id) => (id && list.some((o) => o.id === id) ? id : (list[0]?.id ?? null)));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const selected = orgs.find((o) => o.id === selectedId) ?? null;

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
                if (created) setSelectedId(created.id);
              }}
            />
          )}
          <ul>
            {orgs.map((o) => (
              <li key={o.id}>
                <button className={o.id === selectedId ? "on" : ""} onClick={() => setSelectedId(o.id)}>
                  <span>{o.name}</span>
                  <span className="muted small">
                    {o.user_count} user{o.user_count === 1 ? "" : "s"}
                    {o.has_openai_api_key && " · 🔑"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="org-detail">
        {error && <div className="error">{error}</div>}
        {selected && (
          <>
            <OrganizationPanel key={selected.id} org={selected} canEdit={isRoot} onChanged={reload} />
            <UsersPanel org={selected} orgs={orgs} onChanged={reload} />
          </>
        )}
      </div>
    </div>
  );
}

function NewOrganizationForm({ onDone }: { onDone: (created: Organization | null) => void }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          onDone(await api.createOrganization({ name, openai_api_key: key || null }));
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <input placeholder="Organization name" required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input placeholder="OpenAI API key (optional)" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
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

function OrganizationPanel({ org, canEdit, onChanged }: { org: Organization; canEdit: boolean; onChanged: () => Promise<void> }) {
  const [name, setName] = useState(org.name);
  const [newKey, setNewKey] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      setNewKey("");
      await onChanged();
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
            run(() => api.updateOrganization(org.id, { name, ...(newKey ? { openai_api_key: newKey } : {}) }), "Saved.");
          }}
        >
          <label>Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
          <label>OpenAI API key</label>
          <div className="row">
            <code className="key">{org.openai_api_key_masked ?? "not set"}</code>
            {org.has_openai_api_key && (
              <button type="button" className="small" onClick={() => run(() => api.updateOrganization(org.id, { openai_api_key: null }), "Key removed.")}>
                Remove
              </button>
            )}
          </div>
          <label>Replace key</label>
          <input
            type="password"
            autoComplete="off"
            placeholder="sk-…  (stored encrypted, never shown again)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <span />
          <div className="row between">
            <button className="primary">Save</button>
            <button
              type="button"
              className="danger"
              disabled={org.user_count > 0}
              title={org.user_count > 0 ? "Delete or move its users first" : ""}
              onClick={() => confirm(`Delete organization "${org.name}"?`) && run(() => api.deleteOrganization(org.id), "Deleted.")}
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
        </dl>
      )}
      {msg && <div className={msg.ok ? "ok" : "error"}>{msg.text}</div>}
    </section>
  );
}

function UsersPanel({ org, orgs, onChanged }: { org: Organization; orgs: Organization[]; onChanged: () => Promise<void> }) {
  const { user: me, refresh } = useAuth();
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
