"""Pure-SQL migration runner.

Files:
  migrations/NNNN_description.sql   schema changes plus required reference data (always applied)
  seeds/NNNN_description.sql        optional demo/dev data (applied with `seed`, or on startup if RUN_SEEDS=true)

Each file runs once, in version order, inside its own transaction, and is recorded in
trivia_schema_migrations. See backend/README.md for the workflow.

CLI:
  python -m app.migrations status
  python -m app.migrations up
  python -m app.migrations seed
  python -m app.migrations new "add games table" [--seed]
"""

import argparse
import hashlib
import logging
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import LiteralString, cast

import psycopg

from .config import BACKEND_DIR, get_settings

log = logging.getLogger("migrations")

MIGRATIONS_DIR = BACKEND_DIR / "migrations"
SEEDS_DIR = BACKEND_DIR / "seeds"
FILENAME_RE = re.compile(r"^(\d{4})_([a-z0-9_]+)\.sql$")
LOCK_ID = 7_241_001  # arbitrary constant for pg_advisory_xact_lock

TRACKING_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS trivia_schema_migrations (
    kind       text        NOT NULL CHECK (kind IN ('migration', 'seed')),
    version    text        NOT NULL,
    name       text        NOT NULL,
    checksum   text        NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (kind, version)
)
"""


@dataclass(frozen=True)
class SqlFile:
    kind: str  # "migration" | "seed"
    version: str
    name: str
    path: Path

    @property
    def sql(self) -> str:
        return self.path.read_text()

    @property
    def checksum(self) -> str:
        return hashlib.sha256(self.path.read_bytes()).hexdigest()


class MigrationError(Exception):
    pass


def discover(kind: str) -> list[SqlFile]:
    directory = MIGRATIONS_DIR if kind == "migration" else SEEDS_DIR
    files: list[SqlFile] = []
    for path in sorted(directory.glob("*.sql")):
        m = FILENAME_RE.match(path.name)
        if not m:
            raise MigrationError(f"{path.name}: file names must look like 0001_some_name.sql")
        files.append(SqlFile(kind, m.group(1), m.group(2), path))
    versions = [f.version for f in files]
    if len(versions) != len(set(versions)):
        raise MigrationError(f"Duplicate {kind} version numbers in {directory}")
    return files


def _applied(conn: psycopg.Connection, kind: str) -> dict[str, str]:
    rows = conn.execute("SELECT version, checksum FROM trivia_schema_migrations WHERE kind = %s", (kind,)).fetchall()
    return {r[0]: r[1] for r in rows}


def apply_pending(database_url: str, kind: str = "migration") -> list[SqlFile]:
    """Applies every pending file of `kind`. Returns the files that were applied."""
    files = discover(kind)
    applied_now: list[SqlFile] = []
    # autocommit: each `conn.transaction()` below is a real transaction, one per file
    with psycopg.connect(database_url, autocommit=True) as conn:
        conn.execute(TRACKING_TABLE_SQL)
        # Serialize concurrent runners (e.g. several backend replicas starting at once)
        conn.execute("SELECT pg_advisory_lock(%s)", (LOCK_ID,))
        try:
            applied = _applied(conn, kind)
            for f in files:
                if f.version in applied and applied[f.version] != f.checksum:
                    log.warning("%s %s_%s changed after it was applied. Add a new file instead of editing it.", kind, f.version, f.name)
            latest = max(applied, default="0000")
            pending = [f for f in files if f.version not in applied]
            for f in pending:
                if f.version < latest:
                    raise MigrationError(
                        f"{kind} {f.version}_{f.name} is older than the latest applied version {latest}. "
                        "Renumber it so it sorts after the existing ones."
                    )
                log.info("Applying %s %s_%s", kind, f.version, f.name)
                with conn.transaction():
                    # No parameters, so psycopg runs the file as one multi-statement script.
                    # The SQL comes from a file in the repo, not from user input.
                    conn.execute(cast(LiteralString, f.sql))
                    conn.execute(
                        "INSERT INTO trivia_schema_migrations (kind, version, name, checksum) VALUES (%s, %s, %s, %s)",
                        (kind, f.version, f.name, f.checksum),
                    )
                applied_now.append(f)
        finally:
            conn.execute("SELECT pg_advisory_unlock(%s)", (LOCK_ID,))
    return applied_now


def status(database_url: str) -> list[tuple[SqlFile, bool]]:
    with psycopg.connect(database_url, autocommit=True) as conn:
        conn.execute(TRACKING_TABLE_SQL)
        result = []
        for kind in ("migration", "seed"):
            applied = _applied(conn, kind)
            result += [(f, f.version in applied) for f in discover(kind)]
        return result


def new_file(description: str, kind: str) -> Path:
    directory = MIGRATIONS_DIR if kind == "migration" else SEEDS_DIR
    slug = re.sub(r"[^a-z0-9]+", "_", description.lower()).strip("_")
    if not slug:
        raise MigrationError("Description must contain letters or numbers")
    next_version = max((int(f.version) for f in discover(kind)), default=0) + 1
    path = directory / f"{next_version:04d}_{slug}.sql"
    path.write_text(
        f"-- {kind} {next_version:04d}: {description}\n"
        "-- Runs once, inside a transaction. Don't add BEGIN/COMMIT.\n"
        "-- Table names must start with trivia_.\n\n"
    )
    return path


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(prog="python -m app.migrations")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status", help="list migrations and seeds and whether they are applied")
    sub.add_parser("up", help="apply pending migrations")
    sub.add_parser("seed", help="apply pending migrations, then pending seeds")
    new = sub.add_parser("new", help="create a new numbered SQL file")
    new.add_argument("description")
    new.add_argument("--seed", action="store_true", help="create it in seeds/ instead of migrations/")
    args = parser.parse_args(argv)

    try:
        if args.cmd == "new":
            print(new_file(args.description, "seed" if args.seed else "migration").relative_to(BACKEND_DIR))
            return 0
        url = get_settings().database_url
        if args.cmd == "status":
            for f, done in status(url):
                print(f"{'✔' if done else '·'} {f.kind:<9} {f.version}_{f.name}")
        elif args.cmd == "up":
            print(f"Applied {len(apply_pending(url))} migration(s).")
        elif args.cmd == "seed":
            m = apply_pending(url)
            s = apply_pending(url, "seed")
            print(f"Applied {len(m)} migration(s) and {len(s)} seed(s).")
        return 0
    except MigrationError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
