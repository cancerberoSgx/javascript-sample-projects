from fastapi import APIRouter, HTTPException, Response, status

from ..auth import Conn, Me
from ..repositories import tokens, users
from ..schemas import LoginIn, TokenOut, UserOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

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


@router.get("/me", response_model=UserOut)
def read_me(me: Me):
    return UserOut.from_user(me.user)
