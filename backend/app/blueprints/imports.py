import uuid

from flask import Blueprint, g, jsonify, request

from app.db import get_session
from app.errors import ApiError
from app.models import ImportJob, ImportJobItem
from app.services import google_oauth
from app.services.auth import require_auth
from app.services.jobs import enqueue_import

bp = Blueprint("imports", __name__)


@bp.post("/files/import")
@require_auth
def create_import():
    data = request.get_json(silent=True) or {}
    drive_file_ids = data.get("driveFileIds") or []
    on_conflict = data.get("onConflict", "overwrite")

    if not isinstance(drive_file_ids, list) or not drive_file_ids:
        raise ApiError("no_selection", "Select at least one Drive file to import.", 422)
    if on_conflict not in {"overwrite", "copy"}:
        raise ApiError("invalid_conflict", "onConflict must be 'overwrite' or 'copy'.", 422)
    if google_oauth.get_credentials(g.user_id) is None:
        raise ApiError("not_connected", "Connect Google Drive before importing.", 400)

    session = get_session()
    job = ImportJob(
        user_id=g.user_id,
        status="pending",
        total_count=len(drive_file_ids),
        on_conflict=on_conflict,
    )
    session.add(job)
    session.flush()
    for fid in drive_file_ids:
        session.add(ImportJobItem(job_id=job.id, source_file_id=str(fid), status="pending"))
    session.commit()

    enqueue_import(str(job.id))
    return (
        jsonify({"jobId": str(job.id), "status": "pending", "totalCount": job.total_count}),
        202,
    )


@bp.get("/imports/<job_id>")
@require_auth
def get_import(job_id):
    session = get_session()
    try:
        job = session.get(ImportJob, uuid.UUID(job_id))
    except (ValueError, TypeError):
        raise ApiError("not_found", "Import job not found.", 404)
    if job is None or job.user_id != g.user_id:
        raise ApiError("not_found", "Import job not found.", 404)
    return jsonify(job.to_public())
