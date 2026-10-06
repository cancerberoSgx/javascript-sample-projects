# Trivia Board Game: Rules Specification

This is the source of truth for game logic. Every rule has an ID (e.g. `MOV-3`) so it can be cited in code, tests, and discussions.

Conventions:
- **MUST** means a hard requirement. **DEFAULT** means behavior that a config flag (§1) can change.
- Rules marked *(decision)* filled a gap or settled a conflict in the original notes. §9 lists them for review.

---

## 1. Configuration

All tunable behavior lives in one `GameConfig` object. The engine MUST NOT hard-code these values.

| Flag | Type | Default | Meaning |
|---|---|---|---|
| `track_type` | `"linear" \| "loop"` | `"linear"` | Shape of the board (§2.1). |
| `dice_sides` | int | `6` | Dice returns 1..`dice_sides`. |
| `answer_time_limit_sec` | int | `30` | Countdown for each question. |
| `bonus_roll_on_correct` | bool | `true` | A correct answer grants an extra roll in the same turn. |
| `max_rolls_per_turn` | int | `3` | Cap on rolls in one turn (initial + bonus + roll-again), so a turn can't loop forever. |
| `win_conditions` | set of `"finish" \| "collection" \| "turn_limit"` | `{"finish","collection"}` | Which win checks are active (§7). `finish` needs `track_type = "linear"`. |
| `max_rounds` | int \| null | `null` | Used only by the `turn_limit` win condition. |
| `fuzzy_answer_check` | bool | `false` | Use an LLM judge for open-ended answers (§5.3). |
| `reuse_cards` | bool | `false` | If false, a card is never asked twice until its category's deck is exhausted. |

---

## 2. Data Model

### 2.1 Board
The board is a **directed graph of spaces**, not just an array, because forks (§6.2) need it. A board with no forks is a simple path. A **fork** is any space with more than one entry in `next`; it is a property of the graph, not a space type, so a fork can also be a category or HQ space.

A board has **no categories of its own**, only category **slots** (e.g. `A`, `B`, `C`, `D`). A **game** chooses which category plays each slot (§2.6), so one board layout can be reused for any topic.

```ts
type SpaceType = "start" | "category" | "hq" | "wildcard" | "roll_again" | "penalty" | "finish";

interface Space {
  index: number;            // 0..N-1, unique
  type: SpaceType;
  slot: string | null;      // one of Board.slots; required for "category" and "hq", null otherwise
  next: number[];           // indices of following spaces; length > 1 = fork
  pos: { x: number; y: number }; // layout coordinates in grid units (fractions allowed), set by the board author
}

interface Board {
  config: Partial<GameConfig>; // §1, merged over the defaults
  slots: string[];          // e.g. ["A", "B", "C", "D"]
  spaces: Space[];          // N spaces
}
```

- `BRD-1` There is exactly one `start` space, and it is space `0`.
- `BRD-2` Linear track: exactly one `finish` space, with `next = []`. The board editor numbers it `N-1`, but the engine doesn't need that.
- `BRD-3` Loop track: following `next` from any space returns to the start. A loop has no `finish` space.
- `BRD-4` With the `collection` win, each slot MUST have at least one `hq` space, or that win can never happen.
- `BRD-5` The category that plays each slot MUST have at least one (non-grand-prize) card in the game's deck (§2.2).
- `BRD-6` There is at least one slot. Slot names MUST be unique and not blank. A game MUST map every slot, each to a different category.
- `BRD-7` Space indices run `0..N-1`, with no gaps or repeats.
- `BRD-8` Every entry of `next` points to an existing space other than itself, at most once.
- `BRD-9` `category` and `hq` spaces have one of the board's slots. Other spaces have `slot = null`.
- `BRD-10` Only the `finish` may have an empty `next` (no dead ends).
- `BRD-11` Every space has a `pos`, and no two spaces share one.
- `BRD-12` Every space can be reached from the start.

#### 2.1.1 Board validation
`validateBoardFile` (`frontend/src/engine/board.ts`) and its Python port `validate_board` (`backend/app/validation.py`) check a board and return **issues**: `{ code, severity, message, spaces, slot }`. `code` is the rule ID, `message` is plain language, and `spaces` / `slot` say what the board editor highlights. A shared fixture keeps both ports identical (`backend/tests/fixtures/board_validation.json`).

