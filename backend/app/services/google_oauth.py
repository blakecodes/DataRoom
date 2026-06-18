"""Google OAuth: consent URL, code exchange, token refresh, encrypted storage."""
from datetime import datetime, timedelta, timezone

import requests

from app.config import Config
from app.db import get_session
from app.errors import ApiError
from app.models import OAuthCredential
from app.services import crypto

AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URI = "https://oauth2.googleapis.com/token"
USERINFO_URI = "https://www.googleapis.com/oauth2/v3/userinfo"
REVOKE_URI = "https://oauth2.googleapis.com/revoke"
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
_REFRESH_SKEW = 60  # seconds


def scope_has_drive(scope: str | None) -> bool:
    """True if the granted scope string includes Drive read access."""
    return bool(scope) and DRIVE_SCOPE in scope.split()


def has_drive_access(user_id) -> bool:
    cred = get_credentials(user_id)
    return cred is not None and scope_has_drive(cred.scope)


def build_consent_url(state: str) -> str:
    from urllib.parse import urlencode

    params = {
        "client_id": Config.GOOGLE_CLIENT_ID,
        "redirect_uri": Config.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(Config.GOOGLE_SCOPES),
        "access_type": "offline",
        # Always force the Google account chooser on connect/reconnect so
        # switching from one Google account to another is explicit.
        "prompt": "consent select_account",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{AUTH_URI}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    resp = requests.post(
        TOKEN_URI,
        data={
            "code": code,
            "client_id": Config.GOOGLE_CLIENT_ID,
            "client_secret": Config.GOOGLE_CLIENT_SECRET,
            "redirect_uri": Config.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    if not resp.ok:
        raise ApiError("oauth_exchange_failed", "Could not exchange code with Google.", 400)
    return resp.json()


def fetch_userinfo(access_token: str) -> dict:
    resp = requests.get(
        USERINFO_URI, headers={"Authorization": f"Bearer {access_token}"}, timeout=15
    )
    return resp.json() if resp.ok else {}


def store_credentials(user_id, token_response: dict) -> OAuthCredential:
    session = get_session()
    cred = (
        session.query(OAuthCredential)
        .filter_by(user_id=user_id, provider="google")
        .one_or_none()
    )
    prior_account_email = cred.account_email if cred is not None else None
    access_token = token_response["access_token"]
    refresh_token = token_response.get("refresh_token")
    expires_in = token_response.get("expires_in", 3600)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    account_email = fetch_userinfo(access_token).get("email")

    if cred is None:
        cred = OAuthCredential(user_id=user_id, provider="google")
        session.add(cred)

    cred.access_token = crypto.encrypt(access_token)
    # Google only returns a refresh_token on some consent flows. Keep the old
    # one only when this is clearly the same connected Google account; if the
    # user switched accounts, never let the previous account's refresh token
    # carry forward.
    if refresh_token:
        cred.refresh_token = crypto.encrypt(refresh_token)
    elif prior_account_email and account_email and prior_account_email != account_email:
        cred.refresh_token = None
    cred.token_type = token_response.get("token_type", "Bearer")
    cred.scope = token_response.get("scope")
    cred.expires_at = expires_at
    if account_email:
        cred.account_email = account_email
    session.commit()
    return cred


def get_credentials(user_id) -> OAuthCredential | None:
    session = get_session()
    return (
        session.query(OAuthCredential)
        .filter_by(user_id=user_id, provider="google")
        .one_or_none()
    )


def _refresh(cred: OAuthCredential) -> str:
    refresh_token = crypto.decrypt(cred.refresh_token)
    if not refresh_token:
        raise ApiError("token_expired", "Google connection expired. Reconnect required.", 401)
    resp = requests.post(
        TOKEN_URI,
        data={
            "refresh_token": refresh_token,
            "client_id": Config.GOOGLE_CLIENT_ID,
            "client_secret": Config.GOOGLE_CLIENT_SECRET,
            "grant_type": "refresh_token",
        },
        timeout=15,
    )
    if not resp.ok:
        raise ApiError("token_expired", "Google connection expired. Reconnect required.", 401)
    data = resp.json()
    session = get_session()
    cred.access_token = crypto.encrypt(data["access_token"])
    cred.expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=data.get("expires_in", 3600)
    )
    session.commit()
    return data["access_token"]


def get_valid_access_token(user_id) -> str:
    """Return a fresh access token, refreshing proactively if near expiry."""
    cred = get_credentials(user_id)
    if cred is None:
        raise ApiError("not_connected", "Google Drive is not connected.", 400)
    now = datetime.now(timezone.utc)
    expires_at = cred.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at is None or expires_at <= now + timedelta(seconds=_REFRESH_SKEW):
        return _refresh(cred)
    return crypto.decrypt(cred.access_token)


def disconnect(user_id) -> None:
    session = get_session()
    cred = get_credentials(user_id)
    if cred is None:
        return
    token = crypto.decrypt(cred.access_token)
    refresh_token = crypto.decrypt(cred.refresh_token) if cred.refresh_token else None
    try:
        requests.post(REVOKE_URI, params={"token": token}, timeout=10)
        if refresh_token:
            requests.post(REVOKE_URI, params={"token": refresh_token}, timeout=10)
    except requests.RequestException:
        pass
    session.delete(cred)
    session.commit()
