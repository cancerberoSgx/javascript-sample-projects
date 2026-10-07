from fastapi import APIRouter, HTTPException, Response, status
from psycopg import errors

from .. import llm, transfer
from ..auth import Conn, CurrentUser, Me
from ..db import DbConn
from ..formats import OrganizationFile
from ..models import Organization, OrganizationChanges, Provider
from ..permissions import (
    can_view_organization,
    check_update_organization,
    conflict,
    not_found,
    require_root,
)
from ..repositories import images
from ..repositories import organizations as orgs
from ..schemas import (
    OrganizationCreate,
    OrganizationImportOut,
    OrganizationOut,
    OrganizationUpdate,
)
from ..security import decrypt_secret, encrypt_secret, mask_secret
from ..transfer import file_name, organization_file
from .images import delete_files_of

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


def to_out(org: Organization | None) -> OrganizationOut:
    """`org` is None only if the row vanished (e.g. deleted by a concurrent request)."""
    if org is None:
        raise not_found("Organization not found")
    openai, gemini = org.openai_api_key_encrypted, org.gemini_api_key_encrypted
    return OrganizationOut(
        id=org.id,
        name=org.name,
        has_openai_api_key=openai is not None,
        openai_api_key_masked=mask_secret(decrypt_secret(openai)) if openai else None,
        has_gemini_api_key=gemini is not None,
        gemini_api_key_masked=mask_secret(decrypt_secret(gemini)) if gemini else None,
        openai_model=org.openai_model,
        gemini_model=org.gemini_model,
        default_openai_model=llm.default_model("openai"),
        default_gemini_model=llm.default_model("gemini"),
        user_count=org.user_count,
        created_at=org.created_at,
        updated_at=org.updated_at,
    )


@router.get("", response_model=list[OrganizationOut])
def list_organizations(me: Me, conn: Conn):
    rows = orgs.list_all(conn) if me.is_root else [orgs.get(conn, me.organization_id)]
    return [to_out(r) for r in rows if r]


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
def create_organization(body: OrganizationCreate, me: Me, conn: Conn):
    require_root(me)
    openai = encrypt_secret(body.openai_api_key) if body.openai_api_key else None
    gemini = encrypt_secret(body.gemini_api_key) if body.gemini_api_key else None
    try:
        with conn.transaction():
            org_id = orgs.create(conn, body.name, openai, gemini)
    except errors.UniqueViolation:
        raise conflict(f"An organization named '{body.name}' already exists")
    return to_out(orgs.get(conn, org_id))


@router.get("/{org_id}", response_model=OrganizationOut)
def get_organization(org_id: int, me: Me, conn: Conn):
    row = orgs.get(conn, org_id) if can_view_organization(me, org_id) else None
    if row is None:
        raise not_found("Organization not found")
    return to_out(row)


def _visible_org(me: CurrentUser, conn: DbConn, org_id: int) -> Organization:
    row = orgs.get(conn, org_id) if can_view_organization(me, org_id) else None
    if row is None:
        raise not_found("Organization not found")
    return row


@router.get("/{org_id}/export", response_model=OrganizationFile)
def export_organization(org_id: int, me: Me, conn: Conn, response: Response):
    """SER-10: all the organization's categories, decks (with cards) and boards in one file."""
    org = _visible_org(me, conn, org_id)
    response.headers["Content-Disposition"] = f'attachment; filename="{file_name(org.name, "organization")}"'
    return organization_file(conn, org)


@router.post("/{org_id}/import", response_model=OrganizationImportOut)
def import_organization(org_id: int, file: OrganizationFile, me: Me, conn: Conn):
    """SER-11: adds an organization file's content (skipping decks and boards whose name is taken)."""
    _visible_org(me, conn, org_id)
    try:
        return transfer.import_organization(conn, org_id, file)
    except errors.UniqueViolation:
        raise conflict("A deck or board with one of these names was just created. Try again.")
    except errors.ForeignKeyViolation:
        raise not_found("Organization not found")


@router.patch("/{org_id}", response_model=OrganizationOut)
def update_organization(org_id: int, body: OrganizationUpdate, me: Me, conn: Conn):
    check_update_organization(me, org_id, body.model_fields_set)
    org = orgs.get(conn, org_id)
    if org is None:
        raise not_found("Organization not found")
    _check_models(org, body)
    changes = OrganizationChanges()
    if body.name is not None:
        changes.name = body.name
    if "openai_api_key" in body.model_fields_set:  # explicit null clears the key
        changes.openai_api_key_encrypted = encrypt_secret(body.openai_api_key) if body.openai_api_key else None
    if "gemini_api_key" in body.model_fields_set:
        changes.gemini_api_key_encrypted = encrypt_secret(body.gemini_api_key) if body.gemini_api_key else None
    for field in ("openai_model", "gemini_model"):
        if field in body.model_fields_set:  # null = back to the app's default
            setattr(changes, field, getattr(body, field))
    try:
        with conn.transaction():
            found = orgs.update(conn, org_id, changes)
    except errors.UniqueViolation:
        raise conflict(f"An organization named '{body.name}' already exists")
    if not found:
        raise not_found("Organization not found")
    return to_out(orgs.get(conn, org_id))


def _check_models(org: Organization, body: OrganizationUpdate) -> None:
    """GEN-1: a model being set must exist for the organization's key (the one in this request, or the
    stored one). Without a key there's nothing to check it with, so it's saved as is."""
    providers: tuple[Provider, ...] = ("openai", "gemini")
    for provider in providers:
        model = getattr(body, f"{provider}_model")
        if model is None:
            continue
        stored = getattr(org, f"{provider}_api_key_encrypted")
        key = getattr(body, f"{provider}_api_key") if f"{provider}_api_key" in body.model_fields_set else (decrypt_secret(stored) if stored else None)
        if not key:
            continue
        try:
            llm.check_model(provider, model, key)
        except llm.LlmError as e:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT if not e.retryable else status.HTTP_503_SERVICE_UNAVAILABLE, str(e))


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(org_id: int, me: Me, conn: Conn):
    require_root(me)
    org = orgs.get(conn, org_id)
    if org is None:
        raise not_found("Organization not found")
    if org.user_count:
        raise conflict(f"'{org.name}' still has {org.user_count} user(s). Delete or move them first.")
    keys = images.keys_for_org(conn, org_id)
    try:
        with conn.transaction():
            orgs.delete(conn, org_id)
    except errors.ForeignKeyViolation:  # a user was added concurrently
        raise conflict("Organization still has users")
    delete_files_of(conn, keys)  # its library rows went with it; files other organizations have stay
    return Response(status_code=status.HTTP_204_NO_CONTENT)
