from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    apify_token: str = ""
    espn_mcp_url: str = "https://mrbridge--espn-mcp-server.apify.actor/mcp"
    cursor_api_key: str = ""
    cursor_commentary_model: str = "composer-2.5"
    cursor_commentary_timeout_ms: int = 45_000
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    tts_voice: str = "alloy"
    poll_interval_seconds: int = 45
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "JBFqnCBsd6RMkjVDRZzb"
    elevenlabs_model: str = "eleven_flash_v2_5"


settings = Settings()
