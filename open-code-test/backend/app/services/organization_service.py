from sqlalchemy.orm import Session

from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.models import Organization, User
from app.repositories.organization_repository import OrganizationRepository
from app.services.base import BaseService


class OrganizationService(BaseService):
    def __init__(self, db: Session) -> None:
        super().__init__(db)
        self.organizations = OrganizationRepository(db)

    def list_for_user(self, current_user: User) -> list[Organization]:
        if current_user.role == "root":
            return self.organizations.list_all()

        organization = self.organizations.get(current_user.organization_id)
        return [organization] if organization is not None else []

    def get_for_user(self, organization_id: int, current_user: User) -> Organization:
        if current_user.role != "root" and current_user.organization_id != organization_id:
            raise ForbiddenError("You do not have access to this organization")

        organization = self.organizations.get(organization_id)
        if organization is None:
            raise NotFoundError("Organization not found")
        return organization

    def create(self, name: str, current_user: User) -> Organization:
        self.require_root(current_user)

        if self.organizations.get_by_name(name) is not None:
            raise ConflictError("An organization with this name already exists")

        organization = self.organizations.create(name)
        self.commit("An organization with this name already exists")
        self.db.refresh(organization)
        return organization

    def update(
        self, organization_id: int, name: str, current_user: User
    ) -> Organization:
        self.require_root(current_user)
        organization = self.get_for_user(organization_id, current_user)

        existing = self.organizations.get_by_name(name)
        if existing is not None and existing.id != organization.id:
            raise ConflictError("An organization with this name already exists")

        organization = self.organizations.update(organization, name)
        self.commit("An organization with this name already exists")
        self.db.refresh(organization)
        return organization

    def delete(self, organization_id: int, current_user: User) -> None:
        self.require_root(current_user)
        organization = self.get_for_user(organization_id, current_user)

        if organization.id == current_user.organization_id:
            raise ForbiddenError("You cannot delete the organization you belong to")

        self.organizations.delete(organization)
        self.commit()
