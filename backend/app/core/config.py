from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Monq Procurement RAG API"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:3000"]
    openai_api_key: str = ""
    upload_dir: str = "./data/uploads"
    chroma_persist_dir: str = "./data/chroma"
    max_upload_bytes: int = 20 * 1024 * 1024


settings = Settings()
