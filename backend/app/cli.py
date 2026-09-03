"""Small operational CLI.

    python -m app.cli seed-admin              # create the first admin from .env
    python -m app.cli import-legacy-users     # copy usernames from legacy_raw.userdetails
    python -m app.cli list-users
"""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import select, text

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.security import UNUSABLE_PASSWORD_HASH, hash_password
from app.models.user import Role, User


def seed_admin() -> int:
    if not settings.first_admin_password:
        print("FIRST_ADMIN_PASSWORD is not set in .env", file=sys.stderr)
        return 1
    with SessionLocal() as db:
        existing_admin = db.scalar(select(User).where(User.role == Role.admin))
        if existing_admin:
            print(f"Admin already exists: {existing_admin.username}")
            return 0
        user = db.scalar(
            select(User).where(User.username == settings.first_admin_username)
        )
        if user:
            user.role = Role.admin
            user.password_hash = hash_password(settings.first_admin_password)
            user.is_active = True
            user.must_change_password = True
            print(f"Promoted existing user {user.username!r} to admin")
        else:
            db.add(
                User(
                    username=settings.first_admin_username,
                    full_name="Administrator",
                    role=Role.admin,
                    is_active=True,
                    must_change_password=True,
                    password_hash=hash_password(settings.first_admin_password),
                )
            )
            print(f"Created admin {settings.first_admin_username!r}")
        db.commit()
    return 0


def import_legacy_users() -> int:
    """Bring across the 11 legacy usernames as inactive-by-default viewers.

    Passwords are NOT migrated (legacy stored them in plaintext). Every imported
    user gets an unusable hash + must_change_password, so an admin must reset
    them (or use the web app's reset-password action) before they can log in.
    """
    src = f'{settings.legacy_schema}."userdetails"'
    with SessionLocal() as db:
        rows = db.execute(text(f'SELECT "UserName" FROM {src} ORDER BY "SNO"')).all()
        created = 0
        for (username,) in rows:
            username = (username or "").strip()
            if not username:
                continue
            exists = db.scalar(select(User).where(User.username == username))
            if exists:
                continue
            db.add(
                User(
                    username=username,
                    role=Role.viewer,
                    is_active=True,
                    must_change_password=True,
                    password_hash=UNUSABLE_PASSWORD_HASH,
                )
            )
            created += 1
        db.commit()
    print(f"Imported {created} legacy user(s) from {src} (password reset required).")
    return 0


def list_users() -> int:
    with SessionLocal() as db:
        for u in db.scalars(select(User).order_by(User.username)):
            flag = "" if u.is_active else " [inactive]"
            reset = " [reset-required]" if u.must_change_password else ""
            print(f"{u.id:>4}  {u.username:<20} {u.role.value:<8}{flag}{reset}")
    return 0


_COMMANDS = {
    "seed-admin": seed_admin,
    "import-legacy-users": import_legacy_users,
    "list-users": list_users,
}


def main() -> int:
    parser = argparse.ArgumentParser(prog="app.cli")
    parser.add_argument("command", choices=_COMMANDS)
    args = parser.parse_args()
    return _COMMANDS[args.command]()


if __name__ == "__main__":
    raise SystemExit(main())
