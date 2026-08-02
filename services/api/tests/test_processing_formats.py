import io
import zipfile

import pytest

from app.processing.book_formats import get_book_extension, get_book_mime_type
from app.processing.processing_pipeline import ProcessingPipeline


@pytest.fixture
def pipeline() -> ProcessingPipeline:
    return ProcessingPipeline()


def build_epub() -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("mimetype", "application/epub+zip")
        archive.writestr(
            "META-INF/container.xml",
            """<?xml version="1.0"?>
            <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
              <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
            </container>""",
        )
        archive.writestr(
            "OEBPS/content.opf",
            """<?xml version="1.0"?>
            <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
              <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
                <dc:title>Fixture EPUB</dc:title><dc:creator>Test Author</dc:creator>
              </metadata>
              <manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest>
              <spine><itemref idref="chapter"/></spine>
            </package>""",
        )
        archive.writestr(
            "OEBPS/chapter.xhtml",
            "<html><head><title>Chapter One</title></head><body><h1>Chapter One</h1><p>Readable EPUB text.</p></body></html>",
        )
    return output.getvalue()


def build_docx() -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr(
            "word/document.xml",
            """<?xml version="1.0"?>
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
              <w:body>
                <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter One</w:t></w:r></w:p>
                <w:p><w:r><w:t>Readable DOCX text.</w:t></w:r></w:p>
              </w:body>
            </w:document>""",
        )
        archive.writestr(
            "docProps/core.xml",
            """<?xml version="1.0"?>
            <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
              xmlns:dc="http://purl.org/dc/elements/1.1/">
              <dc:title>Fixture DOCX</dc:title><dc:creator>Test Author</dc:creator>
            </cp:coreProperties>""",
        )
    return output.getvalue()


@pytest.mark.parametrize(
    ("extension", "content", "expected"),
    [
        (".html", b"<html><head><title>HTML Book</title></head><body><h1>Chapter</h1><p>Readable HTML text.</p></body></html>", "Readable HTML text."),
        (".txt", b"CHAPTER ONE\n\nReadable plain text.", "Readable plain text."),
    ],
)
def test_simple_reflowable_formats(pipeline: ProcessingPipeline, extension: str, content: bytes, expected: str):
    result = pipeline.process_file(content, "book-1", extension, f"fixture{extension}")

    assert result["success"] is True
    assert expected in result["htmlContent"]
    assert result["stats"]["wordCount"] > 0


def test_epub_import(pipeline: ProcessingPipeline):
    result = pipeline.process_file(build_epub(), "book-epub", ".epub", "fixture.epub")

    assert result["success"] is True
    assert result["title"] == "Fixture EPUB"
    assert result["author"] == "Test Author"
    assert "Readable EPUB text." in result["htmlContent"]


def test_docx_import(pipeline: ProcessingPipeline):
    result = pipeline.process_file(build_docx(), "book-docx", ".docx", "fixture.docx")

    assert result["success"] is True
    assert result["title"] == "Fixture DOCX"
    assert result["author"] == "Test Author"
    assert "Readable DOCX text." in result["htmlContent"]


def test_kepub_filename_uses_epub_parser_and_mime_type():
    assert get_book_extension("fixture.kepub.epub") == ".epub"
    assert get_book_mime_type("fixture.kepub.epub") == "application/epub+zip"


def test_invalid_kindle_container_is_rejected_before_unpacking(pipeline: ProcessingPipeline):
    result = pipeline.process_file(b"not a kindle book", "book-kindle", ".azw3", "fixture.azw3")

    assert result["success"] is False
    assert result["error"]["code"] == "CORRUPT_KINDLE"
