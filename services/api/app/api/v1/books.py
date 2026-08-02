from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Response, BackgroundTasks
from fastapi.responses import HTMLResponse, Response
from typing import List, Optional
from app.services.book_service import BookService
from app.api.dependencies import get_book_service
from app.schemas.book import BookResponse
from app.schemas.common import ResponseModel
from app.storage.local_storage import storage_service

router = APIRouter(prefix="/books", tags=["Books"])

@router.post("/upload", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def upload_book(
    file: UploadFile = File(...),
    book_service: BookService = Depends(get_book_service)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported."
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    book_doc = await book_service.upload_book(
        original_filename=file.filename,
        file_bytes=content,
        mime_type=file.content_type or "application/pdf"
    )
    return book_doc

@router.get("", response_model=List[BookResponse])
async def list_books(
    skip: int = 0,
    limit: int = 50,
    book_service: BookService = Depends(get_book_service)
):
    return await book_service.list_books(skip=skip, limit=limit)

@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: str,
    book_service: BookService = Depends(get_book_service)
):
    book = await book_service.get_book(book_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book {book_id} not found."
        )
    return book

@router.post("/{book_id}/process", response_model=BookResponse)
async def trigger_processing(
    book_id: str,
    background_tasks: BackgroundTasks,
    book_service: BookService = Depends(get_book_service)
):
    book = await book_service.get_book(book_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book {book_id} not found."
        )

    background_tasks.add_task(book_service.process_book, book_id)
    return book

@router.get("/{book_id}/content")
async def get_book_content(
    book_id: str,
    format: str = "html",
    book_service: BookService = Depends(get_book_service)
):
    book = await book_service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")

    if book.get("processingStatus") not in ["ready", "ocr_required"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Book content is not ready. Current status: {book.get('processingStatus')}"
        )

    storage_info = book.get("storage", {})
    if format == "json":
        json_key = storage_info.get("processedJsonKey")
        if not json_key or not await storage_service.file_exists(json_key):
            raise HTTPException(status_code=status.HTTP_444, detail="JSON content file missing.")
        json_bytes = await storage_service.get_file_bytes(json_key)
        return Response(content=json_bytes, media_type="application/json")
    else:
        html_key = storage_info.get("processedHtmlKey")
        if not html_key or not await storage_service.file_exists(html_key):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HTML content file missing.")
        html_bytes = await storage_service.get_file_bytes(html_key)
        return HTMLResponse(content=html_bytes.decode("utf-8"))

@router.get("/{book_id}/cover")
async def get_book_cover(
    book_id: str,
    book_service: BookService = Depends(get_book_service)
):
    book = await book_service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")

    cover_key = book.get("storage", {}).get("coverKey")
    if not cover_key or not await storage_service.file_exists(cover_key):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cover image not available.")

    cover_bytes = await storage_service.get_file_bytes(cover_key)
    return Response(content=cover_bytes, media_type="image/jpeg")

@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: str,
    book_service: BookService = Depends(get_book_service)
):
    success = await book_service.delete_book(book_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
