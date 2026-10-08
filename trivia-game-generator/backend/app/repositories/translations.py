"""Pure-SQL data access for UI translations (rules.md §2.9): trivia_languages, trivia_i18n_keys
and trivia_translations."""

from psycopg.rows import class_row, scalar_row
from psycopg.types.json import Jsonb

from ..db import DbConn, fetch_scalar
from ..models import (
    CatalogKey,
    I18nKey,
    Language,
    LanguageChanges,
    LanguageStats,
    NewLanguage,
    NewTranslation,
    Translation,
    TranslationMessage,
)
from ._sql import update_row

# ---------- languages ----------

_LANGUAGE = "SELECT code, name, native_name, enabled, created_at, updated_at FROM trivia_languages"


def list_languages(conn: DbConn, enabled_only: bool = False) -> list[Language]:
    where = " WHERE enabled" if enabled_only else ""
    # English (the source) first, then by English name
    return conn.cursor(row_factory=class_row(Language)).execute(_LANGUAGE + where + " ORDER BY code <> 'en', name").fetchall()


def get_language(conn: DbConn, code: str) -> Language | None:
    return conn.cursor(row_factory=class_row(Language)).execute(_LANGUAGE + " WHERE code = %s", (code,)).fetchone()


def language_stats(conn: DbConn) -> list[LanguageStats]:
    """Every language with its counts over the keys in use. English has nothing to translate."""
    return (
        conn.cursor(row_factory=class_row(LanguageStats))
        .execute(
            """
            SELECT l.code, l.name, l.native_name, l.enabled, l.created_at, l.updated_at,
                   count(t.key)::int AS translated,
                   CASE WHEN l.code = 'en' THEN 0 ELSE (SELECT count(*) FROM trivia_i18n_keys WHERE NOT obsolete)::int - count(t.key)::int END AS missing,
                   count(t.key) FILTER (WHERE t.source_hash <> k.source_hash)::int AS outdated,
                   count(t.key) FILTER (WHERE t.status = 'machine')::int AS machine
            FROM trivia_languages l
            LEFT JOIN trivia_translations t ON t.language = l.code
                AND EXISTS (SELECT 1 FROM trivia_i18n_keys x WHERE x.key = t.key AND NOT x.obsolete)
            LEFT JOIN trivia_i18n_keys k ON k.key = t.key
            GROUP BY l.code
            ORDER BY l.code <> 'en', l.name
            """
        )
        .fetchall()
    )


def create_language(conn: DbConn, language: NewLanguage) -> None:
    conn.execute(
        "INSERT INTO trivia_languages (code, name, native_name) VALUES (%s, %s, %s)",
        (language.code, language.name, language.native_name),
    )


def update_language(conn: DbConn, code: str, changes: LanguageChanges) -> bool:
    return update_row(conn, "trivia_languages", code, changes, id_column="code")


def delete_language(conn: DbConn, code: str) -> bool:
    return conn.execute("DELETE FROM trivia_languages WHERE code = %s", (code,)).rowcount == 1


# ---------- keys (from the code's catalog, I18N-2) ----------

_KEY = "SELECT key, area, source, source_hash, description, placeholders, max_length, obsolete, updated_at FROM trivia_i18n_keys"


def list_keys(conn: DbConn) -> list[I18nKey]:
    return conn.cursor(row_factory=class_row(I18nKey)).execute(_KEY + " ORDER BY obsolete, key").fetchall()


def get_key(conn: DbConn, key: str) -> I18nKey | None:
    return conn.cursor(row_factory=class_row(I18nKey)).execute(_KEY + " WHERE key = %s", (key,)).fetchone()


def get_keys(conn: DbConn, keys: list[str]) -> list[I18nKey]:
    return conn.cursor(row_factory=class_row(I18nKey)).execute(_KEY + " WHERE key = ANY(%s) ORDER BY key", (keys,)).fetchall()


def existing_keys(conn: DbConn) -> set[str]:
    return set(conn.cursor(row_factory=scalar_row).execute("SELECT key FROM trivia_i18n_keys").fetchall())


