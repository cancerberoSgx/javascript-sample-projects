from fastapi import APIRouter, Response, status
from psycopg import errors

from ..auth import Conn, Me
from ..models import Category, CategoryChanges, NewCategory
from ..permissions import conflict, list_org, not_found, target_org, visible
from ..repositories import categories, deck_generations
from ..schemas import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _out(category: Category | None) -> CategoryOut:
    if category is None:
        raise not_found("Category not found")
    return CategoryOut(**category.model_dump())


@router.get("", response_model=list[CategoryOut])
def list_categories(me: Me, conn: Conn, organization_id: int | None = None):
    return [_out(c) for c in categories.list_for_org(conn, list_org(me, organization_id))]


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(body: CategoryCreate, me: Me, conn: Conn):
    org_id = target_org(me, body.organization_id)
    try:
        with conn.transaction():
            new_id = categories.create(conn, NewCategory(organization_id=org_id, name=body.name, description=body.description, color=body.color))
    except errors.UniqueViolation:
        raise conflict(f"A category named '{body.name}' already exists")
    except errors.ForeignKeyViolation:
        raise not_found("Organization not found")
    return _out(categories.get(conn, new_id))


@router.get("/{category_id}", response_model=CategoryOut)
def get_category(category_id: int, me: Me, conn: Conn):
    return _out(visible(me, categories.get(conn, category_id), "Category"))


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, body: CategoryUpdate, me: Me, conn: Conn):
    visible(me, categories.get(conn, category_id), "Category")
    changes = CategoryChanges(**body.model_dump(exclude_unset=True, exclude_none=True))
    try:
        with conn.transaction():
            categories.update(conn, category_id, changes)
    except errors.UniqueViolation:
        raise conflict(f"A category named '{body.name}' already exists")
    return _out(categories.get(conn, category_id))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, me: Me, conn: Conn):
    category = visible(me, categories.get(conn, category_id), "Category")
    if category.card_count:
        raise conflict(f"'{category.name}' is used by {category.card_count} card(s). Move or delete them first.")
    if n := categories.count_pending_games_using(conn, category_id):
        raise conflict(f"'{category.name}' is used by {n} game(s) that haven't started yet.")
    try:
        with conn.transaction():
            deck_generations.drop_category(conn, category_id)  # GEN-10
            categories.delete(conn, category_id)
    except errors.ForeignKeyViolation:  # a card was added concurrently
        raise conflict(f"'{category.name}' is used by cards")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
