import { useEffect, useState } from "react";
import { JsonPanel } from "./components/JsonPanel";
import { BoardView, GamePanels, PLAYER_COLORS, useGamePlay } from "./components/PlayTable";
import { resolveConfig } from "./engine/board";
import { createGame } from "./engine/engine";
import { loadBoard, loadDeck, loadManifest, prepareBoard, type ManifestEntry, type LoadedBoard } from "./engine/loader";
import type { DeckFile, GameState, PlayerSetup } from "./engine/types";

const DEFAULT_PLAYERS: PlayerSetup[] = ["Ana", "Ben", "Cleo", "Dan"].map((name, i) => ({ name, color: PLAYER_COLORS[i] }));
const CUSTOM = "__custom__";

export function BoardsDemo() {
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);
  const [deckFile, setDeckFile] = useState<DeckFile | null>(null);
  const [file, setFile] = useState<string>("");
  const [loaded, setLoaded] = useState<LoadedBoard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [view, setView] = useState<"play" | "json">("play");
  const { dispatch, onSpaceClick, showToast, toast } = useGamePlay(game, setGame);

  // Setup options
  const [playerCount, setPlayerCount] = useState(2);
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [noTimer, setNoTimer] = useState(false);

  useEffect(() => {
    loadManifest()
      .then(async (m) => {
        setDeckFile(await loadDeck(m.decks[0].file));
        setManifest(m.boards);
        setFile(m.boards[0]?.file ?? "");
      })
      .catch((e) => setLoadError(String(e)));
  }, []);

  useEffect(() => {
    if (!file || file === CUSTOM || !deckFile) return;
    setGame(null);
    setLoaded(null);
    setLoadError(null);
    loadBoard(file, deckFile).then(setLoaded, (e) => setLoadError(String(e)));
  }, [file, deckFile]);

  const uploadBoard = async (f: File) => {
    try {
      if (!deckFile) return;
      const result = prepareBoard(await f.text(), deckFile);
      setGame(null);
      setLoadError(null);
      setLoaded(result);
      setFile(CUSTOM);
    } catch (e) {
      showToast(String(e));
    }
  };

  const startGame = () => {
    if (!loaded?.board || !loaded.deck) return;
    const board = structuredClone(loaded.board);
    if (noTimer) board.config = { ...board.config, answer_time_limit_sec: 0 };
    setGame(createGame(board, loaded.deck, players.slice(0, playerCount), seed));
  };

  const entry = manifest.find((m) => m.file === file);
  const board = game?.board ?? loaded?.preview;

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
            {file === CUSTOM && <option value={CUSTOM}>Uploaded: {loaded?.file.name}</option>}
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
              <BoardView board={board} game={game} onSpaceClick={onSpaceClick} />
            ) : (
              <JsonPanel loaded={loaded} file={file === CUSTOM ? "(uploaded file)" : file} />
            )}
          </div>

          <aside>
            {game ? (
              <>
                <GamePanels game={game} dispatch={dispatch} />
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

      {toast}
    </div>
  );
}
