from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import DriveItem


class DriveItemRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, item_id: int) -> DriveItem | None:
        return self.db.get(DriveItem, item_id)

    def list_by_drive(self, drive_id: int) -> list[DriveItem]:
        return list(
            self.db.scalars(
                select(DriveItem)
                .where(DriveItem.drive_id == drive_id)
                .order_by(
                    case((DriveItem.kind == "folder", 0), else_=1),
                    func.lower(DriveItem.name),
                )
            )
        )

    def list_children(self, drive_id: int, parent_id: int | None) -> list[DriveItem]:
        query = select(DriveItem).where(DriveItem.drive_id == drive_id)
        if parent_id is None:
            query = query.where(DriveItem.parent_id.is_(None))
        else:
            query = query.where(DriveItem.parent_id == parent_id)
        return list(
            self.db.scalars(
                query.order_by(
                    case((DriveItem.kind == "folder", 0), else_=1),
                    func.lower(DriveItem.name),
                )
            )
        )

    def get_by_name(
        self, drive_id: int, parent_id: int | None, name: str
    ) -> DriveItem | None:
        query = select(DriveItem).where(
            DriveItem.drive_id == drive_id,
            func.lower(DriveItem.name) == name.lower(),
        )
        if parent_id is None:
            query = query.where(DriveItem.parent_id.is_(None))
        else:
            query = query.where(DriveItem.parent_id == parent_id)
        return self.db.scalar(query)

    def create_folder(
        self, drive_id: int, parent_id: int | None, name: str
    ) -> DriveItem:
        item = DriveItem(
            drive_id=drive_id,
            parent_id=parent_id,
            kind="folder",
            name=name,
        )
        self.db.add(item)
        self.db.flush()
        return item

    def create_file(
        self,
        drive_id: int,
        parent_id: int | None,
        name: str,
        file_type: str,
        data: bytes,
    ) -> DriveItem:
        item = DriveItem(
            drive_id=drive_id,
            parent_id=parent_id,
            kind="file",
            name=name,
            file_type=file_type,
            data=data,
            size_bytes=len(data),
        )
        self.db.add(item)
        self.db.flush()
        return item

    def update(
        self,
        item: DriveItem,
        *,
        name: str,
        parent_id: int | None,
    ) -> DriveItem:
        item.name = name
        item.parent_id = parent_id
        self.db.flush()
        return item

    def update_data(self, item: DriveItem, data: bytes) -> DriveItem:
        item.data = data
        item.size_bytes = len(data)
        self.db.flush()
        return item

    def delete(self, item: DriveItem) -> None:
        self.db.delete(item)
        self.db.flush()
