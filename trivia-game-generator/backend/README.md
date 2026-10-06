# Trivia backend (FastAPI)

REST API for organizations, users and auth, plus each organization's game content: categories, decks (with cards), boards and games (with players). Data access is plain SQL (psycopg 3), with no ORM, and the schema is managed by numbered SQL migrations.

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

On startup the backend:
1. applies pending migrations (`AUTO_MIGRATE`),
2. creates a root user from `ROOT_EMAIL` / `ROOT_PASSWORD` if none exists,
3. applies pending seeds (`RUN_SEEDS`). They run after step 2, so a seed can reference the root user.

Log in with the root credentials. With seeds on, the `Default` organization has the example categories, sample deck, five example boards and a game that's ready to start.

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
| `app/routers/` | HTTP endpoints: `/api/auth`, `/api/organizations`, `/api/users`, `/api/categories`, `/api/decks` (+ `/cards`), `/api/boards`, `/api/games`, and multiplayer play (`routers/play.py`: join, lobby, host controls, the game WebSocket) |
| `app/formats.py` | Board definition, game snapshot and live play-state (`EngineState`) formats (match the frontend's `BoardFile` / `DeckFile` / `GameState`) |
| `app/engine/` | **The game engine, ported from `frontend/src/engine`** (`engine.ts`, `movement.ts`, `rng.ts`, `resolve.ts`). Same states, same rule IDs, same error messages. `tests/test_engine.py` replays the conformance fixture the TS tests write (`tests/fixtures/engine_conformance.json`). Change one engine, change the other |
| `app/play.py` | Multiplayer play: deals a started game's opening state and applies actions (turn checks, auto-finish). The only code that changes a live state |
| `app/generation.py`, `app/llm.py` | Card generation (rules.md §2.2.1): exact-mix planning, batches, duplicate detection, the background runner; `llm.py` calls OpenAI / Gemini over HTTP with a JSON schema |
| `app/live.py` | The in-memory WebSocket hub: who watches which game, broadcasts, presence and the server-side question timer |
| `app/validation.py` | Board issues (`validate_board`, a line-by-line port of `validateBoardFile` in `frontend/src/engine/board.ts`) and game-setup checks (port of `resolve.ts`). `tests/test_validation.py` replays the frontend's fixture to keep them identical |
| `migrations/`, `seeds/` | Numbered `.sql` files |

## Conventions

- Every table name starts with `trivia_`.
- Repositories use plain SQL with `%s` parameters, and never return or accept bare dicts:
  - Reads map rows straight into Pydantic models with `class_row(Model)`, which fails loudly if a query and its model drift apart.
  - Single values (`count(*)`, `RETURNING id`) go through `db.fetch_scalar`.
  - Partial updates take a `...Changes` model. Only the fields you set get written, and its `extra="forbid"` config acts as the column allow-list for the dynamic `UPDATE` (built with `psycopg.sql.Identifier`, never string formatting).
- A board's `definition` is stored as `jsonb` and typed in Python as `formats.BoardDefinition`. Its `config` is partial: only the settings that differ from the defaults are stored, so changing a default changes every board that doesn't override it.
- New table → add its row model (and `New…` / `…Changes` models if it's writable) to `app/models.py` alongside the migration.
- Secrets: passwords are bcrypt-hashed. Organization OpenAI and Gemini keys are encrypted with Fernet (`ENCRYPTION_KEY`) and the API only ever returns them masked (`sk-…1234`). Changing `ENCRYPTION_KEY` makes stored keys unreadable.
- Auth: `POST /api/auth/login` returns a JWT. Send it as `Authorization: Bearer <token>`. `POST /api/auth/logout` adds the token's `jti` to `trivia_revoked_tokens`, so it stops working right away. The user's role is read from the database on every request.
- Impersonation: a root user calls `POST /api/auth/impersonate/{user_id}` (member users only) and gets a token that acts as that member. Its `sub` is the member and its `imp` claim is the root user. Every permission check sees the member; `CurrentUser.impersonator` holds the root user, and `/api/auth/me` returns it as `impersonator`. These tokens last `IMPERSONATION_EXPIRE_MINUTES`, stop working as soon as the impersonator is no longer root, and can't be nested. Exiting means `/logout` with that token. Every start is logged (`auth` logger).

## Permissions

| Action | root | member |
|---|---|---|
| List / view organizations | all | own only |
| Create / update / delete organizations | ✔ | ✘ |
| List / view users | all | own organization only |
| Create users | any organization, any role | own organization, role `member` only |
| Update users | ✔ | `member` users in own organization (including themselves); can't grant `root` or move organizations |
| Delete users | ✔ (not yourself) | ✘ |
| Impersonate a member user | ✔ any organization | ✘ |

| Categories, decks, cards, boards, games; hosting a game (start, players, skip turn, new link, end) | every organization | own organization: full create / edit / delete |
| Set an organization's OpenAI / Gemini key | ✔ | ✘ (sees them masked) |
| Generate cards for a deck (with the organization's keys) | every organization | own organization |

Players don't need an account (rules.md §2.7). The game's join code lets anyone join while it's awaiting, and the player token they get proves which player a device is. Who can watch a game's WebSocket: its organization's users (and root), its players, and anyone with its join code.

Other rules: the last root user can't be demoted or deleted, an organization that still has users can't be deleted, and anything outside your scope returns `404`.

## Game content

| Resource | Notes |
|---|---|
| `/api/categories` | `name`, `description`, `color`. Can't be deleted while cards or an awaiting game use it |
| `/api/decks`, `/api/decks/{id}/cards` | A card has `category_id`, `question`, `options` (null = open-ended), `answer` (for multiple choice, one of the options), `difficulty` 1–3, `grand_prize` |
| `/api/boards` | `definition` = `{config, slots, spaces}` (rules.md §2.1). Spaces use **slots**, not categories. Only the shape is checked on save: boards with problems are saved as **drafts** (SER-5). Every board in a response has `issues`: `[{code, severity, message, spaces, slot}]` (rules.md §2.1.1); any `error` keeps games from starting with it |
| `/api/games` | `board_id`, `deck_id`, `categories` (`{slot: category_id}`); `players` (`[{name}]`) only on create. Every game has a `join_code`; players have `joined` (from their own device) and `removed`. `GET /api/games/{id}` includes `setup_errors`, the list of what still blocks starting |
| `POST /api/games/{id}/start` | `awaiting → running`. Validates the setup, stores a `snapshot` (`{board, deck, mapping}`) so later edits don't affect the game, and deals the opening play state (table `trivia_game_states`) |
| `POST /api/games/{id}/finish` | `running → finished`: the host ends the game early. Reaching GAME_OVER finishes it by itself (MPL-10) |

## Generating cards (rules.md §2.2.1)

| Endpoint | What |
|---|---|
| `GET /api/decks/{id}/generation/providers` | `[{id, name, model}]` for each key the deck's organization has. Empty: generating isn't possible |
| `POST /api/decks/{id}/generation` | Starts a generation (201): `{provider?, count (1–200), categories: [{category_id, weight}], difficulty: {easy, medium, hard}, types: {multiple_choice, open}, instructions}`. Weights are relative. `provider` is required when both keys are set (422), 409 when the organization has no key for it, 409 when the deck already has a generation open |
| `GET /api/decks/{id}/generation` | The open generation or `null`: `{status: running/done/failed, cards, batches_done, batches_total, dropped_duplicates, dropped_invalid, messages, error, …}`. The UI polls it while it runs |
| `POST /api/decks/{id}/generation/accept` | `{job_id, cards: [CardIn]}`: the reviewed (possibly edited, possibly fewer) cards. Cards that repeat the deck are skipped: `{added, skipped_duplicates}`. 409 while running |
| `DELETE /api/decks/{id}/generation` | Discards it. A running one stops after the calls in flight |

How it works: the request is planned into exact counts per (category, difficulty, type) (`generation.plan`), split into calls of up to `GENERATION_BATCH_SIZE` cards per category (`plan_batches`), and run on a thread pool in this process (`generation.runner`): categories in parallel (`GENERATION_PARALLEL_CALLS`), each category's calls in order. Each reply is checked (`check_card`) and deduplicated (`Deduper`) against the deck and the job, appended to `trivia_generation_jobs.cards`, and missing cards are asked for again (2 rounds). Like the WebSocket hub, the runner lives in process memory: on startup, jobs still `running` are marked failed. Models come from `OPENAI_MODEL` / `GEMINI_MODEL`; the keys only ever come from the organization. The test suite replaces `llm.complete_json` with a fake; `RUN_LIVE_LLM=1 uv run pytest tests/test_generation_live.py -s` calls the real APIs with `OPENAI_API_KEY` / `GEMINI_API_KEY` from `.env`.

## Multiplayer (rules.md §2.7)

| Endpoint | Who | What |
|---|---|---|
| `POST /api/games/{id}/join` `{code, name}` | anyone with the link | Joins an awaiting game. Returns `{player, player_token}`; the device keeps the token. Wrong code 404, started 409, name taken (ignoring case) 409, 12 players 409 |
| `POST /api/games/{id}/leave` (header `X-Player-Token`) | that player | Leaves the lobby. 409 once the game runs |
| `POST /api/games/{id}/players` `{name}` | host | Adds a player without a device: they play on the host's screen |
| `PUT /api/games/{id}/players/order` `{player_ids}` | host | New turn order. 409 if the list isn't exactly the current players (someone joined meanwhile) |
| `DELETE /api/games/{id}/players/{pid}` | host | Awaiting: deletes the player. Running: removes them from the game (MPL-9); 409 for the last player |
| `POST /api/games/{id}/skip-turn` | host | Ends the active player's turn (MPL-8) |
| `POST /api/games/{id}/join-code` | host | A new join code; the old link stops working |
| `WS /api/games/{id}/ws` | see Permissions | The live view (below) |

**WebSocket protocol.** The client's first message says who it is, with whatever it has: `{"type": "hello", "token": <login JWT>?, "player_token": ?, "code": ?}`. Without access it gets `{"type": "error", "fatal": true}` and close code 4404 (4400 for a bad hello). Then, after every change to the game (joins, start, actions, someone connecting or dropping), the server sends `{"type": "game", "game": {id, name, status, board_name, players: [{id, name, position, joined, removed, online}]}, "state", "version", "server_now", "you": {player_id, can_host}}`. `state` is the engine's `GameState` without `cards`, `decks`, `rng`, and without the pending card's `correct_answer` (MPL-6). `server_now` lets clients run question timers in server time. A device sends `{"type": "action", "action": {"type": "ROLL" | "MOVE" | "CHOOSE_CATEGORY" | "ANSWER" | "TIMEOUT", …}}`; mistakes come back as `{"type": "error", "message"}` to that device only. When the game is deleted, everyone gets `{"type": "gone"}`.

How it works: actions lock the game's `trivia_game_states` row, run the engine (`app/engine`), and save the new state with `version + 1`. The hub (`app/live.py`) then reads the game and sends each socket its view, one broadcast per game at a time so views never arrive out of order. It also schedules a timeout task for each pending question, so absent players can't stall a game. The hub lives in process memory: this is fine for the single uvicorn process the app runs as, but several workers would need shared broadcasts (for example Postgres `LISTEN/NOTIFY`). Long-lived sockets check the login token only when they connect.

List endpoints return the caller's organization. Root users can pass `?organization_id=`, and `organization_id` in create bodies. A game's board, deck and categories must belong to the game's organization.

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
uv run python -m app.migrations new "more demo decks" --seed   # -> seeds/0003_more_demo_decks.sql
uv run python -m app.migrations seed     # applies pending migrations, then pending seeds
```

They also run on startup when `RUN_SEEDS=true`. Set it to `false` for environments that shouldn't have demo data. Make seeds safe to re-run, for example with `INSERT … ON CONFLICT DO NOTHING`, because the target database may already have some of the rows.

Current seeds: `0001` adds two demo organizations. `0002_example_content.sql` loads `frontend/public/boards/*.json` and `decks/general.json` into the `Default` organization. It was generated from those files by `python scripts/generate_example_seed.py`; existing databases keep the copy they already seeded.

Don't put user passwords in seeds; the first root user is created from `.env`. To seed users for local testing, create them through the API or the Organizations tab.

### Resetting the local database

```bash
docker compose -f docker/docker-compose.yml down -v   # -v deletes the pgdata volume
docker compose -f docker/docker-compose.yml up
```
