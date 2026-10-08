-- migration 0009: translating the game's UI (rules.md §2.9, I18N-*)
-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.
--
-- * trivia_languages: the languages the UI can be shown in. English ('en') is the source
--   language: its texts come from the code (frontend/src/i18n/catalog.ts) and it has no rows in
--   trivia_translations. It can't be deleted or disabled.
-- * trivia_i18n_keys: every text the UI shows, with its English message (ICU MessageFormat) and
--   the context a translator needs. The app fills and updates it on every startup from the
--   catalog (app/i18n.py, I18N-2). Keys the code no longer uses are marked obsolete, not deleted,
--   so their translations survive a rename.
-- * trivia_translations: one message per language and key. `source_hash` is the hash of the
--   English message it was translated from: when the English changes, the translation is
--   outdated (I18N-5). `status` says whether a person checked it ('reviewed') or a model wrote
--   it ('machine').
-- * Organizations get a language (the default of their games), games an optional one (NULL =
--   the organization's) and users an optional preference (NULL = automatic) (I18N-3).

CREATE TABLE trivia_languages (
    code        text PRIMARY KEY CHECK (code ~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$'),
    name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),         -- in English: "Spanish"
    native_name text NOT NULL CHECK (length(native_name) BETWEEN 1 AND 100),  -- "Español"
    enabled     boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO trivia_languages (code, name, native_name) VALUES
    ('en', 'English', 'English'),
    ('es', 'Spanish', 'Español');

CREATE TABLE trivia_i18n_keys (
    key          text PRIMARY KEY CHECK (key ~ '^[a-z][A-Za-z0-9]*(\.[a-z0-9][A-Za-z0-9]*)+$'),
    area         text NOT NULL,                   -- where it shows: play, lobby, host, log, errors…
    source       text NOT NULL,                   -- the English message
    source_hash  text NOT NULL,                   -- sha256 of source
    description  text NOT NULL DEFAULT '',
    placeholders jsonb NOT NULL DEFAULT '{}',     -- {"name": "what it holds"}
    max_length   integer CHECK (max_length > 0),  -- a hint for short labels
    obsolete     boolean NOT NULL DEFAULT false,  -- no longer in the catalog
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trivia_translations (
    language    text NOT NULL REFERENCES trivia_languages (code) ON DELETE CASCADE ON UPDATE CASCADE,
    key         text NOT NULL REFERENCES trivia_i18n_keys (key) ON DELETE CASCADE,
    message     text NOT NULL CHECK (length(message) BETWEEN 1 AND 5000),
    status      text NOT NULL CHECK (status IN ('machine', 'reviewed')),
    source_hash text NOT NULL,                    -- the key's source_hash when this was written
    updated_by  integer REFERENCES trivia_users (id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (language, key)
);

ALTER TABLE trivia_organizations
    ADD COLUMN language text NOT NULL DEFAULT 'en' REFERENCES trivia_languages (code) ON DELETE SET DEFAULT ON UPDATE CASCADE;
ALTER TABLE trivia_users
    ADD COLUMN language text REFERENCES trivia_languages (code) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE trivia_games
    ADD COLUMN language text REFERENCES trivia_languages (code) ON DELETE SET NULL ON UPDATE CASCADE;
