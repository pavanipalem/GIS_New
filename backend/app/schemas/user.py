from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import Role


class UserBase(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    full_name: str | None = Field(default=None, max_length=120)
    role: Role = Role.viewer
    is_active: bool = True


class UserCreate(UserBase):
    # If omitted, a random temp password is generated and returned once.
    # bcrypt hard-limits input to 72 bytes; cap here so the length in the
    # request matches what actually gets hashed.
    password: str | None = Field(default=None, min_length=8, max_length=72)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    role: Role | None = None
    is_active: bool | None = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    must_change_password: bool
    created_at: datetime
    last_login_at: datetime | None


class UserCreated(UserOut):
    # Present only in the create response when the server generated the password.
    temp_password: str | None = None


class AdminResetPasswordResponse(BaseModel):
    temp_password: str
