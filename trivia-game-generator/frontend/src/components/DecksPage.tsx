import { useEffect, useRef, useState } from "react";
import { api, type Card, type CardInput, type Category, type Deck, type DeckGeneration } from "../api";
import { CopiedFromNote, ErrorBox, NotFound, PublicChip, PublishControl, useAction, useList, useRouteSelection } from "./common";
import { downloadJson, fileName, ImportButton, readJsonFile } from "./files";
import { SavedGenerations } from "./DeckGenerations";
import { GenerateForm, GenerationPanel, useGeneration } from "./GenerateCards";

export function DecksPage({ orgId }: { orgId: number }) {
  const decks = useList(() => api.listDecks(orgId), [orgId]);
  const categories = useList(() => api.listCategories(orgId), [orgId]);
  const { selectedId, selected, select, missing } = useRouteSelection("/decks", decks, orgId);
  const [creating, setCreating] = useState(false);
  const importing = useAction();
  const [imported, setImported] = useState<string | null>(null);

  const importFile = (file: File) => {
    setImported(null);
    importing.run(async () => {
      const r = await api.importDeck(await readJsonFile(file), orgId);
      await Promise.all([decks.reload(), categories.reload()]);
      select(r.deck.id);
      setImported(importSummary(r));
    });
  };

  return (
    <div className="orgs-page">
      <section className="panel org-list">
        <div className="row between">
          <h2>Decks</h2>
          <div className="row">
            <ImportButton label="⬆ Import" disabled={importing.busy} onFile={importFile} />
            <button className="small" onClick={() => setCreating(true)}>
              + New
            </button>
          </div>
        </div>
        <ErrorBox error={decks.error} />
        <ErrorBox error={importing.error} />
        {imported && <div className="ok small">{imported}</div>}
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
                <span className="muted small">
                  <PublicChip item={d} /> {d.card_count} cards
                </span>
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

function importSummary(r: { deck: Deck; categories_created: string[]; categories_matched: string[] }) {
  const parts = [`Imported "${r.deck.name}" with ${r.deck.card_count} cards.`];
  if (r.categories_created.length) parts.push(`New categories: ${r.categories_created.join(", ")}.`);
  if (r.categories_matched.length) parts.push(`Uses your categories: ${r.categories_matched.join(", ")}.`);
  return parts.join(" ");
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
  // The generate form, possibly opened on a saved generation; `n` remounts it when another is loaded
  const [generateForm, setGenerateForm] = useState<{ initial: DeckGeneration | null; n: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const generation = useGeneration(deck.id);
  const saved = useList(() => api.listOrgDeckGenerations(deck.organization_id), [deck.organization_id]); // GEN-8
  const cardsPanel = useRef<HTMLElement>(null);
  const openForm = (initial: DeckGeneration | null) => {
    setGenerateForm((f) => ({ initial, n: (f?.n ?? 0) + 1 }));
    setNotice(null);
    cardsPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
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
            <div className="row">
              <button className="primary">Save</button>
              <button
                type="button"
                title="Download this deck and its categories as a .json file, to keep or to import elsewhere"
                onClick={() => action.run(async () => downloadJson(fileName(deck.name, "deck"), await api.exportDeck(deck.id)))}
              >
                ⬇ Export JSON
              </button>
            </div>
            <button
              type="button"
              className="danger"
              onClick={() => confirm(`Delete deck "${deck.name}" and its ${cards.length} cards?`) && action.run(async () => (await api.deleteDeck(deck.id), onDeleted()))}
            >
              Delete deck
            </button>
          </div>
        </form>
        <CopiedFromNote item={deck} />
        <ErrorBox error={action.error} />
        <PublishControl
          kind="decks"
          item={deck}
          onChanged={onChanged}
          blocked={deck.card_count ? null : "Add cards before publishing the deck (SHR-2)."}
        />
      </section>

      <section className="panel" ref={cardsPanel}>
        <div className="row between wrap">
          <h2>
            Cards · {cards.length}
          </h2>
          <div className="row wrap">
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
            <button
              className="small"
              disabled={!categories.length || !generation.providers?.length || !!generation.job || !!generateForm}
              title={generateTitle(categories.length > 0, generation.providers, !!generation.job)}
              onClick={() => openForm(null)}
            >
              ✨ Generate
            </button>
          </div>
        </div>
        {!categories.length && <p className="muted small">Create categories first (Categories tab). Every card belongs to one.</p>}
        {categories.length > 0 && generation.providers?.length === 0 && !cards.length && (
          <p className="muted small">To generate cards with OpenAI or Gemini, a root user has to add an API key to this organization (Organizations tab).</p>
        )}
        <ErrorBox error={generation.error} />
        {notice && <div className="ok">{notice}</div>}
        {generateForm && generation.providers && (
          <GenerateForm
            key={generateForm.n}
            deck={deck}
            providers={generation.providers}
            categories={categories}
            generations={saved.items}
            initial={generateForm.initial}
            blocked={
              generation.job
                ? "This deck has generated cards waiting for review below: add or discard them before generating more. You can still save these settings."
                : null
            }
            onCancel={() => setGenerateForm(null)}
            onSaved={saved.reload}
            onStarted={(job) => (generation.setJob(job), setGenerateForm(null), saved.reload())}
          />
        )}
        {generation.job && (
          <GenerationPanel
            deck={deck}
            job={generation.job}
            categories={categories}
            onChanged={generation.setJob}
            onAccepted={async (message) => {
              generation.setJob(null);
              setNotice(message);
              await loadCards();
              await onChanged();
              await saved.reload();
            }}
          />
        )}
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
        <div className="table-scroll">
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
        </div>
      </section>

      <SavedGenerations
        deck={deck}
        generations={saved.items.filter((g) => g.deck_id === deck.id)}
        categories={categories}
        error={saved.error}
        onLoad={openForm}
        onNew={() => openForm(null)}
        onChanged={saved.reload}
      />
    </>
  );
}

function generateTitle(hasCategories: boolean, providers: unknown[] | null, hasJob: boolean) {
  if (!hasCategories) return "Create a category first";
  if (providers && !providers.length) return "This organization has no OpenAI or Gemini API key";
  if (hasJob) return "Review or discard the generated cards first";
  return "Generate cards with an LLM";
}

/** Creates or edits a card. Also edits generated cards before they're added (GenerateCards.tsx). */
export function CardForm({
  card,
  categories,
  defaultCategory,
  onSave,
  onCancel,
}: {
  card: CardInput | null;
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
