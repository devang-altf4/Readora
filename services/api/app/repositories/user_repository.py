from datetime import datetime
from typing import Any, Dict, Optional

from pymongo.asynchronous.database import AsyncDatabase


class UserRepository:
    def __init__(self, db: AsyncDatabase):
        self.users = db.users
        self.sessions = db.auth_sessions
        self.books = db.books

    async def create_user(self, user: Dict[str, Any]) -> Dict[str, Any]:
        await self.users.insert_one(user)
        return user

    async def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        return await self.users.find_one({"username": username})

    async def get_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        return await self.users.find_one({"_id": user_id})

    async def create_session(
        self,
        token_hash: str,
        user_id: str,
        created_at: datetime,
        expires_at: datetime,
    ) -> None:
        await self.sessions.insert_one(
            {
                "_id": token_hash,
                "userId": user_id,
                "createdAt": created_at,
                "lastUsedAt": created_at,
                "expiresAt": expires_at,
            }
        )

    async def get_active_session(self, token_hash: str, now: datetime) -> Optional[Dict[str, Any]]:
        return await self.sessions.find_one(
            {"_id": token_hash, "expiresAt": {"$gt": now}}
        )

    async def touch_session(self, token_hash: str, now: datetime) -> None:
        await self.sessions.update_one(
            {"_id": token_hash},
            {"$set": {"lastUsedAt": now}},
        )

    async def delete_session(self, token_hash: str) -> None:
        await self.sessions.delete_one({"_id": token_hash})

    async def claim_legacy_books_for_first_user(self, user_id: str) -> None:
        # Books uploaded before auth have no owner. Claim them only during the
        # first account creation; later accounts must never see another user's data.
        if await self.users.count_documents({}) != 1:
            return
        await self.books.update_many(
            {
                "$and": [
                    {"$or": [{"userId": {"$exists": False}}, {"userId": None}]},
                    {"isCatalog": {"$ne": True}},
                ]
            },
            {"$set": {"userId": user_id}},
        )
