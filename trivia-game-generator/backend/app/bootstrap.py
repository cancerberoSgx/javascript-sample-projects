"""Creates the first root user from ROOT_EMAIL / ROOT_PASSWORD when no root user exists."""

import logging

from .config import Settings
from .db import DbConn
from .models import NewUser
from .repositories import organizations as orgs
from .repositories import users
from .security import hash_password

log = logging.getLogger("bootstrap")


def ensure_root_user(conn: DbConn, settings: Settings) -> None:
    with conn.transaction():
        conn.execute("SELECT pg_advisory_xact_lock(7241002)")  # one replica at a time
        if users.count_roots(conn) > 0:
            return
        if not settings.root_email or not settings.root_password:
            log.warning("No root user exists and ROOT_EMAIL / ROOT_PASSWORD are not set. Nobody can manage organizations.")
            return
        if users.get_by_email(conn, settings.root_email):
            log.error("Can't bootstrap root: a non-root user already uses %s", settings.root_email)
            return
        org = orgs.get_by_name(conn, settings.root_organization)
        org_id = org.id if org else orgs.create(conn, settings.root_organization, None)
        users.create(
            conn,
            NewUser(
                organization_id=org_id,
                name=settings.root_name,
                email=settings.root_email,
                password_hash=hash_password(settings.root_password),
                role="root",
            ),
        )
        log.info("Created root user %s in organization '%s'", settings.root_email, settings.root_organization)
