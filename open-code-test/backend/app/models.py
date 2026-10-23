from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    LargeBinary,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, deferred, mapped_column, relationship

from app.file_types import is_text_file_type


class Base(DeclarativeBase):
    pass


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    users: Mapped[list["User"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    drives: Mapped[list["Drive"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('member', 'root')", name="users_role_check"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    organization: Mapped[Organization] = relationship(back_populates="users")


class Drive(Base):
    __tablename__ = "drives"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    organization: Mapped[Organization] = relationship(back_populates="drives")
    items: Mapped[list["DriveItem"]] = relationship(
        back_populates="drive",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class DriveItem(Base):
    __tablename__ = "drive_items"
    __table_args__ = (
        CheckConstraint("kind IN ('folder', 'file')", name="drive_items_kind_check"),
        CheckConstraint(
            "length(btrim(name)) > 0", name="drive_items_name_check"
        ),
        CheckConstraint(
            "(kind = 'folder' AND file_type IS NULL AND data IS NULL AND size_bytes = 0) "
            "OR (kind = 'file' AND file_type IS NOT NULL AND data IS NOT NULL "
            "AND size_bytes = octet_length(data))",
            name="drive_items_file_fields_check",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    drive_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("drives.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("drive_items.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    data: Mapped[bytes | None] = mapped_column(
        LargeBinary, nullable=True, deferred=True
    )
    size_bytes: Mapped[int] = mapped_column(
        BigInteger, nullable=False, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    @property
    def is_text(self) -> bool:
        return is_text_file_type(self.file_type)

    @property
    def content(self) -> str | None:
        if self.kind != "file" or not self.is_text or self.data is None:
            return None
        return self.data.decode("utf-8", errors="replace")

    drive: Mapped[Drive] = relationship(back_populates="items")
    parent: Mapped["DriveItem | None"] = relationship(
        remote_side=[id],
        back_populates="children",
    )
    children: Mapped[list["DriveItem"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
