from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def list_by_organization(self, organization_id: int) -> list[User]:
        return list(
            self.db.scalars(
                select(User)
                .where(User.organization_id == organization_id)
                .order_by(User.email)
            )
        )

    def create(
        self,
        organization_id: int,
        email: str,
        password_hash: str,
        role: str,
    ) -> User:
        user = User(
            organization_id=organization_id,
            email=email,
            password_hash=password_hash,
            role=role,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def update(
        self,
        user: User,
        *,
        email: str | None = None,
        password_hash: str | None = None,
        role: str | None = None,
    ) -> User:
        if email is not None:
            user.email = email
        if password_hash is not None:
            user.password_hash = password_hash
        if role is not None:
            user.role = role
        self.db.flush()
        return user

    def delete(self, user: User) -> None:
        self.db.delete(user)
        self.db.flush()
