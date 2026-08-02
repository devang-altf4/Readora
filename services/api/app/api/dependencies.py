from fastapi import Depends
from pymongo.asynchronous.database import AsyncDatabase
from app.database.mongodb import get_database
from app.repositories.book_repository import BookRepository
from app.storage.local_storage import storage_service
from app.services.book_service import BookService

def get_book_repository(db: AsyncDatabase = Depends(get_database)) -> BookRepository:
    return BookRepository(db)

def get_book_service(repo: BookRepository = Depends(get_book_repository)) -> BookService:
    return BookService(repo, storage_service)
