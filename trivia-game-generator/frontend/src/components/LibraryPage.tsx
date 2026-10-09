// The public Library (rules.md §2.8, SHR-*): every organization's published boards, decks,
// categories and images. Nothing here is used in place: "Copy" makes an independent item in
// `orgId` (yours, or the one a root user picked), so the rest of the app never crosses organizations.

import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router";
import { api, type Board, type Card, type Category, type PublicDeckDetail, type PublicImage, type Published } from "../api";
import { BoardPreview, ErrorBox, hasErrors, NotFound, toBoardFile, useAction, useList, useRouteSelection, type RouteState } from "./common";
import { GenerationSummary } from "./DeckGenerations";

type Kind = "boards" | "decks" | "categories" | "images";
const KINDS: [Kind, string][] = [
  ["boards", "Boards"],
  ["decks", "Decks"],
  ["categories", "Categories"],
  ["images", "Images"],
];

export function LibraryPage({ orgId, orgName }: { orgId: number; orgName: string }) {
  const { kind = "boards" } = useParams();
  const [q, setQ] = useState("");
  const query = useDebounced(q, 250);
  if (!KINDS.some(([k]) => k === kind)) return <NotFound what="Library section" back="/library" />;

  return (
    <div className="library">
      <section className="panel library-head">
        <div className="row between wrap">
          <div>
            <h2>Library</h2>
            <p className="muted small">
              What organizations made public. Copy anything into <strong>{orgName}</strong>: the copy is yours to change, and later changes to the original
              don't touch it.
            </p>
          </div>
          <input className="library-search" type="search" placeholder="Search name, description or organization" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <nav className="tabs">
          {KINDS.map(([k, label]) => (
            <NavLink key={k} to={`/library/${k}`} className={({ isActive }) => (isActive ? "on" : "")}>
              {label}
            </NavLink>
          ))}
        </nav>
      </section>
      {kind === "boards" && <BoardsSection key={orgId} orgId={orgId} q={query} />}
      {kind === "decks" && <DecksSection key={orgId} orgId={orgId} q={query} />}
      {kind === "categories" && <CategoriesSection orgId={orgId} q={query} />}
      {kind === "images" && <ImagesSection orgId={orgId} q={query} />}
    </div>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return out;
}

/** "by Default · 3 days ago" */
function Byline({ item }: { item: { organization_name: string; published_at: string | null } }) {
  return (
    <span className="muted small">
      by <strong>{item.organization_name}</strong>
      {item.published_at && ` · ${new Date(item.published_at).toLocaleDateString()}`}
    </span>
  );
}

/** The result of a copy, with a link to it. */
function Copied({ message, to, orgId }: { message: string; to?: string; orgId: number }) {
  return (
    <div className="ok">
      {message}{" "}
      {to && (
        <Link to={to} state={{ orgId } satisfies RouteState}>
          Open it →
        </Link>
      )}
    </div>
  );
}

/** Name for the copy + Copy button. An empty name keeps the original's ("(copy)" when taken, SHR-4). */
function CopyForm({ label, original, onCopy }: { label: string; original: string; onCopy: (name: string | undefined) => Promise<unknown> }) {
  const [name, setName] = useState("");
  const action = useAction();
  return (
    <form
      className="row wrap copy-form"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(async () => (await onCopy(name.trim() || undefined), setName("")));
      }}
    >
      <input placeholder={`Name: ${original}`} value={name} onChange={(e) => setName(e.target.value)} />
      <button className="primary small" disabled={action.busy}>
        {action.busy ? "Copying…" : label}
      </button>
      <ErrorBox error={action.error} />
    </form>
  );
}

