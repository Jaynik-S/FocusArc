from __future__ import annotations

from typing import Literal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.security import (
    hash_password,
    normalize_username,
    password_needs_rehash,
    verify_password,
)


class AccountError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def authenticate(db: Session, username: str, password: str) -> User:
    canonical = normalize_username(username)
    user = db.get(User, canonical)
    if user is None:
        raise AccountError("username_not_registered")
    if user.password_hash is None:
        raise AccountError("password_setup_required")
    if not verify_password(user.password_hash, password):
        raise AccountError("incorrect_password")

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        db.commit()
        db.refresh(user)
    return user


def register(db: Session, username: str, password: str) -> User:
    user = User(
        username=normalize_username(username),
        password_hash=hash_password(password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AccountError("username_unavailable") from exc
    db.refresh(user)
    return user


def initialize_existing_password(
    db: Session, username: str, password: str
) -> Literal["initialized", "verified"]:
    canonical = normalize_username(username)
    user = db.execute(
        select(User).where(User.username == canonical).with_for_update()
    ).scalar_one_or_none()
    if user is None:
        db.rollback()
        raise AccountError("username_not_registered")

    if user.password_hash is None:
        user.password_hash = hash_password(password)
        db.commit()
        return "initialized"

    if verify_password(user.password_hash, password):
        db.commit()
        return "verified"

    db.rollback()
    raise AccountError("password_already_set")
