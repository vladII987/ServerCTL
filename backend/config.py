import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    BACKEND_PORT:    int  = 9090
    DASHBOARD_TOKEN: str  = "change-me-dashboard-token"
    AGENT_TOKEN:     str  = "change-me-agent-token"
    PROMETHEUS_URL:  str  = "http://localhost:9090"
    CORS_ORIGINS:    str  = "http://localhost,http://localhost:80"
    SECRET_KEY:      str  = "change-me-secret-key-32chars"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"

settings = Settings()
