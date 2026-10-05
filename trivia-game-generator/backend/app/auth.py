"""Authentication dependency: resolves the bearer JWT to the current user."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import DbConn, get_conn
from .models import User
from .repositories import tokens, users
from .security import decode_access_token

bearer = HTTPBearer(auto_error=False)
Conn = Annotated[DbConn, Depends(get_conn)]


@dataclass(frozen=True)
class CurrentUser:
    """The user a request acts as. When a root user impersonates a member, this is the
    member (so every permission check sees the member) and `impersonator` is the root user."""

    user: User
    jti: uuid.UUID
    token_expires_at: datetime
    impersonator: User | None = None

    @property
    def id(self) -> int:
        return self.user.id

    @property
    def organization_id(self) -> int:
        return self.user.organization_id

    @property
    def is_root(self) -> bool:
        return self.user.role == "root"


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


def current_user(conn: Conn, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> CurrentUser:
    if creds is None:
        raise _unauthorized("Not authenticated")
    try:
        claims = decode_access_token(creds.credentials)
        jti = uuid.UUID(claims["jti"])
        user_id = int(claims["sub"])
        impersonator_id = int(claims["imp"]) if "imp" in claims else None
    except (jwt.InvalidTokenError, ValueError, KeyError):
        raise _unauthorized("Invalid or expired token")
    if tokens.is_revoked(conn, jti):
        raise _unauthorized("Token has been revoked")
    user = users.get(conn, user_id)
    if user is None:
        raise _unauthorized("User no longer exists")
    impersonator = None
    if impersonator_id is not None:
        # Re-checked on every request: demoting or deleting the root user ends the impersonation
        impersonator = users.get(conn, impersonator_id)
        if impersonator is None or impersonator.role != "root":
            raise _unauthorized("Impersonation is no longer allowed")
    # The role is read from the DB on every request, so role changes apply right away.
    return CurrentUser(user=user, jti=jti, token_expires_at=datetime.fromtimestamp(claims["exp"], UTC), impersonator=impersonator)


Me = Annotated[CurrentUser, Depends(current_user)]
