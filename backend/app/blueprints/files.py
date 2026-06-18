import hashlib
import uuid

from flask import Blueprint, Response, g, jsonify, redirect, request
from sqlalchemy import func

from app.config import Config
from app.db import get_session
from app.errors import ApiError
from app.models import File
from app.services.auth import require_auth
from app.services.storage import get_storage

bp = Blueprint("files", __name__)


def _get_owned_file(file_id: str) -> File:
    session = get_session()
    try:
        file = session.get(File, uuid.UUID(file_id))
    except (ValueError, TypeError):
        raise ApiError("not_found", "File not found.", 404)
    if file is None or file.user_id != g.user_id or file.deleted_at is not None:
        raise ApiError("not_found", "File not found.", 404)
    return file


DEFAULT_PAGE_SIZE = 12
MAX_PAGE_SIZE = 100


def _int_arg(name: str, default: int) -> int:
    try:
        return int(request.args.get(name, default))
    except (TypeError, ValueError):
        return default


@bp.get("/files")
@require_auth
def list_files():
    session = get_session()
    query = session.query(File).filter(
        File.user_id == g.user_id, File.deleted_at.is_(None)
    )
    folder_id = request.args.get("folderId")
    if folder_id:
        query = query.filter(File.folder_id == uuid.UUID(folder_id))
    search = (request.args.get("search") or "").strip()
    if search:
        query = query.filter(File.name.ilike(f"%{search}%"))

    page = max(1, _int_arg("page", 1))
    page_size = min(max(1, _int_arg("pageSize", DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE)

    total = query.count()
    total_size = (
        query.with_entities(func.coalesce(func.sum(File.size_bytes), 0)).scalar() or 0
    )
    total_pages = (total + page_size - 1) // page_size if total else 0

    files = (
        query.order_by(File.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return jsonify(
        {
            "files": [f.to_public() for f in files],
            "pagination": {
                "page": page,
                "pageSize": page_size,
                "total": total,
                "totalPages": total_pages,
            },
            "totalSizeBytes": int(total_size),
        }
    )


@bp.get("/files/<file_id>")
@require_auth
def get_file(file_id):
    return jsonify(_get_owned_file(file_id).to_public())


@bp.get("/files/<file_id>/content")
@require_auth
def get_file_content(file_id):
    file = _get_owned_file(file_id)
    storage = get_storage()
    # Large files: redirect to a short-lived SAS URL so the browser streams from Blob.
    if (file.size_bytes or 0) > Config.MAX_INLINE_UPLOAD_BYTES:
        return redirect(storage.download_sas_url(file.storage_key, file.mime_type))
    data = storage.download_bytes(file.storage_key)
    resp = Response(data, mimetype=file.mime_type or "application/octet-stream")
    disposition = "inline" if file.previewable else "attachment"
    resp.headers["Content-Disposition"] = f'{disposition}; filename="{file.name}"'
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp


@bp.post("/files")
@require_auth
def upload_file():
    if "file" not in request.files:
        raise ApiError("no_file", "No file part in the request.", 422)
    upload = request.files["file"]
    if not upload.filename:
        raise ApiError("no_file", "No file selected.", 422)

    content = upload.read()
    if len(content) > Config.MAX_INLINE_UPLOAD_BYTES:
        raise ApiError("too_large", "Use the SAS upload flow for large files.", 413)

    folder_id = request.form.get("folderId")
    session = get_session()
    file = File(
        user_id=g.user_id,
        folder_id=uuid.UUID(folder_id) if folder_id else None,
        name=upload.filename,
        mime_type=upload.mimetype,
        size_bytes=len(content),
        source="upload",
        checksum=hashlib.sha256(content).hexdigest(),
        status="ready",
        storage_key=f"{g.user_id}/{uuid.uuid4()}/{upload.filename}",
    )
    storage = get_storage()
    storage.ensure_container()
    storage.upload(file.storage_key, content, upload.mimetype)
    session.add(file)
    session.commit()
    return jsonify(file.to_public()), 201


@bp.post("/files/upload-url")
@require_auth
def create_upload_url():
    """Return a SAS URL for large direct-to-Blob uploads."""
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    if not name:
        raise ApiError("no_name", "File name is required.", 422)
    storage = get_storage()
    storage.ensure_container()
    storage_key = f"{g.user_id}/{uuid.uuid4()}/{name}"
    return jsonify({"uploadUrl": storage.upload_sas_url(storage_key), "storageKey": storage_key})


@bp.post("/files/complete-upload")
@require_auth
def complete_upload():
    """Register metadata after a large file was uploaded directly to Blob."""
    data = request.get_json(silent=True) or {}
    storage_key = data.get("storageKey")
    name = data.get("name")
    if not storage_key or not name:
        raise ApiError("invalid_request", "storageKey and name are required.", 422)

    session = get_session()
    file = File(
        user_id=g.user_id,
        folder_id=uuid.UUID(data["folderId"]) if data.get("folderId") else None,
        name=name,
        mime_type=data.get("mimeType"),
        size_bytes=data.get("sizeBytes"),
        source="upload",
        status="ready",
        storage_key=storage_key,
    )
    session.add(file)
    session.commit()
    return jsonify(file.to_public()), 201


@bp.delete("/files/<file_id>")
@require_auth
def delete_file(file_id):
    from datetime import datetime, timezone

    file = _get_owned_file(file_id)
    session = get_session()
    file.deleted_at = datetime.now(timezone.utc)
    session.commit()
    # Best-effort blob cleanup (soft delete keeps the row for audit).
    get_storage().delete(file.storage_key)
    return jsonify({"ok": True})
