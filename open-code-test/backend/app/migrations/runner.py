import logging
import time
from pathlib import Path

from sqlalchemy import Engine, text
from sqlalchemy.exc import OperationalError

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parent
ADVISORY_LOCK_KEY = 728_341_902


def run_migrations(engine: Engine, retries: int = 15, delay: float = 1.0) -> None:
    """Apply pending .sql migrations in filename order, each in a transaction."""
    for attempt in range(1, retries + 1):
        try:
            _apply_migrations(engine)
            return
        except OperationalError:
            if attempt == retries:
                raise
            logger.warning("Database not ready (attempt %s/%s), retrying...", attempt, retries)
            time.sleep(delay)


def _apply_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text("SELECT pg_advisory_xact_lock(:key)"),
            {"key": ADVISORY_LOCK_KEY},
        )
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )

        applied = {
            row[0]
            for row in conn.execute(text("SELECT version FROM schema_migrations"))
        }

        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            version = path.stem
            if version in applied:
                continue

            logger.info("Applying migration %s", version)
            conn.exec_driver_sql(path.read_text(encoding="utf-8"))
            conn.execute(
                text("INSERT INTO schema_migrations (version) VALUES (:version)"),
                {"version": version},
            )

        logger.info("Database migrations are up to date")
