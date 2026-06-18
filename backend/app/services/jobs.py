"""Import queue: enqueue jobs (RQ/Redis) and the worker-side processor."""
import uuid
from datetime import datetime, timezone

from redis import Redis
from rq import Queue
from rq.registry import StartedJobRegistry

from app.config import Config
from app.db import get_session
from app.models import File, ImportJob, ImportJobItem
from app.services import google_oauth
from app.services.drive_client import get_metadata, open_download
from app.services.storage import get_storage

_redis: Redis | None = None
_queue: Queue | None = None

# Keep the long-lived broker connection resilient to proxy/idle resets
# (Container Apps' internal TCP ingress can close idle sockets). redis-py then
# health-checks and reconnects instead of wedging.
REDIS_KWARGS = {
    "socket_keepalive": True,
    "health_check_interval": 30,
    "retry_on_timeout": True,
}


def build_redis() -> Redis:
    return Redis.from_url(Config.REDIS_URL, **REDIS_KWARGS)


def get_queue() -> Queue:
    global _redis, _queue
    if _queue is None:
        _redis = build_redis()
        _queue = Queue(Config.IMPORT_QUEUE_NAME, connection=_redis)
    return _queue


def _rq_job_id(job_id: str) -> str:
    # Stable RQ job id keyed on the import job so duplicate enqueues collapse.
    return f"import:{job_id}"


def enqueue_import(job_id: str) -> None:
    get_queue().enqueue(
        process_import_job, job_id, job_timeout=1800, job_id=_rq_job_id(job_id)
    )


def reclaim_orphaned_jobs() -> int:
    """Re-enqueue jobs stuck in pending/running.

    A worker that is restarted (deploy, crash, scale-in) mid-import leaves the
    job in 'running' with items 'pending'/'running' and nothing in the queue to
    finish it. Called on worker startup so those jobs self-heal. Safe because
    process_import_job skips already-completed items. Dedupes on the stable RQ
    job id so a crash loop can't pile up duplicate work.
    """
    session = get_session()
    jobs = (
        session.query(ImportJob)
        .filter(ImportJob.status.in_(("pending", "running")))
        .all()
    )
    queue = get_queue()
    started = StartedJobRegistry(queue.name, connection=queue.connection)
    active = set(queue.job_ids) | set(started.get_job_ids())

    count = 0
    for job in jobs:
        rq_id = _rq_job_id(str(job.id))
        if rq_id in active:
            continue
        queue.enqueue(process_import_job, str(job.id), job_timeout=1800, job_id=rq_id)
        count += 1
    return count


def _parse_dt(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _existing_active_file(session, user_id, source_file_id: str) -> File | None:
    return (
        session.query(File)
        .filter(
            File.user_id == user_id,
            File.source == "google_drive",
            File.source_file_id == source_file_id,
            File.deleted_at.is_(None),
        )
        .one_or_none()
    )


def _is_unchanged(existing: File, meta: dict) -> bool:
    md5 = meta.get("md5Checksum")
    if md5 and existing.source_md5:
        return md5 == existing.source_md5
    version = meta.get("version")
    if version and existing.source_version:
        return str(version) == str(existing.source_version)
    return False


def _copy_name(name: str) -> str:
    if "." in name:
        stem, ext = name.rsplit(".", 1)
        return f"{stem} (copy).{ext}"
    return f"{name} (copy)"


def process_import_job(job_id: str) -> None:
    """Worker entrypoint. Downloads/exports each selected Drive file into Blob."""
    session = get_session()
    job = session.get(ImportJob, uuid.UUID(job_id))
    if job is None:
        return
    if job.status == "done":
        return  # already finished (e.g. duplicate reclaim) — nothing to do

    job.status = "running"
    # Baseline progress from items already finished, so resumes don't reset it.
    job.completed_count = sum(1 for i in job.items if i.status in ("done", "skipped"))
    session.commit()

    storage = get_storage()
    storage.ensure_container()

    for item in job.items:
        # Idempotent resume: never reprocess an item that already succeeded.
        if item.status in ("done", "skipped"):
            continue
        item.status = "running"
        item.error = None
        session.commit()
        try:
            access_token = google_oauth.get_valid_access_token(job.user_id)
            meta = get_metadata(access_token, item.source_file_id)
            item.name = meta.get("name")

            existing = _existing_active_file(session, job.user_id, item.source_file_id)
            if existing is not None and _is_unchanged(existing, meta):
                item.status = "skipped"
                item.action = "skipped_unchanged"
                item.file_id = existing.id
                job.completed_count += 1
                session.commit()
                continue

            chunks, name, mime_type, export_mime = open_download(access_token, meta)
            owner = (meta.get("owners") or [{}])[0]
            owner_label = owner.get("displayName") or owner.get("emailAddress")
            parents = meta.get("parents") or []

            overwrite = existing is not None and job.on_conflict == "overwrite"
            target = existing if overwrite else File(user_id=job.user_id, source="google_drive")
            if not overwrite and existing is not None:
                name = _copy_name(name)

            target.name = name
            target.mime_type = mime_type
            target.status = "ready"
            target.source_file_id = item.source_file_id
            target.source_md5 = meta.get("md5Checksum")
            target.source_version = str(meta.get("version")) if meta.get("version") else None
            target.source_modified_at = _parse_dt(meta.get("modifiedTime"))
            target.source_owner = owner_label
            target.source_parent_id = parents[0] if parents else None
            target.source_web_link = meta.get("webViewLink")
            target.export_mime = export_mime
            if not target.storage_key:
                target.storage_key = f"{job.user_id}/{uuid.uuid4()}/{name}"

            # Stream Drive -> Blob in blocks; memory stays flat for large files.
            size, checksum = storage.upload_stream(target.storage_key, chunks, mime_type)
            target.size_bytes = size
            target.checksum = checksum

            if existing is None or not overwrite:
                session.add(target)
            session.flush()

            item.file_id = target.id
            item.status = "done"
            item.action = "overwritten" if overwrite else ("copied" if existing else "created")
            job.completed_count += 1
            session.commit()
        except Exception as exc:  # noqa: BLE001 - record per-item failure, continue
            session.rollback()
            item = session.get(ImportJobItem, item.id)
            item.status = "failed"
            item.error = getattr(exc, "code", None) or "import_failed"
            job = session.get(ImportJob, uuid.UUID(job_id))
            job.failed_count += 1
            session.commit()

    job = session.get(ImportJob, uuid.UUID(job_id))
    # Recompute from item statuses so reclaimed/partial jobs report correctly.
    job.completed_count = sum(1 for i in job.items if i.status in ("done", "skipped"))
    job.failed_count = sum(1 for i in job.items if i.status == "failed")
    if job.failed_count == 0:
        job.status = "done"
    elif job.completed_count == 0:
        job.status = "failed"
    else:
        job.status = "partial"
    job.updated_at = datetime.now(timezone.utc)
    session.commit()
