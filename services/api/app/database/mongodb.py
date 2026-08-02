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

    indexes = [
        IndexModel([("fileHash", ASCENDING)], unique=True, sparse=True, name="idx_file_hash"),
        IndexModel([("processingStatus", ASCENDING)], name="idx_processing_status"),
        IndexModel([("createdAt", DESCENDING)], name="idx_created_at"),
        IndexModel([("updatedAt", DESCENDING)], name="idx_updated_at"),
        IndexModel([("processingStatus", ASCENDING), ("updatedAt", DESCENDING)], name="idx_status_updated"),
    ]

    try:
        await books_collection.create_indexes(indexes)
        logger.info("MongoDB indexes verified/created successfully.")
    except Exception as e:
        logger.warning(f"Note on MongoDB index creation: {e}")

def get_database() -> AsyncDatabase:
    if db_manager.db is None:
        raise RuntimeError("Database connection not initialized")
    return db_manager.db
