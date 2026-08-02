from pathlib import Path
from typing import Final


SUPPORTED_BOOK_EXTENSIONS: Final[frozenset[str]] = frozenset(
    {
        ".pdf",
        ".epub",
        ".kepub",
        ".mobi",
        ".azw",
        ".azw3",
        ".html",
        ".htm",
        ".txt",
        ".docx",
    }
)

BOOK_MIME_TYPES: Final[dict[str, str]] = {
    ".pdf": "application/pdf",
    ".epub": "application/epub+zip",
    ".kepub": "application/epub+zip",
    ".mobi": "application/x-mobipocket-ebook",
    ".azw": "application/vnd.amazon.ebook",
    ".azw3": "application/vnd.amazon.ebook",
    ".html": "text/html",
    ".htm": "text/html",
    ".txt": "text/plain",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

SUPPORTED_FORMAT_LABEL = "PDF, EPUB/KEPUB, MOBI, AZW/AZW3, HTML, TXT, or DOCX"


def get_book_extension(filename: str) -> str:
    """Return a normalized extension without trusting any client MIME type."""
    safe_name = Path(filename or "").name.lower()
    if safe_name.endswith(".kepub.epub"):
        return ".epub"
    return Path(safe_name).suffix


def get_book_mime_type(filename: str) -> str:
    return BOOK_MIME_TYPES.get(get_book_extension(filename), "application/octet-stream")
