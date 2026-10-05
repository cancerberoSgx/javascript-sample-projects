import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from cryptography.fernet import Fernet

from .config import get_settings

JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_access_token(user_id: int, impersonator_id: int | None = None) -> tuple[str, uuid.UUID, datetime]:
    """`impersonator_id`: the root user acting as `user_id`. Stored in the "imp" claim; such tokens are short-lived."""
    settings = get_settings()
    jti = uuid.uuid4()
    minutes = settings.impersonation_expire_minutes if impersonator_id else settings.jwt_expire_minutes
    expires_at = datetime.now(UTC) + timedelta(minutes=minutes)
    payload: dict = {"sub": str(user_id), "jti": str(jti), "exp": expires_at, "iat": datetime.now(UTC)}
    if impersonator_id:
        payload["imp"] = str(impersonator_id)
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM), jti, expires_at


def decode_access_token(token: str) -> dict:
    """Raises jwt.InvalidTokenError if the token is malformed, tampered with or expired."""
    return jwt.decode(token, get_settings().jwt_secret, algorithms=[JWT_ALGORITHM], options={"require": ["sub", "jti", "exp"]})


def _fernet() -> Fernet:
    return Fernet(get_settings().encryption_key)


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    return _fernet().decrypt(value.encode()).decode()


def mask_secret(value: str) -> str:
    """'sk-proj-abc...wxyz' -> 'sk-…wxyz'. Never returns enough to reconstruct the key."""
    if len(value) <= 10:
        return "…" + value[-2:]
    return f"{value[:3]}…{value[-4:]}"
