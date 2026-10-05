"""Typed database rows and write inputs used by the repositories.

These mirror the trivia_* tables and may contain secrets (password_hash, encrypted
keys), so they never go over HTTP directly. app/schemas.py has the API models.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

Role = Literal["root", "member"]


class Row(BaseModel):
    """Read-only snapshot of a database row."""

    model_config = ConfigDict(frozen=True)


class Changes(BaseModel):
    """Partial update: only the fields that were explicitly set are written.
    Setting a nullable field to None writes NULL."""

    model_config = ConfigDict(extra="forbid")

    def set_fields(self) -> dict[str, object]:
        return self.model_dump(exclude_unset=True)


# ---------- trivia_organizations ----------


class Organization(Row):
    id: int
    name: str
    openai_api_key_encrypted: str | None
    user_count: int  # computed by the query
    created_at: datetime
    updated_at: datetime


class OrganizationChanges(Changes):
    name: str | None = None
    openai_api_key_encrypted: str | None = None


# ---------- trivia_users ----------


class User(Row):
    id: int
    organization_id: int
    organization_name: str  # joined from trivia_organizations
    name: str
    email: str
    password_hash: str
    role: Role
    created_at: datetime
    updated_at: datetime


class NewUser(BaseModel):
    organization_id: int
    name: str
    email: str
    password_hash: str
    role: Role


class UserChanges(Changes):
    organization_id: int | None = None
    name: str | None = None
    email: str | None = None
    password_hash: str | None = None
    role: Role | None = None
