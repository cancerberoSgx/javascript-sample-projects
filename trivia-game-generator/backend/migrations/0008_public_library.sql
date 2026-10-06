-- migration 0008: public content library (rules.md §2.8, SHR-*)
-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.
--
-- * Boards, decks, categories and library images can be made public. Public items are listed in
--   the Library for every logged-in user, who can copy them into their own organization. They are
--   never used across organizations directly: a copy is an independent item (SHR-3).
-- * `visibility` leaves room for more levels later (e.g. 'shared' with chosen organizations).
--   `published_at` is set while public and orders the Library (newest first).
-- * `copied_from` remembers where a copy came from, as it was then: {id, name, organization_name}.
--   Plain data, not a foreign key: the original can be unpublished or deleted later.

ALTER TABLE trivia_boards
    ADD COLUMN visibility   text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
    ADD COLUMN published_at timestamptz,
    ADD COLUMN copied_from  jsonb;
ALTER TABLE trivia_decks
    ADD COLUMN visibility   text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
    ADD COLUMN published_at timestamptz,
    ADD COLUMN copied_from  jsonb;
ALTER TABLE trivia_categories
    ADD COLUMN visibility   text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
    ADD COLUMN published_at timestamptz,
    ADD COLUMN copied_from  jsonb;
ALTER TABLE trivia_images
    ADD COLUMN visibility   text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
    ADD COLUMN published_at timestamptz,
    ADD COLUMN copied_from  jsonb;

CREATE INDEX trivia_boards_public_idx     ON trivia_boards (published_at DESC)     WHERE visibility = 'public';
CREATE INDEX trivia_decks_public_idx      ON trivia_decks (published_at DESC)      WHERE visibility = 'public';
CREATE INDEX trivia_categories_public_idx ON trivia_categories (published_at DESC) WHERE visibility = 'public';
CREATE INDEX trivia_images_public_idx     ON trivia_images (published_at DESC)     WHERE visibility = 'public';

-- Deleting an organization whose decks have cards failed: trivia_cards.category_id blocked the
-- cascade from trivia_categories (known gap). Copying decks between organizations makes cards and
-- categories far more common, so cascade it: a category's cards always live in the same organization.
ALTER TABLE trivia_cards DROP CONSTRAINT trivia_cards_category_id_fkey;
ALTER TABLE trivia_cards ADD CONSTRAINT trivia_cards_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES trivia_categories (id) ON DELETE CASCADE;