- **Errors** make a board unplayable: BRD-1…4, BRD-6…12, FRK-4 and the settings checks below. A board with errors is a **draft** (SER-5).
- When BRD-7 or BRD-8 fails, or there isn't exactly one start, the path checks (BRD-2, BRD-3, BRD-12, FRK-4) are skipped, because they would only add noise.
- Dead ends (BRD-10) are left out of the FRK-4 / BRD-3 "can't reach" lists, so one dead end isn't reported twice.
- `CFG-1` At least one win condition. `CFG-2` The `finish` win needs a linear track. `CFG-3` The `turn_limit` win needs `max_rounds > 0`. `CFG-4` `dice_sides >= 1` and `max_rolls_per_turn >= 1`.
- **Warnings** are advice and never block anything: `BRD-W1` a slot no space uses (a game still has to map it), `BRD-W2` a slot with HQ spaces but no category spaces.

#### 2.1.2 Background image
A board can have a **background**: an image (or just a color) drawn under its arrows and spaces. A game can replace it with its own (§2.6), so two games on the same board can look different.

```ts
interface Background {
  image?: string;          // key of an image in the organization's library: "<sha256>.webp". Left out = no image
  fit?: "cover" | "contain" | "stretch" | "tile"; // default "cover"
  crop?: { x: number; y: number; w: number; h: number }; // the part of the image to use, as fractions of its size (default: all of it)
  position?: { x: number; y: number }; // 0..1, default 0.5/0.5: where the image sits when it is bigger (cover) or smaller (contain) than the board
  zoom?: number;           // 0.25..4, default 1: scales the cover/contain size
  tile_size?: number;      // 0.02..1, default 0.25: in tile mode, one tile's width as a fraction of the board's width
  opacity?: number;        // 0..1, default 1
  fade?: number;           // 0..0.9, default 0: a veil in the board's theme color over the image, so spaces and arrows stay readable
  blur?: number;           // 0..20, default 0: blur radius in px on an 800 px wide board (it scales with the board)
  grayscale?: boolean;     // default false
  color?: string;          // "#rrggbb" under the image (letterboxing, transparent parts). Default: the theme's board color
}
```

- `BKG-1` The background fills the **board area**: the rectangle around the spaces' grid cells, plus 0.15 of a cell on every side. It is laid out relative to the board, not the screen, so every device shows the same picture at its own size.
- `BKG-2` `crop` is applied first; the fit then works on the cropped part. `cover` fills the area and cuts what overflows (`position` picks what stays), `contain` shows the whole image and leaves bands of `color` (`position` places it), `stretch` fills the area ignoring the image's proportions, `tile` repeats it as a mosaic (`position` shifts the pattern). `zoom` scales cover and contain.
- `BKG-3` Images live in the organization's **image library**. They are uploaded (PNG, JPEG, WebP, AVIF or GIF, whose first frame is kept; at most 10 MB and 40 megapixels) or imported from a URL: the server downloads a copy once, from public `http(s)` addresses only, so a background never depends on another site staying up. The server re-encodes every image as WebP, at most 3000 px on its long side, without its metadata (EXIF, GPS). Identical images are stored once: the key is the SHA-256 of the stored file.
- `BKG-4` A background's `image` must be in the library of the board's (or game's) organization.
- `BKG-5` A game's background is `null` (use the board's), or a `Background` that replaces it. A `Background` without `image` means "no image", even when the board has one.
- `BKG-6` Starting a game copies the background it uses into the snapshot's board (GAM-3). Changing the board's or the game's background later doesn't change a started game.
- `BKG-7` An image can't be deleted while a board, a game or a started game's snapshot uses it.
- `BKG-8` Images are public, immutable files at `/media/<key>`: players load them without logging in, and a device downloads each image once, then keeps it in its cache. The key is a content hash, so it can't be guessed.

### 2.2 Categories, decks and cards
A **category** belongs to an organization: `{ name, description, color }`. A **deck** is a named collection of cards, and each card belongs to one category.

