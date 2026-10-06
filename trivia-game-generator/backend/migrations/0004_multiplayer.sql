-- migration 0004: multiplayer games (rules.md §2.6, §2.7, MPL-*)
-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.
--
-- * Status 'not_started' becomes 'awaiting': the lobby that players join with the game's link.
-- * Each game gets a join code (part of the link) that the host can regenerate.
-- * Players who join from their own device get a secret token (only its hash is stored).
--   Removing a player from a running game marks them removed instead of deleting the row.
-- * The server runs the engine: each running game has one live state, saved after every action.
--   It replaces the named saves of migration 0003 (hot-seat play is gone).

DROP TABLE trivia_game_instances;

-- ---------- status: not_started -> awaiting ----------
ALTER TABLE trivia_games DROP CONSTRAINT trivia_games_status_check;
ALTER TABLE trivia_games DROP CONSTRAINT trivia_games_check;
UPDATE trivia_games SET status = 'awaiting' WHERE status = 'not_started';
ALTER TABLE trivia_games ALTER COLUMN status SET DEFAULT 'awaiting';
ALTER TABLE trivia_games ADD CONSTRAINT trivia_games_status_check CHECK (status IN ('awaiting', 'running', 'finished'));
ALTER TABLE trivia_games ADD CONSTRAINT trivia_games_started_check
    CHECK (status = 'awaiting' OR (snapshot IS NOT NULL AND started_at IS NOT NULL));

-- ---------- join code ----------
-- 8 hex characters. The link also names the game id, so codes only need to be unguessable.
ALTER TABLE trivia_games ADD COLUMN join_code text NOT NULL DEFAULT upper(substr(md5(gen_random_uuid()::text), 1, 8));

-- ---------- players ----------
ALTER TABLE trivia_players ADD COLUMN token_hash text UNIQUE;  -- sha256 of the device's player token; null = added by the host
ALTER TABLE trivia_players ADD COLUMN removed_at timestamptz;  -- removed from a running game (MPL-9)

-- Names are unique per game, ignoring case and surrounding spaces. Rename existing duplicates first.
WITH dups AS (
    SELECT id, row_number() OVER (PARTITION BY game_id, lower(btrim(name)) ORDER BY position) AS n
    FROM trivia_players
)
UPDATE trivia_players p SET name = p.name || ' (' || dups.n || ')' FROM dups WHERE dups.id = p.id AND dups.n > 1;
CREATE UNIQUE INDEX trivia_players_game_name_idx ON trivia_players (game_id, lower(btrim(name)));

-- ---------- live play state ----------
CREATE TABLE trivia_game_states (
    game_id     bigint      PRIMARY KEY REFERENCES trivia_games (id) ON DELETE CASCADE,
    state       jsonb       NOT NULL,  -- the engine's whole GameState, including what players don't see
    version     integer     NOT NULL DEFAULT 1,  -- +1 on every change
    updated_at  timestamptz NOT NULL DEFAULT now()
);
