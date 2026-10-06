"""Board and game-setup checks. Python port of frontend/src/engine/board.ts + resolve.ts,
with the same rule IDs (rules.md). Each function returns human-readable errors; an empty
list means valid."""

from collections import deque
from collections.abc import Iterable, Sequence
from typing import Literal

from pydantic import BaseModel

from .formats import BoardDefinition, BoardSpace


def _reachable(spaces: list[BoardSpace], start: int, reverse: bool = False) -> set[int]:
    edges: dict[int, list[int]] = {}
    for s in spaces:
        for n in s.next:
            a, b = (n, s.index) if reverse else (s.index, n)
            edges.setdefault(a, []).append(b)
    seen, queue = {start}, deque([start])
    while queue:
        for n in edges.get(queue.popleft(), []):
            if n not in seen:
                seen.add(n)
                queue.append(n)
    return seen


SPACE_TYPE_NAMES = {
    "start": "Start",
    "category": "Category",
    "hq": "HQ",
    "wildcard": "Wildcard",
    "roll_again": "Roll again",
    "penalty": "Skip turn",
    "finish": "Finish",
}
WIN_CONDITION_NAMES = {"finish": "Reach the finish", "collection": "Collect every category", "turn_limit": "Round limit"}


class BoardIssue(BaseModel):
    """One problem found by validate_board (rules.md §2.1.1). Errors make a board unplayable;
    warnings are only advice. `spaces` and `slot` say what the editor highlights."""

    code: str
    severity: Literal["error", "warning"]
    message: str
    spaces: list[int]
    slot: str | None


def _spaces_text(items: list[int]) -> str:
    return f"{'Space' if len(items) == 1 else 'Spaces'} {_join(items)}"


