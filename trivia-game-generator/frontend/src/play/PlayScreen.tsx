// The player's game screen (/games/:id?code=…, rules.md §2.7) once the game has started: the
// board fills the screen and pans/zooms with touch gestures; everything else floats over it.
// Players, log, legend and board info open as sheets; dice, questions, answers and the end of
// the game show up as cards on every device. Admin pages keep LiveTable (LiveGame.tsx).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import type { LiveMessage } from "../api";
import { useAuth } from "../auth";
import { activePlayer } from "../engine/engine";
import { LanguagePicker, useT, type MessageKey } from "../i18n";
import { joinList, logText, spaceName, winName } from "../i18n/game";
import type { GameView, Space } from "../engine/types";
import { BoardCanvas } from "../components/BoardCanvas";
import type { Insets } from "../components/camera";
import { canActNow, type LiveGame } from "../components/LiveGame";
import { LogList, PlayersTable } from "../components/PlayersPanel";
import { Legend, useGamePlay } from "../components/PlayTable";
import type { CameraCommand } from "../components/useBoardCamera";
import { diffEvents, type PlayEvent } from "./events";
import { play, useFullscreen, useSound, useWakeLock, vibrate } from "./feedback";
import { Icon, type IconName } from "./icons";
import { Floating, Layer } from "./layers";
import { AnswerReveal, CategoryPicker, DiceRoll, GameOver, QuestionCard, cardCategory } from "./moments";

type SheetName = "players" | "log" | "legend" | "info";
const SHEETS: [SheetName, IconName, MessageKey][] = [
  ["players", "players", "play.nav.players"],
  ["log", "log", "play.nav.log"],
  ["legend", "legend", "play.nav.legend"],
  ["info", "info", "play.nav.board"],
];

const TYPE_COLORS: Partial<Record<Space["type"], string>> = {
  start: "var(--space-start)",
  finish: "var(--space-finish)",
  roll_again: "var(--space-roll)",
  penalty: "var(--space-penalty)",
  wildcard: "var(--space-wild)",
};

