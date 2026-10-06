# Trivia Game Generator (frontend)

A React + Vite app. After login it shows:
- **Games**: set up a game (board, deck, a category for each board slot, players), see what still blocks it, start it, finish it. A running game has **▶ Play** and a list of its saves.
- **Play** (`/games/:id/play`): plays a running game on its snapshot, exactly like the Boards demo (hot-seat: the game's players take turns on one screen). **Save** stores the whole play state on the server; anyone in the organization can **Continue** it later (rules.md §2.7).
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
| `/games/:id/play`, `/games/:id/play?save=:saveId` | Play a running game; with `save`, that save is loaded. Saving updates `?save=`, so a reload continues from the last save |
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
| `src/engine/` | Pure TypeScript game engine, no React. It can move to the server later as is |
| `src/engine/engine.ts` | `createGame` / `applyAction(state, action, now)`: a pure state machine (§3–§7) |
| `src/engine/movement.ts` | Legal destinations for a roll (MOV-*, FRK-*) |
| `src/engine/board.ts` | Default config and board/deck validation (BRD-*, CRD-*) |
| `src/engine/resolve.ts` | Board file (slots) + slot→category mapping + deck file → the engine's board and cards. Also used for game snapshots from the backend |
| `src/engine/loader.ts` | Fetches the example JSON for the boards demo. The demo plays slot A, B, … with the deck's categories in order |
| `src/components/` | Canvas board renderer, game panels, login and Organizations pages |
| `src/BoardsDemo.tsx` | The boards demo tab |
| `src/api.ts` | REST client for the backend |
| `src/App.tsx` | Header, tabs and routes |
| `src/components/PlayTable.tsx` | The play UI shared by the Boards demo and stored games: `useGamePlay` (dispatch + toasts), `BoardView`, `GamePanels` |
| `src/components/GamePlayPage.tsx` | `/games/:id/play`: new playthrough, save / save as new, load, delete. Warns before leaving with unsaved progress |

## Saved games

A save is the engine's `GameState` as JSON: positions, scores, tokens, the draw/used piles, the RNG, the pending question and the log. So loading continues exactly where it stopped, with the same upcoming dice and cards (SAV-2). The question timer is wall-clock time, so `suspendGame()` stores the time left before saving and `resumeGame()` restarts it on load (SAV-3, `engine.ts`).

- **Save** overwrites the loaded save (or creates the first one); **Save as new** keeps it and adds another.
- Unsaved progress: the Save panel says so, loading another save asks first, and the browser asks before a reload or close. In-app links (the tabs) don't ask, because `BrowserRouter` has no navigation blocking.
- Reaching game over doesn't finish the stored game: **Mark game as finished** does, and after that it can't be played or saved.

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
