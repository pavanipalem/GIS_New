from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.schemas.user import (
    AdminResetPasswordResponse,
    UserCreate,
    UserCreated,
    UserOut,
    UserUpdate,
)
from app.services import user_service

# Every route here is admin-only: user management lives entirely in the web app.
router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[UserOut])
def list_users(include_inactive: bool = True, db: Session = Depends(get_db)) -> list[User]:
    return user_service.list_users(db, include_inactive=include_inactive)


@router.post("", response_model=UserCreated, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> UserCreated:
    user, temp_password = user_service.create_user(db, payload)
    out = UserCreated.model_validate(user)
    out.temp_password = temp_password
    return out


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)) -> User:
    return user_service.get_user(db, user_id)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    acting_user: User = Depends(require_admin),
) -> User:
    return user_service.update_user(db, user_id, payload, acting_user=acting_user)


@router.post("/{user_id}/reset-password", response_model=AdminResetPasswordResponse)
def reset_password(user_id: int, db: Session = Depends(get_db)) -> AdminResetPasswordResponse:
    _, temp = user_service.admin_reset_password(db, user_id)
    return AdminResetPasswordResponse(temp_password=temp)
