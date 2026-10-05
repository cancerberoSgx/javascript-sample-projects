from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints

from .models import Role, User

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
# bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently truncated
Password = Annotated[str, Field(min_length=8, max_length=72)]


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    organization_id: int
    organization_name: str
    name: str
    email: str
    role: Role
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_user(cls, user: User) -> "UserOut":
        return cls(**user.model_dump(exclude={"password_hash"}))


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_at: datetime
    user: UserOut


class UserCreate(BaseModel):
    organization_id: int | None = None  # defaults to the caller's organization
    name: Name
    email: EmailStr
    password: Password
    role: Role = "member"


class UserUpdate(BaseModel):
    """Every field is optional; only the fields that are sent are changed."""

    organization_id: int | None = None
    name: Name | None = None
    email: EmailStr | None = None
    password: Password | None = None
    role: Role | None = None


class OrganizationOut(BaseModel):
    id: int
    name: str
    has_openai_api_key: bool
    openai_api_key_masked: str | None  # e.g. "sk-…a1b2"; the full key is never returned
    user_count: int
    created_at: datetime
    updated_at: datetime


class OrganizationCreate(BaseModel):
    name: Name
    openai_api_key: str | None = None


class OrganizationUpdate(BaseModel):
    """Send openai_api_key: null to remove the key; leave it out to keep it unchanged."""

    name: Name | None = None
    openai_api_key: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
