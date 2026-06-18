from app.services import crypto


def test_round_trip():
    token = crypto.encrypt("a-secret-token")
    assert token != b"a-secret-token"
    assert crypto.decrypt(token) == "a-secret-token"


def test_none_passthrough():
    assert crypto.encrypt(None) is None
    assert crypto.decrypt(None) is None
