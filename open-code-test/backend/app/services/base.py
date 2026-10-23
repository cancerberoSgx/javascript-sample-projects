from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import ConflictError, ForbiddenError
from app.models import User


class BaseService:
    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def require_root(user: User) -> None:
        if user.role != "root":
            raise ForbiddenError("Only root users can perform this action")

    def commit(self, conflict_detail: str = "Resource already exists") -> None:
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ConflictError(conflict_detail) from exc
