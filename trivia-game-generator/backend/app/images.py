"""Turning uploaded or downloaded bytes into a library image (rules.md §2.1.2, BKG-3).

Every image is decoded and re-encoded: the stored file is always a WebP we wrote ourselves,
scaled down to IMAGE_MAX_SIDE, without metadata (EXIF, GPS) and without anything a browser
could treat as script (no SVG). That also keeps what each player downloads small.

`fetch_url` downloads an image for "import from URL". It only talks to public addresses: the
host's addresses are checked before connecting, every redirect is checked again, and the
address actually connected to is checked before the body is read (DNS rebinding).
"""

import hashlib
import io
import ipaddress
import socket
import warnings
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

import httpx2 as httpx
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import get_settings

ACCEPTED_FORMATS = ("PNG", "JPEG", "WEBP", "GIF", "AVIF")
ACCEPTED_TYPES_TEXT = "PNG, JPEG, WebP, AVIF or GIF"
MAX_REDIRECTS = 3


class ImageError(Exception):
    """Bad input: shown to the user as is (422)."""


@dataclass(frozen=True)
class ProcessedImage:
    key: str  # "<sha256>.webp"
    data: bytes
    content_type: str
    width: int
    height: int


def max_upload_bytes() -> int:
    return int(get_settings().image_max_upload_mb * 1024 * 1024)


def process(raw: bytes) -> ProcessedImage:
    """Decodes `raw` (ACCEPTED_FORMATS only), applies the EXIF rotation, scales it down to
    IMAGE_MAX_SIDE and encodes it as WebP. Raises ImageError for anything else."""
    settings = get_settings()
    if not raw:
        raise ImageError("The file is empty.")
    if len(raw) > max_upload_bytes():
        raise ImageError(f"Images can be at most {settings.image_max_upload_mb:g} MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            img = Image.open(io.BytesIO(raw), formats=ACCEPTED_FORMATS)
            # Only the header has been read: refuse huge images before decoding the pixels
            if img.width * img.height > settings.image_max_megapixels * 1_000_000:
                raise ImageError(f"The image is too large ({img.width}×{img.height}). The limit is {settings.image_max_megapixels:g} megapixels.")
            img.seek(0)  # animated GIF/WebP: the first frame
            img.load()
    except ImageError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ImageError(f"That isn't an image this app can use. Upload a {ACCEPTED_TYPES_TEXT} file.")
    except (OSError, ValueError, SyntaxError):
        raise ImageError("The image file is damaged or incomplete.")

    img = ImageOps.exif_transpose(img)
    has_alpha = img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info)
    img = img.convert("RGBA" if has_alpha else "RGB")
    side = settings.image_max_side
    if max(img.size) > side:
        img.thumbnail((side, side), Image.Resampling.LANCZOS)

    out = io.BytesIO()
    # A fresh image has no info/exif, so nothing from the original file is written
    img.save(out, format="WEBP", quality=82, method=4)
    data = out.getvalue()
    return ProcessedImage(
        key=f"{hashlib.sha256(data).hexdigest()}.webp",
        data=data,
        content_type="image/webp",
        width=img.width,
        height=img.height,
    )


# ---------- import from URL ----------


def _check_public(host: str, port: int) -> None:
    """Every address `host` resolves to must be a public one (no localhost, private networks,
    link-local / cloud metadata addresses...)."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError):
        raise ImageError(f"Couldn't find the host {host!r}.")
    for info in infos:
        _check_public_ip(str(info[4][0]))


def _check_public_ip(address: str) -> None:
    ip = ipaddress.ip_address(address.split("%")[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    if not ip.is_global or ip.is_multicast:
        raise ImageError("That address isn't on the public internet, so the server won't download from it.")


def _checked_url(url: str) -> tuple[str, int]:
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ImageError("Enter a full http:// or https:// address.")
    if parts.username or parts.password:
        raise ImageError("Addresses with a user name or password aren't allowed.")
    try:
        port = parts.port or (443 if parts.scheme == "https" else 80)
    except ValueError:
        raise ImageError("The address has an invalid port.")
    _check_public(parts.hostname, port)
    return parts.hostname, port


def _peer_ip(response: httpx.Response) -> str | None:
    stream = response.extensions.get("network_stream")
    if stream is None:
        return None
    addr = stream.get_extra_info("server_addr")
    return str(addr[0]) if addr else None


def fetch_url(url: str) -> bytes:
    """Downloads `url` (at most IMAGE_MAX_UPLOAD_MB, IMAGE_IMPORT_TIMEOUT_SECONDS), following up to
    MAX_REDIRECTS redirects. Raises ImageError with a message for the user."""
    settings = get_settings()
    limit = max_upload_bytes()
    try:
        with httpx.Client(timeout=settings.image_import_timeout_seconds, follow_redirects=False, trust_env=False) as client:
            for _ in range(MAX_REDIRECTS + 1):
                _checked_url(url)
                with client.stream("GET", url, headers={"User-Agent": "TriviaGameGenerator/1.0 (background image import)", "Accept": "image/*"}) as r:
                    if (peer := _peer_ip(r)) is not None:
                        _check_public_ip(peer)
                    if r.status_code in (301, 302, 303, 307, 308) and "location" in r.headers:
                        url = urljoin(str(r.url), r.headers["location"])
                        continue
                    if r.status_code != 200:
                        raise ImageError(f"The address answered with HTTP {r.status_code}.")
                    if int(r.headers.get("content-length") or 0) > limit:
                        raise ImageError(f"Images can be at most {settings.image_max_upload_mb:g} MB.")
                    body = bytearray()
                    for chunk in r.iter_bytes():
                        body += chunk
                        if len(body) > limit:
                            raise ImageError(f"Images can be at most {settings.image_max_upload_mb:g} MB.")
                    return bytes(body)
            raise ImageError("The address redirects too many times.")
    except httpx.TimeoutException:
        raise ImageError("The download took too long.")
    except httpx.HTTPError as e:
        raise ImageError(f"Couldn't download the image ({type(e).__name__}).")


def name_from_url(url: str) -> str:
    """A library name for an imported image: the file name in the URL, or its host."""
    parts = urlsplit(url)
    last = parts.path.rstrip("/").rsplit("/", 1)[-1]
    return (last or parts.hostname or "image")[:200]
