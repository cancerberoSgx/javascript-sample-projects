import { useState } from "react";
import { resolveConfig } from "../engine/board";
import type { LoadedBoard } from "../engine/loader";

/** Shows how the board is serialized: the raw file, the effective config, and the deck it's played with. */
export function JsonPanel({ loaded, file }: { loaded: LoadedBoard; file: string }) {
  const [tab, setTab] = useState<"board" | "config" | "deck">("board");
  const { file: board, deckFile: deck, mapping } = loaded;

  const rows = deck.categories.map((c) => ({
    ...c,
    slot: Object.entries(mapping).find(([, m]) => m.id === c.id)?.[0] ?? "–",
    mc: deck.cards.filter((x) => x.category === c.id && x.options && !x.grand_prize).length,
    open: deck.cards.filter((x) => x.category === c.id && !x.options && !x.grand_prize).length,
    gp: deck.cards.filter((x) => x.category === c.id && x.grand_prize).length,
  }));

  return (
    <section className="panel json">
      <div className="row between">
        <div className="tabs">
          <button className={tab === "board" ? "on" : ""} onClick={() => setTab("board")}>
            Board file
          </button>
          <button className={tab === "config" ? "on" : ""} onClick={() => setTab("config")}>
            Effective config
          </button>
          <button className={tab === "deck" ? "on" : ""} onClick={() => setTab("deck")}>
            Deck
          </button>
        </div>
        <code className="muted small">{tab === "deck" ? "decks/general.json" : file}</code>
      </div>

      {tab === "board" && <pre>{loaded.rawJson}</pre>}
      {tab === "config" && (
        <>
          <p className="muted small">
            The board file's <code>config</code> merged over the defaults from rules.md §1. This is what the engine uses.
          </p>
          <pre>{JSON.stringify(resolveConfig(board), null, 2)}</pre>
        </>
      )}
      {tab === "deck" && (
        <>
          <p className="muted small">
            {deck.name}: {deck.cards.length} cards. The demo plays each board slot with the deck's categories in order. In the app, a
            game picks the category for each slot.
          </p>
          <table className="players">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Category</th>
                <th>Multiple choice</th>
                <th>Open-ended</th>
                <th>Grand prize</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.slot}</td>
                  <td>{r.name}</td>
                  <td>{r.mc}</td>
                  <td>{r.open}</td>
                  <td>{r.gp}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <pre>
            {JSON.stringify(deck.cards.slice(0, 2), null, 2)}
            {"\n…"}
          </pre>
        </>
      )}
    </section>
  );
}
