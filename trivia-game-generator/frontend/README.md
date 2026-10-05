# Trivia Game Generator (frontend)

A React + Vite app. After login it shows:
- **Organizations** (root) / **My organization** (member): CRUD for organizations and their users, backed by the FastAPI backend.
- **Boards demo** (root only): loads board definitions from JSON and lets you play turns on them (hot-seat, 1–4 players). The game logic follows [`../rules.md`](../rules.md). Code comments cite its rule IDs.

Usually run through `docker/docker-compose.yml`. To run it locally instead (the backend must be running on :8000):

```bash
npm install
npm run dev     # http://localhost:5173. /api is proxied to VITE_API_PROXY (default http://localhost:8000)
npm test        # engine tests against the example boards
npm run build
```

Auth: the JWT from `/api/auth/login` is kept in `localStorage` and sent as a bearer token (`src/api.ts`, `src/auth.tsx`). A 401 response returns to the login screen.

## Layout

| Path | What |
|---|---|
| `public/boards/index.json` | Manifest of example boards (SER-1) |
| `public/boards/*.json` | Board definitions (SER-2). Each space has `type`, `category`, `next` (forks = more than one entry) and `pos` |
| `public/decks/general.json` | Sample card deck (SER-3) |
| `src/engine/` | Pure TypeScript game engine, no React. It can move to the server later as is |
| `src/engine/engine.ts` | `createGame` / `applyAction(state, action, now)`: a pure state machine (§3–§7) |
| `src/engine/movement.ts` | Legal destinations for a roll (MOV-*, FRK-*) |
| `src/engine/board.ts` | Default config and board/deck validation (BRD-*, CRD-*) |
| `src/engine/loader.ts` | The only I/O: fetches JSON from `public/`. Swap for API calls later |
| `src/components/` | Canvas board renderer, game panels, login and Organizations pages |
| `src/BoardsDemo.tsx` | The boards demo tab |
| `src/api.ts` | REST client for the backend |

## Example boards

- **Linear Snake**: plain linear track. Finish + Grand Prize, or collect all HQ tokens.
- **Classic Loop**: closed loop with no finish. Collect all tokens, or best score after 12 rounds.
- **Forked Paths**: linear track with two forks (short risky branch vs longer safe one).
- **Loop with Shortcut**: loop with a shortcut through the middle.
- **Special Spaces Sandbox**: 4-sided die, 15 s timer, many roll-again, penalty and wildcard spaces.

## Testing aids

- **Dice: rig N** forces the next roll, so you can test specific forks or spaces.
- **force ✓ / force ✗** settles a question without answering it.
- **Disable answer timer** and **Seed**: the same seed with the same inputs replays the same game.
- **Load JSON…** loads a board file from disk and validates it. Its `deck` path must exist under `public/`.
