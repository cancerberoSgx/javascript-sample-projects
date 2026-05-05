-- SQLite does not allow adding a NOT NULL column without a DEFAULT to an existing table.
-- The application layer always provides profile_id; nullability is a SQLite ALTER TABLE constraint.
ALTER TABLE connections ADD COLUMN profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE;
