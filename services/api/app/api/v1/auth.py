from datetime import datetime, timedelta, timezone
from typing import Any, Dict
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.auth.security import create_session_token, hash_password, hash_session_token, verify_password
from app.api.dependencies import get_current_auth, get_user_repository
from app.core.config import settings
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthCredentials, AuthResponse, MessageResponse, UserResponse


router = APIRouter(prefix="/auth", tags=["Authentication"])


def normalize_username(username: str) -> str:
    return username.strip().lower()


async def issue_session(user: Dict[str, Any], repository: UserRepository) -> AuthResponse:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.AUTH_SESSION_DAYS)
    access_token = create_session_token()
    await repository.create_session(
        hash_session_token(access_token),
        user["_id"],
        now,
        expires_at,
    )
    return AuthResponse(
        accessToken=access_token,
        expiresAt=expires_at,
        user=UserResponse.model_validate(user),
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    credentials: AuthCredentials,
    repository: UserRepository = Depends(get_user_repository),
):
    username = normalize_username(credentials.username)
    if await repository.get_by_username(username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already taken.",
        )

    now = datetime.now(timezone.utc)
    user = {
        "_id": str(uuid.uuid4()),
        "username": username,
        "passwordHash": hash_password(credentials.password.get_secret_value()),
        "createdAt": now,
        "updatedAt": now,
    }
    try:
        await repository.create_user(user)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already taken.",
        )
    await repository.claim_legacy_books_for_first_user(user["_id"])
    return await issue_session(user, repository)


@router.post("/login", response_model=AuthResponse)
async def login(
    credentials: AuthCredentials,
    repository: UserRepository = Depends(get_user_repository),
):
    username = normalize_username(credentials.username)
    user = await repository.get_by_username(username)
    if not user or not verify_password(
        credentials.password.get_secret_value(),
        user.get("passwordHash", ""),
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await issue_session(user, repository)


@router.get("/me", response_model=UserResponse)
async def me(current_auth: Dict[str, Any] = Depends(get_current_auth)):
    return current_auth["user"]


@router.post("/logout", response_model=MessageResponse)
async def logout(current_auth: Dict[str, Any] = Depends(get_current_auth)):
    await current_auth["repository"].delete_session(current_auth["tokenHash"])
    return MessageResponse(message="Signed out.")
