// /games/:id?code=<join code>: a game on a player's own device (rules.md §2.7). No login needed.
// Awaiting: pick a name and join, then wait in the lobby. Running: play your turns and watch
// everyone else's live. Without joining, the link still lets you watch.

import { Link, useParams, useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { FinalResult, JoinForm, LeaveButton, LiveTable, LobbyPlayers, YouBanner, useLiveGame } from "./LiveGame";
import { StatusBadge } from "./common";

export function PlayerGamePage() {
  const gameId = Number(useParams().id);
  const code = useSearchParams()[0].get("code");
  const { user } = useAuth();
  const live = useLiveGame(gameId, code);
  const msg = live.msg;

  return (
    <div className="app player-page">
      <header>
        <h1>Trivia</h1>
        {msg && (
          <span className="row wrap">
            <strong>{msg.game.name}</strong>
            <StatusBadge status={msg.game.status} />
            <YouBanner msg={msg} />
          </span>
        )}
        {user && (
          <Link className="small whoami" to={`/games/${gameId}`}>
            Open in the app →
          </Link>
        )}
      </header>

      {live.fatal ? (
        <section className="panel content-page">
          <h2>Can't open this game</h2>
          <p>{live.fatal}</p>
        </section>
      ) : !msg ? (
        <p className="muted">Connecting…</p>
      ) : msg.game.status === "awaiting" ? (
        <Lobby gameId={gameId} code={code} live={live} />
      ) : (
        <>
          {msg.game.status === "finished" && <FinalResult msg={msg} />}
          {msg.state && <LiveTable live={live} />}
        </>
      )}
    </div>
  );
}

function Lobby({ gameId, code, live }: { gameId: number; code: string | null; live: ReturnType<typeof useLiveGame> }) {
  const msg = live.msg!;
  const me = msg.game.players.find((p) => p.id === msg.you.player_id);
  return (
    <div className="lobby-page">
      <section className="panel">
        <h2>{me ? "You're in" : "Join the game"}</h2>
        {me ? (
          <>
            <p className="big">
              Hi <strong>{me.name}</strong>! The game starts when the host is ready. Keep this page open: your turns show up here.
            </p>
            <div>
              <LeaveButton gameId={gameId} onLeft={live.reconnect} />
            </div>
          </>
        ) : code ? (
          <JoinForm gameId={gameId} code={code} onJoined={live.reconnect} />
        ) : (
          <p className="muted">Ask the host for the game's link to join.</p>
        )}
      </section>
      <section className="panel">
        <h2>Players · {msg.game.players.length}</h2>
        <LobbyPlayers msg={msg} />
        <p className="muted small">{msg.game.board_name ? `Board: ${msg.game.board_name}. ` : ""}Players take turns in this order.</p>
      </section>
    </div>
  );
}
