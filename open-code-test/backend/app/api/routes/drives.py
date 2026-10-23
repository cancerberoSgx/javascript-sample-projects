from pathlib import PurePosixPath
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.errors import AppError
from app.file_types import MAX_FILE_BYTES
from app.models import Drive, DriveItem, User
from app.schemas.drive import (
    CopyItemsRequest,
    DriveCreate,
    DriveItemDetail,
    DriveItemRead,
    DriveItemUpdate,
    DriveRead,
    DriveUpdate,
    FileContentUpdate,
    FileCreate,
    FolderCreate,
)
from app.services.drive_service import DriveService

router = APIRouter(
    prefix="/organizations/{organization_id}/drives", tags=["drives"]
)


@router.get("", response_model=list[DriveRead])
def list_drives(
    organization_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Drive]:
    return DriveService(db).list_drives(organization_id, current_user)


@router.post("", response_model=DriveRead, status_code=status.HTTP_201_CREATED)
def create_drive(
    organization_id: int,
    data: DriveCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Drive:
    return DriveService(db).create_drive(organization_id, data, current_user)


@router.get("/{drive_id}", response_model=DriveRead)
def get_drive(
    organization_id: int,
    drive_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Drive:
    return DriveService(db).get_drive(organization_id, drive_id, current_user)


@router.patch("/{drive_id}", response_model=DriveRead)
def update_drive(
    organization_id: int,
    drive_id: int,
    data: DriveUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Drive:
    return DriveService(db).update_drive(
        organization_id, drive_id, data, current_user
    )


@router.delete("/{drive_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_drive(
    organization_id: int,
    drive_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    DriveService(db).delete_drive(organization_id, drive_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{drive_id}/items", response_model=list[DriveItemRead])
def list_items(
    organization_id: int,
    drive_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DriveItem]:
    return DriveService(db).list_items(organization_id, drive_id, current_user)


@router.post(
    "/{drive_id}/folders",
    response_model=DriveItemRead,
    status_code=status.HTTP_201_CREATED,
)
def create_folder(
    organization_id: int,
    drive_id: int,
    data: FolderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DriveItem:
    return DriveService(db).create_folder(
        organization_id, drive_id, data, current_user
    )


@router.post(
    "/{drive_id}/files",
    response_model=DriveItemRead,
    status_code=status.HTTP_201_CREATED,
)
def create_file(
    organization_id: int,
    drive_id: int,
    data: FileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DriveItem:
    return DriveService(db).create_file(
        organization_id, drive_id, data, current_user
    )


@router.post(
    "/{drive_id}/files/upload",
    response_model=DriveItemRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    organization_id: int,
    drive_id: int,
    file: UploadFile = File(...),
    parent_id: int | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DriveItem:
    data = await file.read(MAX_FILE_BYTES + 1)
    await file.close()
    if len(data) > MAX_FILE_BYTES:
        raise AppError(
            f"File must be at most {MAX_FILE_BYTES // (1024 * 1024)} MB"
        )

    name = PurePosixPath((file.filename or "upload").replace("\\", "/")).name
    return DriveService(db).create_uploaded_file(
        organization_id,
        drive_id,
        name=name,
        parent_id=parent_id,
        file_type=file.content_type,
        data=data,
        current_user=current_user,
    )


@router.post("/{drive_id}/items/copy", response_model=list[DriveItemRead])
def copy_items(
    organization_id: int,
    drive_id: int,
    data: CopyItemsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DriveItem]:
    return DriveService(db).copy_items(
        organization_id, drive_id, data, current_user
    )


@router.get("/{drive_id}/items/{item_id}", response_model=DriveItemDetail)
def get_item(
    organization_id: int,
    drive_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DriveItem:
    return DriveService(db).get_item(
        organization_id, drive_id, item_id, current_user
    )


@router.patch("/{drive_id}/items/{item_id}", response_model=DriveItemRead)
def update_item(
    organization_id: int,
    drive_id: int,
    item_id: int,
    data: DriveItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DriveItem:
    return DriveService(db).update_item(
        organization_id, drive_id, item_id, data, current_user
    )


@router.put(
    "/{drive_id}/items/{item_id}/content",
    response_model=DriveItemDetail,
)
def update_file_content(
    organization_id: int,
    drive_id: int,
    item_id: int,
    data: FileContentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DriveItem:
    return DriveService(db).update_content(
        organization_id, drive_id, item_id, data, current_user
    )


@router.get("/{drive_id}/items/{item_id}/download")
def download_file(
    organization_id: int,
    drive_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    item = DriveService(db).get_item(
        organization_id, drive_id, item_id, current_user
    )
    if item.kind != "file":
        raise AppError("Only files can be downloaded")

    filename = quote(item.name, safe="")
    headers = {
        "Content-Disposition": (
            f"attachment; filename=\"download\"; filename*=UTF-8''{filename}"
        ),
        "X-Content-Type-Options": "nosniff",
    }
    return Response(
        content=item.data or b"",
        media_type=item.file_type or "application/octet-stream",
        headers=headers,
    )


@router.delete(
    "/{drive_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_item(
    organization_id: int,
    drive_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    DriveService(db).delete_item(
        organization_id, drive_id, item_id, current_user
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
