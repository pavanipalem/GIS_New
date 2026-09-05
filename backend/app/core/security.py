from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

TokenType = Literal["access", "refresh"]

# bcrypt hard-limits input to 72 bytes and (since 4.x) raises instead of
# silently truncating - enforce the same limit here so hash/verify never
# raise on a long password. Pydantic schemas also cap password length to 72
# so this should never actually trigger from a real request.
_MAX_PASSWORD_BYTES = 72

# Sentinel hash for seeded legacy users: syntactically valid bcrypt hash of
# an unreachable value ('.' is 0 in bcrypt's base64 alphabet), so
# verification always fails until the user resets.
UNUSABLE_PASSWORD_HASH = "$2b$12$" + "." * 53


def hash_password(raw: str) -> str:
    raw_bytes = raw.encode("utf-8")[:_MAX_PASSWORD_BYTES]
    return bcrypt.hashpw(raw_bytes, bcrypt.gensalt()).decode("ascii")


def verify_password(raw: str, hashed: str) -> bool:
    if not hashed:
        return False
    raw_bytes = raw.encode("utf-8")[:_MAX_PASSWORD_BYTES]
    try:
        return bcrypt.checkpw(raw_bytes, hashed.encode("ascii"))
    except ValueError:
        # malformed hash (shouldn't happen for anything we've stored)
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
