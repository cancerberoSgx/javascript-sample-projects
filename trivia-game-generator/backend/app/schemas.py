from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints, model_validator

from .formats import BoardDefinition, EngineState, GameSnapshot
from .models import GameInstanceSummary, GameStatus, Role, User

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
# bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently truncated
Password = Annotated[str, Field(min_length=8, max_length=72)]


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    organization_id: int
    organization_name: str
    name: str
    email: str
    role: Role
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_user(cls, user: User) -> "UserOut":
        return cls(**user.model_dump(exclude={"password_hash"}))


class MeOut(UserOut):
    impersonator: UserOut | None  # set when a root user is impersonating this user


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_at: datetime
    user: UserOut


class UserCreate(BaseModel):
    organization_id: int | None = None  # defaults to the caller's organization
    name: Name
    email: EmailStr
    password: Password
    role: Role = "member"


class UserUpdate(BaseModel):
    """Every field is optional; only the fields that are sent are changed."""

    organization_id: int | None = None
    name: Name | None = None
    email: EmailStr | None = None
    password: Password | None = None
    role: Role | None = None


class OrganizationOut(BaseModel):
    id: int
    name: str
    has_openai_api_key: bool
    openai_api_key_masked: str | None  # e.g. "sk-…a1b2"; the full key is never returned
    user_count: int
    created_at: datetime
    updated_at: datetime


class OrganizationCreate(BaseModel):
    name: Name
    openai_api_key: str | None = None


class OrganizationUpdate(BaseModel):
    """Send openai_api_key: null to remove the key; leave it out to keep it unchanged."""

    name: Name | None = None
    openai_api_key: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None


# ---------- shared ----------

Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Color = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


# ---------- categories ----------


class CategoryOut(BaseModel):
    id: int
    organization_id: int
    name: str
    description: str
    color: str
    card_count: int
    created_at: datetime
    updated_at: datetime


class CategoryCreate(BaseModel):
    organization_id: int | None = None  # defaults to the caller's organization
    name: Name
    description: Description = ""
    color: Color


class CategoryUpdate(BaseModel):
    name: Name | None = None
    description: Description | None = None
    color: Color | None = None


# ---------- decks + cards ----------


class DeckOut(BaseModel):
    id: int
    organization_id: int
    name: str
    description: str
    card_count: int
    created_at: datetime
    updated_at: datetime


class CardOut(BaseModel):
    id: int
    deck_id: int
    category_id: int
    question: str
    options: list[str] | None
    answer: str
    difficulty: int
    grand_prize: bool
    position: int


class DeckDetailOut(DeckOut):
    cards: list[CardOut]


class DeckCreate(BaseModel):
    organization_id: int | None = None
    name: Name
    description: Description = ""


class DeckUpdate(BaseModel):
    name: Name | None = None
    description: Description | None = None


class CardIn(BaseModel):
    category_id: int
    question: Text
    options: list[Text] | None = Field(default=None, min_length=2, max_length=6)  # None = open-ended
    answer: Text  # for multiple choice: must be one of options
    difficulty: int = Field(default=1, ge=1, le=3)
    grand_prize: bool = False

    @model_validator(mode="after")
    def _answer_matches_options(self) -> "CardIn":
        if self.options is not None:
            if len(set(self.options)) != len(self.options):
                raise ValueError("options must be unique")
            if self.answer not in self.options:
                raise ValueError("answer must be one of the options (CRD-1)")
        return self


class CardUpdate(BaseModel):
    """Partial update. The merged card is validated like CardIn. Send options: null to make it open-ended."""

    category_id: int | None = None
    question: Text | None = None
    options: list[Text] | None = None
    answer: Text | None = None
    difficulty: int | None = Field(default=None, ge=1, le=3)
    grand_prize: bool | None = None


# ---------- boards ----------


class BoardOut(BaseModel):
    id: int
    organization_id: int
    name: str
    description: str
    definition: BoardDefinition
    created_at: datetime
    updated_at: datetime


class BoardCreate(BaseModel):
    organization_id: int | None = None
    name: Name
    description: Description = ""
    definition: BoardDefinition


class BoardUpdate(BaseModel):
    name: Name | None = None
    description: Description | None = None
    definition: BoardDefinition | None = None


# ---------- games ----------


class PlayerIn(BaseModel):
    name: Name


class PlayerOut(BaseModel):
    id: int
    name: str
    position: int


class GameOut(BaseModel):
    id: int
    organization_id: int
    name: str
    status: GameStatus
    creator_id: int | None
    creator_name: str | None
    board_id: int | None
    board_name: str | None
    deck_id: int | None
    deck_name: str | None
    categories: dict[str, int]  # slot -> category id
    players: list[PlayerOut]
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    updated_at: datetime


class GameDetailOut(GameOut):
    snapshot: GameSnapshot | None  # set once started
    setup_errors: list[str]  # what still blocks "start" (empty when ready, or once started)


class GameCreate(BaseModel):
    organization_id: int | None = None
    name: Name
    board_id: int | None = None
    deck_id: int | None = None
    categories: dict[str, int] = {}
    players: list[PlayerIn] = Field(default=[], max_length=12)


class GameUpdate(BaseModel):
    """Only while not started. Send board_id/deck_id: null to clear; categories/players replace the whole list."""

    name: Name | None = None
    board_id: int | None = None
    deck_id: int | None = None
    categories: dict[str, int] | None = None
    players: list[PlayerIn] | None = Field(default=None, max_length=12)


# ---------- saved games (game instances, rules.md §2.7) ----------


class GameInstanceOut(GameInstanceSummary):
    """A save in a list: who saved it, when, and a summary of the play state (no state)."""


class GameInstanceDetailOut(GameInstanceOut):
    state: EngineState


class GameInstanceCreate(BaseModel):
    name: Name
    state: EngineState


class GameInstanceUpdate(BaseModel):
    """Rename and/or overwrite with a new state."""

    name: Name | None = None
    state: EngineState | None = None
