// The play experience shared by the Boards demo and stored games (/games/:id/play):
// the board, the turn/players/log panels and the dispatch + toast plumbing.

import { useCallback, useRef, useState } from "react";
import { applyAction } from "../engine/engine";
import type { Action, BoardDefinition, GameState, Space } from "../engine/types";
import { BoardCanvas } from "./BoardCanvas";
import { LogPanel, PlayersPanel } from "./PlayersPanel";
import { TurnPanel } from "./TurnPanel";

/** Player colors in turn order (games can have up to 12 players). */
export const PLAYER_COLORS = ["#e11d48", "#7c3aed", "#0891b2", "#ea580c", "#16a34a", "#db2777", "#2563eb", "#ca8a04", "#0d9488", "#9333ea", "#dc2626", "#475569"];

/** Sends actions to the engine. Rejected actions show as a toast instead of changing the state. */
export function useGamePlay(game: GameState | null, setGame: (s: GameState) => void) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(undefined);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const gameRef = useRef(game);
  gameRef.current = game;
  const dispatch = useCallback(
    (action: Action) => {
      const current = gameRef.current;
      if (!current) return;
      const out = applyAction(current, action);
      if (out.error) showToast(out.error);
      else setGame(out.state);
    },
    [showToast, setGame],
  );

  const onSpaceClick = (index: number) => {
    if (!game) return;
    if (game.phase === "AWAIT_MOVE") dispatch({ type: "MOVE", to: index });
    else if (game.phase !== "GAME_OVER") showToast(`Nothing to move right now. Waiting for ${game.phase}.`);
  };

  return { dispatch, onSpaceClick, showToast, toast: toast && <div className="toast">{toast}</div> };
}

/** The board canvas, the hovered space's JSON and the legend. */
export function BoardView({ board, game, onSpaceClick }: { board: BoardDefinition; game: GameState | null; onSpaceClick: (index: number) => void }) {
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
export function GamePanels({ game, dispatch }: { game: GameState; dispatch: (action: Action) => void }) {
  return (
    <>
      <TurnPanel game={game} dispatch={dispatch} />
      <PlayersPanel game={game} />
      <LogPanel game={game} />
    </>
  );
}
