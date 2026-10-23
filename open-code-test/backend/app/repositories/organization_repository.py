from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Organization


class OrganizationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, organization_id: int) -> Organization | None:
        return self.db.get(Organization, organization_id)

    def get_by_name(self, name: str) -> Organization | None:
        return self.db.scalar(select(Organization).where(Organization.name == name))

    def list_all(self) -> list[Organization]:
        return list(self.db.scalars(select(Organization).order_by(Organization.name)))

    def create(self, name: str) -> Organization:
        organization = Organization(name=name)
        self.db.add(organization)
        self.db.flush()
        return organization

    def update(self, organization: Organization, name: str) -> Organization:
        organization.name = name
        self.db.flush()
        return organization

    def delete(self, organization: Organization) -> None:
        self.db.delete(organization)
        self.db.flush()
