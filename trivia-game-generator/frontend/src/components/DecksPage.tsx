import { useEffect, useState } from "react";
import { api, type Card, type CardInput, type Category, type Deck } from "../api";
import { ErrorBox, NotFound, useAction, useList, useRouteSelection } from "./common";

export function DecksPage({ orgId }: { orgId: number }) {
  const decks = useList(() => api.listDecks(orgId), [orgId]);
  const categories = useList(() => api.listCategories(orgId), [orgId]);
  const { selectedId, selected, select, missing } = useRouteSelection("/decks", decks, orgId);
  const [creating, setCreating] = useState(false);

  return (
    <div className="orgs-page">
      <section className="panel org-list">
        <div className="row between">
          <h2>Decks</h2>
          <button className="small" onClick={() => setCreating(true)}>
            + New
          </button>
        </div>
        <ErrorBox error={decks.error} />
        {creating && (
          <NameForm
            placeholder="Deck name"
            onCancel={() => setCreating(false)}
            onSave={async (name, description) => {
              const d = await api.createDeck({ organization_id: orgId, name, description });
              setCreating(false);
              await decks.reload();
              select(d.id);
            }}
          />
        )}
        <ul>
          {decks.items.map((d) => (
            <li key={d.id}>
              <button className={d.id === selectedId ? "on" : ""} onClick={() => select(d.id)}>
                <span>{d.name}</span>
                <span className="muted small">{d.card_count} cards</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div className="org-detail">
        {missing ? (
          <NotFound what="Deck" back="/decks" />
        ) : selected ? (
          <DeckEditor
            key={selected.id}
            deck={selected}
            categories={categories.items}
            onChanged={decks.reload}
            onDeleted={async () => (await decks.reload(), select(null, true))}
          />
        ) : (
          decks.loaded && !decks.items.length && <p className="muted">Create a deck to start adding questions.</p>
        )}
      </div>
    </div>
  );
}

/** Small name + description form used to create decks and boards. */
export function NameForm({
  placeholder,
  onSave,
  onCancel,
  children,
}: {
  placeholder: string;
  onSave: (name: string, description: string) => Promise<void>;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const save = useAction();
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        save.run(() => onSave(name, description));
      }}
    >
      <input placeholder={placeholder} required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
      {children}
      <ErrorBox error={save.error} />
      <div className="row">
        <button className="primary small" disabled={save.busy}>
          Create
        </button>
        <button type="button" className="small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeckEditor({
  deck,
  categories,
  onChanged,
  onDeleted,
}: {
  deck: Deck;
  categories: Category[];
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [name, setName] = useState(deck.name);
  const [description, setDescription] = useState(deck.description);
  const [cards, setCards] = useState<Card[]>([]);
  const [editing, setEditing] = useState<Card | "new" | null>(null);
  const [filter, setFilter] = useState<number | "all">("all");
  const action = useAction();
  const catById = new Map(categories.map((c) => [c.id, c]));

  const loadCards = async () => setCards((await api.getDeck(deck.id)).cards);
  useEffect(() => {
    loadCards().catch(action.setError);
  }, [deck.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = filter === "all" ? cards : cards.filter((c) => c.category_id === filter);

  return (
    <>
      <section className="panel">
        <h2>Deck</h2>
        <form
          className="grid-form"
          onSubmit={(e) => {
            e.preventDefault();
            action.run(async () => (await api.updateDeck(deck.id, { name, description }), onChanged()));
          }}
        >
          <label>Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
          <label>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
          <span />
          <div className="row between">
            <button className="primary">Save</button>
            <button
              type="button"
              className="danger"
              onClick={() => confirm(`Delete deck "${deck.name}" and its ${cards.length} cards?`) && action.run(async () => (await api.deleteDeck(deck.id), onDeleted()))}
            >
              Delete deck
            </button>
          </div>
        </form>
        <ErrorBox error={action.error} />
      </section>

      <section className="panel">
        <div className="row between">
          <h2>
            Cards · {cards.length}
          </h2>
          <div className="row">
            <select value={filter} onChange={(e) => setFilter(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({cards.filter((x) => x.category_id === c.id).length})
                </option>
              ))}
            </select>
            <button className="small" disabled={!categories.length} title={categories.length ? "" : "Create a category first"} onClick={() => setEditing("new")}>
              + Add card
            </button>
          </div>
        </div>
        {!categories.length && <p className="muted small">Create categories first (Categories tab). Every card belongs to one.</p>}
        {editing && (
          <CardForm
            key={editing === "new" ? "new" : editing.id}
            card={editing === "new" ? null : editing}
            categories={categories}
            defaultCategory={filter === "all" ? categories[0]?.id : filter}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              if (editing === "new") await api.createCard(deck.id, input);
              else await api.updateCard(deck.id, editing.id, input);
              setEditing(null);
              await loadCards();
              await onChanged();
            }}
          />
        )}
        <table className="players users cards">
          <thead>
            <tr>
              <th>Category</th>
              <th>Question</th>
              <th>Answer</th>
              <th>★</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const cat = catById.get(c.category_id);
              return (
                <tr key={c.id}>
                  <td>
                    <span className="dot" style={{ background: cat?.color }} /> {cat?.name}
                  </td>
                  <td>
                    {c.question}
                    {c.grand_prize && <span className="chip">🏆 grand prize</span>}
                    {c.options && <div className="muted small">{c.options.join(" · ")}</div>}
                  </td>
                  <td>{c.answer}</td>
                  <td>{"★".repeat(c.difficulty)}</td>
                  <td className="actions">
                    <button className="small" onClick={() => setEditing(c)}>
                      Edit
                    </button>
                    <button
                      className="small danger"
                      onClick={() => confirm("Delete this card?") && action.run(async () => (await api.deleteCard(deck.id, c.id), loadCards(), onChanged()))}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {!shown.length && (
              <tr>
                <td colSpan={5} className="muted">
                  No cards yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

function CardForm({
  card,
  categories,
  defaultCategory,
  onSave,
  onCancel,
}: {
  card: Card | null;
  categories: Category[];
  defaultCategory: number | undefined;
  onSave: (input: CardInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [categoryId, setCategoryId] = useState(card?.category_id ?? defaultCategory ?? categories[0]?.id);
  const [question, setQuestion] = useState(card?.question ?? "");
  const [multiple, setMultiple] = useState(!!card?.options);
  const [options, setOptions] = useState<string[]>(card?.options ?? ["", "", "", ""]);
  const [answer, setAnswer] = useState(card?.answer ?? "");
  const [difficulty, setDifficulty] = useState(card?.difficulty ?? 1);
  const [grandPrize, setGrandPrize] = useState(card?.grand_prize ?? false);
  const save = useAction();

  const filled = options.map((o) => o.trim()).filter(Boolean);

  return (
    <form
      className="grid-form user-form"
      onSubmit={(e) => {
        e.preventDefault();
        save.run(() =>
          onSave({
            category_id: categoryId!,
            question,
            options: multiple ? filled : null,
            answer,
            difficulty,
            grand_prize: grandPrize,
          }),
        );
      }}
    >
      <strong className="span">{card ? "Edit card" : "New card"}</strong>
      <label>Category</label>
      <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label>Question</label>
      <input required value={question} onChange={(e) => setQuestion(e.target.value)} autoFocus />
      <label>Type</label>
      <div className="row">
        <label className="check">
          <input type="radio" checked={!multiple} onChange={() => setMultiple(false)} /> Open answer
        </label>
        <label className="check">
          <input type="radio" checked={multiple} onChange={() => setMultiple(true)} /> Multiple choice
        </label>
      </div>
      {multiple ? (
        <>
          <label>Options</label>
          <div className="options-edit">
            {options.map((o, i) => (
              <div className="row" key={i}>
                <input
                  type="radio"
                  name="correct"
                  title="Correct answer"
                  checked={!!o.trim() && answer === o.trim()}
                  onChange={() => setAnswer(o.trim())}
                  disabled={!o.trim()}
                />
                <input
                  value={o}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  onChange={(e) => {
                    const next = [...options];
                    if (answer === o.trim()) setAnswer(e.target.value.trim());
                    next[i] = e.target.value;
                    setOptions(next);
                  }}
                />
              </div>
            ))}
            <span className="muted small">Pick the correct option with the radio button. 2–6 options; empty ones are ignored.</span>
            {options.length < 6 && (
              <button type="button" className="small" onClick={() => setOptions([...options, ""])}>
                + option
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <label>Answer</label>
          <input required value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Matched ignoring case, accents and punctuation" />
        </>
      )}
      <label>Difficulty</label>
      <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
        <option value={1}>★ Easy (1 point)</option>
        <option value={2}>★★ Medium (2 points)</option>
        <option value={3}>★★★ Hard (3 points)</option>
      </select>
      <label>Grand prize</label>
      <label className="check">
        <input type="checkbox" checked={grandPrize} onChange={(e) => setGrandPrize(e.target.checked)} /> Only asked as the final question at the finish
      </label>
      <div className="span">
        <ErrorBox error={save.error} />
      </div>
      <span />
      <div className="row">
        <button className="primary small" disabled={save.busy}>
          {card ? "Save" : "Add card"}
        </button>
        <button type="button" className="small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
