import logging

from fastapi import APIRouter, HTTPException, Response, status

from ..auth import Conn, Me
from ..permissions import forbidden, not_found, require_root
from ..repositories import tokens, users
from ..schemas import LoginIn, MeOut, TokenOut, UserOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("auth")

# Compared against when the email doesn't exist, so both cases take about the same time
_DUMMY_HASH = hash_password("timing-equalizer")


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, conn: Conn):
    user = users.get_by_email(conn, body.email)
    if not verify_password(body.password, user.password_hash if user else _DUMMY_HASH) or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    token, _, expires_at = create_access_token(user.id)
    return TokenOut(access_token=token, expires_at=expires_at, user=UserOut.from_user(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(me: Me, conn: Conn):
    with conn.transaction():
        tokens.revoke(conn, me.jti, me.id, me.token_expires_at)
        tokens.purge_expired(conn)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=MeOut)
def read_me(me: Me):
    impersonator = UserOut.from_user(me.impersonator) if me.impersonator else None
    return MeOut(**UserOut.from_user(me.user).model_dump(), impersonator=impersonator)


@router.post("/impersonate/{user_id}", response_model=TokenOut)
def impersonate(user_id: int, me: Me, conn: Conn):
    """Root only: returns a token that acts as `user_id` (a member of any organization).
    Exit by calling /logout with that token and going back to the root token."""
    if me.impersonator is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Exit the current impersonation first")
    require_root(me)
    target = users.get(conn, user_id)
    if target is None:
        raise not_found("User not found")
    if target.role != "member":
        raise forbidden("Only member users can be impersonated")
    token, _, expires_at = create_access_token(target.id, impersonator_id=me.id)
    log.info("Root user %s (%s) started impersonating %s (%s)", me.id, me.user.email, target.id, target.email)
    return TokenOut(access_token=token, expires_at=expires_at, user=UserOut.from_user(target))
