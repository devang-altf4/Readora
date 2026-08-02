from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.asynchronous.database import AsyncDatabase
from app.database.mongodb import get_database
from app.repositories.book_repository import BookRepository
from app.repositories.user_repository import UserRepository
from app.storage.local_storage import storage_service
from app.services.book_service import BookService
from app.auth.security import hash_session_token


bearer_scheme = HTTPBearer(auto_error=False)

def get_book_repository(db: AsyncDatabase = Depends(get_database)) -> BookRepository:
    return BookRepository(db)

def get_book_service(repo: BookRepository = Depends(get_book_repository)) -> BookService:
    return BookService(repo, storage_service)


def get_user_repository(db: AsyncDatabase = Depends(get_database)) -> UserRepository:
    return UserRepository(db)


async def get_current_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    repository: UserRepository = Depends(get_user_repository),
) -> Dict[str, Any]:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_hash = hash_session_token(credentials.credentials)
    now = datetime.now(timezone.utc)
    session = await repository.get_active_session(token_hash, now)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await repository.get_by_id(session["userId"])
    if not user:
        await repository.delete_session(token_hash)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    await repository.touch_session(token_hash, now)
    return {"user": user, "tokenHash": token_hash, "repository": repository}


async def get_current_user(
    current_auth: Dict[str, Any] = Depends(get_current_auth),
) -> Dict[str, Any]:
    return current_auth["user"]
