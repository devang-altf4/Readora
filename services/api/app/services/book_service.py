import hashlib
import asyncio
from typing import Dict, Any, Optional, List
from app.repositories.book_repository import BookRepository
from app.storage.base import AbstractStorageService
from app.processing.processing_pipeline import pipeline
from app.core.logging import logger
import uuid
from app.processing.book_formats import get_book_extension

class BookService:
    def __init__(self, repository: BookRepository, storage: AbstractStorageService):
        self.repo = repository
        self.storage = storage

    async def upload_book(self, original_filename: str, file_bytes: bytes, mime_type: str = "application/pdf") -> Dict[str, Any]:
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        
        # Check duplicate
        existing = await self.repo.get_book_by_hash(file_hash)
        if existing:
            logger.info(f"Duplicate upload detected for hash {file_hash}")
            return existing

        book_id = str(uuid.uuid4())
        extension = get_book_extension(original_filename)
        stored_filename = f"{book_id}{extension}"
        file_size = len(file_bytes)

        # Save file to storage
        original_key = await self.storage.save_original(book_id, file_bytes, extension=extension)

        # Create MongoDB document
        book_doc = {
            "_id": book_id,
            "schemaVersion": 1,
            "originalFilename": original_filename,
            "storedFilename": stored_filename,
            "title": original_filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title(),
            "author": None,
            "mimeType": mime_type,
            "fileSize": file_size,
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
                "coverKey": None,
                "processedJsonKey": None,
                "processedHtmlKey": None
            },
            "extraction": {
                "version": 1,
                "characterCount": 0,
                "wordCount": 0,
                "headingCount": 0,
                "imageCount": 0
            }
        }

        try:
            created_doc = await self.repo.create_book(book_doc)
            # Trigger background processing
            asyncio.create_task(self.process_book(book_id))
            return created_doc
        except Exception:
            # Compensation logic if MongoDB insert fails
            await self.storage.delete_file(original_key)
            raise

    async def process_book(self, book_id: str) -> Dict[str, Any]:
        book = await self.repo.get_book_by_id(book_id)
        if not book:
            raise ValueError(f"Book {book_id} not found")

        await self.repo.update_processing_state(book_id, "processing", "opening_file", progress=10)

        storage_info = book.get("storage", {})
        original_key = storage_info.get("originalFileKey") or storage_info.get("originalPdfKey")
        extension = get_book_extension(book.get("originalFilename", ""))
        try:
            if not original_key:
                raise FileNotFoundError("Original file storage key is missing.")
            file_bytes = await self.storage.get_file_bytes(original_key)
        except Exception:
            error_data = {"code": "FILE_NOT_FOUND", "message": "Original book file is missing from storage.", "stage": "opening_file"}
            return await self.repo.update_processing_state(book_id, "failed", "opening_file", progress=0, error=error_data)

        await self.repo.update_processing_state(book_id, "processing", "extracting_text", progress=40)

        # Run CPU-heavy parsing/unpacking in a threadpool.
        res = await asyncio.to_thread(
            pipeline.process_file,
            file_bytes,
            book_id,
            extension,
            book.get("originalFilename", ""),
        )

        if not res["success"]:
            return await self.repo.update_processing_state(book_id, "failed", res["error"]["stage"], progress=0, error=res["error"])

        await self.repo.update_processing_state(book_id, "processing", "saving_results", progress=80)

        # Save Cover
        cover_key = None
        if res.get("coverBytes"):
            cover_key = await self.storage.save_cover(book_id, res["coverBytes"])

        # Save JSON & HTML
        json_key = await self.storage.save_processed_json(book_id, res["jsonContent"])
        html_key = await self.storage.save_processed_html(book_id, res["htmlContent"])

        status = "ready"
        if res["documentType"] == "scanned_or_image_only":
            status = "ocr_required"

        updated_metadata = {
            "title": res["title"] or book["title"],
            "author": res["author"] or book.get("author"),
            "pageCount": res["pageCount"],
            "textPageCount": res["textPageCount"],
            "documentType": res["documentType"],
            "processingStatus": status,
            "processingStage": "complete",
            "processingProgress": 100,
            "storage": {
                "originalFileKey": original_key,
                "originalPdfKey": original_key if extension == ".pdf" else None,
                "coverKey": cover_key,
                "processedJsonKey": json_key,
                "processedHtmlKey": html_key
            },
            "extraction": res["stats"]
        }

        return await self.repo.update_metadata(book_id, updated_metadata)

    async def get_book(self, book_id: str) -> Optional[Dict[str, Any]]:
        return await self.repo.get_book_by_id(book_id)

    async def list_books(self, skip: int = 0, limit: int = 50) -> List[Dict[str, Any]]:
        return await self.repo.list_books(skip=skip, limit=limit)

    async def delete_book(self, book_id: str) -> bool:
        book = await self.repo.get_book_by_id(book_id)
        if not book:
            return False

        # Clean storage files
        storage_info = book.get("storage", {})
        for key_name, file_key in storage_info.items():
            if file_key:
                await self.storage.delete_file(file_key)

        return await self.repo.delete_book(book_id)
