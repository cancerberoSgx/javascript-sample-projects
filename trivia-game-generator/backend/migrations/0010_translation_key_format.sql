-- migration 0010: translation keys may contain underscores (rules.md I18N-2)
-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.
--
-- Keys like board.space.roll_again end with the engine's own value (a space type, a win
-- condition), which has underscores. 0009's check didn't allow them.

ALTER TABLE trivia_i18n_keys DROP CONSTRAINT trivia_i18n_keys_key_check;
ALTER TABLE trivia_i18n_keys ADD CONSTRAINT trivia_i18n_keys_key_check
    CHECK (key ~ '^[a-z][A-Za-z0-9_]*(\.[a-z0-9][A-Za-z0-9_]*)+$');
