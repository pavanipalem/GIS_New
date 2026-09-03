from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

TokenType = Literal["access", "refresh"]

# Sentinel hash for seeded legacy users: valid bcrypt hash of an unguessable
# random value, so verification always fails until the user resets.
UNUSABLE_PASSWORD_HASH = "$2b$12$" + "." * 53


def hash_password(raw: str) -> str:
    return _pwd.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    if not hashed or hashed == UNUSABLE_PASSWORD_HASH:
        return False
    try:
        return _pwd.verify(raw, hashed)
    except ValueError:
        return False


def _create_token(sub: str, token_type: TokenType, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(UTC)
    if token_type == "access":
        expires = now + timedelta(minutes=settings.access_token_ttl_minutes)
    else:
        expires = now + timedelta(days=settings.refresh_token_ttl_days)
    payload: dict[str, Any] = {
        "sub": sub,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int, role: str) -> str:
    return _create_token(str(user_id), "access", {"role": role})


def create_refresh_token(user_id: int) -> str:
    return _create_token(str(user_id), "refresh")


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    """Raises JWTError on invalid signature/expiry/type."""
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type:
        raise JWTError(f"expected {expected_type} token")
    return payload
