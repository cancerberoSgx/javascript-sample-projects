// Generating a deck's cards with OpenAI or Gemini (rules.md §2.2.1, GEN-*): the form, the
// progress of a running generation, and the review list the user accepts cards from.

import { useEffect, useState } from "react";
import { api, type CardInput, type Category, type Deck, type GenerationJob, type GenerationSpec, type Provider, type ProviderInfo } from "../api";
import { CardForm } from "./DecksPage";
import { ErrorBox, useAction } from "./common";

export const MAX_GENERATED_CARDS = 200; // GEN-2, same limit as the backend

/** The deck's providers and its generation (running or under review). Polls while it runs. */
export function useGeneration(deckId: number) {
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let live = true;
    Promise.all([api.generationProviders(deckId), api.getGeneration(deckId)]).then(
      ([p, j]) => live && (setProviders(p), setJob(j)),
      (e) => live && setError(e),
    );
    return () => {
      live = false;
    };
  }, [deckId]);

  useEffect(() => {
    if (job?.status !== "running") return;
    const timer = setTimeout(() => api.getGeneration(deckId).then(setJob, setError), 1500);
    return () => clearTimeout(timer);
  }, [deckId, job]);

  return { providers, job, setJob, error };
}

/** Splits `total` in proportion to `weights`, adding up exactly (the backend's largest_remainder). */
export function largestRemainder(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const ideal = weights.map((w) => (total * w) / sum);
  const out = ideal.map(Math.floor);
  const order = ideal.map((x, i) => [x - out[i], i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < total - out.reduce((a, b) => a + b, 0); k++) out[order[k][1]]++;
  return out;
}

const evenly = (n: number) => largestRemainder(100, Array(n).fill(1));
const DIFFICULTIES = [
  ["easy", "★ Easy"],
  ["medium", "★★ Medium"],
  ["hard", "★★★ Hard"],
] as const;
const TYPES = [
  ["multiple_choice", "Multiple choice"],
  ["open", "Open answer"],
] as const;

export function GenerateForm({
  deck,
  providers,
  categories,
  onStarted,
  onCancel,
}: {
  deck: Deck;
  providers: ProviderInfo[];
  categories: Category[];
  onStarted: (job: GenerationJob) => void;
  onCancel: () => void;
}) {
  // GEN-1: with one key there's nothing to pick; with two the user must choose
  const [provider, setProvider] = useState<Provider | null>(providers.length === 1 ? providers[0].id : null);
  const [count, setCount] = useState(20);
  const [shares, setShares] = useState<Record<number, number>>(() => {
    const split = evenly(categories.length);
    return Object.fromEntries(categories.map((c, i) => [c.id, split[i]]));
  });
  const [difficulty, setDifficulty] = useState<GenerationSpec["difficulty"]>({
    easy: 34,
    medium: 33,
    hard: 33,
  });
  const [types, setTypes] = useState<GenerationSpec["types"]>({
    multiple_choice: 50,
    open: 50,
  });
  const [instructions, setInstructions] = useState("");
  const start = useAction();

  const chosen = categories.filter((c) => c.id in shares);
  const catCounts = largestRemainder(
    count,
    chosen.map((c) => shares[c.id]),
  );
  const diffCounts = largestRemainder(
    count,
    DIFFICULTIES.map(([k]) => difficulty[k]),
  );
  const typeCounts = largestRemainder(
    count,
    TYPES.map(([k]) => types[k]),
  );
  const undescribed = chosen.filter((c) => shares[c.id] > 0 && !c.description.trim());
  const validCount = Number.isInteger(count) && count >= 1 && count <= MAX_GENERATED_CARDS;
  const problems = [
    !provider && "Pick a provider.",
    !validCount && `Ask for 1 to ${MAX_GENERATED_CARDS} cards.`,
    !chosen.some((c) => shares[c.id] > 0) && "Pick at least one category with a share above 0%.",
    !Object.values(difficulty).some((v) => v > 0) && "Give at least one difficulty a share above 0%.",
    !Object.values(types).some((v) => v > 0) && "Give at least one question type a share above 0%.",
  ].filter(Boolean) as string[];

  const toggle = (id: number) =>
    setShares((s) => {
      const ids = id in s ? chosen.filter((c) => c.id !== id).map((c) => c.id) : [...chosen.map((c) => c.id), id];
      const split = evenly(ids.length);
      return Object.fromEntries(ids.map((x, i) => [x, split[i]]));
    });

  return (
    <form
      className="grid-form user-form generate-form"
      onSubmit={(e) => {
        e.preventDefault();
        start.run(async () =>
          onStarted(
            await api.startGeneration(deck.id, {
              provider,
              count,
              categories: chosen.map((c) => ({
                category_id: c.id,
                weight: shares[c.id],
              })),
              difficulty,
              types,
              instructions,
            }),
          ),
        );
      }}
    >
      <strong className="span">✨ Generate cards</strong>
      <label>Provider</label>
      {providers.length === 1 ? (
        <span className="small">
          {providers[0].name} <span className="muted">· {providers[0].model}</span>
        </span>
      ) : (
        <div className="row wrap">
          {providers.map((p) => (
            <label key={p.id} className="check">
              <input type="radio" name="provider" checked={provider === p.id} onChange={() => setProvider(p.id)} /> {p.name}
              <span className="muted small">{p.model}</span>
            </label>
          ))}
        </div>
      )}

      <label>Cards</label>
      <div className="row">
        <input
          type="number"
          min={1}
          max={MAX_GENERATED_CARDS}
          required
          value={Number.isNaN(count) ? "" : count}
          onChange={(e) => setCount(e.target.valueAsNumber)}
        />
        <span className="muted small">up to {MAX_GENERATED_CARDS}. Questions already in the deck are never repeated.</span>
      </div>

      <label className="self-start">Categories</label>
      <MixTable
        rows={categories.map((c) => {
          const i = chosen.indexOf(c);
          return {
            key: c.id,
            label: (
              <label className="check">
                <input type="checkbox" checked={i >= 0} onChange={() => toggle(c.id)} />
                <span className="dot" style={{ background: c.color }} /> {c.name}
              </label>
            ),
            value: i >= 0 ? shares[c.id] : null,
            count: i >= 0 ? catCounts[i] : null,
            onChange: (v: number) => setShares((s) => ({ ...s, [c.id]: v })),
          };
        })}
        extra={
          chosen.length > 1 && (
            <button type="button" className="link small" onClick={() => setShares(Object.fromEntries(chosen.map((c, i) => [c.id, evenly(chosen.length)[i]])))}>
              Split evenly
            </button>
          )
        }
      />

      <label className="self-start">Difficulty</label>
      <MixTable
        rows={DIFFICULTIES.map(([k, label], i) => ({
          key: k,
          label,
          value: difficulty[k],
          count: diffCounts[i],
          onChange: (v: number) => setDifficulty((d) => ({ ...d, [k]: v })),
        }))}
      />

      <label className="self-start">Question type</label>
      <MixTable
        rows={TYPES.map(([k, label], i) => ({
          key: k,
          label,
          value: types[k],
          count: typeCounts[i],
          onChange: (v: number) => setTypes((t) => ({ ...t, [k]: v })),
        }))}
      />

      <label className="self-start">Instructions</label>
      <textarea
        rows={2}
        maxLength={1000}
        placeholder="Optional. For example: for 10-year-olds · in Spanish · focus on the 20th century"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
      />

      <div className="span">
        {undescribed.length > 0 && (
          <p className="warn-text small">
            {undescribed.map((c) => c.name).join(", ")} {undescribed.length === 1 ? "has" : "have"} no description, so the model only sees the name. A
            description (Categories tab) says what belongs in a category, e.g. to tell "History-Uruguay" from "History-Argentina".
          </p>
        )}
        {problems.length > 0 && <p className="muted small">{problems.join(" ")}</p>}
        <ErrorBox error={start.error} />
      </div>
      <span />
      <div className="row">
        <button className="primary small" disabled={start.busy || problems.length > 0}>
          {start.busy ? "Starting…" : `Generate ${validCount ? count : ""} cards`}
        </button>
        <button type="button" className="small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Percent inputs with the card count each one turns into. Shares not adding up to 100 are scaled. */
function MixTable({
  rows,
  extra,
}: {
  rows: {
    key: string | number;
    label: React.ReactNode;
    value: number | null;
    count: number | null;
    onChange: (v: number) => void;
  }[];
  extra?: React.ReactNode;
}) {
  const total = rows.reduce((a, r) => a + (r.value ?? 0), 0);
  return (
    <div className="mix">
      {rows.map((r) => (
        <div className="mix-row" key={r.key}>
          <span className="mix-label">{r.label}</span>
          {r.value === null ? (
            <span />
          ) : (
            <span className="row">
              <input
                type="number"
                min={0}
                max={100}
                aria-label="share in percent"
                value={Number.isNaN(r.value) ? "" : r.value}
                onChange={(e) => r.onChange(Math.max(0, e.target.valueAsNumber || 0))}
              />
              %
            </span>
          )}
          <span className="muted small">{r.count === null ? "" : `${r.count} card${r.count === 1 ? "" : "s"}`}</span>
        </div>
      ))}
      <div className="row small">
        {total !== 100 && total > 0 && <span className="warn-text">Adds up to {total}%, so it's scaled to 100%.</span>}
        {extra}
      </div>
    </div>
  );
}

/** A running generation's progress, then the review list (GEN-6). */
export function GenerationPanel({
  deck,
  job,
  categories,
  onChanged,
  onAccepted,
}: {
  deck: Deck;
  job: GenerationJob;
  categories: Category[];
  onChanged: (job: GenerationJob | null) => void;
  onAccepted: (message: string) => Promise<void>;
}) {
  const action = useAction();
  const running = job.status === "running";
  const provider = `${job.provider === "openai" ? "OpenAI" : "Gemini"} · ${job.model}`;
  const discard = () =>
    (running || confirm(`Discard ${job.cards.length} generated cards?`)) &&
    action.run(async () => {
      await api.discardGeneration(deck.id);
      onChanged(null);
    });

  return (
    <section className="panel generation">
      <div className="row between">
        <h2>{running ? "Generating cards" : `Review generated cards · ${job.cards.length}`}</h2>
        <span className="muted small">{provider}</span>
      </div>
      {running ? (
        <>
          <progress max={Math.max(1, job.batches_total)} value={job.batches_done} />
          <div className="row between">
            <span className="small">
              {job.cards.length} of {job.request.count} cards · call {Math.min(job.batches_done + 1, job.batches_total)} of {job.batches_total}
              <span className="muted"> · you can leave this page, it keeps going</span>
            </span>
            <button className="small danger" disabled={action.busy} onClick={discard}>
              Stop and discard
            </button>
          </div>
        </>
      ) : (
        <p className="muted small">
          Asked for {job.request.count}, got {job.cards.length}
          {job.dropped_duplicates > 0 && ` · dropped ${job.dropped_duplicates} repeated question${job.dropped_duplicates === 1 ? "" : "s"}`}
          {job.dropped_invalid > 0 && ` · dropped ${job.dropped_invalid} unusable card${job.dropped_invalid === 1 ? "" : "s"}`}. Nothing is in the deck until
          you add it.
        </p>
      )}
      {job.error && <div className="error">{job.error}</div>}
      {job.messages.length > 0 && (
        <div className="warn">
          <ul>
            {job.messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <ErrorBox error={action.error} />
      {running ? (
        job.cards.length > 0 && <CardTable cards={job.cards.map(asInput)} categories={categories} />
      ) : (
        <Review key={job.id} deck={deck} job={job} categories={categories} onDiscard={discard} onAccepted={onAccepted} onGone={() => onChanged(null)} />
      )}
    </section>
  );
}

const asInput = (c: GenerationJob["cards"][number]): CardInput => ({
  ...c,
  grand_prize: false,
});

function Review({
  deck,
  job,
  categories,
  onDiscard,
  onAccepted,
  onGone,
}: {
  deck: Deck;
  job: GenerationJob;
  categories: Category[];
  onDiscard: () => void;
  onAccepted: (message: string) => Promise<void>;
  onGone: () => void;
}) {
  const [cards, setCards] = useState<CardInput[]>(() => job.cards.map(asInput));
  const [selected, setSelected] = useState<Set<number>>(() => new Set(job.cards.map((_, i) => i)));
  const [editing, setEditing] = useState<number | null>(null);
  const accept = useAction();
  const picked = cards.filter((_, i) => selected.has(i));

  const toggle = (i: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(i)) next.add(i);
      return next;
    });

  return (
    <>
      {editing !== null && (
        <CardForm
          card={cards[editing]}
          categories={categories}
          defaultCategory={cards[editing].category_id}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            setCards((cs) => cs.map((c, i) => (i === editing ? input : c)));
            setSelected((s) => new Set(s).add(editing));
            setEditing(null);
          }}
        />
      )}
      {cards.length > 0 && (
        <div className="row small">
          <button type="button" className="link" onClick={() => setSelected(new Set(cards.map((_, i) => i)))}>
            Select all
          </button>
          <button type="button" className="link" onClick={() => setSelected(new Set())}>
            Select none
          </button>
          <span className="muted">· {picked.length} selected</span>
        </div>
      )}
      <CardTable cards={cards} categories={categories} selected={selected} onToggle={toggle} onEdit={setEditing} />
      <ErrorBox error={accept.error} />
      <div className="row">
        <button
          className="primary small"
          disabled={accept.busy || !picked.length || editing !== null}
          onClick={() =>
            accept.run(async () => {
              try {
                const r = await api.acceptGeneration(deck.id, {
                  job_id: job.id,
                  cards: picked,
                });
                const skipped = r.skipped_duplicates.length;
                await onAccepted(
                  `Added ${r.added} generated card${r.added === 1 ? "" : "s"} to the deck.${skipped ? ` Skipped ${skipped} already in the deck.` : ""}`,
                );
              } catch (e) {
                if ((e as { status?: number }).status === 404) onGone(); // discarded or accepted in another tab
                throw e;
              }
            })
          }
        >
          {accept.busy ? "Adding…" : `Add ${picked.length} card${picked.length === 1 ? "" : "s"} to deck`}
        </button>
        <button className="small danger" disabled={accept.busy} onClick={onDiscard}>
          Discard all
        </button>
      </div>
    </>
  );
}

function CardTable({
  cards,
  categories,
  selected,
  onToggle,
  onEdit,
}: {
  cards: CardInput[];
  categories: Category[];
  selected?: Set<number>;
  onToggle?: (i: number) => void;
  onEdit?: (i: number) => void;
}) {
  const catById = new Map(categories.map((c) => [c.id, c]));
  return (
    <div className="generated-cards">
      <table className="players users cards">
        <thead>
          <tr>
            {selected && <th></th>}
            <th>Category</th>
            <th>Question</th>
            <th>Answer</th>
            <th>★</th>
            {onEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {cards.map((c, i) => {
            const cat = catById.get(c.category_id);
            return (
              <tr key={i} className={selected && !selected.has(i) ? "unpicked" : ""}>
                {selected && (
                  <td>
                    <input type="checkbox" aria-label="Add this card" checked={selected.has(i)} onChange={() => onToggle?.(i)} />
                  </td>
                )}
                <td>
                  <span className="dot" style={{ background: cat?.color }} /> {cat?.name}
                </td>
                <td>
                  {c.question}
                  {c.options && <div className="muted small">{c.options.join(" · ")}</div>}
                </td>
                <td>{c.answer}</td>
                <td>{"★".repeat(c.difficulty)}</td>
                {onEdit && (
                  <td className="actions">
                    <button className="small" onClick={() => onEdit(i)}>
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
          {!cards.length && (
            <tr>
              <td colSpan={6} className="muted">
                No cards were generated.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
