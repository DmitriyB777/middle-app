"""Application configuration loaded from environment variables."""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _database_uri() -> str | None:
    if url := os.getenv("DATABASE_URL"):
        return url

    password = os.getenv("DB_PASSWORD")
    if not password:
        return None

    user = os.getenv("DB_USER", "postgres")
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "flask-backend-middle-db")
    return f"postgresql://{user}:{password}@{host}:{port}/{name}"


class Config:
    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
