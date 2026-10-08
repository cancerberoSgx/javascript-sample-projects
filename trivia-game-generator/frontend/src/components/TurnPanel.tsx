import { useEffect, useState } from "react";
import { activePlayer } from "../engine/engine";
import type { Action, GameView } from "../engine/types";
import { useT } from "../i18n";
import { categoryLabel, resultName, winName } from "../i18n/game";

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
  const t = useT();
  const [rigged, setRigged] = useState<string>("random");
  const p = activePlayer(game);

  const rolled = (value: number | null) => t.rich("table.rolled", { value: value ?? 0, die: (chunks) => <span className="die">{chunks}</span> });

  if (game.phase === "GAME_OVER") {
    const r = game.result!;
    const winner = r.type === "win" ? game.players.find((x) => x.id === r.player_id)! : null;
    return (
      <section className="panel turn">
        <h2>{t("common.gameOver")}</h2>
        <p className="big">{winner && r.type === "win" ? t("table.wins", { name: winner.name, reason: winName(t, r.reason) }) : t("common.draw")}</p>
      </section>
    );
  }

  return (
    <section className="panel turn">
      <div className="turn-head">
        <span className="dot" style={{ background: p.color }} />
        <strong>{p.name}</strong>
        <span className="muted">{t("table.roundRoll", { round: game.round, rolls: game.rolls_this_turn, max: game.config.max_rolls_per_turn })}</span>
      </div>

      {!canAct && game.phase !== "AWAIT_ANSWER" && (
        <p className="muted">
          {t("table.waitingFor", { name: p.name, phase: game.phase })}
          {game.phase === "AWAIT_MOVE" && <> {rolled(game.last_roll)}</>}
        </p>
      )}

      {canAct && game.phase === "AWAIT_ROLL" && (
        <div className="row">
          <button className="primary" onClick={() => dispatch({ type: "ROLL", value: rigged === "random" ? undefined : Number(rigged) })}>
            {t("table.roll")} {rigged !== "random" && `(${rigged})`}
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
          <p className="big">{rolled(game.last_roll)}</p>
          <p>
            {t("table.clickToMove")} {Object.keys(game.destinations).length > 1 && <strong>{t("table.fork")}</strong>}
          </p>
          <p className="muted small">{t("table.legal", { spaces: Object.keys(game.destinations).join(", ") })}</p>
        </div>
      )}

      {canAct && game.phase === "AWAIT_CATEGORY" && (
        <div>
          <p>{t("table.pickCategory")}</p>
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
          {t.rich("table.lastAnswer", { result: resultName(t, game.last_answer.result) })}
          {game.last_answer.result !== "correct" &&
            t("table.correctWas", {
              answer: String(
                game.last_answer.card.options
                  ? game.last_answer.card.options[game.last_answer.card.correct_answer as number]
                  : game.last_answer.card.correct_answer,
              ),
            })}
        </p>
      )}
    </section>
  );
}

function Question({ game, dispatch, canAct, dev, clockOffset }: Props & Required<TurnOptions>) {
  const t = useT();
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
          {q.grand_prize ? `🏆 ${t("common.grandPrize")}` : categoryLabel(t, game, q.card.category)}
          {q.from_hq && t("table.hqSuffix")} · {"★".repeat(q.card.difficulty)}
        </span>
        {remaining !== null && <span className={`timer ${remaining <= 5 ? "low" : ""}`}>{t("table.seconds", { count: remaining })}</span>}
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
          <p className="muted small">{t("table.waitingAnswer", { name: activePlayer(game).name })}</p>
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
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t("moments.typeAnswer")} />
          <button className="primary" type="submit">
            {t("moments.answer")}
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
