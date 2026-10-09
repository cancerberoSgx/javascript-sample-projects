"""Typed database rows and write inputs used by the repositories.

These mirror the trivia_* tables and may contain secrets (password_hash, encrypted
keys), so they never go over HTTP directly. app/schemas.py has the API models.
"""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from .formats import (
    Background,
    BoardDefinition,
    DifficultyMix,
    EngineState,
    GameSnapshot,
    TypeMix,
    Weight,
)

Role = Literal["root", "member"]
GameStatus = Literal["awaiting", "running", "finished"]
Provider = Literal["openai", "gemini"]
GenerationStatus = Literal["running", "done", "failed", "accepted"]
Visibility = Literal["private", "public"]  # rules.md §2.8, SHR-1
TranslationStatus = Literal["machine", "reviewed"]  # rules.md §2.9, I18N-5


class Row(BaseModel):
    """Read-only snapshot of a database row."""

    model_config = ConfigDict(frozen=True)


class Changes(BaseModel):
    """Partial update: only the fields that were explicitly set are written.
    Setting a nullable field to None writes NULL."""

    model_config = ConfigDict(extra="forbid")

    def set_fields(self) -> dict[str, object]:
        return self.model_dump(exclude_unset=True)


class CopiedFrom(BaseModel):
    """Where a copy came from, as it was when copied (SHR-3). Not a link: the original may be gone."""

    id: int
    name: str
    organization_name: str


class Shareable(Row):
    """The columns every shareable item has (boards, decks, categories, images; migration 0008)."""

    visibility: Visibility
    published_at: datetime | None  # set while public
    copied_from: CopiedFrom | None


# ---------- trivia_organizations ----------


class Organization(Row):
    id: int
    name: str
    openai_api_key_encrypted: str | None
    gemini_api_key_encrypted: str | None
    openai_model: str | None  # None = the app's default (llm.default_model)
    gemini_model: str | None
    language: str  # the default UI language of its games (I18N-3)
    user_count: int  # computed by the query
    created_at: datetime
    updated_at: datetime


class OrganizationChanges(Changes):
    name: str | None = None
    openai_api_key_encrypted: str | None = None
    gemini_api_key_encrypted: str | None = None
    openai_model: str | None = None
    gemini_model: str | None = None
    language: str | None = None


# ---------- trivia_users ----------


class User(Row):
    id: int
    organization_id: int
    organization_name: str  # joined from trivia_organizations
    name: str
    email: str
    password_hash: str
    role: Role
    language: str | None  # preferred UI language; None = automatic (I18N-3)
    organization_language: str  # joined from trivia_organizations
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
    language: str | None = None


# ---------- trivia_categories ----------


class Category(Shareable):
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
    copied_from: CopiedFrom | None = None  # set on copies from the Library (SHR-3)


class CategoryChanges(Changes):
    name: str | None = None
    description: str | None = None
    color: str | None = None


# ---------- trivia_decks + trivia_cards ----------


class Deck(Shareable):
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
    copied_from: CopiedFrom | None = None  # set on copies from the Library (SHR-3)


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


class Board(Shareable):
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
    copied_from: CopiedFrom | None = None  # set on copies from the Library (SHR-3)


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
    background: Background | None  # None = the board's (BKG-5)
    language: str | None  # UI language players get by default; None = the organization's (I18N-3)
    organization_language: str  # joined
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
    background: Background | None = None
    language: str | None = None


# ---------- trivia_images (rules.md §2.1.2, BKG-*) ----------


class Image(Shareable):
    id: int
    organization_id: int
    key: str  # "<sha256>.webp": the file in MEDIA_DIR, served at /media/<key>
    name: str
    source_url: str | None  # imported from this URL
    content_type: str
    width: int
    height: int
    bytes: int
    creator_id: int | None
    creator_name: str | None  # joined
    board_count: int  # computed: boards whose background uses it
    game_count: int  # computed: games (their own background or their snapshot) that use it
    created_at: datetime
    updated_at: datetime


class NewImage(BaseModel):
    organization_id: int
    key: str
    name: str
    source_url: str | None
    content_type: str
    width: int
    height: int
    bytes: int
    creator_id: int
    copied_from: CopiedFrom | None = None  # set on copies from the Library (SHR-3)


