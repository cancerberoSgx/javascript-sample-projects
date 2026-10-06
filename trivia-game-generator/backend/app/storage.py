"""Where image files live (rules.md §2.1.2, BKG-3, BKG-8).

Files are named by their content (`<sha256>.webp`), so a key never points to different bytes:
they can be served as immutable files, cached by every device forever, and stored once no matter
how many organizations upload the same image. The database only keeps the library rows.

`LocalImageStore` writes to MEDIA_DIR, which the app serves at /media (see main.py). Moving to
S3-compatible storage means another class with the same three methods, plus a public base URL.
"""

import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from .config import get_settings

MEDIA_URL = "/media"
IMMUTABLE = "public, max-age=31536000, immutable"


class ImageStore(Protocol):
    def save(self, key: str, data: bytes) -> None: ...
    def delete(self, key: str) -> None: ...
    def exists(self, key: str) -> bool: ...


class LocalImageStore:
    def __init__(self, directory: Path) -> None:
        self.directory = directory
        directory.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.directory / key).resolve()
        if path.parent != self.directory.resolve():
            raise ValueError(f"Bad image key: {key!r}")
        return path

    def save(self, key: str, data: bytes) -> None:
        path = self._path(key)
        if path.exists():
            return  # same key = same bytes
        # Write next to the target and rename, so a reader never sees half a file
        fd, tmp = tempfile.mkstemp(dir=self.directory, prefix=".upload-")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(data)
            os.chmod(tmp, 0o644)
            os.replace(tmp, path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()


@lru_cache
def get_store() -> ImageStore:
    return LocalImageStore(get_settings().media_dir)


class MediaFiles(StaticFiles):
    """/media/<key>: plain static files with year-long, immutable caching (the key is a content hash).
    No database and no auth: anyone who knows a key may load it (BKG-8)."""

    def file_response(self, *args, **kwargs) -> Response:
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = IMMUTABLE
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response
