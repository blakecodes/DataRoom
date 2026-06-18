import os


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    """12-factor, env-driven config."""

    # Core
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
    ENV = os.environ.get("FLASK_ENV", "development")
    DEBUG = _bool(os.environ.get("FLASK_DEBUG"), ENV != "production")

    # Database
    DATABASE_URL = os.environ.get(
        "DATABASE_URL", "postgresql://dataroom:dataroom@db:5432/dataroom"
    )

    # Auth / JWT
    JWT_SECRET = os.environ.get("JWT_SECRET", "dev-jwt-secret")
    JWT_ALGORITHM = "HS256"
    JWT_ACCESS_TTL_SECONDS = int(os.environ.get("JWT_ACCESS_TTL_SECONDS", "900"))  # 15m
    JWT_REFRESH_TTL_SECONDS = int(
        os.environ.get("JWT_REFRESH_TTL_SECONDS", str(7 * 24 * 3600))  # 7d
    )
    REFRESH_COOKIE_NAME = os.environ.get("REFRESH_COOKIE_NAME", "dataroom_refresh")
    REFRESH_COOKIE_SECURE = _bool(os.environ.get("REFRESH_COOKIE_SECURE"), False)
    REFRESH_COOKIE_SAMESITE = os.environ.get("REFRESH_COOKIE_SAMESITE", "Lax")

    # App-level encryption for OAuth tokens at rest (Fernet key, base64 urlsafe 32b)
    APP_ENCRYPTION_KEY = os.environ.get("APP_ENCRYPTION_KEY", "")

    # CORS — the SPA origin (must be explicit because we send credentials/cookies)
    FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")

    # Azure Blob (Azurite locally)
    AZURE_STORAGE_CONNECTION_STRING = os.environ.get(
        "AZURE_STORAGE_CONNECTION_STRING", ""
    )
    BLOB_CONTAINER = os.environ.get("BLOB_CONTAINER", "dataroom-files")
    # Public-facing base for SAS URLs (browser must be able to reach Azurite).
    BLOB_PUBLIC_ENDPOINT = os.environ.get("BLOB_PUBLIC_ENDPOINT", "")

    # Redis / queue
    REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
    IMPORT_QUEUE_NAME = os.environ.get("IMPORT_QUEUE_NAME", "imports")

    # Google OAuth
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI = os.environ.get(
        "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback"
    )
    GOOGLE_SCOPES = os.environ.get(
        "GOOGLE_SCOPES",
        "openid email profile https://www.googleapis.com/auth/drive.readonly",
    ).split()

    # Uploads
    MAX_INLINE_UPLOAD_BYTES = int(
        os.environ.get("MAX_INLINE_UPLOAD_BYTES", str(25 * 1024 * 1024))  # 25 MB
    )
    SAS_TTL_SECONDS = int(os.environ.get("SAS_TTL_SECONDS", "900"))  # 15m
