// /games/:id?code=<join code>: a game on a player's own device (rules.md §2.7). No login needed.
// Awaiting: pick a name and join, then wait in the lobby. Running: play your turns and watch
// everyone else's live, full screen (play/PlayScreen). Without joining, the link still lets you watch.

import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useAuth } from "../auth";
import "../play/play.css";
import { PlayScreen } from "../play/PlayScreen";
import { JoinForm, LeaveButton, LobbyPlayers, useLiveGame } from "./LiveGame";

export function PlayerGamePage() {
  const gameId = Number(useParams().id);
  const code = useSearchParams()[0].get("code");
  const live = useLiveGame(gameId, code);
  const msg = live.msg;

  // A game screen, not a page: no pull-to-refresh, overscroll or page zoom from stray gestures
  useEffect(() => {
    document.documentElement.classList.add("play-mode");
    return () => document.documentElement.classList.remove("play-mode");
  }, []);

  if (live.fatal)
    return (
      <PlayCard title="Can't open this game">
        <p>{live.fatal}</p>
      </PlayCard>
    );
  if (!msg)
    return (
      <PlayCard title="Trivia">
        <p className="muted row">
          <span className="spinner" aria-hidden="true" /> Connecting to the game…
        </p>
      </PlayCard>
    );
  if (msg.game.status !== "awaiting" && msg.state) return <PlayScreen live={live} />;
  if (msg.game.status !== "awaiting")
    return (
      <PlayCard title="Game over">
        <p className="muted">This game ended before live play existed, so there's no board to show.</p>
      </PlayCard>
    );
  return <Lobby gameId={gameId} code={code} live={live} />;
}

/** A centered card on the play background, for everything before the board. */
function PlayCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="play-lobby">
      <section className="lobby-card">
        <h1>{title}</h1>
        {children}
      </section>
    </div>
  );
}

function Lobby({ gameId, code, live }: { gameId: number; code: string | null; live: ReturnType<typeof useLiveGame> }) {
  const msg = live.msg!;
  const { user } = useAuth();
  const me = msg.game.players.find((p) => p.id === msg.you.player_id);
  return (
    <div className="play-lobby">
      <section className="lobby-card">
        <p className="lobby-kicker">Trivia{msg.game.board_name ? ` · ${msg.game.board_name}` : ""}</p>
        {me ? (
          <>
            <h1>You're in, {me.name}!</h1>
            <p className="lobby-wait">
              <span className="pulse-dot" aria-hidden="true" /> Waiting for the host to start the game. Keep this page open: the board shows up here.
            </p>
            <div className="row">
              <LeaveButton gameId={gameId} onLeft={live.reconnect} />
            </div>
          </>
        ) : code ? (
          <>
            <h1>Join the game</h1>
            <JoinForm gameId={gameId} code={code} onJoined={live.reconnect} />
          </>
        ) : (
          <>
            <h1>Join the game</h1>
            <p className="muted">Ask the host for the game's link to join.</p>
          </>
        )}
        {!live.connected && <p className="lobby-offline">Connection lost. Reconnecting…</p>}
      </section>
      <section className="lobby-card">
        <h2>Players · {msg.game.players.length}</h2>
        <LobbyPlayers msg={msg} />
        <p className="muted small">Players take turns in this order.</p>
      </section>
      {user && (
        <Link className="small lobby-admin" to={`/games/${gameId}`}>
          Open in the app →
        </Link>
      )}
    </div>
  );
}