def upsert_keys(conn: DbConn, keys: list[CatalogKey]) -> None:
    """Writes the catalog: new keys are added, changed ones updated, and the rest left alone."""
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO trivia_i18n_keys (key, area, source, source_hash, description, placeholders, max_length)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (key) DO UPDATE SET
                area = EXCLUDED.area, source = EXCLUDED.source, source_hash = EXCLUDED.source_hash,
                description = EXCLUDED.description, placeholders = EXCLUDED.placeholders,
                max_length = EXCLUDED.max_length, obsolete = false, updated_at = now()
            WHERE (trivia_i18n_keys.area, trivia_i18n_keys.source, trivia_i18n_keys.description,
                   trivia_i18n_keys.placeholders, trivia_i18n_keys.max_length, trivia_i18n_keys.obsolete)
                  IS DISTINCT FROM (EXCLUDED.area, EXCLUDED.source, EXCLUDED.description,
                                    EXCLUDED.placeholders, EXCLUDED.max_length, false)
            """,
            [(k.key, k.area, k.source, k.source_hash, k.description, Jsonb(k.placeholders), k.max_length) for k in keys],
        )


def mark_obsolete(conn: DbConn, current: list[str]) -> int:
    """Keys the catalog no longer has stay, with their translations, but are marked obsolete."""
    return conn.execute(
        "UPDATE trivia_i18n_keys SET obsolete = true, updated_at = now() WHERE NOT obsolete AND NOT (key = ANY(%s))",
        (current,),
    ).rowcount


# ---------- translations ----------

_TRANSLATION = """
    SELECT t.language, t.key, t.message, t.status, t.source_hash,
           t.source_hash <> k.source_hash AS outdated,
           t.updated_by, u.name AS updated_by_name, t.updated_at
    FROM trivia_translations t
    JOIN trivia_i18n_keys k ON k.key = t.key
    LEFT JOIN trivia_users u ON u.id = t.updated_by
"""


def list_translations(conn: DbConn, language: str) -> list[Translation]:
    return conn.cursor(row_factory=class_row(Translation)).execute(_TRANSLATION + " WHERE t.language = %s ORDER BY t.key", (language,)).fetchall()


def get_translation(conn: DbConn, language: str, key: str) -> Translation | None:
    return conn.cursor(row_factory=class_row(Translation)).execute(_TRANSLATION + " WHERE t.language = %s AND t.key = %s", (language, key)).fetchone()


def messages(conn: DbConn, language: str) -> list[TranslationMessage]:
    """The language's messages for keys still in use (what the UI loads)."""
    return (
        conn.cursor(row_factory=class_row(TranslationMessage))
        .execute(
            """
            SELECT t.key, t.message FROM trivia_translations t
            JOIN trivia_i18n_keys k ON k.key = t.key AND NOT k.obsolete
            WHERE t.language = %s ORDER BY t.key
            """,
            (language,),
        )
        .fetchall()
    )


def messages_version(conn: DbConn, language: str) -> str:
    """Changes whenever the language's messages (or the keys) change: the ETag of /i18n/messages."""
    return fetch_scalar(
        conn,
        """
        SELECT concat_ws('-', count(*), extract(epoch FROM max(t.updated_at))::bigint,
                         (SELECT extract(epoch FROM max(updated_at))::bigint FROM trivia_i18n_keys))
        FROM trivia_translations t WHERE t.language = %s
        """,
        (language,),
    )


def count_translations(conn: DbConn, language: str) -> int:
    return fetch_scalar(conn, "SELECT count(*) FROM trivia_translations WHERE language = %s", (language,))


def upsert_translation(conn: DbConn, t: NewTranslation) -> None:
    conn.execute(
        """
        INSERT INTO trivia_translations (language, key, message, status, source_hash, updated_by)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (language, key) DO UPDATE SET
            message = EXCLUDED.message, status = EXCLUDED.status, source_hash = EXCLUDED.source_hash,
            updated_by = EXCLUDED.updated_by, updated_at = now()
        """,
        (t.language, t.key, t.message, t.status, t.source_hash, t.updated_by),
    )


def insert_missing(conn: DbConn, items: list[NewTranslation]) -> int:
    """Adds translations where the language has none for the key yet (bundled defaults, I18N-2)."""
    added = 0
    for t in items:
        added += conn.execute(
            """
            INSERT INTO trivia_translations (language, key, message, status, source_hash, updated_by)
            VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (language, key) DO NOTHING
            """,
            (t.language, t.key, t.message, t.status, t.source_hash, t.updated_by),
        ).rowcount
    return added


def delete_translation(conn: DbConn, language: str, key: str) -> bool:
    return conn.execute("DELETE FROM trivia_translations WHERE language = %s AND key = %s", (language, key)).rowcount == 1
