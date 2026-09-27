import re

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError


_USERNAME_PATTERN = re.compile(r"[a-z0-9][a-z0-9._-]{0,31}")
_PASSWORD_HASHER = PasswordHasher()


def normalize_username(value: str) -> str:
    normalized = value.strip().lower()
    if _USERNAME_PATTERN.fullmatch(normalized) is None:
        raise ValueError(
            "Username must be 1-32 lowercase letters, numbers, periods, underscores, or hyphens and begin with a letter or number"
        )
    return normalized


def hash_password(password: str) -> str:
    return _PASSWORD_HASHER.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _PASSWORD_HASHER.verify(password_hash, password)
    except (InvalidHashError, VerificationError, VerifyMismatchError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    try:
        return _PASSWORD_HASHER.check_needs_rehash(password_hash)
    except InvalidHashError:
        return False
