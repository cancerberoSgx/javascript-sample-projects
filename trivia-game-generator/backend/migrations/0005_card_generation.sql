-- migration 0005: generating cards with an LLM (rules.md §2.2.1, GEN-*)
-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.
--
-- * Organizations can also store a Gemini key (Fernet ciphertext, like the OpenAI key).
-- * A generation job fills a deck's review list in the background. Nothing reaches
--   trivia_cards until a user accepts the reviewed cards (GEN-6).

ALTER TABLE trivia_organizations ADD COLUMN gemini_api_key_encrypted text;  -- Fernet ciphertext

CREATE TABLE trivia_generation_jobs (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    deck_id             bigint      NOT NULL REFERENCES trivia_decks (id) ON DELETE CASCADE,
    creator_id          bigint      REFERENCES trivia_users (id) ON DELETE SET NULL,
    provider            text        NOT NULL CHECK (provider IN ('openai', 'gemini')),
    model               text        NOT NULL,
    request             jsonb       NOT NULL,  -- what was asked for: count, category / difficulty / type mixes, instructions
    status              text        NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed', 'accepted')),
    cards               jsonb       NOT NULL DEFAULT '[]',  -- the generated cards waiting for review
    batches_total       integer     NOT NULL DEFAULT 0,
    batches_done        integer     NOT NULL DEFAULT 0,
    dropped_duplicates  integer     NOT NULL DEFAULT 0,
    dropped_invalid     integer     NOT NULL DEFAULT 0,
    messages            jsonb       NOT NULL DEFAULT '[]',  -- warnings for the reviewer (a failed batch, cards still missing)
    error               text,       -- why a failed job stopped
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    finished_at         timestamptz,
    CHECK (status = 'running' OR finished_at IS NOT NULL)
);
-- One generation under review per deck: accept or discard it before starting another
CREATE UNIQUE INDEX trivia_generation_jobs_open_key ON trivia_generation_jobs (deck_id) WHERE status <> 'accepted';
