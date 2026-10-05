"""Typed database rows and write inputs used by the repositories.

These mirror the trivia_* tables and may contain secrets (password_hash, encrypted
keys), so they never go over HTTP directly. app/schemas.py has the API models.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from .formats import BoardDefinition, GameSnapshot

Role = Literal["root", "member"]
GameStatus = Literal["not_started", "running", "finished"]


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
    user_count: int  # computed by the query
    created_at: datetime
    updated_at: datetime


class OrganizationChanges(Changes):
    name: str | None = None
    openai_api_key_encrypted: str | None = None


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
