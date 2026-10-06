"""The organizations' image libraries (rules.md §2.1.2, BKG-*): upload, import from a URL, list,
rename, delete. The files are served by the /media mount (storage.MediaFiles), never from here."""

import threading
from typing import Annotated

from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from starlette.concurrency import run_in_threadpool

from .. import images as processing
from ..auth import Conn, CurrentUser, Me
from ..config import get_settings
from ..db import DbConn
from ..formats import Background
from ..models import Image, ImageChanges, NewImage
from ..permissions import conflict, list_org, not_found, target_org, visible
from ..repositories import images
from ..schemas import ImageImport, ImageOut, ImageUpdate
from ..storage import MEDIA_URL, get_store

router = APIRouter(prefix="/api/images", tags=["images"])

# Decoding a 40-megapixel image takes a few hundred MB and a CPU core for a moment: a couple at a
# time is plenty, and the rest of the API keeps its threads.
_processing = threading.BoundedSemaphore(2)


def _out(image: Image | None) -> ImageOut:
    if image is None:
        raise not_found("Image not found")
    return ImageOut(**image.model_dump(), url=f"{MEDIA_URL}/{image.key}")


def _invalid(message: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=[message])


def lock_key(conn: DbConn, key: str) -> None:
    """Serializes adding and removing the same file (shared by key across organizations), so a
    delete never removes a file that a concurrent upload just added a row for."""
    conn.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 7))", (key,))


def _store(conn: DbConn, me: CurrentUser, org_id: int, raw: bytes, name: str, source_url: str | None) -> ImageOut:
    with _processing:
        try:
            image = processing.process(raw)
        except processing.ImageError as e:
            raise _invalid(str(e))
    with conn.transaction():
        lock_key(conn, image.key)
        get_store().save(image.key, image.data)
        image_id = images.create(
            conn,
            NewImage(
                organization_id=org_id,
                key=image.key,
                name=name,
                source_url=source_url,
                content_type=image.content_type,
                width=image.width,
                height=image.height,
                bytes=len(image.data),
                creator_id=me.id,
            ),
        )
    return _out(images.get(conn, image_id))


def check_background(conn: DbConn, org_id: int, background: Background | None) -> None:
    """BKG-4: a background's image must be in the organization's library."""
    if background and background.image and not images.exists(conn, org_id, background.image):
        raise _invalid("The background image isn't in this organization's image library (BKG-4). Upload it or pick another one.")


def delete_files_of(conn: DbConn, keys: list[str]) -> None:
    """Removes the files no organization has in its library anymore (after rows were deleted)."""
    for key in keys:
        with conn.transaction():
            lock_key(conn, key)
            if not images.key_in_use(conn, key):
                get_store().delete(key)


@router.get("", response_model=list[ImageOut])
def list_images(me: Me, conn: Conn, organization_id: int | None = None):
    return [_out(i) for i in images.list_for_org(conn, list_org(me, organization_id))]


@router.post("", response_model=ImageOut, status_code=status.HTTP_201_CREATED)
def upload_image(
    request: Request,
    me: Me,
    conn: Conn,
    file: Annotated[UploadFile, File(description="PNG, JPEG, WebP, AVIF or GIF, at most IMAGE_MAX_UPLOAD_MB")],
    organization_id: Annotated[int | None, Form()] = None,
    name: Annotated[str | None, Form(max_length=200)] = None,
):
    """BKG-3: the image is re-encoded as WebP and added to the library. Uploading a file the
    library already has returns the existing image."""
    org_id = target_org(me, organization_id)
    # The body has been received by now; this only spares decoding it. Put a body size limit on the
    # reverse proxy in production (e.g. nginx client_max_body_size) to refuse it before that.
    if int(request.headers.get("content-length") or 0) > processing.max_upload_bytes() + 64 * 1024:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"Images can be at most {get_settings().image_max_upload_mb:g} MB.")
    raw = file.file.read(processing.max_upload_bytes() + 1)
    label = (name or "").strip() or (file.filename or "").strip() or "image"
    return _store(conn, me, org_id, raw, label[:200], None)


@router.post("/import", response_model=ImageOut, status_code=status.HTTP_201_CREATED)
async def import_image(body: ImageImport, me: Me, conn: Conn):
    """BKG-3: the server downloads the image once and keeps its own copy (public addresses only)."""
    org_id = target_org(me, body.organization_id)
    try:
        raw = await run_in_threadpool(processing.fetch_url, body.url)
    except processing.ImageError as e:
        raise _invalid(str(e))
    return await run_in_threadpool(_store, conn, me, org_id, raw, body.name or processing.name_from_url(body.url), body.url)


@router.get("/{image_id}", response_model=ImageOut)
def get_image(image_id: int, me: Me, conn: Conn):
    return _out(visible(me, images.get(conn, image_id), "Image"))


@router.patch("/{image_id}", response_model=ImageOut)
def rename_image(image_id: int, body: ImageUpdate, me: Me, conn: Conn):
    visible(me, images.get(conn, image_id), "Image")
    with conn.transaction():
        images.update(conn, image_id, ImageChanges(name=body.name))
    return _out(images.get(conn, image_id))


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(image_id: int, me: Me, conn: Conn):
    """BKG-7: not while a board, a game or a started game's snapshot uses it."""
    image = visible(me, images.get(conn, image_id), "Image")
    with conn.transaction():
        lock_key(conn, image.key)
        if users := images.used_by(conn, image_id):
            shown = ", ".join(users[:5]) + (f" and {len(users) - 5} more" if len(users) > 5 else "")
            raise conflict(f"'{image.name}' is used by {shown}. Change their backgrounds first.")
        images.delete(conn, image_id)
        if not images.key_in_use(conn, image.key):
            get_store().delete(image.key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
