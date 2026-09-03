from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Identity, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Role(str, enum.Enum):
    admin = "admin"      # full access incl. user management
    editor = "editor"    # create/update GIS records
    viewer = "viewer"    # read-only


class User(Base):
    __tablename__ = "app_user"

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(128))
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="user_role", native_enum=True), default=Role.viewer
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # True for legacy-migrated users and admin-created users until first reset.
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User {self.username} ({self.role.value})>"
