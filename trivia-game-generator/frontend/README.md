# Trivia Game Generator (frontend)

A React + Vite app. After login it shows:
- **Games**: set up a game (board, deck, a category for each board slot), share its link, watch players join live, start it. A running game shows the live board with host controls (skip a turn, remove a player, end the game). See [Multiplayer](#multiplayer).
- **Player page** (`/games/:id?code=…`): what players open on their own devices. No login: pick a name, wait in the lobby, play your turns.
- **Boards**: a visual board editor (see [Board editor](#board-editor)), with live validation that points at the spaces involved. New boards can start blank or from an example.
- **Decks**: questions and answers (open or multiple choice, difficulty, grand prize), written by hand or generated with OpenAI / Gemini (see [Generating cards](#generating-cards)).
- **Categories**: name, description, color.
- **🌐 Library**: what every organization made public (boards, decks with their cards, categories, images). Copy anything into your organization, or add chosen cards to one of your decks. Boards, decks, categories and images get a **Publish to Library** / **Make private** control. See [Library](#library).
- **Organizations** (root) / **My organization** (member): CRUD for organizations and their users, the organization's OpenAI / Gemini keys (root only, shown masked) and models (any user of the organization; empty = default, checked when saved). Root users also get an organization picker on the content tabs.
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
| `/library/:kind/:id` | The Library (`boards`, `decks`, `categories`, `images`), with that public item selected. `/library` opens the boards |
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
| `src/engine/board.ts` | Default config and board validation: `validateBoardFile` returns issues (rules.md §2.1.1). `board.test.ts` writes the fixture that keeps the Python port identical |
| `src/engine/resolve.ts` | Board file (slots) + slot→category mapping + deck file → the engine's board and cards, plus the mapping and deck checks (BRD-5, CRD-*). Also used for game snapshots from the backend |
| `src/engine/loader.ts` | Fetches the example JSON for the boards demo. The demo plays slot A, B, … with the deck's categories in order |
| `src/components/` | Canvas board renderer, game panels, login and Organizations pages |
| `src/BoardsDemo.tsx` | The boards demo tab |
| `src/boardEditor/ops.ts` | Pure board edit operations (add, insert, delete with healing, arrows, forks, types, slots, settings) and `normalize` (path-order numbering). Tested in `ops.test.ts` |
| `src/boardEditor/EditorCanvas.tsx` | The editor's grid canvas: hit tests for spaces and arrows, dragging, problem highlights. Draws tiles and arrows with the helpers exported by `BoardCanvas.tsx` |
| `src/boardEditor/BoardEditor.tsx` | The editor page: undo/redo reducer, halo, selection inspector, checks, slots, settings and the advanced JSON panel |
| `src/api.ts` | REST client for the backend |
| `src/App.tsx` | Header, tabs and routes |
| `src/components/PlayTable.tsx` | The play UI shared by the Boards demo and live games: `useGamePlay` (dispatch + toasts; `useLocalGamePlay` runs the engine in the browser), `BoardView`, `GamePanels` |
| `src/components/LiveGame.tsx` | Multiplayer: `useLiveGame` (the game's WebSocket), `LiveTable`, lobby list, join form, share link, host controls |
| `src/components/GenerateCards.tsx` | Card generation: `useGeneration` (providers + the deck's open generation, polled while it runs), `GenerateForm`, `GenerationPanel` (progress, then the review list) |
| `src/components/background.ts` | Backgrounds (rules.md §2.1.2): the pure layout math (`boardArea`, `cropRect`, `placeBackground`, tested in `background.test.ts`), `useBackgroundImage`, and `BackgroundLayer`, which renders the image once into an offscreen canvas that both board canvases copy every frame |
| `src/components/LibraryPage.tsx` | The public Library (rules.md §2.8): search, a list + detail per kind, copy forms, the card picker for adding single cards to your decks |
| `src/components/BackgroundEditor.tsx` | `BackgroundEditor` (fit, crop rectangle, sliders) and `ImageLibrary` (upload, drop, import from URL, rename, delete). Used by the board editor and the game setup |
| `src/components/PlayerGamePage.tsx` | `/games/:id?code=…`: the player's own device. Lobby and join cards, then `PlayScreen` |
| `src/play/PlayScreen.tsx` | The phone-first play screen (rules.md §2.7.1): full-screen board, floating identity / turn pill / zoom buttons, the action dock (roll, legal-move buttons, back to the question), sheet buttons |
| `src/play/moments.tsx` | Dice, question card, answer reveal, wildcard picker, game over |
| `src/play/events.ts` | `diffEvents(prev, next)`: rolls, answers, new turns and game over, found by diffing two views (the server sends only states). Tested in `events.test.ts` |
| `src/play/layers.tsx` | `Layer` (native modal `<dialog>`: bottom sheet or centered card) and `Floating` (a manual popover, so notices stay above open dialogs) |
| `src/play/feedback.ts` | WebAudio sounds (no files; off by default, per device), vibration, screen wake lock, fullscreen |
| `src/play/play.css` | Play screen styles (phone first; short screens get a one-row top bar and a side nav) |
| `src/components/camera.ts` | Pan/zoom math for `BoardCanvas`'s `viewport` mode (fit, clamp, zoom around a point, pinch, bring into view). Tested in `camera.test.ts` |
| `src/components/useBoardCamera.ts` | Pointer, pinch, wheel and double-tap handling plus camera commands (`fit`, `zoomIn`, `zoomOut`, `focus`) |

## Multiplayer

Games are played live, each player on their own device (rules.md §2.7). The server runs the engine; the browser only sends actions and draws what the server broadcasts.

- **Host** (any user of the organization), on `/games/:id`: sets the game up, copies the **join link**, and watches players join (green dot = online). Players can be reordered or removed, and the host can add players by name who then play on the host's screen. The host can also join from this device. **Start game** closes the lobby. While running: **Skip <name>'s turn**, **Remove** a player, **End game**.
- **Players** open the link: name → lobby → game. The device keeps a player token in `localStorage` (`trivia.player.<gameId>`), so a reload or a dropped connection comes back as the same player. Opening the link without joining (or after the start) just watches.
- `useLiveGame(gameId, code)` opens `ws(s)://<host>/api/games/:id/ws` (Vite proxies it, `ws: true`), sends the hello (login token, player token, code), keeps the latest message, and reconnects with backoff. `canActNow()` decides whether this screen plays the current turn; others see "Waiting for … to roll" and the question read-only.
- Question timers run on server time (`server_now` → `clockOffset`), and the server times out unanswered questions itself, so the browser never sends a timeout in multiplayer.

### The play screen (players' phones)

The player page doesn't use the admin layout: `PlayScreen` draws the board full screen with `BoardCanvas` in **`viewport` mode** (the canvas fills its container and a camera pans/zooms the board; the admin canvases don't pass `viewport` and are unchanged). Everything else floats:

- Top: who this device is (name + color, or Host / Watching) and the status; sound and fullscreen; the **turn pill** (whose turn and what they're doing, plus the latest log line). It turns accent-colored on your turn.
- Right: + / − (hidden on short screens), fit the whole board, find my token.
- Bottom: the **dock** with this device's action (🎲 Roll, the legal-move buttons, "Back to the question", "Final results") and the sheet buttons: Players, Log, Legend, Board (info). Sheets slide up on phones and are centered panels on wide screens.
- Cards (`moments.tsx`): dice, question, answer reveal, wildcard, game over. They're driven by `diffEvents` between consecutive server views, so a device that connects mid-game just shows the current state (no replayed animations).
- Camera: the first view fits the whole board inside the floating bars (`useInsets` measures them). After your roll it brings your token and every legal destination into view with tappable tiles (≥ 48px); other players' moves are followed only if you haven't moved the board yourself in the last 6 s. Fitting never makes tiles bigger than 140px; the user can zoom to 280px.
- Wide boards on portrait phones (and tall ones in landscape) are drawn transposed when that's ≥ 25% bigger (rules.md PLY-UI-2).
- `html.play-mode` (set while the page is mounted) stops page scroll, overscroll and pull-to-refresh; the board and buttons use `touch-action` so pinches never zoom the page.
- PWA: `public/manifest.webmanifest` + `public/icons/` (PNG icons rendered from `icon.svg`). It has no `start_url`, so adding the game to the home screen opens that game's link. No service worker (a live game is useless offline).
- The host's game page links to the play screen ("Open the play screen ↗" in the invite panel), where the host can play the players they added by name.

## Generating cards

On a deck, **✨ Generate** (rules.md §2.2.1) opens a form: provider (a choice only when the organization has both keys), number of cards (≤ 200), categories with % shares, difficulty and question-type % shares, and free-text instructions (audience, language, theme). Each mix shows the exact card counts it becomes (`largestRemainder`, the same split the backend uses); shares that don't add up to 100% are scaled. Chosen categories without a description get a warning, since the description is what tells the model what belongs in a category. The button is disabled, with a tooltip, when the organization has no key or a generation is already open.

The generation runs on the server, so the page can be left and reopened. The panel polls `GET /decks/:id/generation` every 1.5 s and shows progress and the cards so far; **Stop and discard** cancels it. When it's done, the review list has every card ticked: untick some, **Edit** one (the regular `CardForm`, editing the local copy), then **Add N cards to deck**. Nothing is in the deck until then. **Discard all** throws the generation away.

## Library

Publishing and copying follow rules.md §2.8 (SHR-*). `PublishControl`, `PublicChip` and `CopiedFromNote` (in `components/common.tsx`) are shared by the board editor, the deck editor, the categories table and the image library (compact buttons there). `PublishControl` disables publishing with the reason shown when the backend would refuse it (drafts, empty decks), and asks for confirmation both ways. The Library page never edits anything: every action is a copy into the current organization (the member's own; for root, the toolbar's picker, labeled "Copies go to"). Copies are private, and the result message links to the new item. Categories and images you already have (same name / same file) show "✓" instead of a copy button.

## Board editor

`/boards/:id` edits a board visually. Boards with problems save as drafts (rules.md SER-5).

- **Click an empty cell** to add a space. With a space selected, the new space is chained after it: it takes over the selected space's arrow, so it is inserted into the track. After the finish, the finish moves forward to the new space. After a fork, it becomes a new branch. With an arrow selected, the new space goes on that arrow.
- **Click a space** to open its halo: type ◆, slot (choose, add, rename), arrow → (replaces the arrow out), fork ⑂ (adds another arrow out), make start ▶ / finish ⚑, delete 🗑 (arrows into it pass on to its next space), and label ✎. The inspector panel shows the same, plus the arrows in and out.
- **Click an arrow** to reverse or delete it. **Drag a space** to move it; dropping it on another space swaps the two.
- Keys: Del, A (arrow), B (branch), Esc, Ctrl+Z / Ctrl+Shift+Z.
- After every visual edit, `normalize` renumbers the spaces in path order (start 0, each fork branch in turn, finish last), and the selection follows. JSON edits in the Advanced panel are kept as typed.
- **Playable?** shows a checklist and every issue. Pointing at an issue makes its spaces glow, clicking it selects the space, and spaces with problems keep a red (error) or dashed amber (warning) outline.
- Settings store only overrides of the defaults. Switching to a loop turns the finish into a space that leads back to the start, and turns off the finish win.
- Arrows that would cross another tile are drawn bent around it, on the play board too.

## Backgrounds

A board's **Background** panel (in the editor's side column) sets its default background; undo/redo covers it, and the editor canvas shows it as it will look in a game. On a game that hasn't started, the **Background** panel chooses **Board's**, **Custom** (its own, starting from a copy of the board's) or **None**, next to a preview of the board; changes save by themselves (slider drags once they pause). Both use `BackgroundEditor`:

- **Image**: pick one from the organization's library, upload one (button or drop), or paste a URL to import (the server keeps a copy). Images in use can't be deleted.
- **Fill / Fit / Stretch / Mosaic** (cover, contain, stretch, tile). **Crop**: drag on the image to draw the part to use, drag it to move it, drag a corner to resize. **Match board shape** picks the largest part with the board's proportions.
- **Zoom** (fill, fit) or **Tile size** (mosaic), **Horizontal / Vertical** position, **Opacity**, **Fade** (a veil in the board color, for readable spaces), **Blur**, **Black and white**, and a **Fill color** (behind the image, or a plain color without one).

The background fills the board area, the rectangle around the spaces, so a phone and a desktop show the same picture at different sizes (BKG-1). Over an image, arrows get a halo in the board color. Images come from `/media/<key>` (Vite proxies `/media` to the backend too) and are cached by the browser for good.

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
