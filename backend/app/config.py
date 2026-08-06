from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    groq_api_key: str | None = None
    ollama_model: str = "llama3"
    local_rag_enabled: bool = True
    rag_embedding_backend: str = "sentence-transformers"
    rag_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    rag_store_dir: str = "app/resources/rag_store"
    rag_top_k: int = 5
    rag_chunk_size: int = 900
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: str = "*"
    debug: bool = False
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()