-- migration 0011: saved deck generations (rules.md §2.2.2, GEN-8 … GEN-10)
-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.
--
-- * A deck generation is a named, reusable card-generation request: the settings of the
--   generate form (count, category / difficulty / type mixes, instructions) plus a preferred
--   provider. It belongs to a deck; its categories are the organization's (ids inside `spec`).
-- * Its usage is counted on the row itself, not from trivia_generation_jobs: discarding a
--   generation deletes its job, but the use still counts.
-- * A job remembers the deck generation it was started from, so adding its cards credits it.

CREATE TABLE trivia_deck_generations (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    deck_id        bigint      NOT NULL REFERENCES trivia_decks (id) ON DELETE CASCADE,
    name           text        NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
    description    text        NOT NULL DEFAULT '',
    provider       text        CHECK (provider IN ('openai', 'gemini')),  -- preferred; NULL = none
    spec           jsonb       NOT NULL,  -- {count, categories: [{category_id, weight}], difficulty, types, instructions}
    creator_id     bigint      REFERENCES trivia_users (id) ON DELETE SET NULL,
    use_count      integer     NOT NULL DEFAULT 0,  -- generations started from it
    last_used_at   timestamptz,
    cards_accepted integer     NOT NULL DEFAULT 0,  -- generated cards added to a deck from those runs
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trivia_deck_generations_deck_name_key ON trivia_deck_generations (deck_id, lower(name));

ALTER TABLE trivia_generation_jobs
    ADD COLUMN deck_generation_id bigint REFERENCES trivia_deck_generations (id) ON DELETE SET NULL;
