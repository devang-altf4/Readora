from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_book_service, get_current_user
from app.catalog import ensure_catalog_books
from app.schemas.book import BookResponse
from app.services.book_service import BookService
from app.storage.local_storage import storage_service
from fastapi.responses import Response


router = APIRouter(prefix="/catalog", tags=["Catalog"])


@router.get("", response_model=List[BookResponse])
async def list_catalog(
    limit: int = 50,
    book_service: BookService = Depends(get_book_service),
    current_user: dict = Depends(get_current_user),
):
    del current_user
    # This is idempotent and also repairs a catalog that was created before a
    # deploy included all bundled assets.
    await ensure_catalog_books()
    return await book_service.list_catalog(limit=min(max(limit, 1), 100))


@router.post("/{catalog_id}/add", response_model=BookResponse)
async def add_catalog_book(
    catalog_id: str,
    book_service: BookService = Depends(get_book_service),
    current_user: dict = Depends(get_current_user),
):
    # Seed lazily as well as at startup. This repairs a partially seeded
    # database without requiring a manual migration or data cleanup.
    await ensure_catalog_books()
    book = await book_service.add_catalog_book(current_user["_id"], catalog_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catalog book not found.",
        )
    return book


@router.api_route("/{catalog_id}/cover", methods=["GET", "HEAD"])
async def get_catalog_cover(
    catalog_id: str,
    book_service: BookService = Depends(get_book_service),
):
    """Serve shared starter-book artwork without exposing private user covers."""
    book = await book_service.get_catalog_book(catalog_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog book not found.")

    cover_key = book.get("storage", {}).get("coverKey")
    if not cover_key or not await storage_service.file_exists(cover_key):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cover image not available.")

    cover_bytes = await storage_service.get_file_bytes(cover_key)
    return Response(content=cover_bytes, media_type="image/jpeg")
