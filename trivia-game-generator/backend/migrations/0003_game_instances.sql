-- migration 0003: saved games (rules.md §2.7, SAV-*)
-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.
--
-- A game instance is a named save of a running game's play state: the engine's whole
-- GameState as JSON (positions, scores, tokens, card piles, RNG, pending question, log).
-- A game can have many; they go away with the game.

CREATE TABLE trivia_game_instances (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    game_id      bigint      NOT NULL REFERENCES trivia_games (id) ON DELETE CASCADE,
    name         text        NOT NULL CHECK (length(btrim(name)) > 0),
    state        jsonb       NOT NULL,  -- engine GameState, timer stored as time left (SAV-3)
    saved_by_id  bigint      REFERENCES trivia_users (id) ON DELETE SET NULL,  -- who saved it last
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trivia_game_instances_game_id_idx ON trivia_game_instances (game_id, updated_at DESC);
