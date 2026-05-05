CREATE TABLE connections (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  db_host     TEXT    NOT NULL,
  db_port     INTEGER NOT NULL,
  db_name     TEXT    NOT NULL,
  db_user     TEXT    NOT NULL,
  db_password TEXT    NOT NULL
);
