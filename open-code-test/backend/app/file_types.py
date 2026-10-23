import re

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_FILE_NAME_LENGTH = 255
MIME_TYPE_PATTERN = re.compile(
    r"^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$"
)


def is_text_file_type(file_type: str | None) -> bool:
    if not file_type:
        return False

    value = file_type.split(";", 1)[0].strip().lower()
    return (
        value.startswith("text/")
        or value in {
            "application/json",
            "application/xml",
            "application/javascript",
            "application/x-javascript",
            "image/svg+xml",
        }
        or value.endswith("+json")
        or value.endswith("+xml")
    )


def normalize_file_type(file_type: str | None, data: bytes) -> str:
    value = (file_type or "").split(";", 1)[0].strip().lower()
    if not value or not MIME_TYPE_PATTERN.fullmatch(value):
        return "application/octet-stream"

    if is_text_file_type(value):
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            return "application/octet-stream"

    return value
