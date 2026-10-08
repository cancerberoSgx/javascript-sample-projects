from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StrictInt,
    StringConstraints,
    model_validator,
)

from .formats import Background, BoardDefinition, GameSnapshot
from .models import (
    MAX_GENERATED_CARDS,
    CopiedFrom,
    GameStatus,
    GeneratedCard,
    GenerationSpec,
    GenerationStatus,
    Provider,
    Role,
    TranslationStatus,
    User,
    Visibility,
)
from .validation import BoardIssue

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
# bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently truncated
Password = Annotated[str, Field(min_length=8, max_length=72)]
# A BCP 47 tag the app can store (I18N-1): "es", "pt-BR", "zh-Hant", "es-419"
LanguageCode = Annotated[str, StringConstraints(pattern=r"^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$")]


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
    language: str | None  # preferred UI language; null = automatic (I18N-3)
    organization_language: str
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
    language: LanguageCode | None = None  # null = automatic


class OrganizationOut(BaseModel):
    id: int
    name: str
    has_openai_api_key: bool
    openai_api_key_masked: str | None  # e.g. "sk-…a1b2"; the full key is never returned
    has_gemini_api_key: bool
    gemini_api_key_masked: str | None
    openai_model: str | None  # null = the app's default, below
    gemini_model: str | None
    default_openai_model: str
    default_gemini_model: str
    language: str  # its games' default UI language (I18N-3)
    user_count: int
    created_at: datetime
    updated_at: datetime


ApiKey = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
ModelName = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Za-z0-9._:/-]{1,100}$")]


class OrganizationCreate(BaseModel):
    name: Name
    openai_api_key: ApiKey | None = None
    gemini_api_key: ApiKey | None = None


class OrganizationUpdate(BaseModel):
    """Send a key as null to remove it, a model as null to go back to the default; leave a field out to keep it.
    Members may only change the models of their own organization."""

    name: Name | None = None
    openai_api_key: ApiKey | None = None
    gemini_api_key: ApiKey | None = None
    openai_model: ModelName | None = None
    gemini_model: ModelName | None = None
    language: LanguageCode | None = None


# ---------- shared ----------

Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Color = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class SharingOut(BaseModel):
    """Fields every shareable item has (rules.md §2.8)."""

    visibility: Visibility  # public: listed in the Library for every organization (SHR-1)
    published_at: datetime | None
    copied_from: CopiedFrom | None  # set on copies from the Library (SHR-3)


# ---------- categories ----------


class CategoryOut(SharingOut):
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


class DeckOut(SharingOut):
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


class BoardOut(SharingOut):
    id: int
    organization_id: int
    name: str
    description: str
    definition: BoardDefinition
    issues: list[BoardIssue]  # validation results (rules.md §2.1.1); any error = draft, can't start a game
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


# ---------- image library (rules.md §2.1.2, BKG-*) ----------


class ImageOut(SharingOut):
    id: int
    organization_id: int
    key: str  # what a Background's `image` holds
    url: str  # /media/<key>: public, immutable (BKG-8)
    name: str
    source_url: str | None
    content_type: str
    width: int
    height: int
    bytes: int
    creator_name: str | None
    board_count: int  # boards whose background uses it
    game_count: int  # games that use it (their own background or their snapshot)
    created_at: datetime


class ImageImport(BaseModel):
    organization_id: int | None = None
    url: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    name: Name | None = None


class ImageUpdate(BaseModel):
    name: Name


# ---------- games ----------


