from fastapi import APIRouter, Response, status
from psycopg import errors

from ..auth import Conn, CurrentUser, Me
from ..db import DbConn
from ..models import NewUser, User, UserChanges
from ..permissions import (
    can_view_user,
    check_create_user,
    check_update_user,
    conflict,
    not_found,
    require_root,
)
from ..repositories import organizations as orgs
from ..repositories import users
from ..schemas import UserCreate, UserOut, UserUpdate
from ..security import hash_password
from .i18n import require_language

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(me: Me, conn: Conn, organization_id: int | None = None):
    if not me.is_root:
        if organization_id not in (None, me.organization_id):
            raise not_found("Organization not found")
        organization_id = me.organization_id
    return [UserOut.from_user(u) for u in users.list_users(conn, organization_id)]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, me: Me, conn: Conn):
    org_id = body.organization_id or me.organization_id
    check_create_user(me, org_id, body.role)
    if orgs.get(conn, org_id) is None:
        raise not_found("Organization not found")
    new_user = NewUser(
        organization_id=org_id,
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    try:
        with conn.transaction():
            user_id = users.create(conn, new_user)
    except errors.UniqueViolation:
        raise conflict(f"A user with email {body.email} already exists")
    return _out(users.get(conn, user_id))


def _out(user: User | None) -> UserOut:
    """`user` is None only if the row vanished (e.g. deleted by a concurrent request)."""
    if user is None:
        raise not_found("User not found")
    return UserOut.from_user(user)


def _visible_user(me: CurrentUser, conn: DbConn, user_id: int) -> User:
    target = users.get(conn, user_id)
    if target is None or not can_view_user(me, target):
        raise not_found("User not found")
    return target


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, me: Me, conn: Conn):
    return UserOut.from_user(_visible_user(me, conn, user_id))


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserUpdate, me: Me, conn: Conn):
    target = _visible_user(me, conn, user_id)
    # Fields sent as null are treated as "not sent" (those columns aren't nullable), except language: null = automatic
    sent = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None or k == "language"}
    if body.password is not None:
        sent.pop("password")
        sent["password_hash"] = hash_password(body.password)
    changes = UserChanges(**sent)
    check_update_user(me, target, changes)

    if changes.organization_id is not None and orgs.get(conn, changes.organization_id) is None:
        raise not_found("Organization not found")
    if changes.language is not None:
        require_language(conn, changes.language)
    try:
        with conn.transaction():
            if target.role == "root" and changes.role == "member" and users.count_roots(conn) <= 1:
                raise conflict("Can't demote the last root user")
            users.update(conn, user_id, changes)
    except errors.UniqueViolation:
        raise conflict(f"A user with email {changes.email} already exists")
    return _out(users.get(conn, user_id))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, me: Me, conn: Conn):
    require_root(me)
    target = _visible_user(me, conn, user_id)
    if target.id == me.id:
        raise conflict("You can't delete your own account")
    with conn.transaction():
        if target.role == "root" and users.count_roots(conn) <= 1:
            raise conflict("Can't delete the last root user")
        users.delete(conn, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
