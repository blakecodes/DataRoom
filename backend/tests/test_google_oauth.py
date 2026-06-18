from urllib.parse import parse_qs, urlparse

from app.services import google_oauth


def test_build_consent_url_forces_account_selection():
    url = google_oauth.build_consent_url("state-token")
    params = parse_qs(urlparse(url).query)

    assert params["state"] == ["state-token"]
    assert params["prompt"] == ["consent select_account"]


class _FakeCred:
    def __init__(self):
        self.account_email = "old@example.com"
        self.access_token = b"old-access"
        self.refresh_token = b"old-refresh"
        self.token_type = "Bearer"
        self.scope = None
        self.expires_at = None


class _FakeQuery:
    def __init__(self, cred):
        self.cred = cred

    def filter_by(self, **kwargs):
        return self

    def one_or_none(self):
        return self.cred


class _FakeSession:
    def __init__(self, cred):
        self.cred = cred

    def query(self, model):
        return _FakeQuery(self.cred)

    def add(self, obj):
        self.cred = obj

    def commit(self):
        pass


def test_store_credentials_clears_old_refresh_token_on_account_switch(monkeypatch):
    cred = _FakeCred()
    session = _FakeSession(cred)

    monkeypatch.setattr(google_oauth, "get_session", lambda: session)
    monkeypatch.setattr(google_oauth, "fetch_userinfo", lambda token: {"email": "new@example.com"})
    monkeypatch.setattr(google_oauth.crypto, "encrypt", lambda value: value.encode())

    google_oauth.store_credentials(
        "user-1",
        {
            "access_token": "new-access",
            "token_type": "Bearer",
            "scope": "openid https://www.googleapis.com/auth/drive.readonly",
            "expires_in": 3600,
        },
    )

    assert cred.account_email == "new@example.com"
    assert cred.refresh_token is None
