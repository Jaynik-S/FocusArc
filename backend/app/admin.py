from __future__ import annotations

import argparse
import getpass
import os
import sys

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.schemas.auth import LoginRequest
from app.services.accounts import AccountError, initialize_existing_password
from app.settings import normalize_database_url


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Private FocusArc account administration"
    )
    commands = parser.add_subparsers(dest="command", required=True)
    initialize = commands.add_parser(
        "set-initial-password",
        help="initialize a reserved user's password or verify the existing value",
    )
    initialize.add_argument("--username", required=True)
    return parser


def _read_password() -> str:
    configured = os.getenv("FOCUSARC_INITIAL_PASSWORD")
    if configured is not None:
        return configured

    first = getpass.getpass("New password: ")
    second = getpass.getpass("Confirm password: ")
    if first != second:
        raise ValueError("Passwords do not match")
    return first


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    if args.command != "set-initial-password":
        return 2

    database_url = os.getenv("MIGRATION_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL or MIGRATION_DATABASE_URL is required", file=sys.stderr)
        return 2

    try:
        credentials = LoginRequest(username=args.username, password=_read_password())
    except (ValidationError, ValueError):
        print("Invalid account setup input", file=sys.stderr)
        return 2

    engine = create_engine(normalize_database_url(database_url), pool_pre_ping=True)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    try:
        with session_factory() as db:
            result = initialize_existing_password(
                db, credentials.username, credentials.password
            )
    except AccountError as exc:
        messages = {
            "username_not_registered": "The requested existing user was not found",
            "password_already_set": "Password is already set and does not match",
        }
        print(messages.get(exc.code, "Account setup failed"), file=sys.stderr)
        return 1
    finally:
        engine.dispose()

    action = "initialized" if result == "initialized" else "verified"
    print(f"Password {action} for {credentials.username}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
