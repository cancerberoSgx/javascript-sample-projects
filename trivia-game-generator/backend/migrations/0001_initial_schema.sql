-- migration 0001: organizations, users and revoked tokens
-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.

CREATE TABLE trivia_organizations (
    id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                      text        NOT NULL CHECK (length(btrim(name)) > 0),
    openai_api_key_encrypted  text,       -- Fernet ciphertext; never stored in plain text
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trivia_organizations_name_key ON trivia_organizations (lower(name));

CREATE TABLE trivia_users (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id  bigint      NOT NULL REFERENCES trivia_organizations (id) ON DELETE RESTRICT,
    name             text        NOT NULL CHECK (length(btrim(name)) > 0),
    email            text        NOT NULL,
    password_hash    text        NOT NULL,
    role             text        NOT NULL DEFAULT 'member' CHECK (role IN ('root', 'member')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trivia_users_email_key ON trivia_users (lower(email));
CREATE INDEX trivia_users_organization_id_idx ON trivia_users (organization_id);

-- JWTs revoked by logout. Rows past expires_at can be deleted.
CREATE TABLE trivia_revoked_tokens (
    jti         uuid        PRIMARY KEY,
    user_id     bigint      NOT NULL REFERENCES trivia_users (id) ON DELETE CASCADE,
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trivia_revoked_tokens_expires_at_idx ON trivia_revoked_tokens (expires_at);

-- Initial records. The first root user is created by the backend on startup from
-- ROOT_EMAIL / ROOT_PASSWORD in .env, so no password hash is committed here.
INSERT INTO trivia_organizations (name) VALUES ('Default');
