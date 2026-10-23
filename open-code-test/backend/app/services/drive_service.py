from sqlalchemy.orm import Session

from app.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.file_types import (
    MAX_FILE_BYTES,
    MAX_FILE_NAME_LENGTH,
    is_text_file_type,
    normalize_file_type,
)
from app.models import Drive, DriveItem, User
from app.repositories.drive_item_repository import DriveItemRepository
from app.repositories.drive_repository import DriveRepository
from app.repositories.organization_repository import OrganizationRepository
from app.schemas.drive import (
    CopyItemsRequest,
    DriveCreate,
    DriveItemUpdate,
    DriveUpdate,
    FileCreate,
    FileContentUpdate,
    FolderCreate,
)
from app.services.base import BaseService


class DriveService(BaseService):
    def __init__(self, db: Session) -> None:
        super().__init__(db)
        self.drives = DriveRepository(db)
        self.items = DriveItemRepository(db)
        self.organizations = OrganizationRepository(db)

    def _require_organization_access(
        self, organization_id: int, current_user: User
    ) -> None:
        if (
            current_user.role != "root"
            and current_user.organization_id != organization_id
        ):
            raise ForbiddenError("You do not have access to this organization")

        if self.organizations.get(organization_id) is None:
            raise NotFoundError("Organization not found")

    def _get_drive(
        self, organization_id: int, drive_id: int, current_user: User
    ) -> Drive:
        self._require_organization_access(organization_id, current_user)
        drive = self.drives.get(drive_id)
        if drive is None or drive.organization_id != organization_id:
            raise NotFoundError("Drive not found")
        return drive

    def _get_item(self, drive: Drive, item_id: int) -> DriveItem:
        item = self.items.get(item_id)
        if item is None or item.drive_id != drive.id:
            raise NotFoundError("Item not found")
        return item

    def _validate_parent(self, drive: Drive, parent_id: int | None) -> DriveItem | None:
        if parent_id is None:
            return None

        parent = self.items.get(parent_id)
        if parent is None or parent.drive_id != drive.id:
            raise NotFoundError("Parent folder not found")
        if parent.kind != "folder":
            raise AppError("Parent must be a folder")
        return parent

    def _ensure_name_available(
        self,
        drive: Drive,
        parent_id: int | None,
        name: str,
        exclude_id: int | None = None,
    ) -> None:
        existing = self.items.get_by_name(drive.id, parent_id, name)
        if existing is not None and existing.id != exclude_id:
            raise ConflictError("An item with this name already exists")

    def _ensure_not_descendant(
        self, drive: Drive, item: DriveItem, target_parent_id: int | None
    ) -> None:
        if item.kind != "folder" or target_parent_id is None:
            return

        current_id: int | None = target_parent_id
        while current_id is not None:
            if current_id == item.id:
                raise ConflictError(
                    "Cannot move or copy a folder into itself or its descendants"
                )
            parent = self.items.get(current_id)
            current_id = parent.parent_id if parent is not None else None

    def _copy_name(
        self, drive: Drive, parent_id: int | None, source_name: str
    ) -> str:
        candidate = source_name
        counter = 1
        while self.items.get_by_name(drive.id, parent_id, candidate) is not None:
            suffix = " (copy)" if counter == 1 else f" (copy {counter})"
            base = source_name[
                : max(0, MAX_FILE_NAME_LENGTH - len(suffix))
            ].rstrip()
            candidate = f"{base}{suffix}"
            counter += 1
        return candidate

    def _normalize_name(self, name: str) -> str:
        name = name.strip()
        if not name:
            raise AppError("Name cannot be empty")
        if len(name) > MAX_FILE_NAME_LENGTH:
            raise AppError(
                f"Name must be at most {MAX_FILE_NAME_LENGTH} characters"
            )
        return name

    def _validate_file_data(self, data: bytes) -> None:
        if len(data) > MAX_FILE_BYTES:
            raise AppError(
                f"File must be at most {MAX_FILE_BYTES // (1024 * 1024)} MB"
            )

    def list_drives(self, organization_id: int, current_user: User) -> list[Drive]:
        self._require_organization_access(organization_id, current_user)
        return self.drives.list_by_organization(organization_id)

    def get_drive(
        self, organization_id: int, drive_id: int, current_user: User
    ) -> Drive:
        return self._get_drive(organization_id, drive_id, current_user)

    def create_drive(
        self, organization_id: int, data: DriveCreate, current_user: User
    ) -> Drive:
        self._require_organization_access(organization_id, current_user)

        if self.drives.get_by_name(organization_id, data.name) is not None:
            raise ConflictError("A drive with this name already exists")

        drive = self.drives.create(organization_id, data.name)
        self.commit("A drive with this name already exists")
        self.db.refresh(drive)
        return drive

    def update_drive(
        self,
        organization_id: int,
        drive_id: int,
        data: DriveUpdate,
        current_user: User,
    ) -> Drive:
        drive = self._get_drive(organization_id, drive_id, current_user)

        existing = self.drives.get_by_name(organization_id, data.name)
        if existing is not None and existing.id != drive.id:
            raise ConflictError("A drive with this name already exists")

        drive = self.drives.update(drive, data.name)
        self.commit("A drive with this name already exists")
        self.db.refresh(drive)
        return drive

    def delete_drive(
        self, organization_id: int, drive_id: int, current_user: User
    ) -> None:
        drive = self._get_drive(organization_id, drive_id, current_user)
        self.drives.delete(drive)
        self.commit()

    def list_items(
        self, organization_id: int, drive_id: int, current_user: User
    ) -> list[DriveItem]:
        drive = self._get_drive(organization_id, drive_id, current_user)
        return self.items.list_by_drive(drive.id)

    def get_item(
        self,
        organization_id: int,
        drive_id: int,
        item_id: int,
        current_user: User,
    ) -> DriveItem:
        drive = self._get_drive(organization_id, drive_id, current_user)
        return self._get_item(drive, item_id)

    def create_folder(
        self,
        organization_id: int,
        drive_id: int,
        data: FolderCreate,
        current_user: User,
    ) -> DriveItem:
        drive = self._get_drive(organization_id, drive_id, current_user)
        self._validate_parent(drive, data.parent_id)
        self._ensure_name_available(drive, data.parent_id, data.name)

        item = self.items.create_folder(drive.id, data.parent_id, data.name)
        self.commit("An item with this name already exists")
        self.db.refresh(item)
        return item

    def create_file(
        self,
        organization_id: int,
        drive_id: int,
        data: FileCreate,
        current_user: User,
    ) -> DriveItem:
        drive = self._get_drive(organization_id, drive_id, current_user)
        self._validate_parent(drive, data.parent_id)
        self._ensure_name_available(drive, data.parent_id, data.name)

        content = data.content.encode("utf-8")
        self._validate_file_data(content)
        item = self.items.create_file(
            drive.id,
            data.parent_id,
            data.name,
            "text/plain",
            content,
        )
        self.commit("An item with this name already exists")
        self.db.refresh(item)
        return item

    def create_uploaded_file(
        self,
        organization_id: int,
        drive_id: int,
        *,
        name: str,
        parent_id: int | None,
        file_type: str | None,
        data: bytes,
        current_user: User,
    ) -> DriveItem:
        drive = self._get_drive(organization_id, drive_id, current_user)
        self._validate_parent(drive, parent_id)
        name = self._normalize_name(name)
        self._ensure_name_available(drive, parent_id, name)
        self._validate_file_data(data)

        item = self.items.create_file(
            drive.id,
            parent_id,
            name,
            normalize_file_type(file_type, data),
            data,
        )
        self.commit("An item with this name already exists")
        self.db.refresh(item)
        return item

    def update_item(
        self,
        organization_id: int,
        drive_id: int,
        item_id: int,
        data: DriveItemUpdate,
        current_user: User,
    ) -> DriveItem:
        drive = self._get_drive(organization_id, drive_id, current_user)
        item = self._get_item(drive, item_id)

        name = data.name if data.name is not None else item.name
        parent_id = (
            data.parent_id
            if "parent_id" in data.model_fields_set
            else item.parent_id
        )

        if parent_id != item.parent_id:
            self._validate_parent(drive, parent_id)
            self._ensure_not_descendant(drive, item, parent_id)

        if name != item.name or parent_id != item.parent_id:
            self._ensure_name_available(
                drive, parent_id, name, exclude_id=item.id
            )

        item = self.items.update(item, name=name, parent_id=parent_id)
        self.commit("An item with this name already exists")
        self.db.refresh(item)
        return item

    def update_content(
        self,
        organization_id: int,
        drive_id: int,
        item_id: int,
        data: FileContentUpdate,
        current_user: User,
    ) -> DriveItem:
        drive = self._get_drive(organization_id, drive_id, current_user)
        item = self._get_item(drive, item_id)

        if item.kind != "file" or not is_text_file_type(item.file_type):
            raise AppError("Only text files can be edited as text")

        content = data.content.encode("utf-8")
        self._validate_file_data(content)
        item = self.items.update_data(item, content)
        self.commit()
        self.db.refresh(item)
        return item

    def delete_item(
        self,
        organization_id: int,
        drive_id: int,
        item_id: int,
        current_user: User,
    ) -> None:
        drive = self._get_drive(organization_id, drive_id, current_user)
        item = self._get_item(drive, item_id)
        self.items.delete(item)
        self.commit()

    def copy_items(
        self,
        organization_id: int,
        drive_id: int,
        data: CopyItemsRequest,
        current_user: User,
    ) -> list[DriveItem]:
        drive = self._get_drive(organization_id, drive_id, current_user)
        self._validate_parent(drive, data.target_parent_id)

        sources = [
            self._get_item(drive, item_id)
            for item_id in dict.fromkeys(data.item_ids)
        ]

        for source in sources:
            self._ensure_not_descendant(drive, source, data.target_parent_id)

        copies = [
            self._clone_item(drive, source, data.target_parent_id)
            for source in sources
        ]
        self.commit("An item with this name already exists")

        for copy in copies:
            self.db.refresh(copy)
        return copies

    def _clone_item(
        self, drive: Drive, source: DriveItem, target_parent_id: int | None
    ) -> DriveItem:
        name = self._copy_name(drive, target_parent_id, source.name)

        if source.kind == "folder":
            clone = self.items.create_folder(drive.id, target_parent_id, name)
            self.db.flush()
            for child in self.items.list_children(drive.id, source.id):
                self._clone_item(drive, child, clone.id)
            return clone

        clone = self.items.create_file(
            drive.id,
            target_parent_id,
            name,
            source.file_type or "application/octet-stream",
            source.data or b"",
        )
        self.db.flush()
        return clone
