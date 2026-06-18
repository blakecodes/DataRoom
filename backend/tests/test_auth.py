import pytest

from app.errors import ApiError
from app.services import auth


def test_access_token_round_trip():
    token = auth.issue_access_token("user-123")
    payload = auth.decode_token(token, "access")
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"


def test_refresh_token_type_enforced():
    token = auth.issue_access_token("user-123")
    with pytest.raises(ApiError):
        auth.decode_token(token, "refresh")


def test_invalid_token_rejected():
    with pytest.raises(ApiError):
        auth.decode_token("not-a-jwt", "access")


def test_password_hash_and_verify():
    hashed = auth.hash_password("supersecret")
    assert hashed != "supersecret"
    assert auth.verify_password("supersecret", hashed) is True
    assert auth.verify_password("wrong", hashed) is False
