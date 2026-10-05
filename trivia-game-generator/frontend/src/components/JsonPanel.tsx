import { useState } from "react";
import { resolveConfig } from "../engine/board";
import type { LoadedBoard } from "../engine/loader";
import { GRAND_PRIZE } from "../engine/types";

/** Shows how the board is serialized: the raw file, the effective config, and a deck summary. */
export function JsonPanel({ loaded, file }: { loaded: LoadedBoard; file: string }) {
  const [tab, setTab] = useState<"board" | "config" | "deck">("board");
  const { board, deck } = loaded;

  const deckSummary = deck
    ? [...board.categories.map((c) => c.id), GRAND_PRIZE].map((id) => ({
        id,
        mc: deck.cards.filter((c) => c.category === id && c.options).length,
        open: deck.cards.filter((c) => c.category === id && !c.options).length,
      }))
    : [];

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
        <code className="muted small">{tab === "deck" ? board.deck : file}</code>
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
      {tab === "deck" &&
        (deck ? (
          <>
            <p className="muted small">
              {deck.name}: {deck.cards.length} cards
            </p>
            <table className="players">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Multiple choice</th>
                  <th>Open-ended</th>
                </tr>
              </thead>
              <tbody>
                {deckSummary.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.mc}</td>
                    <td>{r.open}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <pre>{JSON.stringify(deck.cards.slice(0, 2), null, 2)}{"\n…"}</pre>
          </>
        ) : (
          <p>Deck could not be loaded.</p>
        ))}
    </section>
  );
}
