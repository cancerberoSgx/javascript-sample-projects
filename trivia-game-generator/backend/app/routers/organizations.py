from fastapi import APIRouter, Response, status
from psycopg import errors

from ..auth import Conn, Me
from ..models import Organization, OrganizationChanges
from ..permissions import can_view_organization, conflict, not_found, require_root
from ..repositories import organizations as orgs
from ..schemas import OrganizationCreate, OrganizationOut, OrganizationUpdate
from ..security import decrypt_secret, encrypt_secret, mask_secret

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


def to_out(org: Organization | None) -> OrganizationOut:
    """`org` is None only if the row vanished (e.g. deleted by a concurrent request)."""
    if org is None:
        raise not_found("Organization not found")
    encrypted = org.openai_api_key_encrypted
    return OrganizationOut(
        id=org.id,
        name=org.name,
        has_openai_api_key=encrypted is not None,
        openai_api_key_masked=mask_secret(decrypt_secret(encrypted)) if encrypted else None,
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
    key = encrypt_secret(body.openai_api_key) if body.openai_api_key else None
    try:
        with conn.transaction():
            org_id = orgs.create(conn, body.name, key)
    except errors.UniqueViolation:
        raise conflict(f"An organization named '{body.name}' already exists")
    return to_out(orgs.get(conn, org_id))


@router.get("/{org_id}", response_model=OrganizationOut)
def get_organization(org_id: int, me: Me, conn: Conn):
    row = orgs.get(conn, org_id) if can_view_organization(me, org_id) else None
    if row is None:
        raise not_found("Organization not found")
    return to_out(row)


@router.patch("/{org_id}", response_model=OrganizationOut)
def update_organization(org_id: int, body: OrganizationUpdate, me: Me, conn: Conn):
    require_root(me)
    changes = OrganizationChanges()
    if body.name is not None:
        changes.name = body.name
    if "openai_api_key" in body.model_fields_set:  # explicit null clears the key
        changes.openai_api_key_encrypted = encrypt_secret(body.openai_api_key) if body.openai_api_key else None
    try:
        with conn.transaction():
            found = orgs.update(conn, org_id, changes)
    except errors.UniqueViolation:
        raise conflict(f"An organization named '{body.name}' already exists")
    if not found:
        raise not_found("Organization not found")
    return to_out(orgs.get(conn, org_id))


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(org_id: int, me: Me, conn: Conn):
    require_root(me)
    org = orgs.get(conn, org_id)
    if org is None:
        raise not_found("Organization not found")
    if org.user_count:
        raise conflict(f"'{org.name}' still has {org.user_count} user(s). Delete or move them first.")
    try:
        with conn.transaction():
            orgs.delete(conn, org_id)
    except errors.ForeignKeyViolation:  # a user was added concurrently
        raise conflict("Organization still has users")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
