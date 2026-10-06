"""Board and game-setup checks. Python port of frontend/src/engine/board.ts + resolve.ts,
with the same rule IDs (rules.md). Each function returns human-readable errors; an empty
list means valid."""

from collections import deque
from collections.abc import Iterable

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


def validate_board(board: BoardDefinition) -> list[str]:
    errors: list[str] = []
    err = errors.append
    config = board.effective_config()
    spaces = board.spaces
    slots = board.slots

    # Slots
    if len(set(slots)) != len(slots):
        err("Slot names must be unique")
    if any(not s.strip() for s in slots):
        err("Slot names can't be empty")

    # Indices must be exactly 0..N-1
    if sorted(s.index for s in spaces) != list(range(len(spaces))):
        err("Space indices must be unique and run 0..N-1")
    by_index = {s.index: s for s in spaces}

    if by_index.get(0) is None or by_index[0].type != "start":
        err("BRD-1: space 0 must be of type 'start'")
    if sum(s.type == "start" for s in spaces) > 1:
        err("Only one 'start' space is allowed")

    positions: set[tuple[float, float]] = set()
    for s in spaces:
        where = f"space {s.index}"
        if s.type in ("category", "hq"):
            if s.slot not in slots:
                err(f"{where}: '{s.type}' needs one of the slots {', '.join(slots)} (got {s.slot})")
        elif s.slot is not None:
            err(f"{where}: '{s.type}' spaces must have slot null")
        for n in s.next:
            if n not in by_index:
                err(f"{where}: next points to missing space {n}")
            if n == s.index:
                err(f"{where}: next points to itself")
        if len(set(s.next)) != len(s.next):
            err(f"{where}: duplicate entries in next")
        if s.type != "finish" and not s.next:
            err(f"{where}: dead end (empty next) on a non-finish space")
        key = (s.pos.x, s.pos.y)
        if key in positions:
            err(f"{where}: pos {s.pos.x},{s.pos.y} is already used by another space")
        positions.add(key)
    if errors:
        return errors  # the graph checks below assume a well-formed board

    # Track shape: BRD-2 / BRD-3, FRK-4
    finishes = [s for s in spaces if s.type == "finish"]
    from_start = _reachable(spaces, 0)
    unreachable = [s.index for s in spaces if s.index not in from_start]
    if unreachable:
        err(f"Spaces not reachable from start: {_join(unreachable)}")
    if config["track_type"] == "linear":
        if len(finishes) != 1:
            err(f"BRD-2: a linear track needs exactly one 'finish' space (found {len(finishes)})")
        else:
            if finishes[0].next:
                err("BRD-2: the 'finish' space must have an empty next")
            to_finish = _reachable(spaces, finishes[0].index, reverse=True)
            trapped = [s.index for s in spaces if s.index not in to_finish]
            if trapped:
                err(f"FRK-4: 'finish' cannot be reached from spaces: {_join(trapped)}")
    else:
        if finishes:
            err("BRD-3: a loop track cannot have a 'finish' space")
        to_start = _reachable(spaces, 0, reverse=True)
        trapped = [s.index for s in spaces if s.index not in to_start]
        if trapped:
            err(f"BRD-3: these spaces never loop back to start: {_join(trapped)}")

    # Config sanity
    wins = config["win_conditions"]
    if not wins:
        err("At least one win condition is required")
    if "finish" in wins and config["track_type"] != "linear":
        err("Win condition 'finish' needs track_type 'linear'")
    if "turn_limit" in wins and not config["max_rounds"]:
        err("Win condition 'turn_limit' needs a positive max_rounds")

    # BRD-4
    if "collection" in wins:
        for slot in slots:
            if not any(s.type == "hq" and s.slot == slot for s in spaces):
                err(f"BRD-4: slot {slot} has no 'hq' space, so the collection win is impossible")
    return errors


def validate_game_setup(
    board: BoardDefinition,
    mapping: dict[str, int],
    category_names: dict[int, str],
    cards: Iterable[tuple[int, bool]],  # (category_id, grand_prize) for each card in the deck
    player_count: int,
) -> list[str]:
    """Everything that must hold before a game can start (BRD-5, WIN-F*, mapping, players)."""
    errors = [f"Board: {e}" for e in validate_board(board)]
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


def _join(items: list[int], limit: int = 15) -> str:
    shown = ", ".join(map(str, items[:limit]))
    return shown + (f" (+{len(items) - limit} more)" if len(items) > limit else "")
