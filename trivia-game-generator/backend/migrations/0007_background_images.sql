-- migration 0007: background images for boards and games (rules.md §2.1.2, BKG-*)
-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.
--
-- * The image library: one row per image an organization uploaded or imported. The file itself
--   is not in the database: it lives in MEDIA_DIR as <key>, served as a static file at /media/<key>.
--   The key is the SHA-256 of the stored file, so two organizations with the same image share
--   one file (each has its own row).
-- * A board's background lives in its definition (it is part of the board file format).
--   A game can replace it: trivia_games.background, NULL = use the board's.

CREATE TABLE trivia_images (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id  bigint      NOT NULL REFERENCES trivia_organizations (id) ON DELETE CASCADE,
    key              text        NOT NULL CHECK (key ~ '^[0-9a-f]{64}\.[a-z0-9]{3,4}$'),
    name             text        NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
    source_url       text,       -- set when imported from a URL
    content_type     text        NOT NULL,
    width            integer     NOT NULL CHECK (width > 0),
    height           integer     NOT NULL CHECK (height > 0),
    bytes            integer     NOT NULL CHECK (bytes > 0),
    creator_id       bigint      REFERENCES trivia_users (id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, key)
);
CREATE INDEX trivia_images_organization_id_idx ON trivia_images (organization_id, created_at DESC);
CREATE INDEX trivia_images_key_idx ON trivia_images (key);

ALTER TABLE trivia_games ADD COLUMN background jsonb;  -- formats.Background; NULL = the board's background (BKG-5)
