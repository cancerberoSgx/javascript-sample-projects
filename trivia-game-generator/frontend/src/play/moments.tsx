// The play screen's big moments, shown over the board on every device (rules.md §2.7): the dice,
// the question card, the answer, the wildcard pick and the end of the game.

import { useEffect, useRef, useState } from "react";
import { activePlayer } from "../engine/engine";
import { GRAND_PRIZE, type Action, type GameView } from "../engine/types";
import { useT, type Translator } from "../i18n";
import { winName } from "../i18n/game";
import { play, vibrate } from "./feedback";
import type { PlayEvent } from "./events";
import { Icon } from "./icons";
import { Floating, Layer } from "./layers";

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const GOLD = "#ca8a04";

/** Category name and color of a card (grand prize cards have their own). */
export function cardCategory(t: Translator, game: GameView, id: string) {
  if (id === GRAND_PRIZE) return { name: t("common.grandPrize"), color: GOLD };
  const c = game.board.categories.find((x) => x.id === id);
  return { name: c?.name ?? id, color: c?.color ?? "#64748b" };
}

// ---------- Dice ----------

/** Which cells of a 3x3 grid hold a pip, for faces 1-6. */
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function DieFace({ value, sides }: { value: number; sides: number }) {
  if (sides > 6 || !PIPS[value]) return <span className="die-face number">{value}</span>;
  return (
    <span className="die-face" aria-label={String(value)}>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={PIPS[value].includes(i) ? "pip" : ""} />
      ))}
    </span>
  );
}

/** The die tumbles for a moment, lands on the roll, then gets out of the way (tap to skip). */
export function DiceRoll({ event, sides, mine, onDone }: { event: Extract<PlayEvent, { kind: "roll" }>; sides: number; mine: boolean; onDone: () => void }) {
  const t = useT();
  const [face, setFace] = useState(() => 1 + Math.floor(Math.random() * sides));
  const [landed, setLanded] = useState(reducedMotion());
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const quick = reducedMotion();
    if (!quick) play("roll");
    const spin = quick ? 0 : window.setInterval(() => setFace(1 + Math.floor(Math.random() * sides)), 80);
    const land = window.setTimeout(
      () => {
        clearInterval(spin);
        setLanded(true);
        play("land");
        if (mine) vibrate(25);
      },
      quick ? 0 : 700,
    );
    const close = window.setTimeout(() => done.current(), quick ? 1300 : 1900);
    return () => {
      clearInterval(spin);
      clearTimeout(land);
      clearTimeout(close);
    };
  }, [sides, mine]);

  return (
    <Floating className="dice-overlay" bump={event.key}>
      <button className="dice-stage" onClick={() => done.current()} aria-label={t("moments.rolledAria", { name: event.player.name, value: event.value })}>
        <span className={`die3d ${landed ? "landed" : "rolling"}`} style={{ "--player": event.player.color } as React.CSSProperties}>
          <DieFace value={landed ? event.value : face} sides={sides} />
        </span>
        <span className={`dice-caption ${landed ? "show" : ""}`}>
          {mine ? t.rich("moments.youRolled", { value: event.value }) : t.rich("moments.playerRolled", { name: event.player.name, value: event.value })}
        </span>
      </button>
    </Floating>
  );
}

// ---------- Question ----------

/** Seconds left on the question, on server time (MPL-8), or null without a limit. */
function useCountdown(deadline: number | null, clockOffset: number) {
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now() + clockOffset), 200);
    return () => clearInterval(id);
  }, [deadline, clockOffset]);
  return deadline === null ? null : Math.max(0, (deadline - now) / 1000);
}

function TimerRing({ left, total }: { left: number; total: number }) {
  const t = useT();
  const r = 19;
  const c = 2 * Math.PI * r;
  const secs = Math.ceil(left);
  return (
    <span className={`timer-ring ${secs <= 5 ? "low" : ""}`} role="timer" aria-label={t("moments.secondsLeft", { count: secs })}>
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle cx="22" cy="22" r={r} className="track" />
        <circle cx="22" cy="22" r={r} className="left" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, left / Math.max(1, total)))} />
      </svg>
      <span>{secs}</span>
    </span>
  );
}

/**
 * The question as a card. The active player answers with big buttons (or types); everyone
 * else reads along. "See board" tucks it away; the dock brings it back.
 */
