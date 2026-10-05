import { useCallback, useEffect, useRef, useState } from "react";
import { BoardCanvas } from "./components/BoardCanvas";
import { JsonPanel } from "./components/JsonPanel";
import { LogPanel, PlayersPanel } from "./components/PlayersPanel";
import { TurnPanel } from "./components/TurnPanel";
import { resolveConfig } from "./engine/board";
import { applyAction, createGame } from "./engine/engine";
import { loadBoard, loadBoardFromJson, loadManifest, type BoardManifestEntry, type LoadedBoard } from "./engine/loader";
import type { Action, GameState, PlayerSetup, Space } from "./engine/types";

const PLAYER_COLORS = ["#e11d48", "#7c3aed", "#0891b2", "#ea580c"];
const DEFAULT_PLAYERS: PlayerSetup[] = ["Ana", "Ben", "Cleo", "Dan"].map((name, i) => ({ name, color: PLAYER_COLORS[i] }));
const CUSTOM = "__custom__";

export function BoardsDemo() {
  const [manifest, setManifest] = useState<BoardManifestEntry[]>([]);
  const [file, setFile] = useState<string>("");
  const [loaded, setLoaded] = useState<LoadedBoard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [view, setView] = useState<"play" | "json">("play");
  const [hovered, setHovered] = useState<Space | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(undefined);

  // Setup options
  const [playerCount, setPlayerCount] = useState(2);
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [noTimer, setNoTimer] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    loadManifest()
      .then((m) => {
        setManifest(m);
        setFile(m[0]?.file ?? "");
      })
      .catch((e) => setLoadError(String(e)));
  }, []);

  useEffect(() => {
    if (!file || file === CUSTOM) return;
    setGame(null);
    setLoaded(null);
    setLoadError(null);
    loadBoard(file).then(setLoaded, (e) => setLoadError(String(e)));
  }, [file]);

  const uploadBoard = async (f: File) => {
    try {
      const result = await loadBoardFromJson(await f.text());
      setGame(null);
      setLoadError(null);
      setLoaded(result);
      setFile(CUSTOM);
    } catch (e) {
      showToast(String(e));
    }
  };

  const startGame = () => {
    if (!loaded?.deck) return;
    const board = structuredClone(loaded.board);
    if (noTimer) board.config = { ...board.config, answer_time_limit_sec: 0 };
    setGame(createGame(board, loaded.deck, players.slice(0, playerCount), seed));
  };

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
    [showToast],
  );

  const onSpaceClick = (index: number) => {
    if (!game) return;
    if (game.phase === "AWAIT_MOVE") dispatch({ type: "MOVE", to: index });
    else if (game.phase !== "GAME_OVER") showToast(`Nothing to move right now. Waiting for ${game.phase}.`);
  };

  const entry = manifest.find((m) => m.file === file);
  const board = game?.board ?? loaded?.board;

  return (
    <div className="boards-demo">
      <div className="toolbar">
        <label>
          Board:{" "}
          <select value={file} onChange={(e) => setFile(e.target.value)}>
            {manifest.map((m) => (
              <option key={m.file} value={m.file}>
                {m.name}
              </option>
            ))}
            {file === CUSTOM && <option value={CUSTOM}>Uploaded: {loaded?.board.name}</option>}
          </select>
        </label>
        <label className="upload">
          Load JSON…
          <input type="file" accept=".json,application/json" onChange={(e) => e.target.files?.[0] && uploadBoard(e.target.files[0])} />
        </label>
        <div className="tabs">
          <button className={view === "play" ? "on" : ""} onClick={() => setView("play")}>
            Board
          </button>
          <button className={view === "json" ? "on" : ""} onClick={() => setView("json")}>
            JSON
          </button>
        </div>
      </div>

      {loadError && <div className="error">{loadError}</div>}

      {loaded && board && (
        <main>
          <div className="left">
            <p className="desc">
              <strong>{board.name}</strong> · {resolveConfig(board).track_type} track · {board.spaces.length} spaces · wins:{" "}
              {resolveConfig(board).win_conditions.join(", ")}
              <br />
              <span className="muted">{board.description ?? entry?.description}</span>
            </p>

            {loaded.errors.length > 0 && (
              <div className="error">
                <strong>This board doesn't pass validation:</strong>
                <ul>
                  {loaded.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {view === "play" ? (
              <>
                <BoardCanvas board={board} game={game} onSpaceClick={onSpaceClick} onHover={setHovered} />
                <div className="space-info">
                  {hovered ? (
                    <code>{JSON.stringify(hovered)}</code>
                  ) : (
                    <span className="muted">Hover a space to see its JSON. Accent arrows leave a fork (⑂). ★ HQ spaces award a category token. After a roll, legal moves glow and everything else is dimmed.</span>
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
            ) : (
              <JsonPanel loaded={loaded} file={file === CUSTOM ? "(uploaded file)" : file} />
            )}
          </div>

          <aside>
            {game ? (
              <>
                <TurnPanel game={game} dispatch={dispatch} />
                <PlayersPanel game={game} />
                <LogPanel game={game} />
                <button onClick={() => setGame(null)}>↺ New game</button>
              </>
            ) : (
              <section className="panel">
                <h2>New game</h2>
                <label>
                  Players{" "}
                  <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                {players.slice(0, playerCount).map((p, i) => (
                  <div className="row" key={i}>
                    <span className="dot" style={{ background: p.color }} />
                    <input
                      value={p.name}
                      onChange={(e) => setPlayers(players.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                  </div>
                ))}
                <label>
                  Seed <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
                </label>
                <label className="check">
                  <input type="checkbox" checked={noTimer} onChange={(e) => setNoTimer(e.target.checked)} /> Disable answer timer
                </label>
                <button className="primary" disabled={loaded.errors.length > 0} onClick={startGame}>
                  Start game
                </button>
                <p className="muted small">The same seed with the same inputs replays the same game (dice, card order).</p>
              </section>
            )}
          </aside>
        </main>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
