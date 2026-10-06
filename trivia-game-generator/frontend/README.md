# Trivia Game Generator (frontend)

A React + Vite app. After login it shows:
- **Games**: set up a game (board, deck, a category for each board slot), share its link, watch players join live, start it. A running game shows the live board with host controls (skip a turn, remove a player, end the game). See [Multiplayer](#multiplayer).
- **Player page** (`/games/:id?code=…`): what players open on their own devices. No login: pick a name, wait in the lobby, play your turns.
- **Boards**: edit a board's JSON definition, with live validation and a canvas preview. New boards can start from an example.
- **Decks**: questions and answers (open or multiple choice, difficulty, grand prize).
- **Categories**: name, description, color.
- **Organizations** (root) / **My organization** (member): CRUD for organizations and their users. Root users also get an organization picker on the content tabs.
- **Boards demo** (root only): loads board definitions from JSON and lets you play turns on them (hot-seat, 1–4 players). The game logic follows [`../rules.md`](../rules.md). Code comments cite its rule IDs.

## URLs

Every tab has its own address ([React Router](https://reactrouter.com), `BrowserRouter` in `src/App.tsx`), so links can be shared, reloaded and bookmarked, and Back/Forward work:

| URL | Shows |
|---|---|
| `/` | Redirects to `/games` |
| `/games/:id`, `/boards/:id`, `/decks/:id` | That item, selected in its list. The bare list URL (`/games`) opens the first item |
| `/games/:id?code=:joinCode` | The player page (`PlayerGamePage`), logged in or not. It's rendered before the login check in `App.tsx` |
| `/games/:id/play` | Old hot-seat URL: redirects to `/games/:id` |
| `/categories`, `/categories/:id` | The categories table; with an id, that category's edit form |
| `/organizations/:id` | That organization and its users. Members only ever see their own |
| `/demo` | Boards demo (root only; others are sent to `/games`) |

- Logged out, the login page shows on the requested URL and opens it after login.
- A root user can open a link to any organization's item: `ContentRoute` looks up the item's `organization_id` and switches the organization picker to it. Links inside the app pass the organization in the navigation state (`RouteState`), which skips that lookup.
- An id that doesn't exist, or that belongs to an organization the user can't see, shows "… not found". Unknown paths show "Page not found".
- Pages get the selection from `useRouteSelection` (`components/common.tsx`) and change it by navigating, never with local state.
- Impersonating goes to `/games`, exiting goes back to `/organizations/<the member's organization>`, and logging out goes to `/`.
- The Vite dev server already falls back to `index.html` for these paths. A production static server must do the same (serve `index.html` for unknown non-`/api` paths).

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
| `src/engine/` | Pure TypeScript game engine, no React. The backend runs a Python port of it (`backend/app/engine/`) for multiplayer games; `engine.test.ts` writes the conformance fixture that keeps them identical |
| `src/engine/engine.ts` | `createGame` / `applyAction(state, action, now)`: a pure state machine (§3–§7) |
| `src/engine/movement.ts` | Legal destinations for a roll (MOV-*, FRK-*) |
| `src/engine/board.ts` | Default config and board/deck validation (BRD-*, CRD-*) |
| `src/engine/resolve.ts` | Board file (slots) + slot→category mapping + deck file → the engine's board and cards. Also used for game snapshots from the backend |
| `src/engine/loader.ts` | Fetches the example JSON for the boards demo. The demo plays slot A, B, … with the deck's categories in order |
| `src/components/` | Canvas board renderer, game panels, login and Organizations pages |
| `src/BoardsDemo.tsx` | The boards demo tab |
| `src/api.ts` | REST client for the backend |
| `src/App.tsx` | Header, tabs and routes |
| `src/components/PlayTable.tsx` | The play UI shared by the Boards demo and live games: `useGamePlay` (dispatch + toasts; `useLocalGamePlay` runs the engine in the browser), `BoardView`, `GamePanels` |
| `src/components/LiveGame.tsx` | Multiplayer: `useLiveGame` (the game's WebSocket), `LiveTable`, lobby list, join form, share link, host controls |
| `src/components/PlayerGamePage.tsx` | `/games/:id?code=…`: the player's own device |

## Multiplayer

Games are played live, each player on their own device (rules.md §2.7). The server runs the engine; the browser only sends actions and draws what the server broadcasts.

- **Host** (any user of the organization), on `/games/:id`: sets the game up, copies the **join link**, and watches players join (green dot = online). Players can be reordered or removed, and the host can add players by name who then play on the host's screen. The host can also join from this device. **Start game** closes the lobby. While running: **Skip <name>'s turn**, **Remove** a player, **End game**.
- **Players** open the link: name → lobby → game. The device keeps a player token in `localStorage` (`trivia.player.<gameId>`), so a reload or a dropped connection comes back as the same player. Opening the link without joining (or after the start) just watches.
- `useLiveGame(gameId, code)` opens `ws(s)://<host>/api/games/:id/ws` (Vite proxies it, `ws: true`), sends the hello (login token, player token, code), keeps the latest message, and reconnects with backoff. `canActNow()` decides whether this screen plays the current turn; others see "Waiting for … to roll" and the question read-only.
- Question timers run on server time (`server_now` → `clockOffset`), and the server times out unanswered questions itself, so the browser never sends a timeout in multiplayer.

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
- These are Boards demo only. Multiplayer games have no rigged dice or forced answers (MPL-7).
- **Load JSON…** loads a board file from disk and validates it. Its `deck` path must exist under `public/`.
