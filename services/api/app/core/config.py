from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "Dindle API"
    APP_ENV: str = "development"
    API_V1_PREFIX: str = "/api/v1"

    MONGODB_URI: str
    MONGODB_DATABASE: str = "dindle"
    MONGODB_TEST_DATABASE: str = "dindle_test"

    STORAGE_BACKEND: str = "local"
    STORAGE_ROOT: str = "./storage"
    MAX_UPLOAD_SIZE_MB: int = 100

    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: str = "http://localhost:8081,http://127.0.0.1:8081,http://10.0.2.2:8081,*"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.CORS_ORIGINS:
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
