from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    REDIS_URL: str = "redis://localhost:6379"
    SIMC_PATH: str = "/usr/local/bin/simc"
    SIMC_THREADS: int = 4
    SIMC_TIMEOUT: int = 300
    DATABASE_URL: str = "sqlite+aiosqlite:///./simhammer.db"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    MAX_ITERATIONS: int = 10000
    DEFAULT_ITERATIONS: int = 1000
    DROP_DB_ON_STARTUP: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
