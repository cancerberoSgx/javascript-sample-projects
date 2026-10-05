-- migration 0002: categories, decks + cards, boards, games + players
-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.
--
-- Everything belongs to an organization and goes away with it (ON DELETE CASCADE).
-- A board has category *slots*; a game maps each slot to a category (trivia_game_categories).
-- Starting a game copies board, deck and categories into trivia_games.snapshot, so
-- later edits or deletes never change a running or finished game.

CREATE TABLE trivia_categories (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id  bigint      NOT NULL REFERENCES trivia_organizations (id) ON DELETE CASCADE,
    name             text        NOT NULL CHECK (length(btrim(name)) > 0),
    description      text        NOT NULL DEFAULT '',
    color            text        NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trivia_categories_org_name_key ON trivia_categories (organization_id, lower(name));

CREATE TABLE trivia_decks (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id  bigint      NOT NULL REFERENCES trivia_organizations (id) ON DELETE CASCADE,
    name             text        NOT NULL CHECK (length(btrim(name)) > 0),
    description      text        NOT NULL DEFAULT '',
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trivia_decks_org_name_key ON trivia_decks (organization_id, lower(name));

CREATE TABLE trivia_cards (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    deck_id      bigint      NOT NULL REFERENCES trivia_decks (id) ON DELETE CASCADE,
    -- NO ACTION (not RESTRICT): blocks deleting a category that cards use, but still lets an
    -- organization delete cascade through both decks and categories in one statement
    category_id  bigint      NOT NULL REFERENCES trivia_categories (id),
    question     text        NOT NULL CHECK (length(btrim(question)) > 0),
    options      jsonb       CHECK (options IS NULL OR jsonb_typeof(options) = 'array'), -- NULL = open-ended
    answer       text        NOT NULL CHECK (length(btrim(answer)) > 0),                 -- for multiple choice: one of options
    difficulty   smallint    NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
    grand_prize  boolean     NOT NULL DEFAULT false,                                     -- only drawn for the final question
    position     integer     NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trivia_cards_deck_id_idx ON trivia_cards (deck_id, position);
CREATE INDEX trivia_cards_category_id_idx ON trivia_cards (category_id);

CREATE TABLE trivia_boards (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id  bigint      NOT NULL REFERENCES trivia_organizations (id) ON DELETE CASCADE,
    name             text        NOT NULL CHECK (length(btrim(name)) > 0),
    description      text        NOT NULL DEFAULT '',
    definition       jsonb       NOT NULL,  -- {config, slots, spaces}; validated by the backend (rules.md §2.1)
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trivia_boards_org_name_key ON trivia_boards (organization_id, lower(name));

CREATE TABLE trivia_games (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id  bigint      NOT NULL REFERENCES trivia_organizations (id) ON DELETE CASCADE,
    name             text        NOT NULL CHECK (length(btrim(name)) > 0),
    status           text        NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'running', 'finished')),
    creator_id       bigint      REFERENCES trivia_users (id) ON DELETE SET NULL,
    board_id         bigint      REFERENCES trivia_boards (id) ON DELETE SET NULL,
    deck_id          bigint      REFERENCES trivia_decks (id) ON DELETE SET NULL,
    snapshot         jsonb,      -- {board, deck, mapping}, set when the game starts
    started_at       timestamptz,
    finished_at      timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CHECK (status = 'not_started' OR (snapshot IS NOT NULL AND started_at IS NOT NULL)),
    CHECK (status <> 'finished' OR finished_at IS NOT NULL)
);
CREATE INDEX trivia_games_organization_id_idx ON trivia_games (organization_id, created_at DESC);

-- Which category plays each board slot (only used until the game starts)
CREATE TABLE trivia_game_categories (
    game_id      bigint NOT NULL REFERENCES trivia_games (id) ON DELETE CASCADE,
    slot         text   NOT NULL,
    category_id  bigint NOT NULL REFERENCES trivia_categories (id) ON DELETE CASCADE,
    PRIMARY KEY (game_id, slot),
    UNIQUE (game_id, category_id)
);

-- Players are just names: they don't need to be organization users
CREATE TABLE trivia_players (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    game_id     bigint      NOT NULL REFERENCES trivia_games (id) ON DELETE CASCADE,
    name        text        NOT NULL CHECK (length(btrim(name)) > 0),
    position    integer     NOT NULL,  -- turn order, 0-based
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (game_id, position)
);
