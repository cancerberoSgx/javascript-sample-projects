// Saved deck generations (rules.md §2.2.2, GEN-8 … GEN-10): named settings of the generate form,
// listed at the bottom of a deck's page. Loading one opens it in the generate form (GenerateCards.tsx),
// where it's also edited and saved.

import { api, type Category, type Deck, type DeckGeneration, type GenerationSpec } from "../api";
import { ErrorBox, useAction } from "./common";

const PROVIDER_NAMES = { openai: "OpenAI", gemini: "Gemini" } as const;

/** Shares as whole percentages of their total ("20/80"), the way the form shows them scaled. */
function percents(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (total > 0 ? Math.round((100 * w) / total) : 0));
}

/** "Science 20% · History 80%", "Easy 50% · Hard 50%", "Multiple choice 100%": zero shares left out. */
export function mixText(spec: GenerationSpec, catById: Map<number, Pick<Category, "name">>) {
  const join = (rows: [string, number][]) => {
    const p = percents(rows.map(([, w]) => w));
    return rows
      .map(([label], i) => [label, p[i], rows[i][1]] as const)
      .filter(([, , w]) => w > 0)
      .map(([label, pct]) => `${label} ${pct}%`)
      .join(" · ");
  };
  return {
    categories: spec.categories.length
      ? join(spec.categories.map((s) => [catById.get(s.category_id)?.name ?? "?", s.weight]))
      : "no categories (pick some before generating)",
    difficulty: join([
      ["Easy", spec.difficulty.easy],
      ["Medium", spec.difficulty.medium],
      ["Hard", spec.difficulty.hard],
    ]),
    types: join([
      ["Multiple choice", spec.types.multiple_choice],
      ["Open", spec.types.open],
    ]),
  };
}

/** One saved generation's settings, as read-only text (also used by the Library). */
export function GenerationSummary({ generation, categories }: { generation: Pick<DeckGeneration, "spec"> & Partial<Pick<DeckGeneration, "provider">>; categories: Pick<Category, "id" | "name">[] }) {
  const { spec, provider } = generation;
  const mix = mixText(spec, new Map(categories.map((c) => [c.id, c])));
  return (
    <div className="small generation-summary">
      <div>
        <strong>{spec.count} cards</strong>
        {provider && <span className="muted"> · {PROVIDER_NAMES[provider]}</span>} · {mix.categories}
      </div>
      <div className="muted">
        {mix.difficulty} · {mix.types}
      </div>
      {spec.instructions && <div className="instructions">“{spec.instructions}”</div>}
    </div>
  );
}

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null;
}

/** The bottom of a deck's page: every generation saved on this deck, to load, inspect or delete. */
export function SavedGenerations({
  deck,
  generations,
  categories,
  error,
  onLoad,
  onNew,
  onChanged,
}: {
  deck: Deck;
  generations: DeckGeneration[];
  categories: Category[];
  error: unknown;
  onLoad: (g: DeckGeneration) => void;
  onNew: () => void;
  onChanged: () => Promise<void>;
}) {
  const action = useAction();
  return (
    <section className="panel saved-generations">
      <div className="row between wrap">
        <h2>Saved generations · {generations.length}</h2>
        <button className="small" disabled={!categories.length} onClick={onNew} title="Open the generate form to set up and save a new one">
          + New
        </button>
      </div>
      <p className="muted small">
        Settings and instructions of ✨ Generate, saved with a name so they can be loaded again, refined, and reused. Any deck of the organization can load
        them.
      </p>
      <ErrorBox error={error ?? action.error} />
      <div className="table-scroll">
        <table className="players users">
          <thead>
            <tr>
              <th>Name</th>
              <th>Settings</th>
              <th>Used</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {generations.map((g) => (
              <tr key={g.id}>
                <td>
                  <strong>{g.name}</strong>
                  {g.description && <div className="muted small">{g.description}</div>}
                </td>
                <td>
                  <GenerationSummary generation={g} categories={categories} />
                </td>
                <td className="small nowrap">
                  {g.use_count ? (
                    <>
                      {g.use_count} time{g.use_count === 1 ? "" : "s"}
                      <div className="muted">last {when(g.last_used_at)}</div>
                      <div className="muted">
                        {g.cards_accepted} card{g.cards_accepted === 1 ? "" : "s"} added
                      </div>
                    </>
                  ) : (
                    <span className="muted">never</span>
                  )}
                  <div className="muted" title={`Last changed ${when(g.updated_at)}`}>
                    by {g.creator_name ?? "—"}, {when(g.created_at)}
                  </div>
                </td>
                <td className="actions">
                  <button className="small" onClick={() => onLoad(g)} title="Open it in the generate form, to generate, edit or save as new">
                    Load
                  </button>
                  <button
                    className="small danger"
                    disabled={action.busy}
                    onClick={() =>
                      confirm(`Delete the saved generation "${g.name}"? Cards it generated stay in the deck.`) &&
                      action.run(async () => (await api.deleteDeckGeneration(deck.id, g.id), onChanged()))
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!generations.length && (
              <tr>
                <td colSpan={4} className="muted">
                  None yet. In ✨ Generate, give your settings a name and save them.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
