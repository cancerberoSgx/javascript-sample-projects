-- migration 0006: each organization can choose its OpenAI and Gemini models (rules.md GEN-1)
-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.
--
-- NULL means "the app's default" (OPENAI_MODEL / GEMINI_MODEL), so changing the default
-- moves every organization that never picked a model.

ALTER TABLE trivia_organizations
    ADD COLUMN openai_model text CHECK (openai_model ~ '^[A-Za-z0-9._:/-]{1,100}$'),
    ADD COLUMN gemini_model text CHECK (gemini_model ~ '^[A-Za-z0-9._:/-]{1,100}$');
