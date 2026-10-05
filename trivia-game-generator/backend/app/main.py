import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .auth import Conn
from .bootstrap import ensure_root_user
from .config import get_settings
from .migrations import apply_pending
from .routers import auth, boards, categories, decks, games, organizations, users

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    if settings.auto_migrate:
        apply_pending(settings.database_url, "migration")
    db.open_pool(settings.database_url)
    try:
        with db._pool.connection() as conn:  # type: ignore[union-attr]
            ensure_root_user(conn, settings)
        # After the root bootstrap, so seeds can reference the root user
        if settings.run_seeds:
            apply_pending(settings.database_url, "seed")
        yield
    finally:
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
    for content in (categories, decks, boards, games):
        app.include_router(content.router)

    @app.get("/api/health", tags=["health"])
    def health(conn: Conn):
        conn.execute("SELECT 1")
        return {"status": "ok"}

    return app


app = create_app()
