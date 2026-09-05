from pydantic import BaseModel, Field

from app.models.user import Role


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    # bcrypt hard-limits input to 72 bytes; cap here so the length in the
    # request matches what actually gets hashed.
    new_password: str = Field(min_length=8, max_length=72)


class CurrentUser(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: Role
    must_change_password: bool
