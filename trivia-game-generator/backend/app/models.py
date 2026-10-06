"""Typed database rows and write inputs used by the repositories.

These mirror the trivia_* tables and may contain secrets (password_hash, encrypted
keys), so they never go over HTTP directly. app/schemas.py has the API models.
"""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from .formats import BoardDefinition, EngineState, GameSnapshot

Role = Literal["root", "member"]
GameStatus = Literal["awaiting", "running", "finished"]
Provider = Literal["openai", "gemini"]
GenerationStatus = Literal["running", "done", "failed", "accepted"]


class Row(BaseModel):
    """Read-only snapshot of a database row."""

    model_config = ConfigDict(frozen=True)


class Changes(BaseModel):
    """Partial update: only the fields that were explicitly set are written.
    Setting a nullable field to None writes NULL."""

    model_config = ConfigDict(extra="forbid")

    def set_fields(self) -> dict[str, object]:
        return self.model_dump(exclude_unset=True)


# ---------- trivia_organizations ----------


class Organization(Row):
    id: int
    name: str
    openai_api_key_encrypted: str | None
    gemini_api_key_encrypted: str | None
    user_count: int  # computed by the query
    created_at: datetime
    updated_at: datetime


class OrganizationChanges(Changes):
    name: str | None = None
    openai_api_key_encrypted: str | None = None
    gemini_api_key_encrypted: str | None = None


# ---------- trivia_users ----------


class User(Row):
    id: int
    organization_id: int
    organization_name: str  # joined from trivia_organizations
    name: str
    email: str
    password_hash: str
    role: Role
    created_at: datetime
    updated_at: datetime


class NewUser(BaseModel):
    organization_id: int
    name: str
    email: str
    password_hash: str
    role: Role


class UserChanges(Changes):
    organization_id: int | None = None
    name: str | None = None
    email: str | None = None
    password_hash: str | None = None
    role: Role | None = None


# ---------- trivia_categories ----------


class Category(Row):
    id: int
    organization_id: int
    name: str
    description: str
    color: str
    card_count: int  # computed by the query
    created_at: datetime
    updated_at: datetime


class NewCategory(BaseModel):
    organization_id: int
    name: str
    description: str
    color: str


class CategoryChanges(Changes):
    name: str | None = None
    description: str | None = None
    color: str | None = None


# ---------- trivia_decks + trivia_cards ----------


class Deck(Row):
    id: int
    organization_id: int
    name: str
    description: str
    card_count: int  # computed by the query
    created_at: datetime
    updated_at: datetime


class NewDeck(BaseModel):
    organization_id: int
    name: str
    description: str


class DeckChanges(Changes):
    name: str | None = None
    description: str | None = None


class Card(Row):
    id: int
    deck_id: int
    category_id: int
    question: str
    options: list[str] | None
    answer: str
    difficulty: int
    grand_prize: bool
    position: int
    created_at: datetime
    updated_at: datetime


class NewCard(BaseModel):
    deck_id: int
    category_id: int
    question: str
    options: list[str] | None
    answer: str
    difficulty: int
    grand_prize: bool


class CardChanges(Changes):
    category_id: int | None = None
    question: str | None = None
    options: list[str] | None = None  # None (when set) = make it open-ended
    answer: str | None = None
    difficulty: int | None = None
    grand_prize: bool | None = None


# ---------- trivia_boards ----------


class Board(Row):
    id: int
    organization_id: int
    name: str
    description: str
    definition: BoardDefinition
    created_at: datetime
    updated_at: datetime


class NewBoard(BaseModel):
    organization_id: int
    name: str
    description: str
    definition: BoardDefinition


class BoardChanges(Changes):
    name: str | None = None
    description: str | None = None
    definition: BoardDefinition | None = None


# ---------- trivia_games + trivia_game_categories + trivia_players ----------


class Player(Row):
    id: int
    game_id: int
    name: str
    position: int
    joined: bool  # joined with the game's link from their own device (has a player token)
    removed: bool  # removed from a running game by the host (MPL-9)


class Game(Row):
    id: int
    organization_id: int
    name: str
    status: GameStatus
    creator_id: int | None
    creator_name: str | None  # joined
    board_id: int | None
    board_name: str | None  # joined
    deck_id: int | None
    deck_name: str | None  # joined
    snapshot: GameSnapshot | None
    join_code: str
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    updated_at: datetime


class NewGame(BaseModel):
    organization_id: int
    name: str
    creator_id: int
    board_id: int | None
    deck_id: int | None


class GameChanges(Changes):
    name: str | None = None
    board_id: int | None = None
    deck_id: int | None = None


# ---------- trivia_game_states (live play state of running games) ----------


class GameLiveState(Row):
    game_id: int
    state: EngineState
    version: int  # +1 on every change
    updated_at: datetime


# ---------- trivia_generation_jobs (rules.md §2.2.1, GEN-*) ----------

Weight = Annotated[float, Field(ge=0, le=1000)]
MAX_GENERATED_CARDS = 200  # GEN-2


class CategoryShare(BaseModel):
    category_id: int
    weight: Weight = 1  # relative: 20 and 80 mean 20% and 80%


class DifficultyMix(BaseModel):
    """Relative weights of difficulty 1 / 2 / 3."""

    easy: Weight = 1
    medium: Weight = 1
    hard: Weight = 1


class TypeMix(BaseModel):
    multiple_choice: Weight = 1
    open: Weight = 1


class GenerationSpec(BaseModel):
    """What a user asks the generator for (GEN-2). Weights are relative and needn't add up to 100."""

    count: int = Field(ge=1, le=MAX_GENERATED_CARDS)
    categories: list[CategoryShare] = Field(min_length=1, max_length=50)
    difficulty: DifficultyMix = DifficultyMix()
    types: TypeMix = TypeMix()
    instructions: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""

    @model_validator(mode="after")
    def _usable_weights(self) -> "GenerationSpec":
        if len({c.category_id for c in self.categories}) != len(self.categories):
            raise ValueError("each category can only be listed once")
        if not any(c.weight > 0 for c in self.categories):
            raise ValueError("at least one category needs a share above 0")
        if not any(self.difficulty.model_dump().values()):
            raise ValueError("at least one difficulty needs a share above 0")
        if not any(self.types.model_dump().values()):
            raise ValueError("at least one question type needs a share above 0")
        return self


class GeneratedCard(BaseModel):
    """A card waiting for review. Same fields as a deck card, before it has an id."""

    category_id: int
    question: str
    options: list[str] | None
    answer: str
    difficulty: int


class GenerationJob(Row):
    id: int
    organization_id: int  # joined from the deck
    deck_id: int
    creator_id: int | None
    creator_name: str | None  # joined
    provider: Provider
    model: str
    request: GenerationSpec
    status: GenerationStatus
    cards: list[GeneratedCard]
    batches_total: int
    batches_done: int
    dropped_duplicates: int
    dropped_invalid: int
    messages: list[str]
    error: str | None
    created_at: datetime
    updated_at: datetime
    finished_at: datetime | None


class NewGenerationJob(BaseModel):
    deck_id: int
    creator_id: int
    provider: Provider
    model: str
    request: GenerationSpec
