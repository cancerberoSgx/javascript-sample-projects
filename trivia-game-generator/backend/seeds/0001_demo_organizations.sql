-- seed 0001: demo organizations for local development
-- Runs once, inside a transaction. Applied by `python -m app.migrations seed` or RUN_SEEDS=true.
-- Seeds should be safe if the rows already exist.

INSERT INTO trivia_organizations (name) VALUES
    ('Acme Trivia Club'),
    ('Springfield Quiz Night')
ON CONFLICT DO NOTHING;
