from flask import Blueprint, jsonify
from sqlalchemy import text

from app.db import get_session

bp = Blueprint("health", __name__)


@bp.get("/healthz")
def healthz():
    db_ok = True
    try:
        get_session().execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        db_ok = False
    status = "ok" if db_ok else "degraded"
    return jsonify({"status": status, "db": db_ok}), (200 if db_ok else 503)
