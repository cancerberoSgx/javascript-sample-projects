-- migration 0012: category labels (rules.md §2.2, CAT-1 … CAT-3)
-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.
--
-- * A category's name identifies it in its organization (unique, matched by imports and Library
--   copies) and can be long and precise: "History-Uruguay". Its label is the short text players
--   see in a game: "History". Empty = show the name.
-- * The labels of a game's categories must be unique (CAT-3), checked by the API when a game starts.

ALTER TABLE trivia_categories
    ADD COLUMN label text NOT NULL DEFAULT '' CHECK (length(label) <= 40);
