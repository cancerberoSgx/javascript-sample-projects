// The player's game screen (/games/:id?code=…, rules.md §2.7) once the game has started: the
// board fills the screen and pans/zooms with touch gestures; everything else floats over it.
// Players, log, legend and board info open as sheets; dice, questions, answers and the end of
// the game show up as cards on every device. Admin pages keep LiveTable (LiveGame.tsx).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import type { LiveMessage } from "../api";
import { useAuth } from "../auth";
import { SPACE_TYPE_NAMES, WIN_CONDITION_NAMES } from "../engine/board";
import { activePlayer } from "../engine/engine";
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
const SHEETS: [SheetName, IconName, string][] = [
  ["players", "players", "Players"],
  ["log", "log", "Log"],
  ["legend", "legend", "Legend"],
  ["info", "info", "Board"],
];

const TYPE_COLORS: Partial<Record<Space["type"], string>> = {
  start: "var(--space-start)",
  finish: "var(--space-finish)",
  roll_again: "var(--space-roll)",
  penalty: "var(--space-penalty)",
  wildcard: "var(--space-wild)",
};

export function PlayScreen({ live }: { live: LiveGame }) {
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
    document.title = canAct ? "● Your turn · Trivia" : "Trivia";
    return () => {
      document.title = old;
    };
  }, [canAct]);

  // ---- Moves ----
  const onSpaceClick = (index: number) => {
    if (!canAct || state.phase !== "AWAIT_MOVE") return;
    if (index in state.destinations) dispatch({ type: "MOVE", to: index });
    else showToast("Tap one of the glowing spaces.");
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
            aria-label={sound ? "Mute sounds" : "Turn sounds on"}
            aria-pressed={sound}
            title={sound ? "Sound on" : "Sound off"}
          >
            <Icon name={sound ? "soundOn" : "soundOff"} />
          </button>
          {fullscreen.supported && (
            <button className="icon-btn" onClick={fullscreen.toggle} aria-label={fullscreen.on ? "Exit full screen" : "Full screen"} aria-pressed={fullscreen.on}>
              <Icon name={fullscreen.on ? "shrink" : "expand"} />
            </button>
          )}
        </div>
        <TurnPill state={state} canAct={canAct} finished={finished} endedByHost={endedByHost} rolling={!!roll} />
      </div>

      <div className="play-zoom" role="group" aria-label="Board view">
        <button className="icon-btn zoom-step" onClick={() => camera({ kind: "zoomIn" })} aria-label="Zoom in">
          <Icon name="plus" />
        </button>
        <button className="icon-btn zoom-step" onClick={() => camera({ kind: "zoomOut" })} aria-label="Zoom out">
          <Icon name="minus" />
        </button>
        <button className="icon-btn" onClick={() => camera({ kind: "fit" })} aria-label="Show the whole board">
          <Icon name="fit" />
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            const me = state.players.find((p) => p.id === you) ?? active;
            if (me) camera({ kind: "focus", spaces: [me.current_space], force: true });
          }}
          aria-label={you ? "Find my token" : "Find the active player"}
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
        <nav className="play-nav" aria-label="Game info">
          {SHEETS.map(([name, icon, label]) => (
            <button key={name} className="nav-btn" onClick={() => setSheet(name)} aria-haspopup="dialog">
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {sheet === "players" && (
        <Layer title={`Players · round ${state.round}${state.config.max_rounds ? ` of ${state.config.max_rounds}` : ""}`} onClose={() => setSheet(null)}>
          <PlayersSheet msg={msg} state={state} you={you} />
        </Layer>
      )}
      {sheet === "log" && (
        <Layer title="Game log" onClose={() => setSheet(null)} className="log-sheet">
          <LogList game={state} />
        </Layer>
      )}
      {sheet === "legend" && (
        <Layer title="Legend" onClose={() => setSheet(null)}>
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
          Your turn!
        </Floating>
      )}
      {!live.connected && (
        <Floating className="offline" role="alert">
          <span className="spinner" aria-hidden="true" /> Connection lost. Reconnecting…
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
        <strong>{msg.you.can_host ? "Host" : "Watching"}</strong>
      )}
      <span className={`status status-${msg.game.status}`}>{msg.game.status === "running" ? "live" : msg.game.status}</span>
    </span>
  );
}

const DOING: Record<string, string> = {
  AWAIT_ROLL: "rolling",
  AWAIT_MOVE: "moving",
  AWAIT_CATEGORY: "picking a category",
  AWAIT_ANSWER: "answering",
};

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
  const last = rolling ? state.log[state.log.length - 2] : state.log[state.log.length - 1];
  const phase = rolling ? "AWAIT_ROLL" : state.phase;
  const lastPlayer = last && state.players.find((p) => p.id === last.player_id);
  let head: React.ReactNode;
  if (state.phase === "GAME_OVER" || endedByHost) {
    const r = state.result;
    const winner = r?.type === "win" ? state.players.find((p) => p.id === r.player_id) : null;
    head = <strong>{winner ? `🏆 ${winner.name} wins` : endedByHost ? "Game ended" : "It's a draw"}</strong>;
  } else {
    const p = activePlayer(state);
    head = (
      <>
        <span className="dot" style={{ background: p.color }} />
        {canAct ? (
          <strong>Your turn{phase === "AWAIT_ROLL" ? "" : `: ${DOING[phase]}`}</strong>
        ) : (
          <span>
            <strong>{p.name}</strong> is {DOING[phase]}
          </span>
        )}
        <span className="round">R{state.round}</span>
      </>
    );
  }
  return (
    <div className={`pill turn-pill ${canAct && !finished ? "mine" : ""}`} aria-live="polite">
      <div className="turn-line">{head}</div>
      {last && (
        <div className="ticker" key={state.log.length}>
          {lastPlayer && <strong style={{ color: lastPlayer.color }}>{lastPlayer.name} </strong>}
          {last.text}
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
          🏆 Final results
        </button>
      </div>
    );
  if (questionHidden)
    return (
      <div className="dock">
        <button className="dock-btn primary" onClick={onShowQuestion}>
          ❓ Back to the question
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
          {state.rolls_this_turn > 0 ? "Roll again" : "Roll the dice"}
        </button>
      </div>
    );
  if (state.phase === "AWAIT_MOVE") {
    const dests = Object.keys(state.destinations)
      .map(Number)
      .sort((a, b) => a - b);
    return (
      <div className="dock move-dock">
        <p className="dock-hint">
          Rolled <strong>{state.last_roll}</strong>. {dests.length > 1 ? "Tap a glowing space or pick one:" : "Tap the glowing space or:"}
        </p>
        <div className="move-strip" onPointerLeave={() => setHighlight(null)}>
          {dests.map((i) => {
            const s = state.board.spaces.find((x) => x.index === i)!;
            const cat = s.category ? cardCategory(state, s.category) : null;
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
                  {cat?.name ?? SPACE_TYPE_NAMES[s.type]}
                </span>
                <span className="move-index">#{i}</span>
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
  const online = Object.fromEntries(msg.game.players.map((p) => [String(p.id), p.online || !p.joined]));
  return (
    <>
      <PlayersTable game={state} online={online} you={you} />
      <p className="muted small">Score: points from correct answers. Tokens: one per category, from its HQ space.</p>
    </>
  );
}

function LegendSheet({ state }: { state: GameView }) {
  return (
    <div className="legend-sheet">
      <Legend board={state.board} />
      <ul className="legend-notes">
        <li>
          <strong>★ HQ</strong> spaces award the category's token for a correct answer.
        </li>
        <li>
          <strong>⑂</strong> marks a fork: accent arrows leave it, and you pick the branch.
        </li>
        <li>After a roll, the spaces you can reach glow and everything else dims.</li>
        <li>Pinch or use + / − to zoom, drag to move the board, double-tap to zoom in.</li>
      </ul>
    </div>
  );
}

function InfoSheet({ msg, state }: { msg: LiveMessage; state: GameView }) {
  const { user } = useAuth();
  const config = state.config;
  return (
    <dl className="info-list">
      <dt>Game</dt>
      <dd>{msg.game.name}</dd>
      <dt>Track</dt>
      <dd>{config.track_type === "loop" ? "Loop" : "Linear (start to finish)"}</dd>
      <dt>To win</dt>
      <dd>{config.win_conditions.map((w) => WIN_CONDITION_NAMES[w]).join(" or ")}</dd>
      <dt>Dice</dt>
      <dd>
        {config.dice_sides} sides, up to {config.max_rolls_per_turn} roll{config.max_rolls_per_turn === 1 ? "" : "s"} per turn
        {config.bonus_roll_on_correct && ", bonus roll after a correct answer"}
      </dd>
      <dt>Answer time</dt>
      <dd>{config.answer_time_limit_sec ? `${config.answer_time_limit_sec} seconds` : "No limit"}</dd>
      {config.max_rounds && (
        <>
          <dt>Rounds</dt>
          <dd>{config.max_rounds}</dd>
        </>
      )}
      <dt>Players</dt>
      <dd>{state.players.filter((p) => !p.removed).length}</dd>
      {user && (
        <>
          <dt>Admin</dt>
          <dd>
            <Link to={`/games/${msg.game.id}`}>Open this game in the app →</Link>
          </dd>
        </>
      )}
    </dl>
  );
}
