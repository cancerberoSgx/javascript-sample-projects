from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_ENV_FILE = BACKEND_DIR.parent / ".env"


class Settings(BaseSettings):
    """Read from environment variables, falling back to the repo-root .env file.
    In docker-compose the variables come from env_file, so the file path isn't used there."""

    model_config = SettingsConfigDict(env_file=ROOT_ENV_FILE, extra="ignore")

    database_url: str
    test_database_url: str | None = None  # used only by the test suite
    jwt_secret: str
    jwt_expire_minutes: int = 480
    impersonation_expire_minutes: int = 60  # tokens root users get when impersonating a member
    encryption_key: str  # Fernet key used for organization API keys

    # Bootstrap root user, created on startup when no root user exists
    root_email: str | None = None
    root_password: str | None = None
    root_name: str = "Root"
    root_organization: str = "Default"

    auto_migrate: bool = True  # apply pending migrations on startup
    run_seeds: bool = False  # also apply pending seeds on startup
    cors_origins: list[str] = []

    # Fail at startup, not on the first request that needs these
    @field_validator("encryption_key")
    @classmethod
    def _valid_fernet_key(cls, v: str) -> str:
        try:
            Fernet(v)
        except ValueError:
            raise ValueError(
                "ENCRYPTION_KEY must be a Fernet key. Run docker/init-env.sh, or generate one with: "
                'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
            )
        return v

    @field_validator("jwt_secret")
    @classmethod
    def _strong_jwt_secret(cls, v: str) -> str:
        if len(v) < 32 or v == "change-me":
            raise ValueError("JWT_SECRET must be a random string of at least 32 characters. Run docker/init-env.sh.")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
