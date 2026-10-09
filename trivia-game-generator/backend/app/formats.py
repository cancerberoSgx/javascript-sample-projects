"""Board, deck and game-snapshot formats (rules.md §2, SER-*). These match the frontend's
BoardFile / DeckFile types (frontend/src/engine/types.ts), so a snapshot can be passed
straight to the engine's resolveGame()."""

from typing import TYPE_CHECKING, Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    SerializerFunctionWrapHandler,
    StringConstraints,
    field_validator,
    model_serializer,
    model_validator,
)

if TYPE_CHECKING:
    from .engine.types import GameState as GameStateDict

TrackType = Literal["linear", "loop"]
WinCondition = Literal["finish", "collection", "turn_limit"]
SpaceType = Literal["start", "category", "hq", "wildcard", "roll_again", "penalty", "finish"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BoardConfig(Strict):
    """Partial GameConfig: fields that are left out use the defaults (rules.md §1)."""

    track_type: TrackType | None = None
    dice_sides: int | None = Field(default=None, ge=1, le=20)
    answer_time_limit_sec: int | None = Field(default=None, ge=0, le=600)
    bonus_roll_on_correct: bool | None = None
    max_rolls_per_turn: int | None = Field(default=None, ge=1, le=10)
    win_conditions: list[WinCondition] | None = None
    max_rounds: int | None = Field(default=None, ge=1)
    fuzzy_answer_check: bool | None = None
    reuse_cards: bool | None = None

    @model_serializer(mode="wrap")
    def _omit_unset(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:
        # Always serialize as a partial config: a null would override the frontend's defaults
        return {k: v for k, v in handler(self).items() if v is not None}


DEFAULT_CONFIG = {
    "track_type": "linear",
    "dice_sides": 6,
    "answer_time_limit_sec": 30,
    "bonus_roll_on_correct": True,
    "max_rolls_per_turn": 3,
    "win_conditions": ["finish", "collection"],
    "max_rounds": None,
    "fuzzy_answer_check": False,
    "reuse_cards": False,
}


class Pos(Strict):
    x: float
    y: float


class BoardSpace(Strict):
    index: int
    type: SpaceType
    slot: str | None = None
    next: list[int]
    pos: Pos
    label: str | None = None

    @model_serializer(mode="wrap")
    def _omit_empty_label(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:
        data = handler(self)
        if data.get("label") is None:
            data.pop("label", None)
        return data


# ---------- background image (rules.md §2.1.2, BKG-*) ----------

IMAGE_KEY_PATTERN = r"^[0-9a-f]{64}\.[a-z0-9]{3,4}$"  # "<sha256 of the stored file>.webp"
BackgroundFit = Literal["cover", "contain", "stretch", "tile"]
Fraction = Annotated[float, Field(ge=0, le=1)]


class Crop(Strict):
    """The part of the image to use, as fractions of its size."""

    x: Fraction
    y: Fraction
    w: Annotated[float, Field(gt=0, le=1)]
    h: Annotated[float, Field(gt=0, le=1)]

    @model_validator(mode="after")
    def _inside(self) -> "Crop":
        if self.x + self.w > 1.0001 or self.y + self.h > 1.0001:
            raise ValueError("the crop must stay inside the image (x + w <= 1, y + h <= 1)")
        return self


class Background(Strict):
    """How a board (or a game, overriding its board) draws its background. Fields left out use
    the defaults in rules.md §2.1.2; a background without `image` is a plain color (or nothing)."""

    image: str | None = Field(default=None, pattern=IMAGE_KEY_PATTERN)
    fit: BackgroundFit | None = None
    crop: Crop | None = None
    position: Pos | None = None
    zoom: float | None = Field(default=None, ge=0.25, le=4)
    tile_size: float | None = Field(default=None, ge=0.02, le=1)
    opacity: Fraction | None = None
    fade: float | None = Field(default=None, ge=0, le=0.9)
    blur: float | None = Field(default=None, ge=0, le=20)
    grayscale: bool | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")

    @field_validator("position")
    @classmethod
    def _position_in_range(cls, v: Pos | None) -> Pos | None:
        if v is not None and not (0 <= v.x <= 1 and 0 <= v.y <= 1):
            raise ValueError("position x and y must be between 0 and 1")
        return v

    @model_serializer(mode="wrap")
    def _omit_unset(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:
        # Like BoardConfig: only what was chosen is stored, so defaults can change later
        return {k: v for k, v in handler(self).items() if v is not None}


class BoardDefinition(Strict):
    """What a board stores: everything except its name/description. Spaces point to slots, not categories."""

    config: BoardConfig = Field(default_factory=BoardConfig)
    slots: list[str] = Field(max_length=12)
    spaces: list[BoardSpace] = Field(max_length=500)
    background: Background | None = None  # BKG-*: left out of the JSON when there is none

    @model_serializer(mode="wrap")
    def _omit_no_background(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:
        data = handler(self)
        if data.get("background") is None:
            data.pop("background", None)
        return data

    def effective_config(self) -> dict:
        return {**DEFAULT_CONFIG, **self.config.model_dump()}

    def to_json(self) -> dict:
        # exclude_unset keeps config partial, so defaults can change without rewriting boards
        return self.model_dump(mode="json", exclude_unset=True)


# ---------- board and deck files (export / import, rules.md §7b SER-2, SER-3, SER-7) ----------
# What a user downloads and uploads: the same shapes as the example files in frontend/public.
# Shapes are checked here; the content rules (answers among options, category references, …)
# are checked by app/transfer.py so every problem is reported with the card it's on.


def _check_version(v: object) -> object:
    if v != 2:
        raise ValueError(f"schema_version must be 2 (got {v!r}). This app reads format version 2 files (rules.md SER-6).")
    return v


FileText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
FileName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class BoardFile(BoardDefinition):
    """SER-2: a board file. `id` is only a label (the example files' file name); it's ignored on import."""

    schema_version: Literal[2]
    id: str | None = Field(default=None, max_length=200)
    name: FileName
    description: FileText = ""

    _version = field_validator("schema_version", mode="before")(_check_version)

    @model_serializer(mode="wrap")
    def _omit_no_background(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:  # overrides BoardDefinition's
        data = handler(self)
        order = ["schema_version", "id", "name", "description", "config", "slots", "spaces", "background"]
        return {k: data[k] for k in order if data.get(k) is not None}


class DeckFileCategory(Strict):
    id: str = Field(min_length=1, max_length=200)  # what the cards' `category` refers to
    name: FileName
    description: FileText = ""
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")


class DeckFileCard(Strict):
    id: str | None = Field(default=None, max_length=200)  # a label for people and diffs; ignored on import
    category: str  # a DeckFileCategory.id of the same file
    question: str
    options: list[str] | None = None  # null = open-ended
    answer: str  # for multiple choice, one of `options`
    difficulty: int = 1
    grand_prize: bool = False


# ---------- saved deck generations in deck files (GEN-8, SER-3) ----------

Weight = Annotated[float, Field(ge=0, le=1000)]


class DifficultyMix(BaseModel):
    """Relative weights of difficulty 1 / 2 / 3."""

    easy: Weight = 1
    medium: Weight = 1
    hard: Weight = 1


class TypeMix(BaseModel):
    multiple_choice: Weight = 1
    open: Weight = 1


class DeckFileShare(Strict):
    category: str  # a DeckFileCategory.id of the same file
    weight: Weight = 1


class DeckFileGeneration(Strict):
    """A saved deck generation (GEN-8): the generate form's settings, with the file's category ids.
    Usage counts aren't part of the file."""

    name: FileName
    description: FileText = ""
    provider: Literal["openai", "gemini"] | None = None
    count: int
    categories: list[DeckFileShare] = Field(default=[], max_length=50)
    difficulty: DifficultyMix = DifficultyMix()
    types: TypeMix = TypeMix()
    instructions: str = ""


class DeckFile(Strict):
    """SER-3: a deck file, with the categories its cards use."""

    schema_version: Literal[2]
    id: str | None = Field(default=None, max_length=200)
    name: FileName
    description: FileText = ""
    categories: list[DeckFileCategory] = Field(max_length=100)
    cards: list[DeckFileCard] = Field(max_length=5000)
    generations: list[DeckFileGeneration] = Field(default=[], max_length=100)  # GEN-8; left out when empty

    _version = field_validator("schema_version", mode="before")(_check_version)

    @model_serializer(mode="wrap")
    def _omit_no_id(self, handler: SerializerFunctionWrapHandler) -> dict[str, Any]:
        data = handler(self)
        if data.get("id") is None:
            data.pop("id", None)
        if not data.get("generations"):
            data.pop("generations", None)
        return data


class OrganizationFile(Strict):
    """SER-10: everything an organization made: all its categories (even unused ones), and every deck
    and board as a complete deck / board file, so each one can also be cut out and imported alone."""

    schema_version: Literal[2]
    kind: Literal["organization"]
    name: FileName  # the organization's, for people; the import goes wherever it's sent
    exported_at: str | None = None
    categories: list[DeckFileCategory] = Field(default=[], max_length=500)
    decks: list[DeckFile] = Field(default=[], max_length=1000)
    boards: list[BoardFile] = Field(default=[], max_length=1000)

    _version = field_validator("schema_version", mode="before")(_check_version)


# ---------- game snapshot (frozen copy taken when a game starts) ----------


class SnapshotBoard(BoardDefinition):
    schema_version: Literal[2] = 2
    name: str
    description: str = ""


class SnapshotCategory(BaseModel):
    id: str
    name: str
    description: str
    color: str


class SnapshotCard(BaseModel):
    id: str
    category: str  # SnapshotCategory.id
    question: str
    options: list[str] | None
    answer: str
    difficulty: int
    grand_prize: bool


class SnapshotDeck(BaseModel):
    schema_version: Literal[2] = 2
    name: str
    description: str
    categories: list[SnapshotCategory]
    cards: list[SnapshotCard]


class GameSnapshot(BaseModel):
    board: SnapshotBoard
    deck: SnapshotDeck
    mapping: dict[str, str]  # slot -> SnapshotCategory.id


# ---------- live play state (rules.md §2.7) ----------
# The engine's GameState (frontend/src/engine/types.ts, app/engine/types.py). The server
# creates and changes it only through app/engine; this model types what the API reads and
# keeps everything else as is (extra="allow"), so a state round-trips unchanged.

EnginePhase = Literal["AWAIT_ROLL", "AWAIT_MOVE", "AWAIT_CATEGORY", "AWAIT_ANSWER", "GAME_OVER"]


class EnginePlayer(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    name: str
    color: str
    current_space: int = Field(ge=0)
    inventory: list[str]
    score: int
    skip_next_turn: bool
    removed: bool = False


class EngineResult(BaseModel):
    type: Literal["win", "draw"]
    player_id: str | None = None
    reason: str | None = None


class EngineState(BaseModel):
    model_config = ConfigDict(extra="allow")

    config: dict[str, Any]
    board: dict[str, Any]
    cards: dict[str, Any]
    decks: dict[str, Any]
    players: list[EnginePlayer] = Field(min_length=1, max_length=12)
    active_player: int = Field(ge=0)
    round: int = Field(ge=1)
    phase: EnginePhase
    question: dict[str, Any] | None
    result: EngineResult | None
    rng: int
    log: list[Any]

    def to_engine(self) -> "GameStateDict":
        """The plain JSON state app/engine works on (exactly what was stored)."""
        return self.model_dump(mode="json", exclude_unset=True)  # type: ignore[return-value]
