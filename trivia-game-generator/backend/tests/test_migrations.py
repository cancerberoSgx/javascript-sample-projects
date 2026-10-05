import psycopg

from app.config import get_settings
from app.migrations import apply_pending, discover


def test_migrations_are_applied_once(client):
    url = get_settings().database_url
    assert apply_pending(url) == []  # the client fixture already applied them
    with psycopg.connect(url) as conn:
        versions = [r[0] for r in conn.execute("SELECT version FROM trivia_schema_migrations WHERE kind = 'migration'")]
        tables = {r[0] for r in conn.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")}
    assert versions == [f.version for f in discover("migration")]
    assert all(t.startswith("trivia_") for t in tables)


def test_seeds_apply_and_are_idempotent(client):
    url = get_settings().database_url
    assert len(apply_pending(url, "seed")) == len(discover("seed"))
    assert apply_pending(url, "seed") == []
