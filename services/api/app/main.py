from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.database.mongodb import connect_to_mongo, close_mongo_connection
from app.api.v1.router import api_v1_router
from app.catalog import ensure_catalog_books

setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing FastAPI Lifespan...")
    await connect_to_mongo()
    await ensure_catalog_books()
    yield
    await close_mongo_connection()

app = FastAPI(
    title=settings.APP_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "docs": f"{settings.API_V1_PREFIX}/docs"
    }
