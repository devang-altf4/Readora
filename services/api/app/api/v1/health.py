from fastapi import APIRouter, Depends
from pymongo.asynchronous.database import AsyncDatabase
from app.database.mongodb import get_database
from app.storage.local_storage import storage_service

router = APIRouter(tags=["Health"])

@router.get("/health")
async def health_check(db: AsyncDatabase = Depends(get_database)):
    mongo_ok = False
    try:
        ping_res = await db.client.admin.command('ping')
        mongo_ok = ping_res.get('ok') == 1
    except Exception:
        mongo_ok = False

    storage_ok = storage_service.root_dir.exists()

    return {
        "status": "ok" if (mongo_ok and storage_ok) else "degraded",
        "service": "dindle-api",
        "database": {
            "provider": "mongodb_atlas",
            "connected": mongo_ok
        },
        "storage": {
            "provider": "local",
            "available": storage_ok
        }
    }
