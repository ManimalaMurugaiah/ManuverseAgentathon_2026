from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "Manuverse Agent Orchestrator API"
    api_v1_prefix: str = "/api/v1"

    secret_key: str = "replace-me"
    access_token_expire_minutes: int = 120
    max_failed_login_attempts: int = 5
    lockout_minutes: int = 15

    database_url: str
    redis_url: str = "redis://localhost:6379/0"

    ai_provider: str = "ollama"

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_api_key: str = ""
    openrouter_model: str = "meta-llama/llama-3.1-8b-instruct:free"


settings = Settings()
