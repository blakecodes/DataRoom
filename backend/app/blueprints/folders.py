import uuid
from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from app.db import get_session
from app.errors import ApiError
from app.models import Folder
from app.services.auth import require_auth

bp = Blueprint("folders", __name__)


def _get_owned_folder(folder_id: str) -> Folder:
    session = get_session()
    try:
        folder = session.get(Folder, uuid.UUID(folder_id))
    except (ValueError, TypeError):
        raise ApiError("not_found", "Folder not found.", 404)
    if folder is None or folder.user_id != g.user_id or folder.deleted_at is not None:
        raise ApiError("not_found", "Folder not found.", 404)
    return folder


@bp.get("/folders")
@require_auth
def list_folders():
    session = get_session()
    query = session.query(Folder).filter(
        Folder.user_id == g.user_id, Folder.deleted_at.is_(None)
    )
    parent_id = request.args.get("parentId")
    if parent_id:
        query = query.filter(Folder.parent_id == uuid.UUID(parent_id))
    folders = query.order_by(Folder.name.asc()).all()
    return jsonify({"folders": [f.to_public() for f in folders]})


@bp.post("/folders")
@require_auth
def create_folder():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        raise ApiError("no_name", "Folder name is required.", 422)
    parent_id = data.get("parentId")
    session = get_session()
    folder = Folder(
        user_id=g.user_id,
        name=name,
        parent_id=uuid.UUID(parent_id) if parent_id else None,
    )
    session.add(folder)
    session.commit()
    return jsonify(folder.to_public()), 201


@bp.patch("/folders/<folder_id>")
@require_auth
def update_folder(folder_id):
    folder = _get_owned_folder(folder_id)
    data = request.get_json(silent=True) or {}
    session = get_session()
    if "name" in data and data["name"]:
        folder.name = data["name"].strip()
    if "parentId" in data:
        folder.parent_id = uuid.UUID(data["parentId"]) if data["parentId"] else None
    session.commit()
    return jsonify(folder.to_public())


@bp.delete("/folders/<folder_id>")
@require_auth
def delete_folder(folder_id):
    folder = _get_owned_folder(folder_id)
    session = get_session()
    folder.deleted_at = datetime.now(timezone.utc)
    session.commit()
    return jsonify({"ok": True})