export function PlayScreen({ live }: { live: LiveGame }) {
  const t = useT();
  const msg = live.msg!;
  const state = msg.state!;
  const finished = msg.game.status === "finished";
  const endedByHost = finished && state.phase !== "GAME_OVER";
  const canAct = canActNow(msg, state);
  const you = msg.you.player_id === null ? null : String(msg.you.player_id);
  const { dispatch, showToast, toastMessage } = useGamePlay(state, live.send, canAct);
  const [errorSeq, setErrorSeq] = useState(0);
  useEffect(
    () =>
      live.onError((m) => {
        showToast(m);
        setErrorSeq((n) => n + 1);
      }),
    [live, showToast],
  );

  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [roll, setRoll] = useState<Extract<PlayEvent, { kind: "roll" }> | null>(null);
  const [reveal, setReveal] = useState<Extract<PlayEvent, { kind: "answer" }> | null>(null);
  const [yourTurn, setYourTurn] = useState<string | null>(null);
  const [showOver, setShowOver] = useState(finished);
  const [hiddenQuestion, setHiddenQuestion] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [sound, setSound] = useSound();
  const fullscreen = useFullscreen();
  useWakeLock(!finished);

  // ---- Camera ----
  const seq = useRef(0);
  const [command, setCommand] = useState<CameraCommand | null>(null);
  const camera = useCallback((c: Omit<CameraCommand, "seq">) => setCommand({ ...c, seq: ++seq.current }), []);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const insets = useInsets(topRef, bottomRef);
  const viewport = useMemo(() => ({ insets, command }), [insets, command]);

  // ---- What just happened (the server sends states; events are their differences) ----
  const prev = useRef<GameView | null>(null);
  const prevStatus = useRef(msg.game.status);
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    for (const e of diffEvents(before, state)) {
      if (e.kind === "roll") {
        setRoll(e);
        const from = e.player.current_space;
        camera({ kind: "focus", spaces: [from, ...Object.keys(state.destinations).map(Number)], force: canAct });
      } else if (e.kind === "answer") setReveal(e);
      else if (e.kind === "over") setShowOver(true);
      else if (e.kind === "turn" && canAct) {
        setYourTurn(e.key);
        vibrate([60, 50, 60]);
        play("turn");
        camera({ kind: "focus", spaces: [e.player.current_space] });
      }
    }
    if (before && state.last_move && state.last_move.seq !== before.last_move?.seq) camera({ kind: "focus", spaces: state.last_move.path });
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prevStatus.current !== "finished" && finished) setShowOver(true);
    prevStatus.current = msg.game.status;
  }, [finished, msg.game.status]);

  // "Your turn!" waits for the dice and the answer card to go away
  const showYourTurn = !!yourTurn && !roll && !reveal;
  useEffect(() => {
    if (!showYourTurn) return;
    const t = window.setTimeout(() => setYourTurn(null), 2600);
    return () => clearTimeout(t);
  }, [showYourTurn]);

  // The tab title says when it's your turn (useful when the tab is in the background)
  useEffect(() => {
    const old = document.title;
    document.title = canAct ? t("play.tabYourTurn") : t("common.appName");
    return () => {
      document.title = old;
    };
  }, [canAct, t]);

  // ---- Moves ----
  const onSpaceClick = (index: number) => {
    if (!canAct || state.phase !== "AWAIT_MOVE") return;
    if (index in state.destinations) dispatch({ type: "MOVE", to: index });
    else showToast(t("play.tapGlowing"));
  };

  const questionKey = state.question ? `${state.question.card.id}-${state.log.length}` : null;
  const questionOpen = state.phase === "AWAIT_ANSWER" && !!state.question && hiddenQuestion !== questionKey && !endedByHost;
  const picking = canAct && state.phase === "AWAIT_CATEGORY";
  const active = state.phase === "GAME_OVER" ? null : activePlayer(state);

  return (
    <div className="play-screen" style={{ "--top-h": `${insets.top}px`, "--bottom-h": `${insets.bottom}px` } as React.CSSProperties}>
      <BoardCanvas
        board={state.board}
        background={msg.game.background}
        game={state}
        onSpaceClick={onSpaceClick}
        onHover={() => {}}
        viewport={viewport}
        highlight={highlight}
      />

      <div className="play-top" ref={topRef}>
        <div className="play-top-row">
          <Identity msg={msg} />
          <span className="spacer" />
          <button
            className="icon-btn"
            onClick={() => setSound(!sound)}
            aria-label={sound ? t("play.soundOff") : t("play.soundOn")}
            aria-pressed={sound}
            title={sound ? t("play.soundIsOn") : t("play.soundIsOff")}
          >
            <Icon name={sound ? "soundOn" : "soundOff"} />
          </button>
          {fullscreen.supported && (
            <button className="icon-btn" onClick={fullscreen.toggle} aria-label={fullscreen.on ? t("play.exitFullscreen") : t("play.fullscreen")} aria-pressed={fullscreen.on}>
              <Icon name={fullscreen.on ? "shrink" : "expand"} />
            </button>
          )}
        </div>
        <TurnPill state={state} canAct={canAct} finished={finished} endedByHost={endedByHost} rolling={!!roll} />
      </div>

      <div className="play-zoom" role="group" aria-label={t("play.boardView")}>
        <button className="icon-btn zoom-step" onClick={() => camera({ kind: "zoomIn" })} aria-label={t("play.zoomIn")}>
          <Icon name="plus" />
        </button>
        <button className="icon-btn zoom-step" onClick={() => camera({ kind: "zoomOut" })} aria-label={t("play.zoomOut")}>
          <Icon name="minus" />
        </button>
        <button className="icon-btn" onClick={() => camera({ kind: "fit" })} aria-label={t("play.fit")}>
          <Icon name="fit" />
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            const me = state.players.find((p) => p.id === you) ?? active;
            if (me) camera({ kind: "focus", spaces: [me.current_space], force: true });
          }}
          aria-label={you ? t("play.findMe") : t("play.findActive")}
        >
          <Icon name="locate" />
        </button>
      </div>

      <div className="play-bottom" ref={bottomRef}>
        <Dock
          state={state}
          canAct={canAct}
          finished={finished}
          rolling={!!roll}
          questionHidden={state.phase === "AWAIT_ANSWER" && !!state.question && !questionOpen && !endedByHost}
          onShowQuestion={() => setHiddenQuestion(null)}
          onShowResults={() => setShowOver(true)}
          dispatch={dispatch}
          errorSeq={errorSeq}
          setHighlight={setHighlight}
        />
        <nav className="play-nav" aria-label={t("play.nav.label")}>
          {SHEETS.map(([name, icon, label]) => (
            <button key={name} className="nav-btn" onClick={() => setSheet(name)} aria-haspopup="dialog">
              <Icon name={icon} />
              <span>{t(label)}</span>
            </button>
          ))}
        </nav>
      </div>

      {sheet === "players" && (
        <Layer
          title={
            state.config.max_rounds
              ? t("play.playersTitleMax", { round: state.round, max: state.config.max_rounds })
              : t("play.playersTitle", { round: state.round })
          }
          onClose={() => setSheet(null)}
        >
          <PlayersSheet msg={msg} state={state} you={you} />
        </Layer>
      )}
      {sheet === "log" && (
        <Layer title={t("play.logTitle")} onClose={() => setSheet(null)} className="log-sheet">
          <LogList game={state} />
        </Layer>
      )}
      {sheet === "legend" && (
        <Layer title={t("play.legendTitle")} onClose={() => setSheet(null)}>
          <LegendSheet state={state} />
        </Layer>
      )}
      {sheet === "info" && (
        <Layer title={state.board.name} onClose={() => setSheet(null)}>
          <InfoSheet msg={msg} state={state} />
        </Layer>
      )}

      {picking && <CategoryPicker key={state.log.length} game={state} dispatch={dispatch} />}
      {questionOpen && (
        <QuestionCard
          key={questionKey}
          game={state}
          canAct={canAct}
          dispatch={dispatch}
          clockOffset={live.clockOffset}
          errorSeq={errorSeq}
          onHide={() => setHiddenQuestion(questionKey)}
        />
      )}
      {reveal && <AnswerReveal key={reveal.key} event={reveal} game={state} mine={reveal.player.id === you} onDone={() => setReveal(null)} />}
      {showOver && !reveal && <GameOver game={state} endedByHost={endedByHost} you={you} onClose={() => setShowOver(false)} />}
      {roll && <DiceRoll key={roll.key} event={roll} sides={state.config.dice_sides} mine={canAct} onDone={() => setRoll(null)} />}

      {showYourTurn && (
        <Floating className="your-turn" bump={yourTurn}>
          {t("play.yourTurn")}
        </Floating>
      )}
      {!live.connected && (
        <Floating className="offline" role="alert">
          <span className="spinner" aria-hidden="true" /> {t("common.reconnecting")}
        </Floating>
      )}
      {toastMessage && (
        <Floating className="play-toast" bump={toastMessage}>
          {toastMessage}
        </Floating>
      )}
    </div>
  );
}

