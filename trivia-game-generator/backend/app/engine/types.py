"""TypedDict mirrors of frontend/src/engine/types.ts (engine formats and runtime state)."""

from typing import Any, Literal, NotRequired, TypedDict

GRAND_PRIZE = "grand_prize"

Phase = Literal["AWAIT_ROLL", "AWAIT_MOVE", "AWAIT_CATEGORY", "AWAIT_ANSWER", "GAME_OVER"]
AnswerResult = Literal["correct", "incorrect", "timeout"]


class Category(TypedDict):
    id: str
    name: str
    color: str


class Space(TypedDict):
    index: int
    type: str
    category: str | None
    next: list[int]
    pos: dict[str, float]
    label: NotRequired[str]


class BoardDefinition(TypedDict):
    id: NotRequired[str]
    name: str
    description: NotRequired[str]
    config: dict[str, Any]  # partial, merged over DEFAULT_CONFIG
    categories: list[Category]
    spaces: list[Space]


class Card(TypedDict):
    id: str
    category: str  # category id, or GRAND_PRIZE
    question: str
    options: list[str] | None
    correct_answer: str | int  # index into options for multiple choice
    difficulty: int


class DeckDefinition(TypedDict):
    name: str
    cards: list[Card]


class Player(TypedDict):
    id: str
    name: str
    color: str
    current_space: int
    inventory: list[str]
    score: int
    skip_next_turn: bool
    removed: NotRequired[bool]


class DeckState(TypedDict):
    draw: list[str]
    used: list[str]


class PendingQuestion(TypedDict):
    card: Card
    deadline: int | None  # epoch ms
    grand_prize: bool
    from_hq: bool


class LastAnswer(TypedDict):
    card: Card
    given: str
    result: AnswerResult


class LastMove(TypedDict):
    seq: int
    player_id: str
    path: list[int]


MessageParams = dict[str, str | int]


class Message(TypedDict):
    """A translatable message (rules.md §2.9, I18N-6): a catalog key and its params."""

    key: str
    params: MessageParams


class LogEntry(TypedDict):
    round: int
    player_id: str | None
    text: str  # English; entries from before I18N-6 have only this
    key: NotRequired[str]
    params: NotRequired[MessageParams]


class GameState(TypedDict):
    config: dict[str, Any]
    board: BoardDefinition
    cards: dict[str, Card]
    decks: dict[str, DeckState]
    players: list[Player]
    active_player: int
    round: int
    rolls_this_turn: int
    phase: Phase
    last_roll: int | None
    destinations: dict[str, list[int]]  # JSON object keys are strings, in ascending numeric order
    last_move: LastMove | None
    question: PendingQuestion | None
    last_answer: LastAnswer | None
    result: dict[str, Any] | None  # {"type": "win", "player_id", "reason"} or {"type": "draw"}
    rng: int
    log: list[LogEntry]


class PlayerSetup(TypedDict):
    name: str
    color: str
    id: NotRequired[str]


# An action is a dict like {"type": "MOVE", "to": 3}; see Action in types.ts.
# The API validates its shape (schemas.PlayerAction) before it reaches the engine.
Action = dict[str, Any]
