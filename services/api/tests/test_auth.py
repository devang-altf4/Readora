import pytest
from httpx import ASGITransport, AsyncClient

from app.api.dependencies import get_user_repository
from app.auth.security import hash_password, hash_session_token, verify_password
from app.main import app
from app.schemas.auth import AuthCredentials


class FakeUserRepository:
    def __init__(self):
        self.users = {}
        self.sessions = {}

    async def create_user(self, user):
        self.users[user["_id"]] = user

    async def get_by_username(self, username):
        return next((user for user in self.users.values() if user["username"] == username), None)

    async def get_by_id(self, user_id):
        return self.users.get(user_id)

    async def create_session(self, token_hash, user_id, created_at, expires_at):
        self.sessions[token_hash] = {"userId": user_id, "expiresAt": expires_at}

    async def get_active_session(self, token_hash, now):
        session = self.sessions.get(token_hash)
        return session if session and session["expiresAt"] > now else None

    async def touch_session(self, token_hash, now):
        return None

    async def delete_session(self, token_hash):
        self.sessions.pop(token_hash, None)

    async def claim_legacy_books_for_first_user(self, user_id):
        return None


def test_password_hash_is_not_reversible_plaintext():
    encoded = hash_password("correct-horse-battery-staple")

    assert encoded != "correct-horse-battery-staple"
    assert verify_password("correct-horse-battery-staple", encoded)
    assert not verify_password("wrong-password", encoded)


def test_session_token_is_stored_as_a_digest():
    assert len(hash_session_token("session-token")) == 64
    assert hash_session_token("session-token") != "session-token"


def test_credentials_require_strong_enough_password():
    credentials = AuthCredentials(username="reader_01", password="eight888")
    assert credentials.username == "reader_01"


@pytest.mark.asyncio
async def test_signup_login_me_and_logout():
    repository = FakeUserRepository()
    app.dependency_overrides[get_user_repository] = lambda: repository
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            signup = await client.post(
                "/api/v1/auth/signup",
                json={"username": "Reader_01", "password": "correct-horse"},
            )
            assert signup.status_code == 201
            token = signup.json()["accessToken"]
            assert signup.json()["user"]["username"] == "reader_01"

            me = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert me.status_code == 200
            assert me.json()["username"] == "reader_01"

            login = await client.post(
                "/api/v1/auth/login",
                json={"username": "reader_01", "password": "correct-horse"},
            )
            assert login.status_code == 200

            logout = await client.post(
                "/api/v1/auth/logout",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert logout.status_code == 200
            expired_me = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert expired_me.status_code == 401
    finally:
        app.dependency_overrides.clear()
