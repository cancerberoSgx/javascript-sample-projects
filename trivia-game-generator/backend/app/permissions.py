"""Every access rule in one place. Routers call these before touching data.

Root:    sees and edits every organization and user.
Member:  sees only their own organization and its users. Can create users there and
         update member users there (including themselves). Can't edit root users,
         grant the root role, move users between organizations, or delete anything.

A resource the caller can't see is reported as 404, not 403, so its existence isn't leaked.
"""

from typing import Protocol

from fastapi import HTTPException, status

from .auth import CurrentUser
from .models import Role, User, UserChanges


def not_found(what: str = "Not found") -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, what)


def forbidden(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_403_FORBIDDEN, detail)


def conflict(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, detail)


def require_root(me: CurrentUser) -> None:
    if not me.is_root:
        raise forbidden("Only root users can do this")


def can_view_organization(me: CurrentUser, org_id: int) -> bool:
    return me.is_root or me.organization_id == org_id


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