def validate_board(board: BoardDefinition) -> list[BoardIssue]:
    """Line-by-line port of validateBoardFile (frontend/src/engine/board.ts).
    tests/fixtures/board_validation.json, written by the frontend tests, checks they agree."""
    issues: list[BoardIssue] = []

    def add(code: str, message: str, spaces: list[int] | None = None, slot: str | None = None, severity: str = "error") -> None:
        issues.append(BoardIssue(code=code, severity=severity, message=message, spaces=spaces or [], slot=slot))  # type: ignore[arg-type]

    config = board.effective_config()
    spaces = board.spaces
    slots = board.slots

    # Slots (BRD-6)
    if not slots:
        add("BRD-6", "Add at least one slot.")
    for slot in dict.fromkeys(s for i, s in enumerate(slots) if slots.index(s) != i):
        add("BRD-6", f'Slot "{slot}" is listed more than once. Slot names must be unique.', [], slot)
    if any(not s.strip() for s in slots):
        add("BRD-6", "Slot names can't be empty.")

    if not spaces:
        add("BRD-1", "The board has no spaces. Add a start space.")
        return issues

    # Structure (BRD-7, BRD-8). The graph checks further down need these to hold.
    broken = False
    if sorted(s.index for s in spaces) != list(range(len(spaces))):
        add("BRD-7", f"Space numbers must run 0..{len(spaces) - 1} with no gaps or repeats.")
        broken = True
    by_index = {s.index: s for s in spaces}
    for s in spaces:
        for n in s.next:
            if n not in by_index:
                add("BRD-8", f"Space {s.index} has an arrow to space {n}, which doesn't exist.", [s.index])
            if n == s.index:
                add("BRD-8", f"Space {s.index} has an arrow to itself.", [s.index])
            broken = broken or n not in by_index or n == s.index
        if len(set(s.next)) != len(s.next):
            add("BRD-8", f"Space {s.index} has two arrows to the same space.", [s.index])
            broken = True

    # Start (BRD-1)
    starts = [s.index for s in spaces if s.type == "start"]
    if not starts:
        add("BRD-1", "The board needs a start space.")
    elif len(starts) > 1:
        add("BRD-1", f"Only one start space is allowed (found spaces {_join(starts)}).", starts)
    elif starts[0] != 0:
        add("BRD-1", f"The start must be space 0 (it is space {starts[0]}).", starts)

    # Each space: slot (BRD-9), position (BRD-11), arrows out (BRD-10)
    dead_ends: list[int] = []
    positions: dict[tuple[float, float], list[int]] = {}
    for s in spaces:
        kind = SPACE_TYPE_NAMES.get(s.type, s.type)
        if s.type in ("category", "hq"):
            if not s.slot:
                add("BRD-9", f"Space {s.index} is a {kind} space, so it needs a slot.", [s.index])
            elif s.slot not in slots:
                add("BRD-9", f'Space {s.index} uses slot "{s.slot}", which isn\'t one of the board\'s slots ({_join(slots) or "none"}).', [s.index], s.slot)
        elif s.slot is not None:
            add("BRD-9", f"Space {s.index} is a {kind} space, so it can't have a slot.", [s.index])
        if s.type != "finish" and not s.next:
            dead_ends.append(s.index)
        positions.setdefault((s.pos.x, s.pos.y), []).append(s.index)
    if dead_ends:
        add("BRD-10", f"{_spaces_text(dead_ends)} {'has' if len(dead_ends) == 1 else 'have'} no arrow out. Only the finish can be a dead end.", dead_ends)
    for same in positions.values():
        if len(same) > 1:
            add("BRD-11", f"{_spaces_text(same)} are on the same spot.", same)

    if not broken and len(starts) == 1:
        # Reachability (BRD-12) and track shape (BRD-2, BRD-3, FRK-4)
        start = starts[0]
        from_start = _reachable(spaces, start)
        unreachable = [s.index for s in spaces if s.index not in from_start]
        if unreachable:
            add("BRD-12", f"{_spaces_text(unreachable)} can never be reached: no path leads there from the start.", unreachable)

        finishes = [s.index for s in spaces if s.type == "finish"]
        if config["track_type"] == "linear":
            if not finishes:
                add("BRD-2", "A linear track needs a finish space.")
            elif len(finishes) > 1:
                add("BRD-2", f"A linear track has exactly one finish (found spaces {_join(finishes)}).", finishes)
            else:
                if by_index[finishes[0]].next:
                    add("BRD-2", f"The finish (space {finishes[0]}) can't have arrows out.", finishes)
                to_finish = _reachable(spaces, finishes[0], reverse=True)
                trapped = [s.index for s in spaces if s.index not in to_finish and s.index not in dead_ends]
                if trapped:
                    them = "it" if len(trapped) == 1 else "them"
                    add("FRK-4", f"{_spaces_text(trapped)} can't reach the finish: every path from {them} ends in a dead end or a circle.", trapped)
        else:
            if finishes:
                add("BRD-3", f"A loop track has no finish: change {_spaces_text(finishes).lower()} to another type, or make the track linear.", finishes)
            to_start = _reachable(spaces, start, reverse=True)
            trapped = [s.index for s in spaces if s.index not in to_start and s.index not in dead_ends]
            if trapped:
                add("BRD-3", f"{_spaces_text(trapped)} never {'leads' if len(trapped) == 1 else 'lead'} back to the start.", trapped)

    # Settings (CFG-*)
    wins = config["win_conditions"]
    if not wins:
        add("CFG-1", "Choose at least one way to win.")
    if "finish" in wins and config["track_type"] != "linear":
        add("CFG-2", f'"{WIN_CONDITION_NAMES["finish"]}" needs a linear track.')
    if "turn_limit" in wins and not (config["max_rounds"] and config["max_rounds"] > 0):
        add("CFG-3", f'"{WIN_CONDITION_NAMES["turn_limit"]}" needs a number of rounds.')
    if config["dice_sides"] < 1:
        add("CFG-4", "The dice need at least 1 side.")
    if config["max_rolls_per_turn"] < 1:
        add("CFG-4", "Allow at least 1 roll per turn.")

    # HQs (BRD-4) and slot use (BRD-W1, BRD-W2)
    for slot in dict.fromkeys(s for s in slots if s.strip()):
        hqs = sum(s.type == "hq" and s.slot == slot for s in spaces)
        plain = sum(s.type == "category" and s.slot == slot for s in spaces)
        if "collection" in wins and not hqs:
            add("BRD-4", f'Slot {slot} has no HQ space, so nobody can collect it ("{WIN_CONDITION_NAMES["collection"]}" needs one).', [], slot)
        if not hqs and not plain:
            add("BRD-W1", f"Slot {slot} isn't used by any space. A game still has to choose a category for it.", [], slot, "warning")
        elif not plain:
            add("BRD-W2", f"Slot {slot} has no category spaces, so its questions only come up on HQ and wildcard spaces.", [], slot, "warning")
    return issues


def board_errors(issues: list[BoardIssue]) -> list[BoardIssue]:
    return [i for i in issues if i.severity == "error"]


def validate_game_setup(
    board: BoardDefinition,
    mapping: dict[str, int],
    category_names: dict[int, str],
    cards: Iterable[tuple[int, bool]],  # (category_id, grand_prize) for each card in the deck
    player_count: int,
) -> list[str]:
    """Everything that must hold before a game can start (BRD-5, WIN-F*, mapping, players)."""
    errors = [f"Board: {i.message}" for i in board_errors(validate_board(board))]
    missing = [s for s in board.slots if s not in mapping]
    if missing:
        errors.append(f"No category chosen for slot(s): {', '.join(missing)}")
    extra = [s for s in mapping if s not in board.slots]
    if extra:
        errors.append(f"The board has no slot(s): {', '.join(extra)}")
    if len(set(mapping.values())) != len(mapping):
        errors.append("Each slot needs a different category")

    cards = list(cards)
    for slot in board.slots:
        cat = mapping.get(slot)
        if cat is not None and not any(c == cat and not gp for c, gp in cards):
            errors.append(f"BRD-5: the deck has no cards for {category_names.get(cat, cat)} (slot {slot})")
    if "finish" in board.effective_config()["win_conditions"] and not any(gp for _, gp in cards):
        errors.append("The board's 'finish' win needs at least one grand prize card in the deck")
    if player_count < 1:
        errors.append("Wait for at least one player to join")
    return errors


def _join(items: Sequence[int | str], limit: int = 15) -> str:
    shown = ", ".join(map(str, items[:limit]))
    return shown + (f" (+{len(items) - limit} more)" if len(items) > limit else "")