export function QuestionCard({
  game,
  canAct,
  dispatch,
  clockOffset,
  errorSeq,
  onHide,
}: {
  game: GameView;
  canAct: boolean;
  dispatch: (a: Action) => void;
  clockOffset: number;
  /** Changes when the server rejects an action: unlocks the answer buttons. */
  errorSeq: number;
  onHide: () => void;
}) {
  const t = useT();
  const q = game.question!;
  const cat = cardCategory(t, game, q.card.category);
  const left = useCountdown(q.deadline, clockOffset);
  const [sent, setSent] = useState<number | string | null>(null);
  const [text, setText] = useState("");
  const answerer = activePlayer(game);

  useEffect(() => setSent(null), [errorSeq]);
  // The last seconds tick on the answering device
  const secs = left === null ? null : Math.ceil(left);
  useEffect(() => {
    if (canAct && secs !== null && secs > 0 && secs <= 5) play("tick");
  }, [canAct, secs]);

  const answer = (a: number | string) => {
    if (sent !== null) return;
    setSent(a);
    dispatch({ type: "ANSWER", answer: a });
  };

  return (
    <Layer variant="card" className="question-layer" labelledBy="question-text">
      <div className={`qcard ${canAct ? "" : "spectating"}`} style={{ "--cat": cat.color } as React.CSSProperties}>
        <div className="qcard-band">
          <span className="qcard-cat">
            {q.grand_prize && "🏆 "}
            {cat.name}
            {q.from_hq && !q.grand_prize && <span className="badge">{t("moments.winsToken")}</span>}
          </span>
          <span className="stars" aria-label={t("moments.difficulty", { level: q.card.difficulty })}>
            {"★".repeat(q.card.difficulty)}
            <span className="dim">{"★".repeat(3 - q.card.difficulty)}</span>
          </span>
          {left !== null && <TimerRing left={left} total={game.config.answer_time_limit_sec} />}
        </div>
        <p className="qcard-who">
          <span className="dot" style={{ background: answerer.color }} /> {canAct ? t("moments.yourQuestion", { name: answerer.name }) : t("moments.isAnswering", { name: answerer.name })}
        </p>
        <p id="question-text" className="qcard-text">
          {q.card.question}
        </p>
        {q.card.options ? (
          <div className="qcard-options">
            {q.card.options.map((o, i) => (
              <button
                key={i}
                className={`option ${sent === i ? "sent" : ""}`}
                disabled={!canAct || (sent !== null && sent !== i)}
                aria-disabled={!canAct}
                onClick={() => canAct && answer(i)}
              >
                <span className="letter">{String.fromCharCode(65 + i)}</span>
                <span>{o}</span>
              </button>
            ))}
          </div>
        ) : canAct ? (
          <form
            className="qcard-input"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) answer(text);
            }}
          >
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("moments.typeAnswer")}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              aria-label={t("moments.yourAnswer")}
            />
            <button className="primary" type="submit" disabled={!text.trim() || sent !== null}>
              {t("moments.answer")}
            </button>
          </form>
        ) : (
          <p className="muted qcard-wait">{t("moments.waitingTyped")}</p>
        )}
        <div className="qcard-foot">
          <button className="ghost-btn" onClick={onHide}>
            <Icon name="board" size={18} /> {t("moments.seeBoard")}
          </button>
        </div>
      </div>
    </Layer>
  );
}

// ---------- Answer ----------

/** Right or wrong, and the right answer, for a few seconds after every answer (tap to close). */
export function AnswerReveal({ event, game, mine, onDone }: { event: Extract<PlayEvent, { kind: "answer" }>; game: GameView; mine: boolean; onDone: () => void }) {
  const t = useT();
  const { answer, player, points, token } = event;
  const ok = answer.result === "correct";
  const card = answer.card;
  const correctText = card.options ? card.options[card.correct_answer as number] : String(card.correct_answer);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    play(ok ? "correct" : "wrong");
    if (mine) vibrate(ok ? [30, 60, 30] : 120);
    const t = window.setTimeout(() => done.current(), ok ? 3200 : 4200);
    return () => clearTimeout(t);
  }, [ok, mine]);

  return (
    <Layer variant="card" className="reveal-layer" onClose={onDone} labelledBy="reveal-title">
      <div className={`reveal ${answer.result}`} style={{ "--cat": cardCategory(t, game, card.category).color } as React.CSSProperties}>
        <span className="reveal-icon" aria-hidden="true">
          {ok ? "✓" : answer.result === "timeout" ? "⏱" : "✗"}
        </span>
        <h2 id="reveal-title">
          {ok
            ? mine
              ? t("moments.youGotIt")
              : t("moments.playerGotIt", { name: player.name })
            : answer.result === "timeout"
              ? t("moments.timesUp")
              : mine
                ? t("moments.notQuiteYou")
                : t("moments.notQuitePlayer", { name: player.name })}
        </h2>
        {ok && <p className="reveal-points">{t("moments.points", { points })}</p>}
        {token && (
          <p className="reveal-token">
            <span className="token-chip" style={{ background: token.color }} />{" "}
            {mine ? t.rich("moments.youEarnedToken", { category: token.name }) : t.rich("moments.playerEarnedToken", { name: player.name, category: token.name })}
          </p>
        )}
        <p className="reveal-q">{card.question}</p>
        {card.options ? (
          <ol className="reveal-options">
            {card.options.map((o, i) => (
              <li key={i} className={i === card.correct_answer ? "right" : o === answer.given && !ok ? "wrong" : ""}>
                <span className="letter">{String.fromCharCode(65 + i)}</span> {o}
              </li>
            ))}
          </ol>
        ) : (
          <>
            {!ok && answer.result !== "timeout" && (
              <p className="reveal-given">
                {mine ? t("moments.youAnswered", { given: answer.given }) : t("moments.playerAnswered", { name: player.name, given: answer.given })}
              </p>
            )}
            {!ok && (
              <p className="reveal-correct">{t.rich("moments.correctAnswer", { answer: correctText })}</p>
            )}
          </>
        )}
        <button className="primary big-btn reveal-continue" onClick={onDone}>
          {t("moments.continue")}
        </button>
      </div>
    </Layer>
  );
}

