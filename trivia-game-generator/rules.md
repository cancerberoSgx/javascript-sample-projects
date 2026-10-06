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

- `BRD-1` Space `0` MUST be of type `start`.
- `BRD-2` Linear track: space `N-1` MUST be of type `finish`, with `next = []`.
- `BRD-3` Loop track: following `next` from space `N-1` returns to `0`. A loop has no `finish` space.
- `BRD-4` Each slot MUST have at least one `hq` space, or the `collection` win can never happen.
- `BRD-5` The category that plays each slot MUST have at least one (non-grand-prize) card in the game's deck (§2.2).
- `BRD-6` Slot names MUST be unique. A game MUST map every slot, each to a different category.

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
A stored game belongs to an organization and has: a name, a `status`, a creator (an organization user), a board, a deck, a category for each board slot, and players (just names; they don't need accounts, and their order is the turn order).

- `GAM-1` `status` goes `not_started → running → finished`, never backwards.
- `GAM-2` While `not_started`, the board, deck, slot mapping and players can change. A game can only start once BRD-*, BRD-5, BRD-6, CRD-4 hold and it has at least one player.
- `GAM-3` Starting copies the board, deck and categories into the game (a *snapshot*). Later edits or deletes of the originals never change a running or finished game.
- `GAM-4` A board, deck or category can't be deleted while a not-started game uses it. A category can't be deleted while cards use it.
- `GAM-5` Only a `running` game can be played (`/games/:id/play`). Play runs the engine on the snapshot (GAM-3) in hot-seat mode: the game's players take turns on one screen, in their stored order.

### 2.7 Saved games (instances)
A play session can be interrupted and continued later. A **save** (a *game instance*) is a named copy of the engine's whole `GameState` (§2.5): positions, scores, tokens, the draw and used piles, the RNG, the pending question, the log and the phase.

- `SAV-1` A game can have any number of named saves. Every user who can see the game (its organization, and root) can list, load, overwrite and delete them. Each save records who saved it last and when.
- `SAV-2` Loading a save continues the game exactly where it was: same phase, same active player, same RNG, so the next dice and cards are the ones that would have come.
- `SAV-3` A question's timer is wall-clock time, so a save stores the *time left* (`question.time_left_ms`) instead of the deadline. Loading restarts the timer with that time left. A save made after the deadline passed times out right after loading.
- `SAV-4` Saves can only be written while the game is `running`. The saved players MUST match the game's players (same names, same order).
- `SAV-5` Saves are trusted data from the organization's own users. The server checks their shape and size, not that every move was legal.

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
- `SER-2` A **board file** is `{ schema_version: 2, id?, name, description?, config, slots, spaces }` (§2.1). The backend stores `{config, slots, spaces}` as a board's `definition`.
- `SER-3` A **deck file** is `{ schema_version: 2, id?, name, description?, categories: [{id, name, description, color}], cards: Card[] }` (§2.2). The categories travel with the deck, so a file is self-contained.
- `SER-4` A **game snapshot** is `{ board: BoardFile, deck: DeckFile, mapping: { slot: categoryId } }`. `frontend/src/engine/resolve.ts` (`resolveGame`) turns it into the engine's internal board (each space's slot replaced by its category) and cards.
- `SER-5` Boards are validated on save (backend) and as you type (frontend), with the same rules: BRD-*, FRK-4, slots, config sanity. A board that fails can be viewed but not saved or played.
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
