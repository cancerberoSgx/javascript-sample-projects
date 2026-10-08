"""Every access rule in one place. Routers call these before touching data.

Root:    sees and edits every organization and user.
Member:  sees only their own organization and its users. Can create users there and
         update member users there (including themselves). Can't edit root users,
         grant the root role, move users between organizations, or delete anything.

A resource the caller can't see is reported as 404, not 403, so its existence isn't leaked.
"""

import hmac
from typing import Protocol

from fastapi import HTTPException, status

from .auth import CurrentUser
from .models import Game, Player, Role, User, UserChanges


class CodedError(HTTPException):
    """An error players can see, so the UI shows it translated (rules.md I18N-7). The response is
    {"detail": English text, "code": catalog key, "params": {…}}; main.py adds code and params."""

    def __init__(self, status_code: int, detail: str, code: str, params: dict[str, str | int] | None = None) -> None:
        super().__init__(status_code, detail)
        self.code = code
        self.params = params or {}


def not_found(what: str = "Not found", code: str | None = None) -> HTTPException:
    if code:
        return CodedError(status.HTTP_404_NOT_FOUND, what, code)
    return HTTPException(status.HTTP_404_NOT_FOUND, what)


def forbidden(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_403_FORBIDDEN, detail)


def conflict(detail: str, code: str | None = None, params: dict[str, str | int] | None = None) -> HTTPException:
    if code:
        return CodedError(status.HTTP_409_CONFLICT, detail, code, params)
    return HTTPException(status.HTTP_409_CONFLICT, detail)


def require_root(me: CurrentUser) -> None:
    if not me.is_root:
        raise forbidden("Only root users can do this")


def can_view_organization(me: CurrentUser, org_id: int) -> bool:
    return me.is_root or me.organization_id == org_id


MEMBER_ORGANIZATION_FIELDS = frozenset({"openai_model", "gemini_model", "language"})


def check_update_organization(me: CurrentUser, org_id: int, fields: set[str]) -> None:
    """Root changes anything. Members only choose their own organization's LLM models (not keys or name)."""
    if me.is_root:
        return
    if me.organization_id != org_id:
        raise not_found("Organization not found")
    if fields - MEMBER_ORGANIZATION_FIELDS:
        raise forbidden("Members can only change their organization's models and language")


def can_view_user(me: CurrentUser, target: User) -> bool:
    return me.is_root or me.organization_id == target.organization_id


def check_create_user(me: CurrentUser, organization_id: int, role: Role) -> None:
    if me.is_root:
        return
    if organization_id != me.organization_id:
        raise forbidden("Members can only create users in their own organization")
    if role != "member":
        raise forbidden("Members can only create member users")


def check_update_user(me: CurrentUser, target: User, changes: UserChanges) -> None:
    """`target` must already be visible to `me` (see can_view_user)."""
    if me.is_root:
        return
    if target.role == "root":
        raise forbidden("Members can't edit root users")
    if changes.role not in (None, "member"):
        raise forbidden("Members can't grant the root role")
    if changes.organization_id not in (None, me.organization_id):
        raise forbidden("Members can't move users to another organization")


# ---------- organization content (categories, decks, boards, games) ----------
# Any user of an organization can create, edit and delete its content. Root users can
# do it for every organization.


# The public Library (rules.md §2.8, SHR-*): publishing and unpublishing follow the item's edit
# rule above (so root can unpublish anything). Every logged-in user can browse public items and
# copy them into an organization they can add content to (target_org). Public items stay
# read-only to everyone else: the ordinary endpoints keep returning 404 for them.


def can_access_org(me: CurrentUser, organization_id: int) -> bool:
    return me.is_root or me.organization_id == organization_id


def target_org(me: CurrentUser, organization_id: int | None) -> int:
    """The organization a new item goes into: the one requested, or the caller's own."""
    org_id = organization_id or me.organization_id
    if not can_access_org(me, org_id):
        raise forbidden("You can only add content to your own organization")
    return org_id


class _OrgOwned(Protocol):
    @property
    def organization_id(self) -> int: ...


def visible[T: _OrgOwned](me: CurrentUser, item: T | None, what: str) -> T:
    """Returns `item` if it exists and the caller may see it; otherwise raises 404."""
    if item is None or not can_access_org(me, item.organization_id):
        raise not_found(f"{what} not found")
    return item


def list_org(me: CurrentUser, organization_id: int | None) -> int:
    """The organization a list request is for: the one requested (root) or the caller's own."""
    org_id = organization_id or me.organization_id
    if not can_access_org(me, org_id):
        raise not_found("Organization not found")
    return org_id


# ---------- multiplayer games (rules.md §2.7, MPL-*) ----------
# Hosting (setup, start, skip a turn, remove players, new link) is organization content, so
# it follows the rules above. Players don't need an account: the game's link (its join code)
# lets anyone join while the game is awaiting, and their device then holds a player token.


def join_code_matches(game: Game, code: str | None) -> bool:
    if not code:
        return False
    return hmac.compare_digest(code.strip().upper().encode(), game.join_code.encode())


BAD_LINK = "Game not found. The link may be out of date: ask the host for a new one."


def check_join(game: Game, code: str | None) -> None:
    """MPL-1, MPL-2: a valid link, and only while the game is awaiting players."""
    if not join_code_matches(game, code):
        raise not_found(BAD_LINK, "error.badLink")
    if game.status != "awaiting":
        raise conflict("This game has already started, so it can't be joined anymore", "error.alreadyStarted")


def can_watch(me: CurrentUser | None, game: Game, player: Player | None, code: str | None) -> bool:
    """MPL-5: who may open a game's live view. Its organization (and root), its players, and anyone with its link."""
    return (me is not None and can_access_org(me, game.organization_id)) or player is not None or join_code_matches(game, code)


# ---------- UI translations (rules.md §2.9) ----------


def check_manage_translations(me: CurrentUser) -> None:
    """I18N-1: translations are shared by every organization, so only root users edit them."""
    require_root(me)
