"""UI translations (rules.md §2.9, I18N-*).

The texts of the game experience are declared in the frontend (src/i18n/catalog.ts) with their
English message and context; a test there writes `catalog.json` next to this file. On every
startup `sync` writes that catalog into trivia_i18n_keys (I18N-2): new keys are added, changed
ones updated (their translations become outdated, I18N-5), and keys the code dropped are marked
obsolete. Translations live in trivia_translations and are edited by root users.

`bundled/<code>.json` holds translations that ship with the code. They are only defaults: sync
adds them for keys that are new in this run, or for a language that has no translations yet, so
it never overwrites what root edited (or deleted).
"""

import hashlib
import json
import logging
from functools import cache
from pathlib import Path

from ..db import DbConn
from ..models import CatalogKey, NewTranslation
from ..repositories import translations
from .icu import check_translation

log = logging.getLogger(__name__)

SOURCE_LANGUAGE = "en"
_DIR = Path(__file__).parent
CATALOG_PATH = _DIR / "catalog.json"
BUNDLED_DIR = _DIR / "bundled"


def source_hash(message: str) -> str:
    return hashlib.sha256(message.encode()).hexdigest()


@cache
def catalog() -> dict[str, CatalogKey]:
    data = json.loads(CATALOG_PATH.read_text())
    return {
        key: CatalogKey(key=key, source_hash=source_hash(entry["source"]), **entry)
        for key, entry in data["keys"].items()
    }


def bundled() -> dict[str, dict[str, str]]:
    """language code -> {key: message}, from bundled/*.json."""
    out: dict[str, dict[str, str]] = {}
    for path in sorted(BUNDLED_DIR.glob("*.json")):
        data = json.loads(path.read_text())
        out[data["language"]] = data["messages"]
    return out


def sync(conn: DbConn) -> None:
    """Writes the catalog into the database and adds bundled defaults (I18N-2). Idempotent."""
    keys = catalog()
    with conn.transaction():
        conn.execute("SELECT pg_advisory_xact_lock(hashtext('trivia_i18n_sync'))")  # one process at a time
        before = translations.existing_keys(conn)
        translations.upsert_keys(conn, list(keys.values()))
        obsolete = translations.mark_obsolete(conn, list(keys))
        new = set(keys) - before
        added = 0
        for language, messages in bundled().items():
            if translations.get_language(conn, language) is None:
                continue
            fresh_language = translations.count_translations(conn, language) == 0
            items = []
            for key, message in messages.items():
                entry = keys.get(key)
                if entry is None or not (fresh_language or key in new):
                    continue
                errors, _ = check_translation(entry.source, message)
                if errors:
                    log.warning("Bundled %s translation of %s skipped: %s", language, key, "; ".join(errors))
                    continue
                items.append(NewTranslation(language=language, key=key, message=message, status="reviewed", source_hash=entry.source_hash, updated_by=None))
            added += translations.insert_missing(conn, items)
    if new or obsolete or added:
        log.info("i18n catalog: %d new key(s), %d obsolete, %d bundled translation(s) added", len(new), obsolete, added)