/** Measures the floating bars so fitting the board keeps it clear of them. */
function useInsets(top: React.RefObject<HTMLDivElement | null>, bottom: React.RefObject<HTMLDivElement | null>): Insets {
  const [m, setM] = useState({ top: 0, bottom: 0, left: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      // On short screens the sheet buttons are a column on the left (play.css)
      const nav = bottom.current?.querySelector(".play-nav")?.getBoundingClientRect();
      const side = nav && nav.height > nav.width ? nav.right : 0;
      setM({ top: top.current?.offsetHeight ?? 0, bottom: bottom.current?.offsetHeight ?? 0, left: side });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (top.current) ro.observe(top.current);
    if (bottom.current) ro.observe(bottom.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [top, bottom]);
  // The zoom buttons sit on the right edge
  return useMemo(() => ({ top: m.top + 8, bottom: m.bottom + 8, left: m.left + 10, right: 58 }), [m.top, m.bottom, m.left]);
}

/** Who this device is: a player, the host or a spectator. */
function Identity({ msg }: { msg: LiveMessage }) {
  const t = useT();
  const me = msg.game.players.find((p) => p.id === msg.you.player_id);
  const color = me && msg.state?.players.find((p) => p.id === String(me.id))?.color;
  return (
    <span className="pill identity">
      {me ? (
        <>
          <span className="dot" style={{ background: color ?? "var(--muted)" }} />
          <strong>{me.name}</strong>
        </>
      ) : (
        <strong>{msg.you.can_host ? t("common.host") : t("common.watching")}</strong>
      )}
      <span className={`status status-${msg.game.status}`}>{t(`play.status.${msg.game.status}`)}</span>
    </span>
  );
}

/** Whose turn it is and the latest thing that happened. */
function TurnPill({
  state,
  canAct,
  finished,
  endedByHost,
  rolling,
}: {
  state: GameView;
  canAct: boolean;
  finished: boolean;
  endedByHost: boolean;
  /** The dice are still tumbling: don't give the roll away yet. */
  rolling: boolean;
}) {
  const t = useT();
  const last = rolling ? state.log[state.log.length - 2] : state.log[state.log.length - 1];
  const phase = rolling ? "AWAIT_ROLL" : state.phase;
  const lastPlayer = last && state.players.find((p) => p.id === last.player_id);
  let head: React.ReactNode;
  if (state.phase === "GAME_OVER" || endedByHost) {
    const r = state.result;
    const winner = r?.type === "win" ? state.players.find((p) => p.id === r.player_id) : null;
    head = <strong>{winner ? t("play.pill.wins", { name: winner.name }) : endedByHost ? t("play.pill.ended") : t("play.pill.draw")}</strong>;
  } else {
    const p = activePlayer(state);
    head = (
      <>
        <span className="dot" style={{ background: p.color }} />
        {canAct ? <strong>{t("play.pill.mine", { phase })}</strong> : <span>{t.rich("play.pill.other", { name: p.name, phase })}</span>}
        <span className="round">{t("play.roundShort", { round: state.round })}</span>
      </>
    );
  }
  return (
    <div className={`pill turn-pill ${canAct && !finished ? "mine" : ""}`} aria-live="polite">
      <div className="turn-line">{head}</div>
      {last && (
        <div className="ticker" key={state.log.length}>
          {lastPlayer && <strong style={{ color: lastPlayer.color }}>{lastPlayer.name} </strong>}
          {logText(t, state, last)}
        </div>
      )}
    </div>
  );
}

/** The primary action for this device, above the sheet buttons: roll, pick a move, reopen the question. */
function Dock({
  state,
  canAct,
  finished,
  rolling,
  questionHidden,
  onShowQuestion,
  onShowResults,
  dispatch,
  errorSeq,
  setHighlight,
}: {
  state: GameView;
  canAct: boolean;
  finished: boolean;
  /** The dice are still tumbling: the move buttons wait for them to land. */
  rolling: boolean;
  questionHidden: boolean;
  onShowQuestion: () => void;
  onShowResults: () => void;
  dispatch: ReturnType<typeof useGamePlay>["dispatch"];
  /** Changes when the server rejects an action: the buttons work again. */
  errorSeq: number;
  setHighlight: (i: number | null) => void;
}) {
  const t = useT();
  const [sent, setSent] = useState<string | null>(null);
  // One tap per state: a second tap before the server answers would be rejected anyway
  const stateKey = `${state.log.length}-${state.phase}`;
  const once = (fn: () => void) => () => {
    if (sent === stateKey) return;
    setSent(stateKey);
    fn();
  };
  useEffect(() => setHighlight(null), [stateKey, setHighlight]);
  useEffect(() => setSent(null), [errorSeq]);

  if (finished)
    return (
      <div className="dock">
        <button className="dock-btn" onClick={onShowResults}>
          {t("play.finalResults")}
        </button>
      </div>
    );
  if (questionHidden)
    return (
      <div className="dock">
        <button className="dock-btn primary" onClick={onShowQuestion}>
          {t("play.backToQuestion")}
        </button>
      </div>
    );
  if (!canAct || rolling) return null;
  if (state.phase === "AWAIT_ROLL")
    return (
      <div className="dock">
        <button className="roll-btn" disabled={sent === stateKey} onClick={once(() => dispatch({ type: "ROLL" }))}>
          <span className="roll-die" aria-hidden="true">
            🎲
          </span>
          {state.rolls_this_turn > 0 ? t("play.rollAgain") : t("play.rollDice")}
        </button>
      </div>
    );
  if (state.phase === "AWAIT_MOVE") {
    const dests = Object.keys(state.destinations)
      .map(Number)
      .sort((a, b) => a - b);
    return (
      <div className="dock move-dock">
        <p className="dock-hint">{t.rich("play.moveHint", { value: state.last_roll ?? 0, count: dests.length })}</p>
        <div className="move-strip" onPointerLeave={() => setHighlight(null)}>
          {dests.map((i) => {
            const s = state.board.spaces.find((x) => x.index === i)!;
            const cat = s.category ? cardCategory(t, state, s.category) : null;
            return (
              <button
                key={i}
                className="move-btn"
                disabled={sent === stateKey}
                onPointerEnter={() => setHighlight(i)}
                onFocus={() => setHighlight(i)}
                onBlur={() => setHighlight(null)}
                onClick={once(() => dispatch({ type: "MOVE", to: i }))}
              >
                <span className="swatch" style={{ background: cat?.color ?? TYPE_COLORS[s.type] ?? "var(--muted)" }} />
                <span className="move-label">
                  {s.type === "hq" && "★ "}
                  {cat?.name ?? spaceName(t, s.type)}
                </span>
                <span className="move-index">{t("play.spaceNumber", { index: i })}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

function PlayersSheet({ msg, state, you }: { msg: LiveMessage; state: GameView; you: string | null }) {
  const t = useT();
  const online = Object.fromEntries(msg.game.players.map((p) => [String(p.id), p.online || !p.joined]));
  return (
    <>
      <PlayersTable game={state} online={online} you={you} />
      <p className="muted small">{t("play.scoreHelp")}</p>
    </>
  );
}

function LegendSheet({ state }: { state: GameView }) {
  const t = useT();
  return (
    <div className="legend-sheet">
      <Legend board={state.board} />
      <ul className="legend-notes">
        <li>{t.rich("play.legend.hq")}</li>
        <li>{t.rich("play.legend.fork")}</li>
        <li>{t("play.legend.glow")}</li>
        <li>{t("play.legend.gestures")}</li>
      </ul>
    </div>
  );
}

function InfoSheet({ msg, state }: { msg: LiveMessage; state: GameView }) {
  const { user } = useAuth();
  const t = useT();
  const config = state.config;
  return (
    <dl className="info-list">
      <dt>{t("play.info.game")}</dt>
      <dd>{msg.game.name}</dd>
      <dt>{t("play.info.track")}</dt>
      <dd>{config.track_type === "loop" ? t("play.info.loop") : t("play.info.linear")}</dd>
      <dt>{t("play.info.toWin")}</dt>
      <dd>
        {joinList(
          t,
          config.win_conditions.map((w) => winName(t, w)),
          "disjunction",
        )}
      </dd>
      <dt>{t("play.info.dice")}</dt>
      <dd>{t("play.info.diceRules", { sides: config.dice_sides, max: config.max_rolls_per_turn, bonus: config.bonus_roll_on_correct ? "yes" : "no" })}</dd>
      <dt>{t("play.info.answerTime")}</dt>
      <dd>{config.answer_time_limit_sec ? t("play.info.seconds", { count: config.answer_time_limit_sec }) : t("play.info.noLimit")}</dd>
      {config.max_rounds && (
        <>
          <dt>{t("play.info.rounds")}</dt>
          <dd>{config.max_rounds}</dd>
        </>
      )}
      <dt>{t("play.info.players")}</dt>
      <dd>{state.players.filter((p) => !p.removed).length}</dd>
      <dt>{t("common.language")}</dt>
      <dd>
        <LanguagePicker label={false} />
      </dd>
      {user && (
        <>
          <dt>{t("play.info.admin")}</dt>
          <dd>
            <Link to={`/games/${msg.game.id}`}>{t("play.info.openAdmin")}</Link>
          </dd>
        </>
      )}
    </dl>
  );
}
