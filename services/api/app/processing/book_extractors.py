import io
import posixpath
import re
import shutil
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any, Optional
from xml.etree import ElementTree as ET

from bs4 import BeautifulSoup
from PIL import Image


MAX_ARCHIVE_UNCOMPRESSED_BYTES = 250 * 1024 * 1024
MAX_ARCHIVE_MEMBER_BYTES = 25 * 1024 * 1024
HTML_BLOCK_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "pre")


class BookExtractionError(Exception):
    def __init__(self, code: str, message: str, stage: str = "extracting_text"):
        super().__init__(message)
        self.code = code
        self.message = message
        self.stage = stage


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _is_heading(text: str) -> bool:
    lowered = text.casefold()
    return len(text) <= 90 and (
        text.isupper()
        or lowered.startswith(("chapter ", "part ", "book ", "section ", "prologue", "epilogue"))
    )


def _paragraphs_to_blocks(paragraphs: list[str], source_page: int = 1) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for paragraph in paragraphs:
        text = _normalize_text(paragraph)
        if not text:
            continue
        if _is_heading(text):
            blocks.append({"type": "heading", "text": text, "level": 2, "sourcePage": source_page})
        else:
            blocks.append({"type": "paragraph", "text": text, "sourcePage": source_page})
    return blocks


