"""Application configuration using Pydantic Settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment variable settings.
    
    Load settings from environment variables or .env file.
    """
    
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        case_sensitive=True,
    )
    
    # App
    APP_NAME: str = "Study English API"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/studyenglish"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # JWT
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # OAuth - Kakao
    KAKAO_CLIENT_ID: str = ""
    KAKAO_CLIENT_SECRET: str = ""
    
    # OAuth - Naver
    NAVER_CLIENT_ID: str = ""
    NAVER_CLIENT_SECRET: str = ""
    
    # OAuth - Google
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    
    # AI
    GOOGLE_AI_API_KEY: str = ""
    GOOGLE_CLOUD_STT_TTS_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Storage (GCS)
    GCS_BUCKET_NAME: str = ""  # 비어있으면 로컬 디스크 저장


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
