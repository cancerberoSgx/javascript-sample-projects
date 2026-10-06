"""resolveBoard / resolveDeck from resolve.ts: a game snapshot (board with slots, deck with
categories) in the engine formats. The snapshot was validated when the game started (GAM-2)."""

from ..formats import GameSnapshot
from .types import GRAND_PRIZE, BoardDefinition, Card, Category, DeckDefinition, Space


def resolve_snapshot(snapshot: GameSnapshot) -> tuple[BoardDefinition, DeckDefinition]:
    by_id = {c.id: c for c in snapshot.deck.categories}
    mapping: dict[str, Category] = {}
    for slot, cat_id in snapshot.mapping.items():
        c = by_id[cat_id]
        mapping[slot] = {"id": c.id, "name": c.name, "color": c.color}

    file = snapshot.board.model_dump(mode="json", exclude_unset=True)
    spaces: list[Space] = []
    for sp in file["spaces"]:
        slot = sp.pop("slot", None)
        spaces.append({**sp, "category": mapping[slot]["id"] if slot else None})  # pyright: ignore[reportArgumentType]
    board: BoardDefinition = {
        "name": snapshot.board.name,
        "description": snapshot.board.description,
        "config": snapshot.board.config.model_dump(),
        "categories": [mapping[slot] for slot in snapshot.board.slots],
        "spaces": spaces,
    }
    cards: list[Card] = [
        {
            "id": c.id,
            "category": GRAND_PRIZE if c.grand_prize else c.category,
            "question": c.question,
            "options": c.options,
            "correct_answer": c.options.index(c.answer) if c.options else c.answer,
            "difficulty": c.difficulty,
        }
        for c in snapshot.deck.cards
    ]
    return board, {"name": snapshot.deck.name, "cards": cards}