def _decode_text(data: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-16", "cp1252"):
        try:
            value = data.decode(encoding)
            if value.strip():
                return value
        except (UnicodeDecodeError, UnicodeError):
            continue
    raise BookExtractionError("UNSUPPORTED_ENCODING", "The text encoding could not be detected.")


def _validate_archive(archive: zipfile.ZipFile) -> None:
    total_size = 0
    for member in archive.infolist():
        total_size += member.file_size
        if member.file_size > MAX_ARCHIVE_MEMBER_BYTES:
            raise BookExtractionError("ARCHIVE_TOO_LARGE", "The book contains an oversized archive member.")
        if total_size > MAX_ARCHIVE_UNCOMPRESSED_BYTES:
            raise BookExtractionError("ARCHIVE_TOO_LARGE", "The uncompressed book is too large to process safely.")


def _parse_xml(data: bytes) -> ET.Element:
    upper = data.upper()
    if b"<!DOCTYPE" in upper or b"<!ENTITY" in upper:
        raise BookExtractionError("INVALID_ARCHIVE", "Book XML declarations are not allowed.")
    return ET.fromstring(data)


def _read_archive_member(archive: zipfile.ZipFile, member_name: str) -> bytes:
    normalized = posixpath.normpath(member_name).lstrip("/")
    if normalized.startswith("../") or normalized == "..":
        raise BookExtractionError("INVALID_ARCHIVE", "The book contains an unsafe archive path.")
    try:
        return archive.read(normalized)
    except KeyError as exc:
        raise BookExtractionError("INVALID_ARCHIVE", f"Missing book resource: {normalized}") from exc


def _image_to_jpeg(image_bytes: bytes) -> Optional[bytes]:
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.thumbnail((800, 1200))
            output = io.BytesIO()
            image.convert("RGB").save(output, format="JPEG", quality=85)
            return output.getvalue()
    except Exception:
        return None


def _html_to_blocks(markup: bytes | str, source_page: int = 1) -> tuple[list[dict[str, Any]], str, str]:
    soup = BeautifulSoup(markup, "html.parser")
    for unwanted in soup(["script", "style", "noscript", "template", "svg"]):
        unwanted.decompose()

    title = _normalize_text(soup.title.get_text(" ", strip=True)) if soup.title else ""
    author = ""
    author_meta = soup.find("meta", attrs={"name": re.compile(r"^(author|dc\.creator)$", re.I)})
    if author_meta:
        author = _normalize_text(str(author_meta.get("content", "")))

    root = soup.body or soup
    blocks: list[dict[str, Any]] = []
    for element in root.find_all(HTML_BLOCK_TAGS):
        if element.find_parent(("p", "li", "blockquote", "pre")):
            continue
        text = _normalize_text(element.get_text(" ", strip=True))
        if not text:
            continue
        if element.name and element.name.startswith("h"):
            blocks.append(
                {
                    "type": "heading",
                    "text": text,
                    "level": min(6, max(1, int(element.name[1]))),
                    "sourcePage": source_page,
                }
            )
        else:
            blocks.append({"type": "paragraph", "text": text, "sourcePage": source_page})

    if not blocks:
        fallback = root.get_text("\n", strip=True)
        blocks = _paragraphs_to_blocks(re.split(r"\n+", fallback), source_page)
    return blocks, title, author


def extract_html(file_bytes: bytes) -> dict[str, Any]:
    blocks, title, author = _html_to_blocks(file_bytes)
    if not blocks:
        raise BookExtractionError("EMPTY_BOOK", "The HTML file does not contain readable text.")
    return _build_source(title, author, blocks, page_count=1)


def extract_txt(file_bytes: bytes) -> dict[str, Any]:
    text = _decode_text(file_bytes).replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = re.split(r"\n\s*\n+", text)
    if len(paragraphs) == 1:
        paragraphs = text.split("\n")
    blocks = _paragraphs_to_blocks(paragraphs)
    if not blocks:
        raise BookExtractionError("EMPTY_BOOK", "The text file does not contain readable text.")
    return _build_source("", "", blocks, page_count=1)


def extract_docx(file_bytes: bytes) -> dict[str, Any]:
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
            _validate_archive(archive)
            document = _parse_xml(_read_archive_member(archive, "word/document.xml"))

            title = ""
            author = ""
            if "docProps/core.xml" in archive.namelist():
                core = _parse_xml(_read_archive_member(archive, "docProps/core.xml"))
                for node in core.iter():
                    name = _local_name(node.tag)
                    if name == "title" and node.text:
                        title = _normalize_text(node.text)
                    elif name == "creator" and node.text:
                        author = _normalize_text(node.text)

            blocks: list[dict[str, Any]] = []
            source_page = 1
            for paragraph in (node for node in document.iter() if _local_name(node.tag) == "p"):
                text = _normalize_text("".join(node.text or "" for node in paragraph.iter() if _local_name(node.tag) == "t"))
                if not text:
                    continue
                style = ""
                for node in paragraph.iter():
                    if _local_name(node.tag) == "pStyle":
                        style = next((value for key, value in node.attrib.items() if _local_name(key) == "val"), "")
                        break
                if style.casefold().startswith(("heading", "title", "subtitle")) or _is_heading(text):
                    level_match = re.search(r"(\d+)", style)
                    level = int(level_match.group(1)) if level_match else 2
                    blocks.append({"type": "heading", "text": text, "level": min(6, level), "sourcePage": source_page})
                else:
                    blocks.append({"type": "paragraph", "text": text, "sourcePage": source_page})

                has_page_break = any(
                    _local_name(node.tag) == "br"
                    and any(_local_name(key) == "type" and value == "page" for key, value in node.attrib.items())
                    for node in paragraph.iter()
                )
                if has_page_break:
                    source_page += 1
                    blocks.append({"type": "page_break", "sourcePage": source_page})

            cover_bytes = None
            media_names = sorted(name for name in archive.namelist() if name.startswith("word/media/"))
            if media_names:
                cover_bytes = _image_to_jpeg(_read_archive_member(archive, media_names[0]))
    except (zipfile.BadZipFile, ET.ParseError, KeyError) as exc:
        raise BookExtractionError("CORRUPT_DOCX", "The DOCX file is invalid or corrupted.", "opening_file") from exc

    if not blocks:
        raise BookExtractionError("EMPTY_BOOK", "The DOCX file does not contain readable text.")
    return _build_source(title, author, blocks, page_count=max(1, source_page), cover_bytes=cover_bytes)


def extract_epub(file_bytes: bytes) -> dict[str, Any]:
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
            _validate_archive(archive)
            names = set(archive.namelist())
            opf_path = ""
            if "META-INF/container.xml" in names:
                container = _parse_xml(_read_archive_member(archive, "META-INF/container.xml"))
                rootfile = next((node for node in container.iter() if _local_name(node.tag) == "rootfile"), None)
                if rootfile is not None:
                    opf_path = rootfile.attrib.get("full-path", "")
            if not opf_path:
                opf_path = next((name for name in names if name.lower().endswith(".opf")), "")
            if not opf_path:
                raise BookExtractionError("INVALID_EPUB", "The EPUB package document is missing.", "opening_file")

            package = _parse_xml(_read_archive_member(archive, opf_path))
            title = ""
            author = ""
            cover_id = ""
            manifest: dict[str, dict[str, str]] = {}
            spine_ids: list[str] = []
            for node in package.iter():
                name = _local_name(node.tag)
                if name == "title" and not title and node.text:
                    title = _normalize_text(node.text)
                elif name == "creator" and not author and node.text:
                    author = _normalize_text(node.text)
                elif name == "meta" and node.attrib.get("name", "").casefold() == "cover":
                    cover_id = node.attrib.get("content", "")
                elif name == "item" and node.attrib.get("id"):
                    manifest[node.attrib["id"]] = {
                        "href": node.attrib.get("href", ""),
                        "media_type": node.attrib.get("media-type", ""),
                        "properties": node.attrib.get("properties", ""),
                    }
                elif name == "itemref" and node.attrib.get("idref"):
                    spine_ids.append(node.attrib["idref"])

            opf_dir = str(PurePosixPath(opf_path).parent)

            def resource_path(href: str) -> str:
                base = "" if opf_dir == "." else opf_dir
                return posixpath.normpath(posixpath.join(base, href.split("#", 1)[0])).lstrip("/")

            document_ids = [item_id for item_id in spine_ids if item_id in manifest]
            if not document_ids:
                document_ids = [
                    item_id
                    for item_id, item in manifest.items()
                    if item["media_type"] in {"application/xhtml+xml", "text/html"}
                ]

            blocks: list[dict[str, Any]] = []
            text_chapters = 0
            for chapter_number, item_id in enumerate(document_ids, start=1):
                item = manifest[item_id]
                chapter_path = resource_path(item["href"])
                if chapter_path not in names:
                    continue
                chapter_blocks, chapter_title, _ = _html_to_blocks(
                    _read_archive_member(archive, chapter_path), chapter_number
                )
                if not chapter_blocks:
                    continue
                if blocks:
                    blocks.append({"type": "page_break", "sourcePage": chapter_number})
                if chapter_title and not any(block.get("type") == "heading" for block in chapter_blocks[:2]):
                    chapter_blocks.insert(
                        0,
                        {"type": "heading", "text": chapter_title, "level": 2, "sourcePage": chapter_number},
                    )
                blocks.extend(chapter_blocks)
                text_chapters += 1

            cover_item = manifest.get(cover_id)
            if cover_item is None:
                cover_item = next(
                    (item for item in manifest.values() if "cover-image" in item["properties"].split()),
                    None,
                )
            cover_bytes = None
            if cover_item and cover_item.get("href"):
                cover_path = resource_path(cover_item["href"])
                if cover_path in names:
                    cover_bytes = _image_to_jpeg(_read_archive_member(archive, cover_path))
    except BookExtractionError:
        raise
    except (zipfile.BadZipFile, ET.ParseError, KeyError) as exc:
        raise BookExtractionError("CORRUPT_EPUB", "The EPUB/KEPUB file is invalid or corrupted.", "opening_file") from exc

    if not blocks:
        raise BookExtractionError("EMPTY_BOOK", "The EPUB/KEPUB file does not contain readable chapters.")
    return _build_source(
        title,
        author,
        blocks,
        page_count=max(1, len(document_ids)),
        text_page_count=max(1, text_chapters),
        cover_bytes=cover_bytes,
    )


def unpack_kindle(file_bytes: bytes, extension: str) -> tuple[bytes, str, str]:
    # MOBI/KF8 files are Palm databases whose type/creator marker is BOOKMOBI.
    # Reject arbitrary bytes before invoking the third-party unpacker.
    if len(file_bytes) < 78 or file_bytes[60:68] != b"BOOKMOBI":
        raise BookExtractionError(
            "CORRUPT_KINDLE",
            "The MOBI/AZW/AZW3 file is invalid or corrupted.",
            "opening_file",
        )

    try:
        import mobi
    except ImportError as exc:
        raise BookExtractionError(
            "KINDLE_SUPPORT_UNAVAILABLE",
            "Kindle import support is not installed on the reader service.",
            "opening_file",
        ) from exc

    input_path = ""
    extracted_dir = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as handle:
            handle.write(file_bytes)
            input_path = handle.name
        extracted_dir, extracted_path = mobi.extract(input_path)
        output_path = Path(extracted_path)
        output_extension = output_path.suffix.lower()
        if output_extension not in {".epub", ".html", ".htm", ".pdf"}:
            raise BookExtractionError(
                "UNSUPPORTED_KINDLE_CONTENT",
                "The Kindle container did not contain EPUB, HTML, or PDF content.",
            )
        return output_path.read_bytes(), output_extension, output_path.name
    except BookExtractionError:
        raise
    except Exception as exc:
        message = str(exc)
        code = "DRM_PROTECTED" if any(word in message.casefold() for word in ("drm", "encrypt", "crypto")) else "CORRUPT_KINDLE"
        friendly = (
            "This Kindle book is DRM-protected. Only DRM-free MOBI/AZW/AZW3 files can be imported."
            if code == "DRM_PROTECTED"
            else "The MOBI/AZW/AZW3 file could not be unpacked. It may be corrupted or DRM-protected."
        )
        raise BookExtractionError(code, friendly, "opening_file") from exc
    finally:
        if input_path:
            Path(input_path).unlink(missing_ok=True)
        if extracted_dir:
            shutil.rmtree(extracted_dir, ignore_errors=True)


def _build_source(
    title: str,
    author: str,
    blocks: list[dict[str, Any]],
    page_count: int,
    text_page_count: Optional[int] = None,
    cover_bytes: Optional[bytes] = None,
) -> dict[str, Any]:
    return {
        "title": title,
        "author": author,
        "blocks": blocks,
        "pageCount": max(1, page_count),
        "textPageCount": max(1, text_page_count if text_page_count is not None else page_count),
        "coverBytes": cover_bytes,
    }