// ---------- Wildcard ----------

export function CategoryPicker({ game, dispatch }: { game: GameView; dispatch: (a: Action) => void }) {
  const t = useT();
  const [sent, setSent] = useState(false);
  return (
    <Layer variant="card" title={t("moments.pickCategory")}>
      <div className="category-picker">
        {game.board.categories.map((c) => (
          <button
            key={c.id}
            disabled={sent}
            style={{ background: c.color }}
            onClick={() => {
              setSent(true);
              dispatch({ type: "CHOOSE_CATEGORY", category: c.id });
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </Layer>
  );
}

// ---------- Game over ----------

/** 1, 2, 3…, with "=" for players tied on score and tokens. */
function rankLabel(ranked: GameView["players"], i: number) {
  const same = (a: GameView["players"][number], b: GameView["players"][number]) => a.score === b.score && a.inventory.length === b.inventory.length;
  let first = i;
  while (first > 0 && same(ranked[first - 1], ranked[i])) first--;
  const tied = first !== i || (i + 1 < ranked.length && same(ranked[i + 1], ranked[i]));
  return `${first + 1}${tied ? "=" : ""}`;
}

export function GameOver({ game, endedByHost, you, onClose }: { game: GameView; endedByHost: boolean; you: string | null; onClose: () => void }) {
  const t = useT();
  const r = game.result;
  const winner = r?.type === "win" ? game.players.find((p) => p.id === r.player_id) : null;
  const ranked = [...game.players].filter((p) => !p.removed).sort((a, b) => b.score - a.score || b.inventory.length - a.inventory.length);
  useEffect(() => {
    if (winner) play("win");
  }, [winner]);

  return (
    <Layer variant="card" className="over-layer" onClose={onClose} labelledBy="over-title">
      <div className="game-over">
        <span className="trophy" aria-hidden="true">
          {winner ? "🏆" : endedByHost ? "🏁" : "🤝"}
        </span>
        <h2 id="over-title">
          {winner
            ? winner.id === you
              ? t("moments.youWin")
              : t("moments.playerWins", { name: winner.name })
            : endedByHost
              ? t("moments.hostEnded")
              : t("moments.itsADraw")}
        </h2>
        {r?.type === "win" && <p className="muted">{winName(t, r.reason)}</p>}
        <ol className="standings">
          {ranked.map((p, i) => (
            <li key={p.id} className={p.id === winner?.id ? "winner" : ""}>
              <span className="rank">{rankLabel(ranked, i)}</span>
              <span className="dot" style={{ background: p.color }} />
              <span className="name">
                {p.name}
                {p.id === you && <span className="chip you">{t("common.you")}</span>}
              </span>
              <span className="tokens">
                {game.board.categories.map((c) => (
                  <span
                    key={c.id}
                    title={c.name}
                    className="token"
                    style={p.inventory.includes(c.id) ? { background: c.color, borderColor: c.color } : { borderColor: c.color }}
                  />
                ))}
              </span>
              <span className="score">{p.score}</span>
            </li>
          ))}
        </ol>
        <button className="primary big-btn" onClick={onClose}>
          {t("moments.seeTheBoard")}
        </button>
      </div>
    </Layer>
  );
}
