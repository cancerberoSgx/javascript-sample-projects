from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/organizations/{organization_id}/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(
    organization_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    return UserService(db).list_for_organization(organization_id, current_user)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    organization_id: int,
    data: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return UserService(db).create(organization_id, data, current_user)


@router.get("/{user_id}", response_model=UserRead)
def get_user(
    organization_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return UserService(db).get_for_organization(organization_id, user_id, current_user)


@router.post("/{user_id}/impersonate", response_model=TokenResponse)
def impersonate_user(
    organization_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TokenResponse:
    return UserService(db).impersonate(organization_id, user_id, current_user)


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    organization_id: int,
    user_id: int,
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return UserService(db).update(organization_id, user_id, data, current_user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    organization_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    UserService(db).delete(organization_id, user_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
