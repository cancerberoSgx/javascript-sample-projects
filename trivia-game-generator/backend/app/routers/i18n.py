"""UI translations (rules.md §2.9, I18N-*).

/api/i18n: public, for every device (the player page works logged out): the enabled languages
and one language's messages.
/api/translations: root only. The keys with their context, the languages, each language's
translations (edit, delete, translate with AI, export / import as a file).
"""

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Response, status
from psycopg import errors

from .. import generation, llm
from ..auth import Conn, Me
from ..db import DbConn
from ..i18n import SOURCE_LANGUAGE, ai
from ..i18n.icu import check_translation
from ..models import (
    I18nKey,
    Language,
    LanguageChanges,
    NewLanguage,
    NewTranslation,
    Translation,
)
from ..permissions import check_manage_translations, conflict, not_found
from ..repositories import organizations, translations
from ..schemas import (
    AiFailure,
    AiTranslateIn,
    AiTranslateOut,
    I18nKeyOut,
    LanguageCreate,
    LanguageOut,
    LanguageStatsOut,
    LanguageUpdate,
    MessagesOut,
    TranslationFile,
    TranslationFileEntry,
    TranslationImportOut,
    TranslationIn,
    TranslationOut,
)
from ..security import decrypt_secret

public = APIRouter(prefix="/api/i18n", tags=["i18n"])
router = APIRouter(prefix="/api/translations", tags=["translations"])


def require_language(conn: DbConn, code: str) -> Language:
    """A language users, organizations and games may pick: it exists and is enabled."""
    language = translations.get_language(conn, code)
    if language is None or not language.enabled:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Unknown language '{code}'")
    return language


def _translation_out(t: Translation | None, source: str) -> TranslationOut:
    if t is None:
        raise not_found("Translation not found")
    _, warnings = check_translation(source, t.message)
    return TranslationOut(**t.model_dump(include={"key", "message", "status", "outdated", "updated_by_name", "updated_at"}), warnings=warnings)


def _target_language(conn: DbConn, code: str) -> Language:
    """A language that can have translations: not English, whose texts come from the code."""
    language = translations.get_language(conn, code)
    if language is None:
        raise not_found("Language not found")
    if language.code == SOURCE_LANGUAGE:
        raise conflict("English is the source language: its texts come from the code (frontend/src/i18n/catalog.ts)")
    return language


def _key(conn: DbConn, key: str) -> I18nKey:
    row = translations.get_key(conn, key)
    if row is None:
        raise not_found("Key not found")
    return row


def _validated(key: I18nKey, message: str) -> None:
    errors_, _ = check_translation(key.source, message)
    if errors_:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=errors_)


# ---------- public ----------


@public.get("/languages", response_model=list[LanguageOut])
def enabled_languages(conn: Conn):
    """The languages the UI can be shown in (English first)."""
    return [LanguageOut(**lang.model_dump()) for lang in translations.list_languages(conn, enabled_only=True)]


@public.get("/messages/{code}", response_model=MessagesOut)
def language_messages(code: str, conn: Conn, response: Response, if_none_match: Annotated[str | None, Header()] = None):
    """A language's messages for the keys in use. Missing keys fall back to English in the UI."""
    language = translations.get_language(conn, code)
    if language is None or not language.enabled:
        raise not_found("Language not found")
    version = translations.messages_version(conn, code)
    etag = f'"{version}"'
    if if_none_match == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag})
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "no-cache"  # revalidate: edits show up on the next load (I18N-2)
    return MessagesOut(language=code, version=version, messages={m.key: m.message for m in translations.messages(conn, code)})


# ---------- root: languages ----------


@router.get("/languages", response_model=list[LanguageStatsOut])
def list_languages(me: Me, conn: Conn):
    check_manage_translations(me)
    return [LanguageStatsOut(**s.model_dump()) for s in translations.language_stats(conn)]


def _stats(conn: DbConn, code: str) -> LanguageStatsOut:
    row = next((s for s in translations.language_stats(conn) if s.code == code), None)
    if row is None:
        raise not_found("Language not found")
    return LanguageStatsOut(**row.model_dump())


@router.post("/languages", response_model=LanguageStatsOut, status_code=status.HTTP_201_CREATED)
def create_language(body: LanguageCreate, me: Me, conn: Conn):
    check_manage_translations(me)
    try:
        with conn.transaction():
            translations.create_language(conn, NewLanguage(**body.model_dump()))
    except errors.UniqueViolation:
        raise conflict(f"The language '{body.code}' already exists")
    return _stats(conn, body.code)


@router.patch("/languages/{code}", response_model=LanguageStatsOut)
def update_language(code: str, body: LanguageUpdate, me: Me, conn: Conn):
    check_manage_translations(me)
    if code == SOURCE_LANGUAGE and body.enabled is False:
        raise conflict("English can't be disabled: it's the source language and the fallback")
    changes = LanguageChanges(**body.model_dump(exclude_unset=True, exclude_none=True))
    with conn.transaction():
        if not translations.update_language(conn, code, changes):
            raise not_found("Language not found")
    return _stats(conn, code)


