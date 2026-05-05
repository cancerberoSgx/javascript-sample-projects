# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **SQL Inspector** desktop app built with Tauri v2. The UI is React + TypeScript (Vite). The application logic lives in a Node.js/Express backend that Rust spawns as a child process. Rust acts only as a process manager — the React frontend talks directly to the Node backend over HTTP.

## Commands

### Full app (Tauri + Node backend auto-spawned)
```sh
npm run tauri dev       # Launches Vite, Rust shell, and auto-spawns node-backend
export NO_STRIP=true && npm run tauri build   # Production build (Linux requires NO_STRIP)
npx tauri -v build      # Verbose build
```

### Browser-based development (recommended for building features)
```sh
# Terminal 1 — node-backend with a fixed port so the URL stays stable between restarts
cd node-backend && PORT=3001 npm run dev
# Prints: [server] Browser dev URL: http://localhost:1420?port=3001&token=<token>

# Terminal 2 — Vite only
npm run dev
# Open the URL printed above in the browser
```

### Node backend standalone
```sh
cd node-backend
npm install       # first time, or after adding dependencies
npm run dev       # tsx src/server.ts (auto-picks a free port unless PORT is set)
npm run build     # tsc → dist/
npm start         # node dist/server.js
```

## Architecture

### Three-layer stack

```
React (src/)  ──HTTP──▶  Node.js/Express (node-backend/)  ──SQL──▶  SQLite
                                    ▲
                          spawned & managed by
                            Rust (src-tauri/)
```

**Rust (`src-tauri/src/lib.rs`)** — process manager only. On startup it:
1. Checks for `node-backend/node_modules`; runs `npm install` automatically if missing
2. Spawns `node_modules/.bin/tsx src/server.ts` with stdout piped
3. Reads stdout line-by-line until it sees `READY:{port}:{token}`, stores both in `AppState`
4. Exposes a single Tauri command `get_backend_info` → `{ port, token }`
5. Kills the node process on drop

**Node backend (`node-backend/src/`)** — Express server, started by Rust or manually:
- Generates a random 32-hex-char session token via `crypto.randomBytes`
- Listens on `127.0.0.1` only; port 0 (OS-assigned) by default, or `PORT` env var
- Prints `READY:{port}:{token}` to **stdout** (parsed by Rust)
- Prints browser dev URL to **stderr** (human-readable, ignored by Rust)
- Initialises SQLite and runs pending migrations before starting

**React frontend (`src/`)** — never calls Rust commands directly for data. All data fetching goes to the Node HTTP API. `src/lib/backend.ts` resolves connection details:
1. `?port=PORT&token=TOKEN` URL params (browser dev mode)
2. `invoke('get_backend_info')` (Tauri runtime, detected via `window.__TAURI_INTERNALS__`)

### Key files

| Path | Role |
|------|------|
| `src-tauri/src/lib.rs` | Rust: spawns node backend, exposes `get_backend_info` |
| `node-backend/src/server.ts` | Express entry point, auth middleware, route mounting |
| `node-backend/src/db.ts` | SQLite init, migration runner, `getDb()` singleton |
| `node-backend/src/api/connections.ts` | Express router for `/api/connections` |
| `node-backend/src/repository/connectionRepository.ts` | Pure SQL data access |
| `node-backend/migrations/` | SQL migration files, applied in filename order |
| `src/lib/backend.ts` | `getBackendInfo()`, `apiUrl()`, `authHeaders()` helpers |

## Node Backend Conventions

### Authentication
Every request (except OPTIONS preflight) must include the header:
```
x-session-token: <token>
```
The token is generated fresh on each server start. The React app gets it via `get_backend_info` (Tauri) or the URL param (browser dev).

CORS is handled by a middleware placed **before** the auth middleware so OPTIONS preflights pass without a token.

### SQL — always pure SQL, no ORM or query builder
- Migrations: plain `.sql` files in `node-backend/migrations/`, named `NNN_description.sql`
- Queries: raw SQL strings passed to `node:sqlite` prepared statements
- `node:sqlite` is the built-in Node.js 22.5+ SQLite module — no native compilation needed
- Cast results with `as unknown as MyType` (node:sqlite returns `Record<string, SQLOutputValue>`)

### Database
- File: `~/.my_db_inspector/data` (created automatically on first run)
- WAL mode and foreign keys enabled
- Migration tracking: `schema_migrations` table (name + applied_at)
- New migrations are applied automatically on next server startup

### Code structure
```
node-backend/src/
  server.ts          # Express app, middleware, route mounting
  db.ts              # initDb(), getDb() singleton
  api/               # Express routers (one file per resource)
  repository/        # Data access (one file per resource, pure SQL)
migrations/          # NNN_description.sql files
```

### Adding a new API resource
1. Write the migration SQL in `migrations/NNN_name.sql`
2. Create `src/repository/fooRepository.ts` with typed functions using `getDb()`
3. Create `src/api/foo.ts` as an Express Router
4. Mount it in `server.ts`: `app.use('/api/foo', fooRouter)`

## Current API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Returns `{ success: true }` |
| GET | `/api/connections` | List all saved connections (ordered by name) |
| POST | `/api/connections` | Create a connection |
| PUT | `/api/connections/:id` | Update a connection |

All request/response bodies are JSON. `db_port` must be sent as a JSON number.

## React Frontend Conventions

- Use `getBackendInfo()` from `src/lib/backend.ts` — never call `invoke('get_backend_info')` directly
- Use `apiUrl(path, info)` and `authHeaders(info)` for every fetch call
- `BackendInfo` type is exported from `src/lib/backend.ts`

## Linux Setup (Manjaro/Arch)

```sh
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg xdotool
```

Tauri config: `src-tauri/tauri.conf.json`. Vite dev server pinned to port **1420**.
