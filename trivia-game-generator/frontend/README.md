# Trivia Game Generator (frontend)

A React + Vite app. After login it shows:
- **Games**: set up a game (board, deck, a category for each board slot, players), see what still blocks it, start it, finish it.
- **Boards**: edit a board's JSON definition, with live validation and a canvas preview. New boards can start from an example.
- **Decks**: questions and answers (open or multiple choice, difficulty, grand prize).
- **Categories**: name, description, color.
- **Organizations** (root) / **My organization** (member): CRUD for organizations and their users. Root users also get an organization picker on the content tabs.
- **Boards demo** (root only): loads board definitions from JSON and lets you play turns on them (hot-seat, 1–4 players). The game logic follows [`../rules.md`](../rules.md). Code comments cite its rule IDs.

Usually run through `docker/docker-compose.yml`. To run it locally instead (the backend must be running on :8000):

```bash
npm install
npm run dev     # http://localhost:5173. /api is proxied to VITE_API_PROXY (default http://localhost:8000)
npm test        # engine tests against the example boards
npm run build
```

Auth: the JWT from `/api/auth/login` is kept in `localStorage` and sent as a bearer token (`src/api.ts`, `src/auth.tsx`). A 401 response returns to the login screen.

Impersonation: root users get an **Impersonate** button on member users (Organizations tab). The app then runs with the member's token, so it looks and behaves exactly as it does for them, under a yellow banner with **Exit impersonation**. Meanwhile the root token waits in `localStorage` (`trivia.token.impersonator`) and is restored on exit, or automatically if the impersonation token expires. The whole app remounts on every switch (`key={user.id}`), so no state carries over between users.

## Layout

| Path | What |
|---|---|
| `public/boards/index.json` | Manifest of example boards (SER-1) |
| `public/boards/*.json` | Example boards (SER-2, format v2). Each space has `type`, `slot`, `next` (forks = more than one entry) and `pos`. Also seeded into the backend |
| `public/decks/general.json` | Sample deck (SER-3) with its categories. Also seeded into the backend |
| `src/engine/` | Pure TypeScript game engine, no React. It can move to the server later as is |
| `src/engine/engine.ts` | `createGame` / `applyAction(state, action, now)`: a pure state machine (§3–§7) |
| `src/engine/movement.ts` | Legal destinations for a roll (MOV-*, FRK-*) |
| `src/engine/board.ts` | Default config and board/deck validation (BRD-*, CRD-*) |
| `src/engine/resolve.ts` | Board file (slots) + slot→category mapping + deck file → the engine's board and cards. Also used for game snapshots from the backend |
| `src/engine/loader.ts` | Fetches the example JSON for the boards demo. The demo plays slot A, B, … with the deck's categories in order |
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
