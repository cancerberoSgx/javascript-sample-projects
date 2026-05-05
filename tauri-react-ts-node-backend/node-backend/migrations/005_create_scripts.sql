CREATE TABLE scripts (
  id            INTEGER PRIMARY KEY,
  connection_id INTEGER NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  content       TEXT    NOT NULL
);
