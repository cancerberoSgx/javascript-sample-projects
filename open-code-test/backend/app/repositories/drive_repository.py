from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Drive


class DriveRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, drive_id: int) -> Drive | None:
        return self.db.get(Drive, drive_id)

    def list_by_organization(self, organization_id: int) -> list[Drive]:
        return list(
            self.db.scalars(
                select(Drive)
                .where(Drive.organization_id == organization_id)
                .order_by(func.lower(Drive.name))
            )
        )

    def get_by_name(self, organization_id: int, name: str) -> Drive | None:
        return self.db.scalar(
            select(Drive).where(
                Drive.organization_id == organization_id,
                func.lower(Drive.name) == name.lower(),
            )
        )

    def create(self, organization_id: int, name: str) -> Drive:
        drive = Drive(organization_id=organization_id, name=name)
        self.db.add(drive)
        self.db.flush()
        return drive

    def update(self, drive: Drive, name: str) -> Drive:
        drive.name = name
        self.db.flush()
        return drive

    def delete(self, drive: Drive) -> None:
        self.db.delete(drive)
        self.db.flush()
