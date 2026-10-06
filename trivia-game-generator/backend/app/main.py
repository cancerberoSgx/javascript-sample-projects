import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import db, generation
from .auth import Conn
from .bootstrap import ensure_root_user
from .config import get_settings
from .live import hub
from .migrations import apply_pending
from .repositories import generation_jobs
from .routers import (
    auth,
    boards,
    categories,
    decks,
    games,
    images,
    library,
    organizations,
    play,
    users,
)
from .routers import (
    generation as generation_router,
)
from .storage import MEDIA_URL, MediaFiles

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    if settings.auto_migrate:
        apply_pending(settings.database_url, "migration")
    db.open_pool(settings.database_url)
    try:
        with db.connection() as conn:
            ensure_root_user(conn, settings)
            with conn.transaction():
                if n := generation_jobs.fail_interrupted(conn):
                    logging.getLogger(__name__).warning("Marked %d interrupted generation job(s) as failed", n)
        # After the root bootstrap, so seeds can reference the root user
        if settings.run_seeds:
            apply_pending(settings.database_url, "seed")
        hub.attach(asyncio.get_running_loop())
        generation.runner.open()
        yield
    finally:
        await hub.close()
        generation.runner.shutdown()
        db.close_pool()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Trivia Game Generator API", version="0.1.0", lifespan=lifespan)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    app.include_router(auth.router)
    app.include_router(organizations.router)
    app.include_router(users.router)
    for content in (categories, decks, generation_router, boards, games, play, images, library):
        app.include_router(content.router)

    # Background images (BKG-8): static, immutable files. In production, serve settings.media_dir
    # at /media from the web server or a CDN instead, and this mount is never reached.
    settings.media_dir.mkdir(parents=True, exist_ok=True)
    app.mount(MEDIA_URL, MediaFiles(directory=settings.media_dir), name="media")

    @app.get("/api/health", tags=["health"])
    def health(conn: Conn):
        conn.execute("SELECT 1")
        return {"status": "ok"}

    return app


app = create_app()
