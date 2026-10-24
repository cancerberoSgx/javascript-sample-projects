import re

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_FILE_NAME_LENGTH = 255
MAX_ZIP_ENTRIES = 500
MAX_ZIP_DEPTH = 50
MAX_ZIP_UNCOMPRESSED_BYTES = 50 * 1024 * 1024

MIME_TYPE_PATTERN = re.compile(
    r"^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$"
)

IMAGE_FILE_TYPES = {
    "image/avif",
    "image/bmp",
    "image/gif",
    "image/heic",
    "image/heif",
    "image/jpeg",
    "image/jpg",
    "image/jxl",
    "image/png",
    "image/svg+xml",
    "image/tiff",
    "image/webp",
    "image/x-icon",
    "image/vnd.microsoft.icon",
}

FILE_TYPE_BY_EXTENSION = {
    "avif": "image/avif",
    "bmp": "image/bmp",
    "gif": "image/gif",
    "heic": "image/heic",
    "heif": "image/heif",
    "ico": "image/x-icon",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "jxl": "image/jxl",
    "png": "image/png",
    "svg": "image/svg+xml",
    "tif": "image/tiff",
    "tiff": "image/tiff",
    "webp": "image/webp",
    "zip": "application/zip",
    "txt": "text/plain",
    "csv": "text/csv",
    "json": "application/json",
    "xml": "application/xml",
    "html": "text/html",
    "css": "text/css",
    "js": "application/javascript",
    "md": "text/markdown",
    "pdf": "application/pdf",
}


def _normalize_mime(value: str | None) -> str:
    return (value or "").split(";", 1)[0].strip().lower()


def is_text_file_type(file_type: str | None) -> bool:
    value = _normalize_mime(file_type)
    if not value:
        return False

    return (
        value.startswith("text/")
        or value
        in {
            "application/json",
            "application/xml",
            "application/javascript",
            "application/x-javascript",
            "image/svg+xml",
        }
        or value.endswith("+json")
        or value.endswith("+xml")
    )


def is_image_file_type(file_type: str | None) -> bool:
    return _normalize_mime(file_type) in IMAGE_FILE_TYPES


def _file_extension(filename: str | None) -> str:
    if not filename:
        return ""
    name = filename.replace("\\", "/").rsplit("/", 1)[-1]
    if "." not in name:
        return ""
    return name.rsplit(".", 1)[-1].strip().lower()


def sniff_file_type(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if data.startswith(b"BM"):
        return "image/bmp"
    if data.startswith((b"II*\x00", b"MM\x00*")):
        return "image/tiff"
    if data.startswith(b"\x00\x00\x01\x00"):
        return "image/x-icon"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if len(data) >= 12 and data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand in (b"avif", b"avis"):
            return "image/avif"
        if brand in (b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1"):
            return "image/heic"
    return None


def normalize_file_type(file_type: str | None, data: bytes) -> str:
    value = _normalize_mime(file_type)
    if not value or not MIME_TYPE_PATTERN.fullmatch(value):
        return "application/octet-stream"

    if is_text_file_type(value):
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            return "application/octet-stream"

    return value


def detect_file_type(
    filename: str | None, file_type: str | None, data: bytes
) -> str:
    """Pick the best MIME type from the declared type, filename and bytes."""
    value = _normalize_mime(file_type)
    if value and value != "application/octet-stream":
        return normalize_file_type(value, data)

    extension_type = FILE_TYPE_BY_EXTENSION.get(_file_extension(filename))
    if extension_type:
        return normalize_file_type(extension_type, data)

    sniffed = sniff_file_type(data)
    if sniffed:
        return normalize_file_type(sniffed, data)

    return normalize_file_type(value, data)
