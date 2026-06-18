import secrets

import jwt
from flask import Blueprint, g, jsonify, redirect, request

from app.config import Config
from app.errors import ApiError
from app.services import google_oauth
from app.services.auth import require_auth

bp = Blueprint("google_oauth", __name__)


def _sign_state(user_id: str) -> str:
    return jwt.encode(
        {"sub": str(user_id), "nonce": secrets.token_urlsafe(8), "type": "oauth_state"},
        Config.JWT_SECRET,
        algorithm=Config.JWT_ALGORITHM,
    )


def _verify_state(state: str) -> str:
    try:
        payload = jwt.decode(state, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
    except jwt.InvalidTokenError as exc:
        raise ApiError("invalid_state", "OAuth state mismatch.", 400) from exc
    if payload.get("type") != "oauth_state":
        raise ApiError("invalid_state", "OAuth state mismatch.", 400)
    return payload["sub"]


@bp.get("/auth/google/login")
@require_auth
def google_login():
    state = _sign_state(str(g.user_id))
    return jsonify({"consentUrl": google_oauth.build_consent_url(state)})


@bp.get("/auth/google/callback")
def google_callback():
    error = request.args.get("error")
    if error:
        return redirect(f"{Config.FRONTEND_ORIGIN}/settings?drive=error&reason={error}")

    code = request.args.get("code")
    state = request.args.get("state")
    if not code or not state:
        raise ApiError("invalid_callback", "Missing code or state.", 400)

    user_id = _verify_state(state)
    token_response = google_oauth.exchange_code(code)
    google_oauth.store_credentials(user_id, token_response)
    # Drive access is a per-scope checkbox the user can decline. If they did,
    # the Picker would 403 later — surface it now instead.
    if not google_oauth.scope_has_drive(token_response.get("scope")):
        return redirect(f"{Config.FRONTEND_ORIGIN}/settings?drive=error&reason=drive_permission_required")
    return redirect(f"{Config.FRONTEND_ORIGIN}/settings?drive=connected")


@bp.post("/auth/google/disconnect")
@require_auth
def google_disconnect():
    google_oauth.disconnect(g.user_id)
    return jsonify({"ok": True})


@bp.post("/auth/google/picker-token")
@require_auth
def picker_token():
    """Mint a short-lived Drive access token for the in-browser Google Picker."""
    if not google_oauth.has_drive_access(g.user_id):
        raise ApiError(
            "drive_permission_required",
            "Google Drive access wasn't granted. Reconnect Google and allow access to your Drive files.",
            403,
        )
    access_token = google_oauth.get_valid_access_token(g.user_id)
    return jsonify(
        {
            "accessToken": access_token,
            "apiKey": None,  # set client-side via VITE_GOOGLE_API_KEY
            "clientId": Config.GOOGLE_CLIENT_ID,
        }
    )
