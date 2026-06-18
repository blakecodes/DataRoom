import re

from flask import Blueprint, g, jsonify, make_response, request

from app.config import Config
from app.db import get_session
from app.errors import ApiError
from app.models import User
from app.services import google_oauth
from app.services.auth import (
    decode_token,
    hash_password,
    issue_access_token,
    issue_refresh_token,
    require_auth,
    verify_password,
)

bp = Blueprint("auth", __name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _set_refresh_cookie(resp, user_id: str):
    resp.set_cookie(
        Config.REFRESH_COOKIE_NAME,
        issue_refresh_token(user_id),
        max_age=Config.JWT_REFRESH_TTL_SECONDS,
        httponly=True,
        secure=Config.REFRESH_COOKIE_SECURE,
        samesite=Config.REFRESH_COOKIE_SAMESITE,
        path="/api/auth",
    )


def _auth_response(user: User, status: int = 200):
    resp = make_response(
        jsonify({"accessToken": issue_access_token(str(user.id)), "user": user.to_public()}),
        status,
    )
    _set_refresh_cookie(resp, str(user.id))
    return resp


def _drive_status(user_id) -> str:
    cred = google_oauth.get_credentials(user_id)
    return "connected" if cred is not None else "disconnected"


def _drive_account_email(user_id) -> str | None:
    cred = google_oauth.get_credentials(user_id)
    return cred.account_email if cred is not None else None


@bp.post("/auth/signup")
def signup():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    display_name = (data.get("displayName") or data.get("name") or "").strip() or None

    if not _EMAIL_RE.match(email):
        raise ApiError("invalid_email", "Enter a valid email address.", 422)
    if len(password) < 8:
        raise ApiError("weak_password", "Password must be at least 8 characters.", 422)

    session = get_session()
    if session.query(User).filter_by(email=email).one_or_none() is not None:
        raise ApiError("email_taken", "An account with that email already exists.", 409)

    user = User(email=email, password_hash=hash_password(password), display_name=display_name)
    session.add(user)
    session.commit()
    return _auth_response(user, status=201)


@bp.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    session = get_session()
    user = session.query(User).filter_by(email=email).one_or_none()
    if user is None or not user.password_hash or not verify_password(password, user.password_hash):
        raise ApiError("invalid_credentials", "Incorrect email or password.", 401)
    return _auth_response(user)


@bp.post("/auth/refresh")
def refresh():
    token = request.cookies.get(Config.REFRESH_COOKIE_NAME)
    if not token:
        raise ApiError("unauthorized", "No refresh token.", 401)
    payload = decode_token(token, "refresh")
    session = get_session()
    import uuid

    user = session.get(User, uuid.UUID(payload["sub"]))
    if user is None:
        raise ApiError("invalid_token", "User not found.", 401)
    resp = make_response(jsonify({"accessToken": issue_access_token(str(user.id))}))
    _set_refresh_cookie(resp, str(user.id))
    return resp


@bp.post("/auth/logout")
def logout():
    resp = make_response(jsonify({"ok": True}))
    resp.delete_cookie(Config.REFRESH_COOKIE_NAME, path="/api/auth")
    return resp


@bp.get("/auth/me")
@require_auth
def me():
    return jsonify(
        {
            "user": g.user.to_public(),
            "driveStatus": _drive_status(g.user_id),
            "driveAccountEmail": _drive_account_email(g.user_id),
        }
    )


@bp.patch("/auth/me")
@require_auth
def update_me():
    data = request.get_json(silent=True) or {}
    session = get_session()
    if "displayName" in data:
        name = (data.get("displayName") or "").strip()
        g.user.display_name = name or None
    session.commit()
    return jsonify(
        {
            "user": g.user.to_public(),
            "driveStatus": _drive_status(g.user_id),
            "driveAccountEmail": _drive_account_email(g.user_id),
        }
    )


@bp.post("/auth/change-password")
@require_auth
def change_password():
    data = request.get_json(silent=True) or {}
    current_password = data.get("currentPassword") or ""
    new_password = data.get("newPassword") or ""

    if not g.user.password_hash or not verify_password(current_password, g.user.password_hash):
        raise ApiError("invalid_credentials", "Current password is incorrect.", 401)
    if len(new_password) < 8:
        raise ApiError("weak_password", "Password must be at least 8 characters.", 422)

    session = get_session()
    g.user.password_hash = hash_password(new_password)
    session.commit()
    return jsonify({"ok": True})
