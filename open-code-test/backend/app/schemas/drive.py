from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.file_types import MAX_FILE_BYTES, MAX_FILE_NAME_LENGTH


def _validate_name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Name cannot be empty")
    if len(value) > MAX_FILE_NAME_LENGTH:
        raise ValueError(f"Name must be at most {MAX_FILE_NAME_LENGTH} characters")
    return value


def _validate_content(value: str) -> str:
    if len(value.encode("utf-8")) > MAX_FILE_BYTES:
        raise ValueError(
            f"File content must be at most {MAX_FILE_BYTES // (1024 * 1024)} MB"
        )
    return value


class DriveCreate(BaseModel):
    name: str = Field(min_length=1, max_length=MAX_FILE_NAME_LENGTH)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_name(value)


class DriveUpdate(DriveCreate):
    pass


class DriveRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    name: str
    created_at: datetime
    updated_at: datetime


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=MAX_FILE_NAME_LENGTH)
    parent_id: int | None = Field(default=None, gt=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_name(value)


class FileCreate(FolderCreate):
    content: str = ""

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        return _validate_content(value)


class DriveItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=MAX_FILE_NAME_LENGTH)
    parent_id: int | None = Field(default=None, gt=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_name(value)


class FileContentUpdate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        return _validate_content(value)


class DriveItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    drive_id: int
    parent_id: int | None
    kind: Literal["folder", "file"]
    name: str
    file_type: str | None
    size_bytes: int
    created_at: datetime
    updated_at: datetime


class DriveItemDetail(DriveItemRead):
    content: str | None = None


class CopyItemsRequest(BaseModel):
    item_ids: list[int] = Field(min_length=1)
    target_parent_id: int | None = Field(default=None, gt=0)