function ListAndDetail<T extends { id: number; name: string; organization_name: string }>({
  kind,
  list,
  orgId,
  meta,
  empty,
  children,
}: {
  kind: Kind;
  list: { items: T[]; loaded: boolean; error: unknown };
  orgId: number;
  meta: (item: T) => React.ReactNode;
  empty: string;
  children: (selected: T) => React.ReactNode;
}) {
  const { selectedId, selected, select } = useRouteSelection(`/library/${kind}`, list, orgId);
  return (
    <div className="orgs-page">
      <section className="panel org-list">
        <ErrorBox error={list.error} />
        {list.loaded && !list.items.length && <p className="muted small">{empty}</p>}
        <ul>
          {list.items.map((item) => (
            <li key={item.id}>
              <button className={item.id === selectedId ? "on" : ""} onClick={() => select(item.id)}>
                <span>{item.name}</span>
                <span className="muted small">
                  {item.organization_name} · {meta(item)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div className="org-detail">
        {selected ? children(selected) : selectedId !== null && list.loaded && <p className="muted">Not in the Library (anymore), or not matching the search.</p>}
      </div>
    </div>
  );
}

// ---------- boards (SHR-7) ----------

function BoardsSection({ orgId, q }: { orgId: number; q: string }) {
  const list = useList(() => api.libraryBoards(q), [q]);
  return (
    <ListAndDetail
      kind="boards"
      list={list}
      orgId={orgId}
      meta={(b) => `${b.definition.spaces.length} spaces · ${b.definition.slots.length} slots`}
      empty="No public boards yet. Publish one from the Boards tab."
    >
      {(b) => <BoardDetail key={b.id} board={b} orgId={orgId} />}
    </ListAndDetail>
  );
}

function BoardDetail({ board, orgId }: { board: Published<Board>; orgId: number }) {
  const [copied, setCopied] = useState<Board | null>(null);
  const { config, slots, spaces, background } = board.definition;
  return (
    <section className="panel">
      <div className="row between wrap">
        <h2>
          {board.name} {hasErrors(board) && <span className="chip draft">draft</span>}
        </h2>
        <Byline item={board} />
      </div>
      {board.description && <p>{board.description}</p>}
      <p className="muted small">
        {spaces.length} spaces · {slots.length} category slots ({slots.join(", ")}) · {config.track_type ?? "linear"} track
        {background?.image && " · background image included"}
      </p>
      <div className="library-preview">
        <BoardPreview board={toBoardFile(board)} />
      </div>
      <p className="muted small">Boards have category slots, not categories: each game picks its own categories, so a copied board works with any of your decks.</p>
      {copied && <Copied message={`Copied as “${copied.name}”.`} to={`/boards/${copied.id}`} orgId={orgId} />}
      <CopyForm label="Copy board" original={board.name} onCopy={async (name) => setCopied(await api.copyBoard(board.id, { organization_id: orgId, name }))} />
    </section>
  );
}

// ---------- decks and cards (SHR-5, SHR-6) ----------

function DecksSection({ orgId, q }: { orgId: number; q: string }) {
  const list = useList(() => api.libraryDecks(q), [q]);
  return (
    <ListAndDetail kind="decks" list={list} orgId={orgId} meta={(d) => `${d.card_count} cards`} empty="No public decks yet. Publish one from the Decks tab.">
      {(d) => <DeckDetail key={d.id} deckId={d.id} orgId={orgId} />}
    </ListAndDetail>
  );
}

function DeckDetail({ deckId, orgId }: { deckId: number; orgId: number }) {
  const [deck, setDeck] = useState<PublicDeckDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState<number | "all">("all");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<{ message: string; to?: string } | null>(null);
  const myDecks = useList(() => api.listDecks(orgId), [orgId]);
  const [target, setTarget] = useState<number | null>(null);
  const add = useAction();

  useEffect(() => {
    api.libraryDeck(deckId).then(setDeck, setError);
  }, [deckId]);
  const catById = useMemo(() => new Map((deck?.categories ?? []).map((c) => [c.id, c])), [deck]);

  if (error) return <ErrorBox error={error} />;
  if (!deck) return <p className="muted">Loading…</p>;
  const shown = filter === "all" ? deck.cards : deck.cards.filter((c) => c.category_id === filter);
  const allShownPicked = shown.length > 0 && shown.every((c) => picked.has(c.id));
  const targetId = target ?? myDecks.items[0]?.id ?? null;
  const toggle = (ids: number[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });

  return (
    <>
      <section className="panel">
        <div className="row between wrap">
          <h2>{deck.name}</h2>
          <Byline item={deck} />
        </div>
        {deck.description && <p>{deck.description}</p>}
        <div className="row wrap">
          {deck.categories.map((c) => (
            <span key={c.id} className="chip cat-chip" title={c.description}>
              <span className="dot" style={{ background: c.color }} /> {c.name} · {deck.cards.filter((x) => x.category_id === c.id).length}
            </span>
          ))}
        </div>
        <p className="muted small">
          Copying brings the cards' categories along: a category with the same name in your organization is reused, the others are created. Its saved
          generations come along too.
        </p>
        {notice && <Copied message={notice.message} to={notice.to} orgId={orgId} />}
        <CopyForm
          label={`Copy whole deck (${deck.cards.length} cards)`}
          original={deck.name}
          onCopy={async (name) => {
            const r = await api.copyDeck(deck.id, { organization_id: orgId, name });
            const saved = r.generations_copied ? ` With ${r.generations_copied} saved generation${r.generations_copied === 1 ? "" : "s"}.` : "";
            setNotice({ message: `Copied as “${r.deck.name}”.${saved}${categoriesNote(r.categories_created, r.categories_matched)}`, to: `/decks/${r.deck.id}` });
            myDecks.reload();
          }}
        />
      </section>

      <section className="panel">
        <div className="row between wrap">
          <h2>Cards · {deck.cards.length}</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">All categories</option>
            {deck.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="row wrap pick-bar">
          <span className="small">{picked.size} selected</span>
          {myDecks.items.length ? (
            <>
              <span className="small">→ add to</span>
              <select value={targetId ?? ""} onChange={(e) => setTarget(Number(e.target.value))}>
                {myDecks.items.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.card_count})
                  </option>
                ))}
              </select>
              <button
                className="small primary"
                disabled={!picked.size || add.busy || targetId === null}
                onClick={() =>
                  add.run(async () => {
                    const order = deck.cards.filter((c) => picked.has(c.id)).map((c) => c.id);
                    const r = await api.copyCards(deck.id, { deck_id: targetId!, card_ids: order });
                    const name = myDecks.items.find((d) => d.id === targetId)?.name;
                    const skipped = r.skipped_duplicates.length ? ` Skipped ${r.skipped_duplicates.length} that “${name}” already has.` : "";
                    setNotice({ message: `Added ${r.added} card${r.added === 1 ? "" : "s"} to “${name}”.${skipped}${categoriesNote(r.categories_created, [])}`, to: `/decks/${targetId}` });
                    setPicked(new Set());
                    myDecks.reload();
                  })
                }
              >
                Add selected cards
              </button>
            </>
          ) : (
            <span className="muted small">Create a deck (Decks tab) to add single cards, or copy the whole deck.</span>
          )}
        </div>
        <ErrorBox error={add.error ?? myDecks.error} />
        <div className="table-scroll">
          <table className="players users cards">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" title="Select all shown" checked={allShownPicked} onChange={(e) => toggle(shown.map((c) => c.id), e.target.checked)} />
                </th>
                <th>Category</th>
                <th>Question</th>
                <th>Answer</th>
                <th>★</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <CardRow key={c.id} card={c} category={catById.get(c.category_id)} picked={picked.has(c.id)} onPick={(on) => toggle([c.id], on)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {deck.generations.length > 0 && (
        <section className="panel saved-generations">
          <h2>Saved generations · {deck.generations.length}</h2>
          <p className="muted small">The settings and instructions its publisher saved for ✨ Generate (copied with the deck).</p>
          <ul className="plain-list">
            {deck.generations.map((g, i) => (
              <li key={i}>
                <strong>{g.name}</strong>
                {g.description && <span className="muted small"> · {g.description}</span>}
                <GenerationSummary generation={g} categories={deck.categories} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function categoriesNote(created: string[], matched: string[]) {
  const parts = [];
  if (created.length) parts.push(`New categories: ${created.join(", ")}.`);
  if (matched.length) parts.push(`Reused your categories: ${matched.join(", ")}.`);
  return parts.length ? " " + parts.join(" ") : "";
}

function CardRow({ card, category, picked, onPick }: { card: Card; category?: { name: string; color: string }; picked: boolean; onPick: (on: boolean) => void }) {
  return (
    <tr className={picked ? "on" : ""} onClick={(e) => (e.target as HTMLElement).tagName !== "INPUT" && onPick(!picked)}>
      <td>
        <input type="checkbox" checked={picked} onChange={(e) => onPick(e.target.checked)} />
      </td>
      <td>
        <span className="dot" style={{ background: category?.color }} /> {category?.name}
      </td>
      <td>
        {card.question}
        {card.grand_prize && <span className="chip">🏆 grand prize</span>}
        {card.options && <div className="muted small">{card.options.join(" · ")}</div>}
      </td>
      <td>{card.answer}</td>
      <td>{"★".repeat(card.difficulty)}</td>
    </tr>
  );
}

// ---------- categories ----------

function CategoriesSection({ orgId, q }: { orgId: number; q: string }) {
  const list = useList(() => api.libraryCategories(q), [q]);
  const mine = useList(() => api.listCategories(orgId), [orgId]);
  const taken = new Set(mine.items.map((c) => c.name.toLowerCase()));
  return (
    <section className="panel content-page">
      <ErrorBox error={list.error} />
      <table className="players users">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>By</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.items.map((c) => (
            <CategoryRow key={c.id} category={c} orgId={orgId} have={taken.has(c.name.toLowerCase())} onCopied={mine.reload} />
          ))}
          {list.loaded && !list.items.length && (
            <tr>
              <td colSpan={4} className="muted">
                No public categories yet. Publish one from the Categories tab.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function CategoryRow({ category, orgId, have, onCopied }: { category: Published<Category>; orgId: number; have: boolean; onCopied: () => Promise<void> }) {
  const action = useAction();
  const navigate = useNavigate();
  return (
    <tr>
      <td>
        <span className="dot" style={{ background: category.color }} /> {category.name}
      </td>
      <td className="muted">{category.description}</td>
      <td className="small">{category.organization_name}</td>
      <td className="actions">
        {have ? (
          <span className="muted small" title="Categories are matched by name (SHR-5): you already have one called this">
            ✓ you have one
          </span>
        ) : (
          <button
            className="small"
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                const c = await api.copyCategory(category.id, { organization_id: orgId });
                await onCopied();
                if (confirm(`Copied “${c.name}”. Open it in Categories?`)) navigate(`/categories/${c.id}`, { state: { orgId } satisfies RouteState });
              })
            }
          >
            Copy
          </button>
        )}
        <ErrorBox error={action.error} />
      </td>
    </tr>
  );
}

// ---------- images ----------

function ImagesSection({ orgId, q }: { orgId: number; q: string }) {
  const list = useList(() => api.libraryImages(q), [q]);
  const mine = useList(() => api.listImages(orgId), [orgId]);
  const have = new Set(mine.items.map((i) => i.key));
  return (
    <section className="panel">
      <ErrorBox error={list.error ?? mine.error} />
      {list.loaded && !list.items.length && <p className="muted small">No public images yet. Publish one from a board's or game's background image library.</p>}
      <p className="muted small">Copied images join your organization's image library, ready to use as board and game backgrounds.</p>
      <ul className="image-grid library-images">
        {list.items.map((img) => (
          <ImageItem key={img.id} img={img} orgId={orgId} have={have.has(img.key)} onCopied={mine.reload} />
        ))}
      </ul>
    </section>
  );
}

function ImageItem({ img, orgId, have, onCopied }: { img: PublicImage; orgId: number; have: boolean; onCopied: () => Promise<void> }) {
  const action = useAction();
  return (
    <li>
      <a className="thumb" href={img.url} target="_blank" rel="noreferrer" title="Open full size">
        <img src={img.url} alt={img.name} loading="lazy" />
      </a>
      <span className="small name" title={img.name}>
        {img.name}
      </span>
      <span className="muted tiny">
        {img.organization_name} · {img.width}×{img.height}
      </span>
      {have ? (
        <span className="muted tiny">✓ In your library</span>
      ) : (
        <button className="tiny" disabled={action.busy} onClick={() => action.run(async () => (await api.copyImage(img.id, { organization_id: orgId }), await onCopied()))}>
          + Add to my library
        </button>
      )}
      <ErrorBox error={action.error} />
    </li>
  );
}
