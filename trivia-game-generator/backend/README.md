# Trivia backend (FastAPI)

REST API for organizations, users and auth. Data access is plain SQL (psycopg 3), with no ORM, and the schema is managed by numbered SQL migrations.

## Running

The whole app runs with Docker. From the repo root:

```bash
./docker/init-env.sh      # once: creates .env from .env.example with generated secrets
docker compose -f docker/docker-compose.yml up --build
```

| URL | What |
|---|---|
| http://localhost:5173 | Frontend (Vite dev server; it forwards `/api` to the backend) |
| http://localhost:8000/docs | Interactive API docs (Swagger) |
| `localhost:5433` | Postgres (`POSTGRES_HOST_PORT`) |

On startup the backend applies pending migrations (`AUTO_MIGRATE`) and seeds (`RUN_SEEDS`). If no root user exists, it then creates one from `ROOT_EMAIL` / `ROOT_PASSWORD`. Log in with those credentials.

To run the backend outside Docker (the db container must still be running):

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload       # reads DATABASE_URL from ../.env
uv run pytest                              # uses TEST_DATABASE_URL and wipes it on every test
```

Tests also run inside the container: `docker compose -f docker/docker-compose.yml exec backend pytest`.

## Code layout

| Path | What |
|---|---|
| `app/main.py` | App factory; startup runs migrations, seeds and the root bootstrap |
| `app/config.py` | Settings from env vars / the root `.env` |
| `app/db.py` | Connection pool. Connections are autocommit; writes use `with conn.transaction():` |
| `app/migrations.py` | Migration runner and CLI |
| `app/models.py` | Typed rows (`User`, `Organization`) and write inputs (`NewUser`, `UserChanges`, …) the repositories take and return |
| `app/repositories/` | **All SQL lives here.** One module per table, plain functions that take a connection and return models from `app/models.py` |
| `app/schemas.py` | API request/response models. Separate from the row models so secrets like `password_hash` never reach a response |
| `app/permissions.py` | Every root/member access rule, in one place |
| `app/auth.py` | Bearer JWT → `CurrentUser` dependency, with a revocation check |
| `app/routers/` | HTTP endpoints: `/api/auth`, `/api/organizations`, `/api/users` |
| `migrations/`, `seeds/` | Numbered `.sql` files |

## Conventions

- Every table name starts with `trivia_`.
- Repositories use plain SQL with `%s` parameters, and never return or accept bare dicts:
  - Reads map rows straight into Pydantic models with `class_row(Model)`, which fails loudly if a query and its model drift apart.
  - Single values (`count(*)`, `RETURNING id`) go through `db.fetch_scalar`.
  - Partial updates take a `...Changes` model. Only the fields you set get written, and its `extra="forbid"` config acts as the column allow-list for the dynamic `UPDATE` (built with `psycopg.sql.Identifier`, never string formatting).
- New table → add its row model (and `New…` / `…Changes` models if it's writable) to `app/models.py` alongside the migration.
- Secrets: passwords are bcrypt-hashed. Organization OpenAI keys are encrypted with Fernet (`ENCRYPTION_KEY`) and the API only ever returns them masked (`sk-…1234`). Changing `ENCRYPTION_KEY` makes stored keys unreadable.
- Auth: `POST /api/auth/login` returns a JWT. Send it as `Authorization: Bearer <token>`. `POST /api/auth/logout` adds the token's `jti` to `trivia_revoked_tokens`, so it stops working right away. The user's role is read from the database on every request.

## Permissions

| Action | root | member |
|---|---|---|
| List / view organizations | all | own only |
| Create / update / delete organizations | ✔ | ✘ |
| List / view users | all | own organization only |
| Create users | any organization, any role | own organization, role `member` only |
| Update users | ✔ | `member` users in own organization (including themselves); can't grant `root` or move organizations |
| Delete users | ✔ (not yourself) | ✘ |

Other rules: the last root user can't be demoted or deleted, an organization that still has users can't be deleted, and anything outside your scope returns `404`.

## Migrations

A migration is a plain SQL file in `migrations/` named `NNNN_description.sql`, for example `0002_add_games_table.sql`. The runner:

1. creates `trivia_schema_migrations` if it doesn't exist,
2. takes a Postgres advisory lock, so two backends starting at once don't both migrate,
3. runs each pending file **in version order**, each in its **own transaction**, and records its version and checksum.

If a file fails, its transaction rolls back, nothing is recorded, and startup stops with the error.

### Adding a migration

```bash
cd backend
uv run python -m app.migrations new "add games table"
# -> migrations/0002_add_games_table.sql (a template)
```

Write the SQL in that file:

```sql
-- migration 0002: add games table
CREATE TABLE trivia_games (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id  bigint NOT NULL REFERENCES trivia_organizations (id) ON DELETE CASCADE,
    name             text   NOT NULL,
    board            jsonb  NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);
```

Then apply it. Any of these works:

```bash
uv run python -m app.migrations up          # locally
docker compose -f docker/docker-compose.yml restart backend   # in Docker (AUTO_MIGRATE=true)
uv run python -m app.migrations status      # ✔ = applied, · = pending
```

Rules:

- **Don't add `BEGIN` / `COMMIT`.** The runner wraps each file in a transaction.
- **Never edit or renumber a migration after it has been applied** anywhere (another machine, CI, production). Write a new migration that changes things instead. The runner logs a warning when an applied file's checksum changes.
- A new file must sort after the latest applied one. If two branches both add `0002`, renumber one of them before merging. The runner refuses to apply an out-of-order file.
- Data that the app needs in every environment (reference rows, like the `Default` organization in `0001`) belongs in a migration, not a seed.
- Some statements can't run inside a transaction (e.g. `CREATE INDEX CONCURRENTLY`). Leave those out for now, or extend the runner if one is ever needed.

### Seeds

Seeds are optional demo or dev data in `seeds/`. They use the same file naming and are tracked in the same table (`kind = 'seed'`), so each one runs only once.

```bash
uv run python -m app.migrations new "demo organizations" --seed   # -> seeds/0002_demo_organizations.sql
uv run python -m app.migrations seed     # applies pending migrations, then pending seeds
```

They also run on startup when `RUN_SEEDS=true`. Set it to `false` for environments that shouldn't have demo data. Make seeds safe to re-run, for example with `INSERT … ON CONFLICT DO NOTHING`, because the target database may already have some of the rows.

Don't put user passwords in seeds; the first root user is created from `.env`. To seed users for local testing, create them through the API or the Organizations tab.

### Resetting the local database

```bash
docker compose -f docker/docker-compose.yml down -v   # -v deletes the pgdata volume
docker compose -f docker/docker-compose.yml up
```
