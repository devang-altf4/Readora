"""Seed and expose the bundled Readora starter books.

The catalog records are shared, read-only source documents.  Adding one to a
user's library creates a separate Mongo document (and therefore separate
progress/bookmarks on the device) while reusing the processed source files.
"""

import asyncio
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Final

from app.core.logging import logger
from app.database.mongodb import get_database
from app.processing.book_formats import get_book_extension, get_book_mime_type
from app.repositories.book_repository import BookRepository
from app.services.book_service import BookService
from app.storage.local_storage import storage_service


CATALOG_ASSET_DIR: Final[Path] = Path(__file__).resolve().parent.parent / "catalog_assets"

CATALOG_BOOKS: Final[tuple[dict[str, str], ...]] = (
    {
        "catalogId": "readora-ddia",
        "filename": "designing-data-intensive-applications.pdf",
        "title": "Designing Data-Intensive Applications",
        "author": "Martin Kleppmann",
    },
    {
        "catalogId": "readora-hamlet",
        "filename": "hamlet.azw3",
        "title": "Hamlet",
        "author": "William Shakespeare",
    },
    {
        "catalogId": "readora-sherlock",
        "filename": "the-adventures-of-sherlock-holmes.pdf",
        "title": "The Adventures of Sherlock Holmes",
        "author": "Arthur Conan Doyle",
    },
)


def catalog_manifest() -> list[dict[str, str]]:
    """Return a JSON-safe copy for tests and diagnostics."""

    return [dict(item) for item in CATALOG_BOOKS]


async def _seed_catalog_book(
    item: dict[str, str],
    collection: Any,
    book_service: BookService,
) -> None:
    catalog_id = item["catalogId"]
    asset_path = CATALOG_ASSET_DIR / item["filename"]
    if not asset_path.is_file():
        logger.warning("Catalog asset is missing: %s", asset_path)
        return

    file_bytes = await asyncio.to_thread(asset_path.read_bytes)
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    existing = await collection.find_one({"catalogId": catalog_id, "isCatalog": True})
    if not existing:
        # Earlier imports made before account ownership (or an interrupted
        # catalog seed) have the same content hash but no owner. Reuse that
        # record as the shared catalog source instead of inserting a second
        # ownerless document that would collide with MongoDB's old index.
        existing = await collection.find_one(
            {
                "fileHash": file_hash,
                "isCatalog": {"$ne": True},
                "$or": [{"userId": {"$exists": False}}, {"userId": None}],
            }
        )
        if existing:
            logger.info("Promoting ownerless book %s into catalog item %s", existing["_id"], catalog_id)

    if existing and existing.get("processingStatus") in {"ready", "ocr_required"}:
        storage = existing.get("storage", {})
        original_exists = bool(storage.get("originalFileKey")) and await storage_service.file_exists(storage["originalFileKey"])
        html_exists = bool(storage.get("processedHtmlKey")) and await storage_service.file_exists(storage["processedHtmlKey"])
        if original_exists and html_exists:
            if existing.get("catalogId") != catalog_id or not existing.get("isCatalog"):
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {
                        "$set": {
                            "catalogId": catalog_id,
                            "isCatalog": True,
                            "storageShared": True,
                            "title": item["title"],
                            "author": item["author"],
                        },
                        "$unset": {"userId": ""},
                    },
                )
            return

    extension = get_book_extension(item["filename"])
    book_id = str(existing.get("_id")) if existing else f"catalog-{catalog_id}"
    original_key = await storage_service.save_original(book_id, file_bytes, extension=extension)
    now = datetime.now(timezone.utc)
    book_doc = {
        "_id": book_id,
        "catalogId": catalog_id,
        "isCatalog": True,
        "storageShared": True,
        "schemaVersion": 1,
        "originalFilename": item["filename"],
        "storedFilename": f"{book_id}{extension}",
        "title": item["title"],
        "author": item["author"],
        "mimeType": get_book_mime_type(item["filename"]),
        "fileSize": len(file_bytes),
        "fileHash": file_hash,
        "pageCount": 0,
        "textPageCount": 0,
        "documentType": "text_based",
        "processingStatus": "uploaded",
        "processingProgress": 0,
        "processingStage": "awaiting_processing",
        "processingError": None,
        "storage": {
            "originalFileKey": original_key,
            "originalPdfKey": original_key if extension == ".pdf" else None,
            "coverKey": existing.get("storage", {}).get("coverKey") if existing else None,
            "processedJsonKey": existing.get("storage", {}).get("processedJsonKey") if existing else None,
            "processedHtmlKey": existing.get("storage", {}).get("processedHtmlKey") if existing else None,
        },
        "extraction": existing.get("extraction", {}) if existing else {},
        "createdAt": existing.get("createdAt", now) if existing else now,
        "updatedAt": now,
    }

    if existing:
        await collection.replace_one({"_id": book_id}, book_doc)
    else:
        await collection.insert_one(book_doc)

    try:
        processed = await book_service.process_book(book_id)
        if processed:
            await collection.update_one(
                {"_id": book_id},
                {
                    "$set": {
                        "title": item["title"],
                        "author": item["author"],
                        "catalogId": catalog_id,
                        "isCatalog": True,
                        "storageShared": True,
                    }
                },
            )
    except Exception as exc:
        logger.exception("Could not process catalog book %s: %s", catalog_id, exc)


async def ensure_catalog_books() -> None:
    """Create/update bundled catalog records during API startup.

    Missing local assets are non-fatal so a source checkout can still boot; a
    deployment that includes the bundled files will seed all three records.
    """

    db = get_database()
    repository = BookRepository(db)
    service = BookService(repository, storage_service)
    for item in CATALOG_BOOKS:
        try:
            await _seed_catalog_book(item, db.books, service)
        except Exception as exc:
            logger.exception("Could not seed catalog book %s: %s", item["catalogId"], exc)
