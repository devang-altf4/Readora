from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pymongo.asynchronous.database import AsyncDatabase
from pymongo import DESCENDING, ASCENDING
import uuid

class BookRepository:
    def __init__(self, db: AsyncDatabase):
        self.collection = db.books

    async def create_book(self, book_data: Dict[str, Any]) -> Dict[str, Any]:
        if "_id" not in book_data:
            book_data["_id"] = str(uuid.uuid4())
        
        now = datetime.now(timezone.utc)
        book_data.setdefault("createdAt", now)
        book_data.setdefault("updatedAt", now)
        
        await self.collection.insert_one(book_data)
        return book_data

    async def get_book_by_id(self, book_id: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"_id": book_id})

    async def get_book_by_hash(self, file_hash: str) -> Optional[Dict[str, Any]]:
        if not file_hash:
            return None
        return await self.collection.find_one({"fileHash": file_hash})

    async def list_books(
        self,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
        sort_by: str = "updatedAt",
        sort_dir: int = -1
    ) -> List[Dict[str, Any]]:
        query = {}
        if status:
            query["processingStatus"] = status

        cursor = self.collection.find(query).sort(sort_by, sort_dir).skip(skip).limit(limit)
        return await cursor.to_list(length=limit)

    async def update_processing_state(
        self,
        book_id: str,
        status: str,
        stage: str,
        progress: int = 0,
        error: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        update_fields: Dict[str, Any] = {
            "processingStatus": status,
            "processingStage": stage,
            "processingProgress": progress,
            "updatedAt": now
        }
        if error is not None:
            update_fields["processingError"] = error

        return await self.collection.find_one_and_update(
            {"_id": book_id},
            {"$set": update_fields},
            return_document=True
        )

    async def update_metadata(self, book_id: str, metadata: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        metadata["updatedAt"] = datetime.now(timezone.utc)
        return await self.collection.find_one_and_update(
            {"_id": book_id},
            {"$set": metadata},
            return_document=True
        )

    async def delete_book(self, book_id: str) -> bool:
        result = await self.collection.delete_one({"_id": book_id})
        return result.deleted_count > 0
