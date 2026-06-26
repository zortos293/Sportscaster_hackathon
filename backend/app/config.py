from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    apify_token: str = ""
    espn_mcp_url: str = "https://mrbridge--espn-mcp-server.apify.actor/mcp"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    tts_voice: str = "alloy"
    poll_interval_seconds: int = 45


settings = Settings()
