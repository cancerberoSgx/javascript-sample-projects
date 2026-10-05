import { useState } from "react";
import { api, type Category } from "../api";
import { SLOT_COLORS } from "../engine/resolve";
import { ErrorBox, useAction, useList } from "./common";

export function CategoriesPage({ orgId }: { orgId: number }) {
  const { items, error, reload } = useList(() => api.listCategories(orgId), [orgId]);
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const del = useAction();

  return (
    <section className="panel content-page">
      <div className="row between">
        <h2>Categories</h2>
        <button className="small" onClick={() => setEditing("new")}>
          + New category
        </button>
      </div>
      <p className="muted small">Cards belong to a category, and a game picks one category for each board slot.</p>
      <ErrorBox error={error ?? del.error} />
      {editing && (
        <CategoryForm
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          orgId={orgId}
          suggestedColor={SLOT_COLORS[items.length % SLOT_COLORS.length]}
          onDone={async () => {
            setEditing(null);
            await reload();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      <table className="players users">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Cards</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>
                <span className="dot" style={{ background: c.color }} /> {c.name}
              </td>
              <td className="muted">{c.description}</td>
              <td>{c.card_count}</td>
              <td className="actions">
                <button className="small" onClick={() => setEditing(c)}>
                  Edit
                </button>
                <button
                  className="small danger"
                  onClick={() => confirm(`Delete category "${c.name}"?`) && del.run(async () => (await api.deleteCategory(c.id), reload()))}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {!items.length && (
            <tr>
              <td colSpan={4} className="muted">
                No categories yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function CategoryForm({
  category,
  orgId,
  suggestedColor,
  onDone,
  onCancel,
}: {
  category: Category | null;
  orgId: number;
  suggestedColor: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [color, setColor] = useState(category?.color ?? suggestedColor);
  const save = useAction();

  return (
    <form
      className="grid-form user-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const body = { name, description, color };
        const ok = await save.run(() => (category ? api.updateCategory(category.id, body) : api.createCategory({ ...body, organization_id: orgId })));
        if (ok) onDone();
      }}
    >
      <strong className="span">{category ? `Edit ${category.name}` : "New category"}</strong>
      <label>Name</label>
      <input required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <label>Description</label>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
      <label>Color</label>
      <div className="row">
        <input type="color" className="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <code className="muted small">{color}</code>
      </div>
      <div className="span">
        <ErrorBox error={save.error} />
      </div>
      <span />
      <div className="row">
        <button className="primary small" disabled={save.busy}>
          {category ? "Save" : "Create"}
        </button>
        <button type="button" className="small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