class PlayerIn(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class PlayerOut(BaseModel):
    id: int
    name: str
    position: int
    joined: bool  # joined with the link from their own device
    removed: bool  # removed from the running game by the host


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
    background: Background | None  # the game's own background; null = the board's (BKG-5)
    join_code: str  # players join with /games/{id}?code={join_code} (MPL-1)
    language: str | None  # the UI language players get by default; null = the organization's (I18N-3)
    organization_language: str
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
    """Only while awaiting. Send board_id/deck_id: null to clear; categories replaces the whole mapping.
    Players have their own endpoints, so a host's edit never overwrites someone joining meanwhile."""

    name: Name | None = None
    board_id: int | None = None
    deck_id: int | None = None
    categories: dict[str, int] | None = None
    background: Background | None = None  # null = use the board's (BKG-5); a Background without image = none
    language: LanguageCode | None = None  # null = the organization's (I18N-3)


# ---------- multiplayer (rules.md §2.7, MPL-*) ----------

class PlayerOrderIn(BaseModel):
    player_ids: list[int]  # every player of the game, in the new turn order


class JoinIn(PlayerIn):
    code: str = Field(max_length=64)


class JoinOut(BaseModel):
    player: PlayerOut
    player_token: str  # keep it on this device: it proves which player it is (MPL-4)


class LivePlayerOut(BaseModel):
    id: int
    name: str
    position: int
    joined: bool
    removed: bool
    online: bool  # has a connection open right now


class LiveGameOut(BaseModel):
    id: int
    name: str
    status: GameStatus
    board_name: str | None
    background: Background | None  # what the started game draws (its snapshot's, BKG-6); null before the start
    language: str  # the UI language players see unless they pick theirs: the game's, else its organization's (I18N-3)
    players: list[LivePlayerOut]


class LiveYouOut(BaseModel):
    player_id: int | None  # the player this device plays as
    can_host: bool  # an organization user: may start, skip turns, remove players


class LiveMessage(BaseModel):
    """Sent over the game's WebSocket after every change (MPL-5)."""

    type: Literal["game"] = "game"
    game: LiveGameOut
    state: dict[str, Any] | None  # the engine state without its secrets (MPL-6); null until started
    version: int | None  # +1 on every state change
    server_now: int  # epoch ms, so clients can show question timers in server time
    you: LiveYouOut


class SocketHello(BaseModel):
    """The first message on a game's WebSocket: who is watching. Any combination works (MPL-5)."""

    type: Literal["hello"]
    token: str | None = None  # an organization user's access token
    player_token: str | None = None  # from joining on this device
    code: str | None = None  # the game's join code, from its link


class _ActionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RollIn(_ActionIn):
    type: Literal["ROLL"]  # no rigged "value" in multiplayer (MPL-7)


class MoveIn(_ActionIn):
    type: Literal["MOVE"]
    to: StrictInt


class ChooseCategoryIn(_ActionIn):
    type: Literal["CHOOSE_CATEGORY"]
    category: str


class AnswerIn(_ActionIn):
    type: Literal["ANSWER"]
    answer: Annotated[str, StringConstraints(max_length=500)] | StrictInt


class TimeoutIn(_ActionIn):
    type: Literal["TIMEOUT"]


PlayerAction = Annotated[RollIn | MoveIn | ChooseCategoryIn | AnswerIn | TimeoutIn, Field(discriminator="type")]


class SocketAction(BaseModel):
    type: Literal["action"]
    action: PlayerAction


# ---------- card generation (rules.md §2.2.1) ----------


class ProviderOut(BaseModel):
    id: Provider
    name: str  # "OpenAI"
    model: str


class GenerationRequest(GenerationSpec):
    """GEN-1: `provider` may be left out when the organization has only one key."""

    provider: Provider | None = None


class GenerationJobOut(BaseModel):
    id: int
    deck_id: int
    creator_name: str | None
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
    finished_at: datetime | None


class GenerationAccept(BaseModel):
    """The reviewed cards to add. `job_id` guards against accepting a generation that was replaced meanwhile."""

    job_id: int
    cards: list[CardIn] = Field(max_length=MAX_GENERATED_CARDS)


class GenerationAcceptOut(BaseModel):
    added: int
    skipped_duplicates: list[str]  # questions already in the deck (or twice in the list), not added


# ---------- the public Library (rules.md §2.8, SHR-*) ----------


class VisibilityIn(BaseModel):
    visibility: Visibility


class LibraryCategoryOut(CategoryOut):
    organization_name: str  # the publisher (SHR-2)


class LibraryDeckOut(DeckOut):
    organization_name: str


class LibraryCardCategory(BaseModel):
    id: int
    name: str
    description: str
    color: str


class LibraryDeckDetailOut(LibraryDeckOut):
    categories: list[LibraryCardCategory]  # the ones its cards use
    cards: list[CardOut]


class LibraryBoardOut(BoardOut):
    organization_name: str


class LibraryImageOut(SharingOut):
    """Like ImageOut, minus who uploaded it and where it's used: that's the publisher's business."""

    id: int
    organization_id: int
    organization_name: str
    key: str
    url: str
    name: str
    width: int
    height: int
    bytes: int


class CopyIn(BaseModel):
    organization_id: int | None = None  # where the copy goes; defaults to the caller's organization
    name: Name | None = None  # defaults to the original's ("… (copy)" when taken, SHR-4)


class DeckCopyOut(BaseModel):
    deck: DeckOut
    categories_created: list[str]  # SHR-5: made for this copy
    categories_matched: list[str]  # SHR-5: already in the organization (same name), reused


class CardsCopyIn(BaseModel):
    deck_id: int  # one of the caller's decks
    card_ids: list[int] = Field(min_length=1, max_length=500)


class CardsCopyOut(BaseModel):
    added: int
    skipped_duplicates: list[str]  # questions the deck already has (SHR-6)
    categories_created: list[str]



# ---------- files: export / import (rules.md SER-7 … SER-9) ----------


class DeckImportOut(BaseModel):
    deck: DeckOut
    categories_created: list[str]  # SER-8: the file's categories the organization didn't have
    categories_matched: list[str]  # SER-8: already in the organization (same name), reused


class BoardImportOut(BaseModel):
    board: BoardOut
    background_image_missing: bool  # SER-8: the file's background image isn't in this organization's library, so it was left out


class OrganizationImportOut(BaseModel):
    """SER-11: what an organization file added. Decks and boards whose name the organization already has are skipped."""

    decks_created: list[str]
    decks_skipped: list[str]
    boards_created: list[str]
    boards_skipped: list[str]
    cards_created: int
    categories_created: list[str]
    categories_matched: list[str]
    background_images_missing: list[str]  # boards whose background image isn't in the library (left out, SER-8)


# ---------- UI translations (rules.md §2.9, I18N-*) ----------


class LanguageOut(BaseModel):
    code: str
    name: str  # in English
    native_name: str


class LanguageStatsOut(LanguageOut):
    enabled: bool
    translated: int
    missing: int
    outdated: int
    machine: int


class LanguageCreate(BaseModel):
    code: LanguageCode
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    native_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class LanguageUpdate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)] | None = None
    native_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)] | None = None
    enabled: bool | None = None


