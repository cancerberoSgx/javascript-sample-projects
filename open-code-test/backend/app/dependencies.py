from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import UnauthorizedError
from app.models import User
from app.repositories.user_repository import UserRepository
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise UnauthorizedError("Not authenticated")

    try:
        user_id = decode_access_token(credentials.credentials)
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise UnauthorizedError("Invalid or expired token") from exc

    user = UserRepository(db).get(user_id)
    if user is None:
        raise UnauthorizedError("User not found")
    return user
