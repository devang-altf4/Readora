from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pymongo.asynchronous.database import AsyncDatabase
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

    async def get_book_by_id(self, book_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        query: Dict[str, Any] = {"_id": book_id}
        if user_id is not None:
            query["userId"] = user_id
        return await self.collection.find_one(query)

    async def get_book_for_user(self, book_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one(
            {
                "_id": book_id,
                "$or": [{"userId": user_id}, {"isCatalog": True}],
            }
        )

    async def get_catalog_book(self, catalog_id: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"catalogId": catalog_id, "isCatalog": True})

    async def list_catalog_books(self, limit: int = 50) -> List[Dict[str, Any]]:
        cursor = self.collection.find({"isCatalog": True}).sort("title", 1).limit(limit)
        return await cursor.to_list(length=limit)

    async def get_user_catalog_copy(self, user_id: str, catalog_id: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"userId": user_id, "catalogId": catalog_id})

    async def get_book_by_hash(self, file_hash: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not file_hash:
            return None
        query: Dict[str, Any] = {"fileHash": file_hash}
        if user_id is not None:
            query["userId"] = user_id
        return await self.collection.find_one(query)

    async def list_books(
        self,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
        sort_by: str = "updatedAt",
        sort_dir: int = -1,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query = {}
        if user_id is not None:
            query["userId"] = user_id
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

    async def delete_book(self, book_id: str, user_id: Optional[str] = None) -> bool:
        query: Dict[str, Any] = {"_id": book_id}
        if user_id is not None:
            query["userId"] = user_id
        result = await self.collection.delete_one(query)
        return result.deleted_count > 0
