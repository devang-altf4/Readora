import pytest_asyncio
from app.database.mongodb import connect_to_mongo, close_mongo_connection
from app.main import app
from httpx import AsyncClient, ASGITransport

@pytest_asyncio.fixture(autouse=True)
async def initialize_test_database():
    await connect_to_mongo()
    yield
    await close_mongo_connection()

@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