class MessagesOut(BaseModel):
    """One language's messages for the UI. English isn't here: it comes with the code."""

    language: str
    version: str  # changes whenever a message changes (also the ETag)
    messages: dict[str, str]


class I18nKeyOut(BaseModel):
    key: str
    area: str  # where it shows: play, lobby, host, log, errors…
    source: str  # the English message (ICU MessageFormat)
    description: str
    placeholders: dict[str, str]
    max_length: int | None
    obsolete: bool  # the code no longer uses it
    updated_at: datetime


class TranslationOut(BaseModel):
    key: str
    message: str
    status: TranslationStatus
    outdated: bool  # translated from an older English text (I18N-5)
    warnings: list[str]  # placeholders or tags of the English text it leaves out
    updated_by_name: str | None
    updated_at: datetime


class TranslationIn(BaseModel):
    message: Annotated[str, StringConstraints(min_length=1, max_length=5000)]
    status: TranslationStatus = "reviewed"


class AiTranslateIn(BaseModel):
    """I18N-8: translate these keys with the key of `organization_id` (OpenAI or Gemini)."""

    organization_id: int
    provider: Provider | None = None  # needed when the organization has both keys
    keys: list[str] = Field(min_length=1, max_length=40)


class AiFailure(BaseModel):
    key: str
    reason: str


class AiTranslateOut(BaseModel):
    translated: list[TranslationOut]
    failed: list[AiFailure]


class TranslationFileEntry(BaseModel):
    key: str
    area: str = ""
    description: str = ""
    placeholders: dict[str, str] = {}
    english: str = ""
    translation: str | None = None  # empty: not translated (skipped on import)
    status: TranslationStatus = "reviewed"


class TranslationFile(BaseModel):
    """A language's translations with their context (I18N-9): export, translate anywhere, import."""

    format: Literal["trivia-translations"] = "trivia-translations"
    version: Literal[1] = 1
    language: LanguageCode
    language_name: str = ""
    native_name: str = ""
    entries: list[TranslationFileEntry] = Field(max_length=5000)


class TranslationImportOut(BaseModel):
    imported: int  # new or changed translations
    unchanged: int
