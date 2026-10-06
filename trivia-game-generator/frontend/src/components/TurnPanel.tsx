import { useEffect, useState } from "react";
import { activePlayer, categoryName } from "../engine/engine";
import type { Action, GameView } from "../engine/types";

export interface TurnOptions {
  /** This screen may act for the active player. Otherwise it only shows what they do. */
  canAct?: boolean;
  /** Dev tools: rigged dice and forced answers (Boards demo only, not multiplayer: MPL-7). */
  dev?: boolean;
  /** Server time minus local time, for question timers in multiplayer. */
  clockOffset?: number;
}

interface Props extends TurnOptions {
  game: GameView;
  dispatch: (action: Action) => void;
}

export function TurnPanel({ game, dispatch, canAct = true, dev = true, clockOffset = 0 }: Props) {
  const [rigged, setRigged] = useState<string>("random");
  const p = activePlayer(game);

  if (game.phase === "GAME_OVER") {
    const r = game.result!;
    const winner = r.type === "win" ? game.players.find((x) => x.id === r.player_id)! : null;
    return (
      <section className="panel turn">
        <h2>Game over</h2>
        <p className="big">{winner ? `🏆 ${winner.name} wins (${r.type === "win" ? r.reason : ""})` : "It's a draw."}</p>
      </section>
    );
  }

  return (
    <section className="panel turn">
      <div className="turn-head">
        <span className="dot" style={{ background: p.color }} />
        <strong>{p.name}</strong>
        <span className="muted">
          · round {game.round} · roll {game.rolls_this_turn}/{game.config.max_rolls_per_turn}
        </span>
      </div>

      {!canAct && game.phase !== "AWAIT_ANSWER" && (
        <p className="muted">
          Waiting for {p.name} to {game.phase === "AWAIT_ROLL" ? "roll" : game.phase === "AWAIT_MOVE" ? "move" : "pick a category"}…
          {game.phase === "AWAIT_MOVE" && <> Rolled <span className="die">{game.last_roll}</span></>}
        </p>
      )}

      {canAct && game.phase === "AWAIT_ROLL" && (
        <div className="row">
          <button className="primary" onClick={() => dispatch({ type: "ROLL", value: rigged === "random" ? undefined : Number(rigged) })}>
            🎲 Roll {rigged !== "random" && `(${rigged})`}
          </button>
          {dev && (
          <label className="muted small">
            Dice:{" "}
            <select value={rigged} onChange={(e) => setRigged(e.target.value)} title="Pick a fixed value to test specific moves">
              <option value="random">random</option>
              {Array.from({ length: game.config.dice_sides }, (_, i) => (
                <option key={i} value={i + 1}>
                  rig {i + 1}
                </option>
              ))}
            </select>
          </label>
          )}
        </div>
      )}

      {canAct && game.phase === "AWAIT_MOVE" && (
        <div>
          <p className="big">
            Rolled <span className="die">{game.last_roll}</span>
          </p>
          <p>
            Click a highlighted space to move.{" "}
            {Object.keys(game.destinations).length > 1 && <strong>A fork is in reach: pick your branch.</strong>}
          </p>
          <p className="muted small">Legal: {Object.keys(game.destinations).join(", ")}</p>
        </div>
      )}

      {canAct && game.phase === "AWAIT_CATEGORY" && (
        <div>
          <p>Wildcard: pick a category.</p>
          <div className="row wrap">
            {game.board.categories.map((c) => (
              <button key={c.id} style={{ background: c.color, color: "#fff" }} onClick={() => dispatch({ type: "CHOOSE_CATEGORY", category: c.id })}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {game.phase === "AWAIT_ANSWER" && (
        <Question key={game.question!.card.id + game.log.length} game={game} dispatch={dispatch} canAct={canAct} dev={dev} clockOffset={clockOffset} />
      )}

      {game.last_answer && game.phase !== "AWAIT_ANSWER" && (
        <p className={`small result ${game.last_answer.result}`}>
          Last answer: <strong>{game.last_answer.result}</strong>
          {game.last_answer.result !== "correct" && (
            <>
              {" "}
              · correct was “
              {game.last_answer.card.options
                ? game.last_answer.card.options[game.last_answer.card.correct_answer as number]
                : game.last_answer.card.correct_answer}
              ”
            </>
          )}
        </p>
      )}
    </section>
  );
}

function Question({ game, dispatch, canAct, dev, clockOffset }: Props & Required<TurnOptions>) {
  const q = game.question!;
  const [text, setText] = useState("");
  const [now, setNow] = useState(Date.now() + clockOffset);

  useEffect(() => {
    if (q.deadline === null) return;
    const id = setInterval(() => setNow(Date.now() + clockOffset), 200);
    return () => clearInterval(id);
  }, [q.deadline, clockOffset]);

  const remaining = q.deadline === null ? null : Math.max(0, Math.ceil((q.deadline - now) / 1000));
  // Locally the screen runs the timer; in multiplayer the server does (MPL-8)
  useEffect(() => {
    if (dev && q.deadline !== null && now >= q.deadline) dispatch({ type: "TIMEOUT" });
  }, [dev, now, q.deadline, dispatch]);

  return (
    <div className="question">
      <div className="row between">
        <span className="chip">
          {q.grand_prize ? "🏆 Grand Prize" : categoryName(game, q.card.category)}
          {q.from_hq && " · HQ"} · {"★".repeat(q.card.difficulty)}
        </span>
        {remaining !== null && <span className={`timer ${remaining <= 5 ? "low" : ""}`}>{remaining}s</span>}
      </div>
      <p className="big">{q.card.question}</p>
      {!canAct ? (
        <>
          {q.card.options && (
            <ol className="options-view" type="A">
              {q.card.options.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ol>
          )}
          <p className="muted small">Waiting for {activePlayer(game).name} to answer…</p>
        </>
      ) : q.card.options ? (
        <div className="options">
          {q.card.options.map((o, i) => (
            <button key={i} onClick={() => dispatch({ type: "ANSWER", answer: i })}>
              {String.fromCharCode(65 + i)}. {o}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) dispatch({ type: "ANSWER", answer: text });
          }}
        >
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your answer" />
          <button className="primary" type="submit">
            Answer
          </button>
        </form>
      )}
      {canAct && dev && (
      <div className="row dev">
        <span className="muted small">Dev:</span>
        <button className="small" onClick={() => dispatch({ type: "FORCE_RESULT", correct: true })}>
          force ✓
        </button>
        <button className="small" onClick={() => dispatch({ type: "FORCE_RESULT", correct: false })}>
          force ✗
        </button>
      </div>
      )}
    </div>
  );
}
