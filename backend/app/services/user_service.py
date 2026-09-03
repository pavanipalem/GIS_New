from __future__ import annotations

import secrets
import string

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import Role, User
from app.schemas.user import UserCreate, UserUpdate

_PW_ALPHABET = string.ascii_letters + string.digits


def generate_temp_password(length: int = 14) -> str:
    return "".join(secrets.choice(_PW_ALPHABET) for _ in range(length))


def get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


def list_users(db: Session, *, include_inactive: bool = True) -> list[User]:
    stmt = select(User).order_by(User.username)
    if not include_inactive:
        stmt = stmt.where(User.is_active.is_(True))
    return list(db.scalars(stmt))


def create_user(db: Session, data: UserCreate) -> tuple[User, str | None]:
    exists = db.scalar(
        select(User).where(func.lower(User.username) == data.username.lower())
    )
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")

    temp_password: str | None = None
    raw = data.password
    if raw is None:
        raw = temp_password = generate_temp_password()

    user = User(
        username=data.username,
        full_name=data.full_name,
        role=data.role,
        is_active=data.is_active,
        password_hash=hash_password(raw),
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, temp_password


def update_user(db: Session, user_id: int, data: UserUpdate, *, acting_user: User) -> User:
    user = get_user(db, user_id)

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        _guard_last_admin(db, user, new_role=data.role, acting_user=acting_user)
        user.role = data.role
    if data.is_active is not None:
        if not data.is_active:
            _guard_last_admin(db, user, deactivating=True, acting_user=acting_user)
        user.is_active = data.is_active

    db.commit()
    db.refresh(user)
    return user


def admin_reset_password(db: Session, user_id: int) -> tuple[User, str]:
    user = get_user(db, user_id)
    temp = generate_temp_password()
    user.password_hash = hash_password(temp)
    user.must_change_password = True
    db.commit()
    return user, temp


def _guard_last_admin(
    db: Session,
    target: User,
    *,
    new_role: Role | None = None,
    deactivating: bool = False,
    acting_user: User,
) -> None:
    """Prevent removing/demoting/deactivating the final active admin."""
    if target.role != Role.admin:
        return
    losing_admin = deactivating or (new_role is not None and new_role != Role.admin)
    if not losing_admin:
        return
    active_admins = db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.role == Role.admin, User.is_active.is_(True))
    )
    if active_admins is not None and active_admins <= 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Cannot remove the last active admin",
        )
