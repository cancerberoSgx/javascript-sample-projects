from sqlalchemy.orm import Session

from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.models import User
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.security import create_access_token, hash_password
from app.services.base import BaseService


class UserService(BaseService):
    def __init__(self, db: Session) -> None:
        super().__init__(db)
        self.users = UserRepository(db)
        self.organizations = OrganizationRepository(db)

    def _require_organization_access(self, organization_id: int, current_user: User) -> None:
        if current_user.role != "root" and current_user.organization_id != organization_id:
            raise ForbiddenError("You do not have access to this organization")

        if self.organizations.get(organization_id) is None:
            raise NotFoundError("Organization not found")

    def list_for_organization(
        self, organization_id: int, current_user: User
    ) -> list[User]:
        self._require_organization_access(organization_id, current_user)
        return self.users.list_by_organization(organization_id)

    def get_for_organization(
        self, organization_id: int, user_id: int, current_user: User
    ) -> User:
        self._require_organization_access(organization_id, current_user)

        user = self.users.get(user_id)
        if user is None or user.organization_id != organization_id:
            raise NotFoundError("User not found")
        return user

    def create(
        self, organization_id: int, data: UserCreate, current_user: User
    ) -> User:
        self._require_organization_access(organization_id, current_user)

        if current_user.role != "root" and data.role != "member":
            raise ForbiddenError("Only root users can create root users")

        email = str(data.email).strip().lower()
        if self.users.get_by_email(email) is not None:
            raise ConflictError("A user with this email already exists")

        user = self.users.create(
            organization_id=organization_id,
            email=email,
            password_hash=hash_password(data.password),
            role=data.role,
        )
        self.commit("A user with this email already exists")
        self.db.refresh(user)
        return user

    def impersonate(
        self, organization_id: int, user_id: int, current_user: User
    ) -> TokenResponse:
        if current_user.role != "root":
            raise ForbiddenError("Only root users can impersonate other users")

        user = self.get_for_organization(organization_id, user_id, current_user)
        if user.role != "member":
            raise ForbiddenError("Only member users can be impersonated")

        token, expires_in = create_access_token(
            user.id, impersonator_id=current_user.id
        )
        return TokenResponse(
            access_token=token,
            expires_in=expires_in,
            user=UserRead.model_validate(user),
        )

    def update(
        self,
        organization_id: int,
        user_id: int,
        data: UserUpdate,
        current_user: User,
    ) -> User:
        user = self.get_for_organization(organization_id, user_id, current_user)

        if current_user.role != "root":
            if user.role == "root":
                raise ForbiddenError("Only root users can modify root users")
            if data.role == "root":
                raise ForbiddenError("Only root users can assign the root role")

        if user.id == current_user.id and data.role is not None and data.role != user.role:
            raise ForbiddenError("You cannot change your own role")

        email = str(data.email).strip().lower() if data.email is not None else None
        if email is not None and email != user.email:
            existing = self.users.get_by_email(email)
            if existing is not None:
                raise ConflictError("A user with this email already exists")

        password_hash = hash_password(data.password) if data.password is not None else None
        user = self.users.update(
            user,
            email=email,
            password_hash=password_hash,
            role=data.role,
        )
        self.commit("A user with this email already exists")
        self.db.refresh(user)
        return user

    def delete(
        self, organization_id: int, user_id: int, current_user: User
    ) -> None:
        user = self.get_for_organization(organization_id, user_id, current_user)

        if user.id == current_user.id:
            raise ForbiddenError("You cannot delete your own account")
        if current_user.role != "root" and user.role == "root":
            raise ForbiddenError("Only root users can delete root users")

        self.users.delete(user)
        self.commit()
