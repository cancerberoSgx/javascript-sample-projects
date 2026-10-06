# Trivia Game Generator

A web app where organizations build trivia board games: categories, decks of questions, board layouts, and games with players. The long-term goal is a **generator**: boards and decks are plain data (later generated with an LLM using each organization's OpenAI key), so new games need no code changes.

Read first:
- `rules.md` is the game spec. Every rule has an ID (`MOV-2`, `BRD-4`, `GAM-3`, `SER-4`…). Code, tests and discussions cite these IDs. Update it whenever game behavior or a data format changes.
- `prompts.md` is the user's log of the feature requests so far (the "why" behind the code).
- `backend/README.md` covers the API, permissions table, and how to add migrations and seeds. `frontend/README.md` covers the UI and engine layout.

## Layout

| Path | What |
|---|---|
| `frontend/` | React 19 + Vite 8 + TypeScript 7. `src/engine/` is the pure game engine; `src/components/` holds the pages |
| `backend/` | FastAPI + psycopg 3 on Postgres 18, Python 3.14, managed with `uv`. Plain SQL, no ORM |
| `docker/docker-compose.yml` | db + backend (uvicorn `--reload`) + frontend (Vite dev server), with source bind-mounted |
| `.env` / `.env.example` | All config. `.env` is gitignored; `docker/.env` is a committed symlink to it, because that's where Compose looks |
| `frontend/public/boards/*.json`, `decks/general.json` | Example board and deck files (format v2). Also seeded into the DB |

The git repo root is the parent folder (`javascript-sample-projects`), on branch `master`. Only commit when asked.

## Commands

```bash
./docker/init-env.sh                                   # once: .env with generated secrets
docker compose -f docker/docker-compose.yml up --build # whole app: http://localhost:5173, API docs :8000/docs
docker compose -f docker/docker-compose.yml up -d --wait db   # just Postgres (needed by backend tests)

# backend (from backend/)
uv run pytest -q                                        # real Postgres: TEST_DATABASE_URL, wiped per test
uv run --with pyright pyright app                       # must stay at 0 errors
uv run --with ruff ruff check app tests scripts --select I,F --fix
uv run python -m app.migrations status|up|seed|new "description" [--seed]

# frontend (from frontend/)
npx tsc -b && npx vitest run                            # engine tests run against the real example JSON files
```

**On this machine:** host ports 5432 and 5173 are already taken (another Postgres, and the user's own Vite). That's why Postgres maps to **5433**. To run a test stack next to the user's Vite, use `FRONTEND_HOST_PORT=5180 docker compose … up -d`, and stop it afterwards with `docker compose -f docker/docker-compose.yml down` (keep the volume, so no `-v`). Local root login: `ROOT_EMAIL` / `ROOT_PASSWORD` from `.env`.

**Verify UI changes in a real browser.** Drive the app with Playwright and headless Chromium (browsers are cached in `~/.cache/ms-playwright`; install `playwright` in a scratch folder, not in the repo). Take screenshots and look at them. This has caught real bugs that typecheck and unit tests missed (a canvas crash, a 401 race).

## Architecture and conventions

### Domain model (rules.md §2)
- Every piece of content belongs to an **organization**. Users are `root` (all organizations) or `member` (own organization only). Players are just names, not users.
- A **board** has category **slots** (`A`, `B`, …), never categories. A **game** maps each slot to a category, so one board works for any topic.
- **Cards** store `answer` text. For multiple choice it must be one of `options`. `grand_prize: true` cards are only drawn for the final question.
- **Game status:** `awaiting → running → finished`. `awaiting` is the lobby players join. Starting copies board, deck and categories into `trivia_games.snapshot`, so later edits never touch a started game (GAM-3).
- **Multiplayer** (rules.md §2.7, `MPL-*`): each player plays on their own device. **The server is authoritative.** It runs a Python port of the engine (`backend/app/engine/`) on one live state per running game (`trivia_game_states`, saved after every action). Devices send actions over a WebSocket (`/api/games/:id/ws`), and the hub (`app/live.py`) broadcasts each change with the secrets stripped (`public_view`: no cards, piles, RNG or pending answer). Players are guests: the game's `join_code` (in the link `/games/:id?code=…`) lets them join while awaiting, and the player token they get (only its sha256 is stored) proves who a device is. The server runs the question timer. Players the host added by name play on the host's screen. Hot-seat play and named saves no longer exist (migration 0004 dropped them).

### Formats (version 2) and the engine
- `BoardFile` / `DeckFile` (`frontend/src/engine/types.ts`) are the shared shapes: example files, the API's board `definition`, and game snapshots all use them. The Python equivalents are in `backend/app/formats.py`.
- The engine (`engine.ts`) is pure TypeScript with no React or DOM: `applyAction(state, action, now)` returns a new state, and the RNG is seedable. It works on a *resolved* board (spaces carry category ids). `resolve.ts` turns BoardFile + slot mapping + DeckFile into that resolved form, so the engine itself never knows about slots.
- **Two engines, one behavior.** The browser runs the TS engine (Boards demo). The server runs `backend/app/engine/` (multiplayer), a line-by-line port with the same states and error messages. `engine.test.ts` writes `backend/tests/fixtures/engine_conformance.json` (scripted games on every example board, run with `UPDATE_CONFORMANCE=1`), and checks it is current. `backend/tests/test_engine.py` replays it. The UI takes `GameView` (a `GameState` minus the secrets), so it renders both.
- A board's `config` is **partial**: only overrides of the rules.md §1 defaults are stored. The backend's `BoardConfig` serializer drops `None`s on purpose; a `null` would override the frontend's defaults.

### Backend
- Layers: `routers/` → `permissions.py` → `repositories/` (all SQL) → `models.py` (typed rows). `schemas.py` holds the API models, kept separate so `password_hash` and encrypted keys never reach a response.
- **Repositories never take or return bare dicts.** Reads use `class_row(Model)`, single values use `db.fetch_scalar`, and partial updates take a `…Changes` model passed to `_sql.update_row`. The `extra="forbid"` config on those models is the column allow-list.
- Pooled connections are **autocommit**. Every write goes inside `with conn.transaction():`.
- **All access rules live in `permissions.py`.** A resource outside the caller's organization returns **404**, not 403. A forbidden action on something they can see returns 403.
- Every table name starts with `trivia_`. Migrations are numbered SQL files and **never edited after being applied**: add a new one instead. Data the app needs in every environment goes in migrations; demo data goes in `seeds/`. Startup order: migrations → root bootstrap → seeds.
- `validation.py` is a **Python port** of `frontend/src/engine/board.ts` + `resolve.ts`, using the same rule IDs. Change one, change the other.
- Secrets: passwords use bcrypt. Organization OpenAI keys are Fernet-encrypted with `ENCRYPTION_KEY` and only ever returned masked. JWTs carry a `jti`; logout revokes it in `trivia_revoked_tokens`. The role is re-read from the DB on every request.
- **Impersonation:** root calls `POST /api/auth/impersonate/{member_id}` and gets a short-lived token. Its `sub` is the member and its `imp` claim is the root user. All permission checks see the member, and `CurrentUser.impersonator` holds the root user. The token dies as soon as the impersonator stops being root, and impersonation can't be nested.
- Don't run `ruff format` over the codebase. It was never applied, and a mass reformat would bury real diffs.

### Frontend
- `api.ts` is the only HTTP client. Requests go to `/api` on the same origin, and Vite proxies them to `VITE_API_PROXY`. `ApiError.details` carries the server's validation lists, shown by `ErrorBox`.
- `auth.tsx` holds the session. While impersonating, the root token waits in `trivia.token.impersonator`. A 401 handler gets the token that the failed request used and ignores stale ones. That fixed a race where several failing requests logged root out.
- **Routes** (react-router, `App.tsx`): `/games/:id`, `/boards/:id`, `/decks/:id`, `/categories/:id`, `/organizations/:id`, `/demo`. `/games/:id?code=…` is the **player page** (`PlayerGamePage`), rendered before the login check, so it works logged out. The URL *is* the selection: pages use `useRouteSelection` (`common.tsx`) and navigate instead of keeping a selected id in state. For root, `ContentRoute` resolves a deep-linked item's organization; in-app links pass it as `RouteState` to skip that lookup. Details in `frontend/README.md`.
- The UI only *hides* actions a user can't take. The backend enforces everything.
- Content pages (`GamesPage`, `BoardsPage`, `DecksPage`, `CategoriesPage`) take an `orgId`. Root users pick one in the toolbar; members always use their own. The **Boards demo** tab (root only) plays the example JSON files locally.
- The play UI (`PlayTable.tsx`: `useGamePlay`, `BoardView`, `GamePanels`, `TurnPanel` with `canAct`/`dev`/`clockOffset`) is shared by the Boards demo and live games (`LiveGame.tsx`: `useLiveGame`, `LiveTable`, lobby, share link, host controls). Change it once.
- `BoardCanvas` draws any resolved board. `BoardPreview` (in `common.tsx`) wraps it for boards that may have unmapped slots.

### Keep in sync (checklist)
- **Engine change** (rules, `GameState`, actions, log text): `frontend/src/engine/*` → the same change in `backend/app/engine/*` → `UPDATE_CONFORMANCE=1 npx vitest run src/engine` → `uv run pytest tests/test_engine.py` must pass → `formats.EngineState` if a typed field changed. Live states in `trivia_game_states` must still load.
- **New table:** migration → row models in `models.py` → repository → API schemas → router (+ `permissions.py`) → tests → `backend/README.md`.
- **Game or format rule change:** `rules.md` → `engine/board.ts` / `resolve.ts` → `backend/app/validation.py` / `formats.py` → tests on both sides.
- **Example JSON change:** `python backend/scripts/generate_example_seed.py`, and regenerate the engine conformance fixture (it plays every example board). Seed `0002` is already applied in existing databases, so changes for those need a new seed file.

## Working with this user
- Big features usually end with "do you have any questions before proceeding?". Answer with a few focused `AskUserQuestion` questions (up to 4), each with a **(Recommended)** option. State the smaller defaults you'll use in a sentence, then build the whole thing once they answer. So far they have always picked the recommended options.
- They want the whole slice: backend, frontend, tests, docs, and a real run of the app before saying it's done. Report what was verified and how, mention anything flaky or unverified, and list design decisions made on their behalf.

## Built so far (see prompts.md)
1. `rules.md`: game rules made precise, with rule IDs and resolved ambiguities (§9).
2. Frontend board simulator: canvas board, click-to-move with validation, forks, special spaces, questions, win conditions, JSON viewer, example boards.
3. Clearer legal-move highlighting (dim everything else). The HQ outline had looked like a move target.
4. Backend foundation: FastAPI + Postgres + compose, SQL migrations/seeds, organizations and users (root/member), JWT login/logout with revocation, encrypted OpenAI keys, login UI and Organizations tab.
5. Typed repositories (Pydantic row models, no dicts), pyright clean.
6. Content: categories, decks + cards, boards (slots), games + players, start/finish with snapshot. Example content seeded. Management tabs in the UI.
7. Impersonation of member users by root, with a banner and Exit.
8. URL routes for every tab and item (`/games/1`, `/organizations/4`, …), with deep links surviving login.
9. Playing stored games (`/games/:id/play`, hot-seat on the snapshot) with named saves in `trivia_game_instances` (save, save as new, continue, delete).
10. Multiplayer (replaces 9): lobby with join link and unique names, `awaiting` status, server-authoritative play over WebSockets, a Python engine port with a TS conformance fixture, presence, server-side question timer, host skip/remove/end, auto-finish on game over.

## Known gaps and likely next steps
- The WebSocket hub is in-process memory: fine for one uvicorn process, but several workers would need shared broadcasts (Postgres `LISTEN/NOTIFY`). Sockets check the login token only on connect.
- The board canvas is small on phones (tiles about 22px wide), which makes tapping moves fiddly. A zoom, or a list of legal moves as buttons, would help.
- No rate limit on `join` (8-hex join codes) or login.
- LLM features from `readme.md`: lenient answer checking (EVL-3, needs the backend and the organization's key), generating categories, decks and boards.
- Tokens (login and player) live in `localStorage`.
- The backend suite once failed with 9 setup errors that never reproduced in 6+ reruns. Look into it if it recurs.
- `frontend/tsconfig.tsbuildinfo` is tracked in git, and changes on every typecheck.
