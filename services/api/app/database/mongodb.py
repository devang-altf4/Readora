from pymongo import AsyncMongoClient, IndexModel, ASCENDING, DESCENDING
from pymongo.asynchronous.database import AsyncDatabase
from app.core.config import settings
from app.core.logging import logger
from typing import Optional

class DatabaseManager:
    client: Optional[AsyncMongoClient] = None
    db: Optional[AsyncDatabase] = None

db_manager = DatabaseManager()

async def connect_to_mongo():
    logger.info(f"Connecting to MongoDB Atlas database: {settings.MONGODB_DATABASE}")
    db_manager.client = AsyncMongoClient(settings.MONGODB_URI)
    db_manager.db = db_manager.client[settings.MONGODB_DATABASE]
    
    # Ping server
    try:
        await db_manager.client.admin.command('ping')
        logger.info("Successfully connected and pinged MongoDB Atlas!")
    except Exception as e:
        logger.error(f"Failed to ping MongoDB Atlas: {e}")
        raise e

    # Create indexes
    await ensure_indexes()

async def close_mongo_connection():
    if db_manager.client:
        logger.info("Closing MongoDB Atlas connection...")
        await db_manager.client.close()
        logger.info("MongoDB connection closed.")

async def ensure_indexes():
    if db_manager.db is None:
        return

    books_collection = db_manager.db.books
    users_collection = db_manager.db.users
    sessions_collection = db_manager.db.auth_sessions

    indexes = [
        IndexModel(
            [("userId", ASCENDING), ("fileHash", ASCENDING)],
            unique=True,
            # Catalog records and legacy records deliberately have no owner.
            # Only enforce duplicate hashes within an actual signed-in user's
            # library; otherwise MongoDB treats absent userId values as null
            # and blocks separate shared catalog records.
            partialFilterExpression={"userId": {"$type": "string"}},
            name="idx_user_file_hash",
        ),
        IndexModel([("processingStatus", ASCENDING)], name="idx_processing_status"),
        IndexModel([("createdAt", DESCENDING)], name="idx_created_at"),
        IndexModel([("updatedAt", DESCENDING)], name="idx_updated_at"),
        IndexModel([("processingStatus", ASCENDING), ("updatedAt", DESCENDING)], name="idx_status_updated"),
        IndexModel(
            [("userId", ASCENDING), ("catalogId", ASCENDING)],
            unique=True,
            sparse=True,
            name="idx_user_catalog_unique",
        ),
    ]

    try:
        # Older versions enforced fileHash globally. Ownership makes the same
        # title valid for multiple accounts, so replace that index safely.
        try:
            await books_collection.drop_index("idx_file_hash")
        except Exception:
            pass
        current_indexes = await books_collection.index_information()
        current_user_hash_index = current_indexes.get("idx_user_file_hash")
        desired_filter = {"userId": {"$type": "string"}}
        if (
            current_user_hash_index
            and current_user_hash_index.get("partialFilterExpression") != desired_filter
        ):
            # Upgrade the earlier sparse compound index, which indexed
            # ownerless catalog rows as null.
            await books_collection.drop_index("idx_user_file_hash")
        await books_collection.create_indexes(indexes)
        await users_collection.create_index("username", unique=True, name="idx_username_unique")
        await sessions_collection.create_index(
            "expiresAt",
            expireAfterSeconds=0,
            name="idx_auth_session_expiry",
        )
        await sessions_collection.create_index("userId", name="idx_auth_session_user")
        logger.info("MongoDB indexes verified/created successfully.")
    except Exception as e:
        logger.warning(f"Note on MongoDB index creation: {e}")

def get_database() -> AsyncDatabase:
    if db_manager.db is None:
        raise RuntimeError("Database connection not initialized")
    return db_manager.db
