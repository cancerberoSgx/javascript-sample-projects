"""legalDestinations from movement.ts (MOV-1..3, FRK-1)."""

from .types import Space


def legal_destinations(spaces: list[Space], start: int, steps: int) -> dict[str, list[int]]:
    """Every legal landing space for a roll of `steps` from `start`, each with one path that
    reaches it (excluding `start`). Keys are strings in ascending numeric order, like the
    JSON of the TS Record<number, number[]>."""
    by_index = {s["index"]: s for s in spaces}
    result: dict[int, list[int]] = {}

    frontier: list[tuple[int, list[int]]] = [(start, [])]
    for _ in range(steps):
        if not frontier:
            break
        next_frontier: list[tuple[int, list[int]]] = []
        seen_this_step: set[int] = set()
        for at, path in frontier:
            space = by_index[at]
            if not space["next"]:
                result.setdefault(at, path)  # stopped early on the finish space
                continue
            for n in space["next"]:
                if n in seen_this_step:
                    continue
                seen_this_step.add(n)
                next_frontier.append((n, [*path, n]))
        frontier = next_frontier
    for at, path in frontier:
        result.setdefault(at, path)
    return {str(k): result[k] for k in sorted(result)}
