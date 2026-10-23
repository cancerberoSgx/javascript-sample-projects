from sqlalchemy.orm import Session

from app.errors import UnauthorizedError
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserRead
from app.security import create_access_token, verify_password
from app.services.base import BaseService


class AuthService(BaseService):
    def __init__(self, db: Session) -> None:
        super().__init__(db)
        self.users = UserRepository(db)

    def login(self, data: LoginRequest) -> TokenResponse:
        user = self.users.get_by_email(str(data.email).strip().lower())
        if user is None or not verify_password(data.password, user.password_hash):
            raise UnauthorizedError("Invalid email or password")

        token, expires_in = create_access_token(user.id)
        return TokenResponse(
            access_token=token,
            expires_in=expires_in,
            user=UserRead.model_validate(user),
        )
