"""App-level encryption for OAuth tokens at rest (Fernet / AES)."""
import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import Config


def _fernet() -> Fernet:
    key = Config.APP_ENCRYPTION_KEY
    if key:
        # Accept either a valid Fernet key or any passphrase (derive a key).
        try:
            return Fernet(key)
        except (ValueError, TypeError):
            derived = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
            return Fernet(derived)
    # Dev fallback: derive a stable key from the JWT secret. NOT for production.
    derived = base64.urlsafe_b64encode(hashlib.sha256(Config.JWT_SECRET.encode()).digest())
    return Fernet(derived)


def encrypt(plaintext: str | None) -> bytes | None:
    if plaintext is None:
        return None
    return _fernet().encrypt(plaintext.encode("utf-8"))


def decrypt(token: bytes | None) -> str | None:
    if token is None:
        return None
    return _fernet().decrypt(bytes(token)).decode("utf-8")
