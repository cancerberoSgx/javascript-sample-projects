import { useEffect, useRef } from "react";
import type { GameView } from "../engine/types";

/** online: engine player id -> has a device connected (multiplayer). you: this device's player id. */
export function PlayersPanel(props: PlayersProps) {
  return (
    <section className="panel">
      <h2>Players</h2>
      <PlayersTable {...props} />
    </section>
  );
}

interface PlayersProps {
  game: GameView;
  online?: Record<string, boolean>;
  you?: string | null;
}

export function PlayersTable({ game, online, you }: PlayersProps) {
  return (
    <table className="players">
      <thead>
        <tr>
          <th></th>
          <th>Space</th>
          <th>Score</th>
          <th>Tokens</th>
        </tr>
      </thead>
      <tbody>
        {game.players.map((p, i) => (
          <tr key={p.id} className={[i === game.active_player && game.phase !== "GAME_OVER" ? "active" : "", p.removed ? "removed" : ""].join(" ")}>
            <td>
              <span className="dot" style={{ background: p.color }} /> {p.name}
              {p.id === you && <span className="chip">you</span>}
              {online && !p.removed && online[p.id] === false && <span className="chip muted" title="No device connected">offline</span>}
              {p.removed && <span className="chip">removed</span>}
              {p.skip_next_turn && <span className="chip warn">skips next</span>}
            </td>
            <td>{p.current_space}</td>
            <td>{p.score}</td>
            <td>
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
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LogPanel({ game }: { game: GameView }) {
  return (
    <section className="panel">
      <h2>Log</h2>
      <LogList game={game} />
    </section>
  );
}

export function LogList({ game }: { game: GameView }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [game.log.length]);
  const name = (id: string | null) => game.players.find((p) => p.id === id);

  return (
    <ol ref={ref} className="log">
      {game.log.map((e, i) => {
        const p = name(e.player_id);
        return (
          <li key={i}>
            <span className="muted">R{e.round}</span>{" "}
            {p && (
              <strong style={{ color: p.color }}>
                {p.name}{" "}
              </strong>
            )}
            {e.text}
          </li>
        );
      })}
    </ol>
  );
}