class ImageChanges(Changes):
    name: str | None = None


# ---------- trivia_game_states (live play state of running games) ----------


class GameLiveState(Row):
    game_id: int
    state: EngineState
    version: int  # +1 on every change
    updated_at: datetime


# ---------- trivia_generation_jobs (rules.md §2.2.1, GEN-*) ----------

MAX_GENERATED_CARDS = 200  # GEN-2


class CategoryShare(BaseModel):
    category_id: int
    weight: Weight = 1  # relative: 20 and 80 mean 20% and 80%


class GenerationSettings(BaseModel):
    """The generate form's settings as a saved deck generation keeps them (GEN-8). Looser than a
    request: deleting a category drops it from saved generations, which may leave none (GEN-10)."""

    count: int = Field(ge=1, le=MAX_GENERATED_CARDS)
    categories: list[CategoryShare] = Field(max_length=50)
    difficulty: DifficultyMix = DifficultyMix()
    types: TypeMix = TypeMix()
    instructions: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""


class GenerationSpec(GenerationSettings):
    """What a user asks the generator for (GEN-2). Weights are relative and needn't add up to 100."""

    categories: list[CategoryShare] = Field(min_length=1, max_length=50)

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
    deck_generation_id: int | None  # the saved deck generation it was started from (GEN-9)
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
    deck_generation_id: int | None = None


# ---------- trivia_deck_generations (rules.md §2.2.2, GEN-8 … GEN-10) ----------


class DeckGeneration(Row):
    id: int
    organization_id: int  # joined from the deck
    deck_id: int
    deck_name: str  # joined
    name: str
    description: str
    provider: Provider | None  # preferred; None = none
    spec: GenerationSettings
    creator_id: int | None
    creator_name: str | None  # joined
    use_count: int
    last_used_at: datetime | None
    cards_accepted: int
    created_at: datetime
    updated_at: datetime


class NewDeckGeneration(BaseModel):
    deck_id: int
    name: str
    description: str = ""
    provider: Provider | None = None
    spec: GenerationSettings
    creator_id: int | None


class DeckGenerationChanges(Changes):
    name: str | None = None
    description: str | None = None
    provider: Provider | None = None
    spec: GenerationSettings | None = None


# ---------- trivia_languages, trivia_i18n_keys, trivia_translations (rules.md §2.9, I18N-*) ----------


class Language(Row):
    code: str  # "es", "pt-BR"
    name: str  # in English
    native_name: str  # "Español"
    enabled: bool
    created_at: datetime
    updated_at: datetime


class LanguageStats(Language):
    """A language with how far its translation is (computed over the keys that aren't obsolete)."""

    translated: int
    missing: int
    outdated: int  # translated from an English text that changed since (I18N-5)
    machine: int  # written by a model and not reviewed yet


class NewLanguage(BaseModel):
    code: str
    name: str
    native_name: str


class LanguageChanges(Changes):
    name: str | None = None
    native_name: str | None = None
    enabled: bool | None = None


class CatalogKey(BaseModel):
    """One entry of the code's catalog (app/i18n/catalog.json), as written into trivia_i18n_keys."""

    key: str
    area: str
    source: str  # the English message
    source_hash: str
    description: str
    placeholders: dict[str, str]
    max_length: int | None


class I18nKey(Row):
    key: str
    area: str
    source: str
    source_hash: str
    description: str
    placeholders: dict[str, str]
    max_length: int | None
    obsolete: bool  # no longer in the catalog
    updated_at: datetime


class Translation(Row):
    language: str
    key: str
    message: str
    status: TranslationStatus
    source_hash: str
    outdated: bool  # computed: source_hash differs from the key's (I18N-5)
    updated_by: int | None
    updated_by_name: str | None  # joined
    updated_at: datetime


class TranslationMessage(Row):
    """What the public messages endpoint sends: a key and its message."""

    key: str
    message: str


class NewTranslation(BaseModel):
    language: str
    key: str
    message: str
    status: TranslationStatus
    source_hash: str
    updated_by: int | None