```ts
interface Card {
  id: string;
  category: string;          // category id
  question: string;
  options: string[] | null;  // 2..6 choices for multiple choice; null for open-ended
  answer: string;            // the answer text; for multiple choice, one of `options`
  difficulty: 1 | 2 | 3;     // 1 Easy, 2 Medium, 3 Hard
  grand_prize: boolean;      // only drawn for the final question at the finish (§7.1)
}
```
- `CRD-1` For multiple-choice cards, `answer` MUST be one of `options`, and options MUST be unique.
- `CRD-2` Each category has its own shuffled deck. "Draw" means taking the top card of that deck.
- `CRD-3` When a deck runs out, reshuffle its used cards into a new deck. *(decision)*
- `CRD-4` Grand prize cards form a separate draw pile, whatever their category, and SHOULD all be `difficulty: 3`. A board whose win conditions include `finish` needs at least one in the deck.

#### 2.2.1 Generating cards with an LLM
A deck's cards can also be written by OpenAI or Gemini, using the API keys stored on the deck's organization (never a server-wide key). Generated cards are ordinary cards once added: everything in §2.2 applies.

- `GEN-1` **Provider.** An organization may store an OpenAI key, a Gemini key, both or neither. With neither, generating isn't possible. With one, that one is used. With both, the user MUST pick one for each request. Only root users set keys; any user of the organization can generate. Each organization can also choose its model per provider (any user of the organization may change it); unset means the app default (`gpt-5.4-mini`, `gemini-3.5-flash`). A model is tried with a tiny real call when it's saved (if the organization has that provider's key), so models that don't exist, are retired, or can't produce structured text are rejected then, not mid-generation. Low reasoning / thinking is requested only from model families that support it (gpt-5*, o-series, gemini-3+).
- `GEN-2` **Exact mix.** A request has `count` (1–200), categories with relative shares, and relative shares for difficulty (easy/medium/hard = 1/2/3) and type (multiple choice/open). Each mix is met exactly: the count is split with the largest-remainder method (100 cards at 20/80 → exactly 20 and 80; ties go to the first listed), and the per-(category, difficulty, type) counts are filled so every one of those totals holds. The server works out these counts and asks the model for them; it never trusts the model to count. Shares needn't add up to 100: they're scaled.
- `GEN-3` **No repeats.** A generated card MUST NOT repeat a card already in the deck or another card of the same generation. A repeat is: the same question after normalizing (case, accents, punctuation, spacing); or a question sharing at least 80% of its content words with another; or one with the same normalized answer sharing at least 50%. Every request to the model also lists the category's existing questions (up to 400) as "already used". Rewordings that share few words may still slip through: the user reviews the list (GEN-6). Adding the reviewed cards checks again against the deck as it is then.
- `GEN-4` **Usable cards.** A generated card is dropped if a field is empty, the difficulty or type is unknown, or a multiple-choice card has fewer than 2 or more than 6 options, repeated options, or an answer that isn't exactly one option (CRD-1; an answer that matches an option ignoring case becomes that option). Multiple-choice options are shuffled, because models tend to put the answer in the same place. The model is asked for 4 options and short typed answers for open cards.
- `GEN-5` **Batches.** Each model call asks for at most 20 cards (`GENERATION_BATCH_SIZE`) of one category, with the category's mix spread evenly across its calls. Categories run in parallel; a category's calls run one after another, so each sees what the previous wrote. Cards that come up short (dropped by GEN-3/GEN-4, or a failed call) are asked for again, up to 2 more rounds per category; whatever is still missing is reported. A rejected key or an invalid model stops the whole generation.
- `GEN-6` **Review first.** Generated cards wait in a review list and reach the deck only when a user adds them (all, some, or edited ones). A deck has at most one generation running or under review; it must be added or discarded before the next. Discarding a running generation stops it after the calls in flight. A server restart fails generations that were running; their cards so far can still be reviewed.
- `GEN-7` **Categories are defined by their descriptions.** Every request gives the model the category's name and description, and says that the description defines what belongs in it, winning over the name. It also lists the deck's other categories (those in the request and those the deck's cards use) with their descriptions, so similar categories ("History-Uruguay" / "History-Argentina") stay apart. The form warns when a chosen category has no description.

### 2.3 Dice
- `DIE-1` `roll()` returns a uniform random integer in `[1, dice_sides]`.
- `DIE-2` The RNG MUST be injectable (seedable) so tests are deterministic.

### 2.4 Players
```ts
interface Player {
  id: string;
  name: string;
  current_space: number;     // starts at 0
  inventory: Set<string>;    // categories collected at HQ spaces (one token per category)
  score: number;             // starts at 0
  skip_next_turn: boolean;   // starts false
  removed?: boolean;         // removed by the host during a multiplayer game (MPL-9)
}
```
- `PLY-1` Players play in a fixed order: the order they joined, or a randomized order. The order MUST NOT change during the game.
- `PLY-2` Inventory is a **set**: a second HQ win for a category that is already collected adds score but no new token.

### 2.5 Game State
```ts
interface GameState {
  config: GameConfig;
  board: Board;
  players: Player[];
  active_player: number;     // index into players
  round: number;             // +1 each time active_player wraps to 0
  rolls_this_turn: number;
  phase: Phase;              // see §3
  current_card: Card | null;
  winner: string | null;     // player id
}
```

### 2.6 Game (stored)
A stored game belongs to an organization and has: a name, a `status`, a creator (an organization user), a board, a deck, a category for each board slot, a join code, and players (just names; they don't need accounts, and their order is the turn order).

- `GAM-1` `status` goes `awaiting → running → finished`, never backwards. `awaiting` is the lobby: players join while the game waits for its host to start it.
- `GAM-2` While `awaiting`, the board, deck, slot mapping and players can change. A game can only start once its board has no errors (§2.1.1), BRD-5, BRD-6 and CRD-4 hold, and it has at least one player. Starting is up to the host (any user of the game's organization).
- `GAM-3` Starting copies the board, deck and categories into the game (a *snapshot*). Later edits or deletes of the originals never change a running or finished game.
- `GAM-4` A board, deck or category can't be deleted while an awaiting game uses it. A category can't be deleted while cards use it.
- `GAM-5` Only a `running` game can be played. It is played live and multiplayer (§2.7) at `/games/:id`.
- `GAM-6` A game can have its own background (BKG-5). It can change while the game is `awaiting`, and it is frozen on start (BKG-6).

### 2.7 Multiplayer play
Each player plays on their own device. The server runs the engine (a Python port of it, kept identical by a conformance fixture), so it alone decides what happens; devices send actions and show what the server broadcasts.

- `MPL-1` A game has a **join code**. Its link is `/games/:id?code=<code>`. Codes ignore case. The host can make a new code at any time; the old link then stops working for joining and watching, and players who already joined stay in.
- `MPL-2` With the link, anyone can join while the game is `awaiting`: they give a name and become a player. No account is needed. Once the game starts, no one can join.
- `MPL-3` Player names are unique within a game, ignoring case and surrounding spaces. At most 12 players.
- `MPL-4` Joining gives the device a secret **player token** (the server stores only its hash). It identifies that player when the device reconnects. A player can leave the lobby from their device; once the game runs, only the host can remove them.
- `MPL-5` Every device watching a game keeps a WebSocket open and gets the game's current view after every change: lobby, players with who's **online**, status and play state. Who may watch: users of the game's organization (and root), its players, and anyone with a valid link.
- `MPL-6` Each player acts only on their own turn, from their own device. Players the host added by name (no device) are played from the host's screen. What devices receive never includes the deck, the draw piles, the RNG or the pending card's answer. A card's answer is shown once the card is answered.
- `MPL-7` Devices can only roll, move, choose a category, answer and time out. Rigged rolls and forced results exist only in the Boards demo.
- `MPL-8` The server runs the question timer: an unanswered question times out at its deadline even if no device sends anything. The host can **skip** the active player's turn (for someone who's away); the turn ends as if it had played out.
- `MPL-9` The host can **remove** a player. While awaiting, the player is deleted. While running, they stay in the scoreboard and log but never play again: their token disappears from the board and turns pass over them. The last remaining player can't be removed (end the game instead).
- `MPL-10` A game is `finished` as soon as the engine reaches GAME_OVER. The host can also end a running game early, without a winner.
- `MPL-11` The live state is saved after every action. A restart or a dropped connection loses nothing: devices reconnect and continue. Games started before live play get a fresh state the first time they're opened.

#### 2.7.1 The play screen
What a player's device shows at `/games/:id?code=…` once the game runs. Presentation only: none of this changes the engine or what the server sends.

- `PLY-UI-1` The board fills the screen and pans and zooms (drag, pinch, wheel, double tap, + / − / fit / find-me buttons). The view never changes the game; a tap only counts as a move on one of the active player's legal destinations, and a near miss snaps to the closest legal destination within reach.
- `PLY-UI-2` A board whose shape doesn't match the screen (wide board, portrait phone, or the reverse) may be drawn **transposed** (x and y swapped), when that makes its tiles at least 25% bigger. The paths, arrows and numbers are the same. Boards with a background image are never transposed.
- `PLY-UI-3` Every device sees each roll (dice animation), each question (only the active device can answer; the others read along and can hide it to look at the board), each answer with the right answer (MPL-6), and the end of the game. The device whose turn starts gets a "Your turn!" alert (and a vibration where supported).
- `PLY-UI-4` The board name, track, win conditions, players and scores, the log and the legend are in sheets opened from floating buttons. The game's name isn't on the main screen. The player's name, the game status and a lost connection float over the board.

### 2.8 Sharing: the public Library
Boards, decks, categories and library images can be made **public**. Every organization can then see them in the **Library** and copy them. Nothing is ever used across organizations in place: a copy is an ordinary item of the organization that made it.

- `SHR-1` **Visibility.** Every board, deck, category and image is `private` (the default: only its organization sees it) or `public`. Users of the item's organization (and root) publish and unpublish it. Root can unpublish anything, for moderation. Unpublishing removes it from the Library; copies already made stay where they are.
- `SHR-2` **The Library.** Every logged-in user sees every organization's public items, with the publishing organization's name and the publication date, and can search them by name, description or organization. Public items stay read-only to other organizations: the ordinary endpoints keep treating them as not found (404). A deck shows its cards and the categories they use. A board can only be published without errors (drafts can't be public); a deck needs at least one card. An item that is edited after publishing stays public as it is now (the Library shows its current version).
- `SHR-3` **Copy, never reference.** Copying creates an independent, private item in the copier's organization (root picks the organization). It remembers where it came from (`copied_from`: the original's id, name and organization name, as they were then). Later edits, unpublishing or deleting the original never change the copy, and the copy's edits never reach the original.
- `SHR-4` **Names.** A copy keeps the original's name, or gets " (copy)", " (copy 2)", … when the organization already has a board or deck with that name. A name chosen by the user must be free.
- `SHR-5` **Categories come along.** Copying a deck copies all its cards. Each category the cards use is matched to the organization's category with the same name (ignoring case), or created with the original's name, description and color. A public category can also be copied on its own; copying one whose name the organization already has is refused.
- `SHR-6` **Single cards.** Chosen cards of a public deck can be added to one of the copier's decks (categories as in SHR-5). Cards that repeat a card already in that deck (the GEN-3 rules) are skipped and reported.
- `SHR-7` **Images come along.** Copying a board copies its background; its image is added to the organization's image library (the same file, BKG-3), so the copy satisfies BKG-4. A public image can also be added to a library on its own.


---

## 3. Turn State Machine

Main path: `TURN_START → ROLL → AWAIT_MOVE → MOVE → RESOLVE_SPACE → DRAW_CARD → AWAIT_ANSWER → EVALUATE → APPLY_RESULT → TURN_END`

| From | Condition | To |
|---|---|---|
| `TURN_START` | `skip_next_turn` is true | `TURN_END` |
| `TURN_START` | player is on `finish` (linear) | `DRAW_CARD` (Grand Prize) |
| `TURN_START` | otherwise | `ROLL` |
| `ROLL` | rolled `R`; legal destinations computed (FRK-1) | `AWAIT_MOVE` |
| `AWAIT_MOVE` | player picked a legal destination | `MOVE` |
| `MOVE` | token placed on the destination | `RESOLVE_SPACE` |
| `RESOLVE_SPACE` | space has a card to draw | `DRAW_CARD` |
| `RESOLVE_SPACE` | `wildcard` | `AWAIT_CATEGORY` |
| `AWAIT_CATEGORY` | player picked a category | `DRAW_CARD` |
| `RESOLVE_SPACE` | `roll_again` and rolls left | `ROLL` |
| `RESOLVE_SPACE` | anything else (start, penalty, no rolls left) | `TURN_END` |
| `DRAW_CARD` | card shown | `AWAIT_ANSWER` |
| `AWAIT_ANSWER` | answer received or timer expired | `EVALUATE` |
| `EVALUATE` | result decided | `APPLY_RESULT` |
| `APPLY_RESULT` | a win condition is met | `GAME_OVER` |
| `APPLY_RESULT` | correct, bonus roll on, rolls left | `ROLL` |
| `APPLY_RESULT` | otherwise | `TURN_END` |
| `TURN_END` | round limit reached (`turn_limit`) | `GAME_OVER` |
| `TURN_END` | otherwise | `TURN_START` (next player) |

`Phase` = `TURN_START | ROLL | AWAIT_MOVE | MOVE | AWAIT_CATEGORY | RESOLVE_SPACE | DRAW_CARD | AWAIT_ANSWER | EVALUATE | APPLY_RESULT | TURN_END | GAME_OVER`

- `SM-1` Only one phase is active at a time. The engine moves between phases only through the transitions in this table.
- `SM-2` Only `ROLL`, `AWAIT_MOVE`, `AWAIT_CATEGORY` (wildcard) and `AWAIT_ANSWER` wait for player input. Every other phase runs automatically.
- `SM-3` Only the active player may send input. Input from other players or in the wrong phase MUST be rejected.

---

## 4. Phase Rules

### 4.1 TURN_START
- `TS-1` Set `rolls_this_turn = 0`.
- `TS-2` If the active player's `skip_next_turn` is true: set it to false and go straight to `TURN_END`. No roll happens.
- `TS-3` Linear track only: if the player is already on the `finish` space (they missed the Grand Prize earlier), skip rolling and go to `DRAW_CARD` with a Grand Prize card (§7.1). *(decision)*

### 4.2 ROLL
- `ROL-1` The active player triggers the roll. `R = roll()`, then increment `rolls_this_turn`.

### 4.3 MOVE
The engine works out every space the roll can reach, and the player picks one (§6.2).
- `MOV-1` A legal destination is any space reached by following `next` edges exactly `R` times from the current space, taking any branch at each fork.
- `MOV-2` Linear track: if the player reaches `finish` before using all `R` steps, they stop there. Extra steps are lost, which is the same as `min(current + R, N-1)`.
- `MOV-3` Loop track: movement wraps from `N-1` back to `0`, the same as `(current + R) mod N`.
- `MOV-4` Only the space where movement ends triggers an effect. Spaces passed through do nothing.
- `MOV-5` Several players may stand on the same space. They do not interact.

### 4.4 RESOLVE_SPACE
The type of the landing space decides what happens next:

| Space type | Effect |
|---|---|
| `start` | No card. Go to `TURN_END`. |
| `category` | Draw from that space's category deck. |
| `hq` | Draw from that space's category deck. A correct answer also gives a token (§4.7). |
| `wildcard` | The player picks any category, then draws from it. *(decision)* |
| `roll_again` | No card. Go to `ROLL` if `rolls_this_turn < max_rolls_per_turn`, otherwise `TURN_END`. |
| `penalty` | No card. Set `skip_next_turn = true`, then `TURN_END`. *(decision: no question on a penalty space)* |
| `finish` | Draw a Grand Prize card (§7.1). |

### 4.5 DRAW_CARD / AWAIT_ANSWER
- `TRV-1` Draw the top card of the chosen deck and set `current_card`.
- `TRV-2` Show the question, plus options if it is multiple choice, to **all** players. Only the active player answers.
- `TRV-3` Start the countdown when the question appears. Track the deadline on the server, never on the client.
- `TRV-4` The player sends exactly one answer. Nothing can be changed after submitting.
- `TRV-5` If the timer runs out with no answer, the result is `timeout`, which counts as incorrect.

### 4.6 EVALUATE
Result is one of `correct | incorrect | timeout`.
- `EVL-1` Multiple choice: correct only if the selected index equals `correct_answer`.
- `EVL-2` Open-ended: normalize both strings (trim, lowercase, collapse spaces, remove accents and punctuation). Correct if they are equal.
- `EVL-3` If `fuzzy_answer_check` is on and EVL-2 fails, ask the LLM judge whether the answer is roughly equivalent (e.g. "one third" ≈ "-1/3"). Its yes/no answer is final.
- `EVL-4` The timer only decides whether the answer arrived in time. Time spent in EVL-3 judging does not count against the player.

### 4.7 APPLY_RESULT
**If correct:**
- `RES-1` `score += card.difficulty`.
- `RES-2` If the landing space is `hq`, add its category to `inventory` (a set, see PLY-2).
- `RES-3` If it was a Grand Prize card, the player wins (§7.1).
- `RES-4` Run CHECK_WIN (§7) right away. If someone has won, go to `GAME_OVER`.
- `RES-5` If `bonus_roll_on_correct` is on and `rolls_this_turn < max_rolls_per_turn`, go to `ROLL`. Otherwise go to `TURN_END`.

**If incorrect or timeout:**
- `RES-6` No reward and no penalty, and the player keeps their position. Go to `TURN_END`.

### 4.8 TURN_END
- `TE-1` Clear `current_card`.
- `TE-2` `active_player = (active_player + 1) mod players.length`. If this wraps to 0, increment `round`.
- `TE-3` If `turn_limit` is active and `round > max_rounds`, run the turn-limit win check (§7.3).
- `TE-4` Go to `TURN_START`.

---

## 5. Scoring Summary
- Correct answer: +1 / +2 / +3 points, matching difficulty 1 / 2 / 3.
- Wrong answer or timeout: no change.
- Scores never go down.
- Score decides the `turn_limit` win (§7.3) and is shown on the progress board. It does not decide the `finish` or `collection` wins.

---

## 6. Special Spaces

### 6.1 Roll Again
See RESOLVE_SPACE. It counts toward `max_rolls_per_turn`.

### 6.2 Fork (decision node)
- `FRK-1` After the roll, the engine lists every legal destination (MOV-1, MOV-2), each with one path that reaches it. With no fork in reach there is exactly one.
- `FRK-2` The player picks the destination directly, which also picks the branch. Any other space MUST be rejected. When two paths reach the same space, the path taken doesn't matter (MOV-4).
- `FRK-3` Picking a destination has no timer. *(decision)*
- `FRK-4` Every branch MUST rejoin the main path, or reach `finish` on a linear track. No dead ends.

### 6.3 Penalty
- `PEN-1` Landing here sets `skip_next_turn = true` and ends the turn.
- `PEN-2` A skipped turn is used up at the player's next `TURN_START` (TS-2). Penalties don't stack: landing on a second one before the skip is used still costs only one turn.

---

## 7. Win Conditions
The engine checks every active condition after each `APPLY_RESULT` (RES-4) and at round limits (TE-3). The first player to meet any condition wins at once and the game goes to `GAME_OVER`. Turns are sequential, so two players can never win at the same moment.

### 7.1 `finish`: Reach the end + Grand Prize (linear tracks only)
- `WIN-F1` A player who reaches `finish` gets a Grand Prize question right away in that turn.
- `WIN-F2` Correct: that player wins.
- `WIN-F3` Wrong or timeout: the turn ends and the player stays on `finish`. Each later turn they skip the roll and get a new Grand Prize question (TS-3), until they answer one correctly or someone else wins first.

### 7.2 `collection`: Collect every category
- `WIN-C1` A player wins as soon as `inventory` holds every entry in `Board.categories`.

### 7.3 `turn_limit` (optional)
- `WIN-T1` After `max_rounds` full rounds, the highest score wins.
- `WIN-T2` Ties are broken by most inventory tokens, then by furthest position. If still tied, the game is a draw. *(decision)*

---

## 7b. Serialization (board and deck files)
Boards and decks are plain data, so the generator can produce new games without code changes. The same shapes are used by the example files in `frontend/public/`, the backend API, and game snapshots (GAM-3). Format version 2:

- `SER-1` `boards/index.json` lists the example files: `{ "boards": [{ "file", "name", "description" }], "decks": [...] }`.
- `SER-2` A **board file** is `{ schema_version: 2, id?, name, description?, config, slots, spaces, background? }` (§2.1, §2.1.2). The backend stores `{config, slots, spaces, background?}` as a board's `definition`.
- `SER-3` A **deck file** is `{ schema_version: 2, id?, name, description?, categories: [{id, name, description, color}], cards: Card[] }` (§2.2). The categories travel with the deck, so a file is self-contained.
- `SER-4` A **game snapshot** is `{ board: BoardFile, deck: DeckFile, mapping: { slot: categoryId } }`. `frontend/src/engine/resolve.ts` (`resolveGame`) turns it into the engine's internal board (each space's slot replaced by its category) and cards.
- `SER-5` Boards are validated as you edit (frontend) and on every read (backend), with the same rules (§2.1.1). A board with errors can still be saved, as a **draft**: the API returns its `issues`, lists mark it, and a game can't start with it (GAM-2). Only the shape (field names, types, space types, sizes) is rejected on save.
- `SER-6` `schema_version` changes whenever the format changes in a breaking way. Version 1 had categories on the board and `correct_answer` indices on cards.

---

## 8. Invariants (good test targets)
- `INV-1` `0 <= current_space < N` for every player at all times.
- `INV-2` `score` never decreases. `inventory` never shrinks.
- `INV-3` `rolls_this_turn <= max_rolls_per_turn`.
- `INV-4` Once `winner` is set, no further game actions are accepted.
- `INV-5` For a given seed and input sequence, the engine produces the same states (deterministic replay).

---

## 9. Decisions Made While Formalizing (review these)
Answers to gaps or conflicts in the original draft. Change any of them and update the matching rule.

1. **Loop vs. linear and the finish win**: "reach N-1" only makes sense on a linear track. On loop boards only `collection` and `turn_limit` apply.
2. **Forks on an array**: forks need a graph, so `Space.next[]` replaces plain index arithmetic. The `mod N` and `min` formulas still describe fork-free boards.
3. **Forks are resolved by picking the destination**, not a direction at each fork. The player clicks one of the highlighted landing spaces, which covers forks that are only passed through.
4. **Infinite extra turns**: bonus rolls and roll-again spaces could chain forever, so `max_rolls_per_turn` caps them.
5. **Penalty space**: no question is asked. The space only sets the skip.
6. **Wildcard space**: the player picks the category.
7. **Missing the Grand Prize**: the player stays on `finish` and tries again on later turns instead of being sent back.
8. **Empty decks**: used cards are reshuffled.
9. **Score has a purpose**: it decides the optional `turn_limit` win and the leaderboard.
10. **Open-ended answers**: exact match after normalization, with an optional LLM judge (from the readme idea).
11. **Multiplayer is server-authoritative** (MPL-*): players are anonymous guests, so the server runs the engine, checks turns, keeps answers and upcoming cards hidden, and runs the timer. The hot-seat play page and named saves were replaced by one live state per game, saved after every action.
12. **Players without a device** (added by the host) are played from the host's screen, so a game can mix phones and a shared screen.
13. **Absent players**: the game waits for them. The question timer still runs on the server, and the host can skip their turn or remove them.
14. **Draft boards**: boards are built in a visual editor, so half-finished boards can be saved (SER-5). Validity is checked when a game starts, not when a board is saved.
15. **Numbering is the editor's job**: the editor renumbers spaces in path order after every visual edit (start `0`, each fork branch in turn, the finish last), so authors never manage indices. Raw JSON edits are kept as typed.
16. **Generated cards are reviewed, not trusted** (GEN-*): the server fixes the exact mix itself and only asks the model to fill it, drops repeats and broken cards, and keeps the result out of the deck until a person adds it. Calls are batched (about 20 cards each) rather than one call per request: a 100-card call works but takes ~25 s, returned the wrong mix in testing, and a failure loses everything.
17. **Background images are files, not database rows** (BKG-*): every player of a game loads the image, so it is served as a static, immutable file that each device caches, and Python and Postgres are never involved in serving it. The database only keeps the library (who uploaded what, sizes, the key). Images imported from a URL are copied for the same reason: other sites can disappear, slow down, or see every player's IP address.
18. **Sharing copies instead of linking** (SHR-*): a public item is copied into the organization that wants it rather than used from its owner's. Cards, games and backgrounds all depend on organization-owned rows (categories, images), so using another organization's deck in place would make every permission check cross organizations, and the owner's edits or deletion could break other organizations' games. Copies are independent and adaptable, and the snapshot taken at start (GAM-3) already freezes games the same way. Visibility is `private` / `public` for now; sharing with chosen organizations only can be added as another visibility level later.
