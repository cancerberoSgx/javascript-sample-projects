# AGENTS.md

## Repo shape
- This is a flat collection of 50+ independent demo apps in one git repo (branch `master`), not a JS monorepo. There is no root `package.json`, workspace, lockfile, CI, lint, or test command.
- Work from the specific project directory. Read its `README.md`/`readme.md` first; a few have none (`canvas-webassembly-fractals`, `graphql`, `gulp-jst-backbone`, `puppeteer-example`, `reactNativeDetox`, `ts-preact-browserify`, `wye-bitmap-to-vector-presentation`), so inspect `package.json` / Dockerfile instead.
- Each project owns its dependencies and lockfile (38 `package-lock.json`, plus `next-js-example/yarn.lock` and `trivia-game-generator/backend/uv.lock`). Do not hoist dependencies or add tooling at the repo root.
- Toolchains span legacy Gulp/Browserify/AngularJS through React 19/Tauri, with no shared Node version. Do not upgrade a toolchain unless asked.

## Per-project guidance
- `trivia-game-generator/CLAUDE.md` is detailed and authoritative for that project: game rules, TS/Python engine sync, migrations, and commands. Read it before touching that code.
- `tauri-react-ts-node-backend/CLAUDE.md` covers its Tauri/Rust/Node/SQLite architecture and commands.
- `open-code-test/` is the full-stack app in this workspace: FastAPI + SQLAlchemy + Postgres + JWT, React 19/Vite/TS/Tailwind, Docker Compose. See `open-code-test/README.md`.
  - Whole app: `cd open-code-test/docker && docker compose up --build` (frontend `:5173`, API docs `:8000/docs`, Postgres host `:5433`).
  - Frontend check: `cd open-code-test/frontend && npm run typecheck` (or `npm run build`, which typechecks then builds). There is no test suite.
  - Backend applies pending SQL migrations on startup (`backend/app/migrations/runner.py`). Add a new numbered `.sql` file; never edit an applied migration.
  - Frontend calls `/api`; Vite proxies it to `VITE_API_PROXY_TARGET` (default `http://localhost:8000`).

## Git and environment
- Git root is this directory (not an individual project). `open-code-test/` and `egui-python-probe1/` are currently untracked, and `trivia-game-generator/` has uncommitted edits. Do not reset or revert unrelated work.
- Commit only when explicitly asked.
- Host ports 5432 and 5173 are often already in use on this machine. Docker projects here map Postgres to 5433 and expose `*_PORT` overrides; check before starting a stack.
- There is no repo-local `opencode.json`; this file and the per-project READMEs/CLAUDE.md files are the shared guidance.
