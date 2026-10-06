"""Pure-SQL data access for trivia_generation_jobs (rules.md §2.2.1).

The runner (app/generation.py) writes from worker threads while a job runs. Its writes only
touch a job that is still `running`, so a job that was discarded (deleted) or interrupted
just stops receiving cards.
"""

from typing import Literal

from psycopg.rows import class_row
from psycopg.types.json import Jsonb

from ..db import DbConn, fetch_scalar
from ..models import GeneratedCard, GenerationJob, NewGenerationJob

_SELECT = """
    SELECT j.id, d.organization_id, j.deck_id, j.creator_id, u.name AS creator_name,
           j.provider, j.model, j.request, j.status, j.cards,
           j.batches_total, j.batches_done, j.dropped_duplicates, j.dropped_invalid,
           j.messages, j.error, j.created_at, j.updated_at, j.finished_at
    FROM trivia_generation_jobs j
    JOIN trivia_decks d ON d.id = j.deck_id
    LEFT JOIN trivia_users u ON u.id = j.creator_id
"""


def _jobs(conn: DbConn):
    return conn.cursor(row_factory=class_row(GenerationJob))


def get(conn: DbConn, job_id: int) -> GenerationJob | None:
    return _jobs(conn).execute(_SELECT + " WHERE j.id = %s", (job_id,)).fetchone()


def get_open(conn: DbConn, deck_id: int) -> GenerationJob | None:
    """The deck's generation that hasn't been accepted yet (at most one: a unique index)."""
    return _jobs(conn).execute(_SELECT + " WHERE j.deck_id = %s AND j.status <> 'accepted'", (deck_id,)).fetchone()


def create(conn: DbConn, job: NewGenerationJob, batches_total: int) -> int:
    return fetch_scalar(
        conn,
        """
        INSERT INTO trivia_generation_jobs (deck_id, creator_id, provider, model, request, batches_total)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (job.deck_id, job.creator_id, job.provider, job.model, Jsonb(job.request.model_dump()), batches_total),
    )


def is_running(conn: DbConn, job_id: int) -> bool:
    return conn.execute("SELECT 1 FROM trivia_generation_jobs WHERE id = %s AND status = 'running'", (job_id,)).fetchone() is not None


def add_batch(conn: DbConn, job_id: int, cards: list[GeneratedCard], dropped_duplicates: int, dropped_invalid: int) -> bool:
    """Appends one finished batch. Returns False if the job is gone or no longer running."""
    return (
        conn.execute(
            """
            UPDATE trivia_generation_jobs
            SET cards = cards || %s, batches_done = batches_done + 1,
                dropped_duplicates = dropped_duplicates + %s, dropped_invalid = dropped_invalid + %s, updated_at = now()
            WHERE id = %s AND status = 'running'
            """,
            (Jsonb([c.model_dump() for c in cards]), dropped_duplicates, dropped_invalid, job_id),
        ).rowcount
        == 1
    )


def add_batches(conn: DbConn, job_id: int, n: int) -> bool:
    """Top-up batches scheduled while running count toward the progress total."""
    return (
        conn.execute(
            "UPDATE trivia_generation_jobs SET batches_total = batches_total + %s, updated_at = now() WHERE id = %s AND status = 'running'",
            (n, job_id),
        ).rowcount
        == 1
    )


def add_message(conn: DbConn, job_id: int, message: str) -> bool:
    return (
        conn.execute(
            "UPDATE trivia_generation_jobs SET messages = messages || %s, updated_at = now() WHERE id = %s AND status = 'running'",
            (Jsonb([message]), job_id),
        ).rowcount
        == 1
    )


def finish(conn: DbConn, job_id: int, status: Literal["done", "failed"], error: str | None = None) -> bool:
    return (
        conn.execute(
            """
            UPDATE trivia_generation_jobs SET status = %s, error = %s, finished_at = now(), updated_at = now()
            WHERE id = %s AND status = 'running'
            """,
            (status, error, job_id),
        ).rowcount
        == 1
    )


def mark_accepted(conn: DbConn, job_id: int) -> bool:
    return (
        conn.execute(
            "UPDATE trivia_generation_jobs SET status = 'accepted', updated_at = now() WHERE id = %s AND status IN ('done', 'failed')",
            (job_id,),
        ).rowcount
        == 1
    )


def delete(conn: DbConn, job_id: int) -> bool:
    return conn.execute("DELETE FROM trivia_generation_jobs WHERE id = %s", (job_id,)).rowcount == 1


def fail_interrupted(conn: DbConn) -> int:
    """On startup: jobs left running by a previous process will never finish."""
    return conn.execute(
        """
        UPDATE trivia_generation_jobs
        SET status = 'failed', error = 'Interrupted by a server restart.', finished_at = now(), updated_at = now()
        WHERE status = 'running'
        """
    ).rowcount
