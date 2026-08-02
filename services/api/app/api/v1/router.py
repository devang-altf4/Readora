from fastapi import APIRouter
from app.api.v1 import auth, health, books, catalog

api_v1_router = APIRouter()
api_v1_router.include_router(health.router)
api_v1_router.include_router(auth.router)
api_v1_router.include_router(books.router)
api_v1_router.include_router(catalog.router)
