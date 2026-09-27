from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.security import normalize_username


class LoginRequest(BaseModel):
    username: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def canonical_username(cls, value: str) -> str:
        return normalize_username(value)


class RegisterRequest(LoginRequest):
    confirm: Literal[True]


class AuthUser(BaseModel):
    username: str
