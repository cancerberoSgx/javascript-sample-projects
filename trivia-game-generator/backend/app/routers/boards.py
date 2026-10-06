from fastapi import APIRouter, Response, status
from psycopg import errors

from ..auth import Conn, Me
from ..models import Board, BoardChanges, NewBoard
from ..permissions import conflict, list_org, not_found, target_org, visible
from ..repositories import boards
from ..schemas import BoardCreate, BoardOut, BoardUpdate
from ..validation import validate_board
from .images import check_background

router = APIRouter(prefix="/api/boards", tags=["boards"])


def _out(board: Board | None) -> BoardOut:
    if board is None:
        raise not_found("Board not found")
    # Boards may be saved with problems (drafts, SER-5); the issues travel with the board
    return BoardOut(**board.model_dump(exclude={"definition"}), definition=board.definition, issues=validate_board(board.definition))


@router.get("", response_model=list[BoardOut])
def list_boards(me: Me, conn: Conn, organization_id: int | None = None):
    return [_out(b) for b in boards.list_for_org(conn, list_org(me, organization_id))]


@router.post("", response_model=BoardOut, status_code=status.HTTP_201_CREATED)
def create_board(body: BoardCreate, me: Me, conn: Conn):
    org_id = target_org(me, body.organization_id)
    check_background(conn, org_id, body.definition.background)
    try:
        with conn.transaction():
            new_id = boards.create(
                conn, NewBoard(organization_id=org_id, name=body.name, description=body.description, definition=body.definition)
            )
    except errors.UniqueViolation:
        raise conflict(f"A board named '{body.name}' already exists")
    except errors.ForeignKeyViolation:
        raise not_found("Organization not found")
    return _out(boards.get(conn, new_id))


@router.get("/{board_id}", response_model=BoardOut)
def get_board(board_id: int, me: Me, conn: Conn):
    return _out(visible(me, boards.get(conn, board_id), "Board"))


@router.patch("/{board_id}", response_model=BoardOut)
def update_board(board_id: int, body: BoardUpdate, me: Me, conn: Conn):
    board = visible(me, boards.get(conn, board_id), "Board")
    if body.definition is not None:
        check_background(conn, board.organization_id, body.definition.background)
    changes = BoardChanges(**{k: getattr(body, k) for k in body.model_fields_set if getattr(body, k) is not None})
    try:
        with conn.transaction():
            boards.update(conn, board_id, changes)
    except errors.UniqueViolation:
        raise conflict(f"A board named '{body.name}' already exists")
    return _out(boards.get(conn, board_id))


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_board(board_id: int, me: Me, conn: Conn):
    board = visible(me, boards.get(conn, board_id), "Board")
    if n := boards.count_pending_games_using(conn, board_id):
        raise conflict(f"'{board.name}' is used by {n} game(s) that haven't started yet.")
    with conn.transaction():
        boards.delete(conn, board_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
