import pytest

@pytest.mark.asyncio
async def test_root(client):
    response = await client.get("/")
    assert response.status_code == 200
    assert "app" in response.json()

@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"]["connected"] is True
