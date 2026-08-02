from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, SecretStr


USERNAME_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.-]{2,31}$"


class AuthCredentials(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=USERNAME_PATTERN)
    password: SecretStr = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str = Field(alias="_id")
    username: str
    createdAt: datetime

    model_config = ConfigDict(populate_by_name=True)


class AuthResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    expiresAt: datetime
    user: UserResponse


class MessageResponse(BaseModel):
    message: str
