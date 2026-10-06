// The play experience shared by the Boards demo and stored games (/games/:id/play):
// the board, the turn/players/log panels and the dispatch + toast plumbing.

import { useCallback, useRef, useState } from "react";
import { activePlayer, applyAction } from "../engine/engine";
import type { Action, BoardDefinition, GameState, GameView, Space } from "../engine/types";
import { BoardCanvas } from "./BoardCanvas";
import { LogPanel, PlayersPanel } from "./PlayersPanel";
import { TurnPanel, type TurnOptions } from "./TurnPanel";

/** Player colors in turn order (games can have up to 12 players). */
export const PLAYER_COLORS = ["#e11d48", "#7c3aed", "#0891b2", "#ea580c", "#16a34a", "#db2777", "#2563eb", "#ca8a04", "#0d9488", "#9333ea", "#dc2626", "#475569"];

/** Plays locally: actions go to the engine in this browser (Boards demo). */
export function useLocalGamePlay(game: GameState | null, setGame: (s: GameState) => void) {
  const gameRef = useRef(game);
  gameRef.current = game;
  const run = useCallback(
    (action: Action) => {
      const current = gameRef.current;
      if (!current) return;
      const out = applyAction(current, action);
      if (out.error) return out.error;
      setGame(out.state);
    },
    [setGame],
  );
  return useGamePlay(game, run);
}

/**
 * Sends actions with `run`, which returns an error to show (local engine), or nothing
 * (multiplayer: the server answers later; show its errors with showToast).
 * canAct: false shows a toast instead of sending, e.g. when it's another player's turn.
 */
export function useGamePlay(game: GameView | null, run: (action: Action) => string | void, canAct = true) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(undefined);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const dispatch = useCallback(
    (action: Action) => {
      const error = run(action);
      if (error) showToast(error);
    },
    [showToast, run],
  );

  const onSpaceClick = (index: number) => {
    if (!game || game.phase === "GAME_OVER") return;
    if (!canAct) showToast(`It's ${activePlayer(game).name}'s turn.`);
    else if (game.phase === "AWAIT_MOVE") dispatch({ type: "MOVE", to: index });
    else showToast(`Nothing to move right now. Waiting for ${game.phase}.`);
  };

  return { dispatch, onSpaceClick, showToast, toast: toast && <div className="toast">{toast}</div> };
}

/** The board canvas, the hovered space's JSON and the legend. */
export function BoardView({ board, game, onSpaceClick }: { board: BoardDefinition; game: GameView | null; onSpaceClick: (index: number) => void }) {
  const [hovered, setHovered] = useState<Space | null>(null);
  return (
    <>
      <BoardCanvas board={board} game={game} onSpaceClick={onSpaceClick} onHover={setHovered} />
      <div className="space-info">
        {hovered ? (
          <code>{JSON.stringify(hovered)}</code>
        ) : (
          <span className="muted">
            Hover a space to see its JSON. Accent arrows leave a fork (⑂). ★ HQ spaces award a category token. After a roll, legal moves glow and everything else is
            dimmed.
          </span>
        )}
      </div>
      <div className="legend">
        {board.categories.map((c) => (
          <span key={c.id}>
            <i style={{ background: c.color }} /> {c.name}
          </span>
        ))}
        <span>
          <i className="sp-roll" /> Roll again
        </span>
        <span>
          <i className="sp-penalty" /> Penalty
        </span>
        <span>
          <i className="sp-wild" /> Wildcard
        </span>
        <span>
          <i className="sp-finish" /> Finish
        </span>
      </div>
    </>
  );
}

/** Whose turn it is and what they can do, the scoreboard and the log. */
export function GamePanels({
  game,
  dispatch,
  online,
  you,
  ended = false,
  ...turn
}: {
  game: GameView;
  dispatch: (action: Action) => void;
  online?: Record<string, boolean>;
  you?: string | null;
  /** The game was ended before anyone won: no turn to show. */
  ended?: boolean;
} & TurnOptions) {
  return (
    <>
      {!ended && <TurnPanel game={game} dispatch={dispatch} {...turn} />}
      <PlayersPanel game={game} online={online} you={you} />
      <LogPanel game={game} />
    </>
  );
}
