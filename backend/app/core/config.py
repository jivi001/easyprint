from functools import lru_cache
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "PrintEasy"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Security & JWT
    SECRET_KEY: str = "printeasy-insecure-default-change-in-production-7f83a89e1b2c4d5e"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # Password Hashing
    ARGON2_TIME_COST: int = 3
    ARGON2_MEMORY_COST: int = 65536  # 64 MB in KiB
    ARGON2_PARALLELISM: int = 4

    # Database
    DATABASE_URL: str = "sqlite:///./storage/printeasy.db"

    # Storage & Upload Limits
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STORAGE_DIR: Path = BASE_DIR / "storage" / "private"
    MAX_FILE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    ALLOWED_MIME_TYPES: List[str] = ["application/pdf"]

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    return settings
