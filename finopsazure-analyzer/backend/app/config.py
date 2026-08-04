"""Application configuration loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "local"
    app_version: str = "1.0.0"

    # Database — SQLite by default, PostgreSQL-ready via DATABASE_URL.
    database_url: str = "sqlite:///./data/finopsazure.db"

    # Fernet key used to encrypt connection secrets at rest.
    finops_config_encryption_key: str = ""

    # Azure OpenAI / Foundry (optional — app degrades to rule-based summary).
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = ""
    azure_openai_api_version: str = "2024-10-21"
    azure_openai_api_key: str = ""  # optional; MI/RBAC preferred in Azure

    # Key Vault (Azure). When set, backend can resolve secret refs.
    key_vault_uri: str = ""

    # CORS
    cors_allowed_origins: str = "http://localhost:3000"

    # Azure Management endpoints (public cloud defaults).
    arm_endpoint: str = "https://management.azure.com"
    arm_scope: str = "https://management.azure.com/.default"
    authority_host: str = "https://login.microsoftonline.com"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