@router.delete("/languages/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_language(code: str, me: Me, conn: Conn):
    """Deletes a language and its translations. Users and games that picked it go back to automatic;
    organizations to English."""
    check_manage_translations(me)
    if code == SOURCE_LANGUAGE:
        raise conflict("English can't be deleted: it's the source language")
    with conn.transaction():
        if not translations.delete_language(conn, code):
            raise not_found("Language not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- root: keys and translations ----------


@router.get("/keys", response_model=list[I18nKeyOut])
def list_keys(me: Me, conn: Conn):
    """Every key with its English message and context, obsolete ones last."""
    check_manage_translations(me)
    return [I18nKeyOut(**k.model_dump()) for k in translations.list_keys(conn)]


@router.get("/{code}", response_model=list[TranslationOut])
def list_translations(code: str, me: Me, conn: Conn):
    check_manage_translations(me)
    _target_language(conn, code)
    sources = {k.key: k.source for k in translations.list_keys(conn)}
    return [_translation_out(t, sources[t.key]) for t in translations.list_translations(conn, code)]


@router.put("/{code}/{key}", response_model=TranslationOut)
def save_translation(code: str, key: str, body: TranslationIn, me: Me, conn: Conn):
    """Saves a translation (I18N-4: valid ICU, no placeholder or tag the English text doesn't have).
    It counts as translated from the current English text."""
    check_manage_translations(me)
    _target_language(conn, code)
    row = _key(conn, key)
    _validated(row, body.message)
    with conn.transaction():
        translations.upsert_translation(
            conn, NewTranslation(language=code, key=key, message=body.message, status=body.status, source_hash=row.source_hash, updated_by=me.id)
        )
    return _translation_out(translations.get_translation(conn, code, key), row.source)


@router.delete("/{code}/{key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_translation(code: str, key: str, me: Me, conn: Conn):
    """The key shows in English again in this language."""
    check_manage_translations(me)
    _target_language(conn, code)
    with conn.transaction():
        if not translations.delete_translation(conn, code, key):
            raise not_found("Translation not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{code}/ai", response_model=AiTranslateOut)
def translate_with_ai(code: str, body: AiTranslateIn, me: Me, conn: Conn):
    """I18N-8: translates the given keys with an organization's OpenAI or Gemini key and saves the
    valid results as `machine` translations, to review. The UI sends the keys in batches."""
    check_manage_translations(me)
    language = _target_language(conn, code)
    if organizations.get(conn, body.organization_id) is None:
        raise not_found("Organization not found")
    keys = translations.get_keys(conn, list(dict.fromkeys(body.keys)))
    if len(keys) != len(set(body.keys)):
        raise not_found("Key not found")
    try:
        provider = generation.pick_provider(generation.org_keys(conn, body.organization_id), body.provider)
    except generation.GenerationUnavailable as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT if e.needs_choice else status.HTTP_409_CONFLICT, str(e))
    encrypted = generation.org_keys(conn, body.organization_id)[provider]
    assert encrypted is not None
    api_key = decrypt_secret(encrypted)
    existing = translations.list_translations(conn, code)
    wanted = {k.key for k in keys}
    current = {t.key: t.message for t in existing if t.key in wanted}
    glossary = {t.key: t.message for t in existing if t.key not in wanted and t.status == "reviewed" and len(t.message) <= 80}
    glossary = dict(list(glossary.items())[: ai.MAX_GLOSSARY])
    try:
        result = ai.translate(provider, generation.org_model(conn, body.organization_id, provider), api_key, language, keys, current, glossary)
    except llm.LlmError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))

    by_key = {k.key: k for k in keys}
    with conn.transaction():
        for key, message in result.translated.items():
            translations.upsert_translation(
                conn, NewTranslation(language=code, key=key, message=message, status="machine", source_hash=by_key[key].source_hash, updated_by=me.id)
            )
    return AiTranslateOut(
        translated=[_translation_out(translations.get_translation(conn, code, k), by_key[k].source) for k in result.translated],
        failed=[AiFailure(key=k, reason=r) for k, r in result.failed.items()],
    )


# ---------- root: files (I18N-9) ----------


@router.get("/{code}/export", response_model=TranslationFile)
def export_translations(code: str, me: Me, conn: Conn, response: Response):
    """Every key in use with its context, English text and this language's translation (empty if none)."""
    check_manage_translations(me)
    language = _target_language(conn, code)
    current = {t.key: t for t in translations.list_translations(conn, code)}
    entries = [
        TranslationFileEntry(
            key=k.key,
            area=k.area,
            description=k.description,
            placeholders=k.placeholders,
            english=k.source,
            translation=current[k.key].message if k.key in current else None,
            status=current[k.key].status if k.key in current else "reviewed",
        )
        for k in translations.list_keys(conn)
        if not k.obsolete
    ]
    response.headers["Content-Disposition"] = f'attachment; filename="translations.{code}.json"'
    return TranslationFile(language=code, language_name=language.name, native_name=language.native_name, entries=entries)


@router.post("/{code}/import", response_model=TranslationImportOut)
def import_translations(code: str, file: TranslationFile, me: Me, conn: Conn):
    """Saves a file's translations, all or nothing: every problem is listed (unknown keys, invalid
    messages). Entries without a translation are skipped; only the key and translation are read."""
    check_manage_translations(me)
    _target_language(conn, code)
    if file.language != code:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=[f"This file is for '{file.language}', not '{code}'"])
    keys = {k.key: k for k in translations.list_keys(conn)}
    current = {t.key: t for t in translations.list_translations(conn, code)}
    problems: list[str] = []
    todo: list[NewTranslation] = []
    unchanged = 0
    for e in file.entries:
        if not e.translation:
            continue
        row = keys.get(e.key)
        if row is None:
            problems.append(f"{e.key}: unknown key")
            continue
        errors_, _ = check_translation(row.source, e.translation)
        problems += [f"{e.key}: {p}" for p in errors_]
        old = current.get(e.key)
        if old and old.message == e.translation and old.status == e.status and not old.outdated:
            unchanged += 1
        elif not errors_:
            todo.append(NewTranslation(language=code, key=e.key, message=e.translation, status=e.status, source_hash=row.source_hash, updated_by=me.id))
    if problems:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=problems)
    with conn.transaction():
        for t in todo:
            translations.upsert_translation(conn, t)
    return TranslationImportOut(imported=len(todo), unchanged=unchanged)
