"""Import queue: enqueue jobs (RQ/Redis) and the worker-side processor."""
import socket
import uuid
from datetime import datetime, timezone

from redis import Redis
from rq import Queue
from rq.exceptions import NoSuchJobError
from rq.job import Job
from rq.registry import StartedJobRegistry

from app.config import Config
from app.db import SessionLocal, engine, get_session
from app.models import File, ImportJob, ImportJobItem
from app.services import google_oauth
from app.services.drive_client import get_metadata, open_download
from app.services.storage import get_storage

_redis: Redis | None = None
_queue: Queue | None = None

# Keep the long-lived broker connection resilient to proxy/idle resets.
# Container Apps' internal ingress drops sockets that look idle, which it was
# doing between/within import jobs ("Connection closed by server"), wedging the
# worker. Aggressive TCP keepalive (probe after 20s idle, every 10s) keeps the
# socket demonstrably alive during long Drive->Blob transfers; health checks +
# retries let redis-py transparently reconnect instead of looping.
_KEEPALIVE_OPTS = {}
for _name, _val in (("TCP_KEEPIDLE", 20), ("TCP_KEEPINTVL", 10), ("TCP_KEEPCNT", 3)):
    _opt = getattr(socket, _name, None)
    if _opt is not None:
        _KEEPALIVE_OPTS[_opt] = _val

REDIS_KWARGS = {
    "socket_keepalive": True,
    "socket_keepalive_options": _KEEPALIVE_OPTS,
    "health_check_interval": 15,
    "retry_on_timeout": True,
    "socket_connect_timeout": 10,
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

    # Reclaim runs at worker startup, before we consume anything, so nothing is
    # genuinely executing right now. Any StartedJobRegistry entry is therefore a
    # stale leftover from a worker that died mid-job (the cause of "stuck
    # importing"); expire those so they don't block recovery. Dedupe only
    # against jobs still waiting in the live queue. process_import_job is
    # idempotent, so re-enqueuing is always safe.
    started = StartedJobRegistry(queue.name, connection=queue.connection)
    try:
        started.cleanup()
    except Exception:  # noqa: BLE001 - registry hygiene must never block reclaim
        pass

    count = 0
    for job in jobs:
        rq_id = _rq_job_id(str(job.id))
        # The stable RQ id is reused across reclaims, but RQ retains the job hash
        # (and failed/finished registry entries) from earlier attempts. Re-enqueuing
        # the same id over a retained terminal job is silently dropped — leaving the
        # import wedged in 'pending'. Purge any leftover RQ job first so this is a
        # clean enqueue every time. Safe because process_import_job is idempotent.
        try:
            Job.fetch(rq_id, connection=queue.connection).delete()
        except NoSuchJobError:
            pass
        except Exception:  # noqa: BLE001 - best-effort cleanup, never block reclaim
            pass
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


def _active_files_for_source(session, user_id, source_file_id: str):
    return session.query(File).filter(
        File.user_id == user_id,
        File.source == "google_drive",
        File.source_file_id == source_file_id,
        File.deleted_at.is_(None),
    )


def _existing_active_file(session, user_id, source_file_id: str) -> File | None:
    # "Save a copy" intentionally creates multiple active files sharing the same
    # source_file_id, so this can match more than one row. Return the most recent
    # (one_or_none() would raise MultipleResultsFound). Overwrite then replaces
    # the latest copy, and the unchanged-check compares against it.
    return (
        _active_files_for_source(session, user_id, source_file_id)
        .order_by(File.created_at.desc())
        .first()
    )


def _is_unchanged(existing: File, meta: dict) -> bool:
    md5 = meta.get("md5Checksum")
    if md5 and existing.source_md5:
        return md5 == existing.source_md5
    version = meta.get("version")
    if version and existing.source_version:
        return str(version) == str(existing.source_version)
    return False


def _copy_name(name: str, index: int = 1) -> str:
    # index is the copy number: 1 -> "(copy)", 2 -> "(copy 2)", ... so repeated
    # "save a copy" imports version cleanly instead of stacking "(copy) (copy)".
    suffix = "(copy)" if index <= 1 else f"(copy {index})"
    if "." in name:
        stem, ext = name.rsplit(".", 1)
        return f"{stem} {suffix}.{ext}"
    return f"{name} {suffix}"


def _unique_copy_name(session, user_id, base_name: str) -> str:
    """Pick the next free "(copy)" / "(copy N)" name among the user's files."""
    index = 1
    while True:
        candidate = _copy_name(base_name, index)
        exists = (
            session.query(File.id)
            .filter(
                File.user_id == user_id,
                File.name == candidate,
                File.deleted_at.is_(None),
            )
            .first()
        )
        if exists is None:
            return candidate
        index += 1


def process_import_job(job_id: str) -> None:
    """Worker entrypoint. Downloads/exports each selected Drive file into Blob."""
    # RQ runs each job in a forked work-horse process. That child inherits the
    # parent's pooled Postgres connections (open SSL sockets opened during
    # startup reclaim). Sharing an SSL socket across a fork desyncs the TLS
    # session and the next query dies with "SSL SYSCALL error: EOF detected",
    # leaving the job wedged in 'pending' forever. Reset the scoped session and
    # discard the inherited pool so this child opens its own fresh connections.
    # close=False leaves the inherited file descriptors untouched so we don't
    # disturb the connections the parent still owns.
    SessionLocal.remove()
    engine.dispose(close=False)

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
            # The conflict dialog forces an explicit choice (overwrite | copy), so
            # we always honor it for files already imported. We never silently skip
            # unchanged files: "overwrite" replaces the existing copy in place, and
            # "copy" saves a new, versioned copy. (There's no "skip" option in the
            # UI, and silently skipping confused users who picked an explicit action.)
            chunks, name, mime_type, export_mime = open_download(access_token, meta)
            owner = (meta.get("owners") or [{}])[0]
            owner_label = owner.get("displayName") or owner.get("emailAddress")
            parents = meta.get("parents") or []

            overwrite = existing is not None and job.on_conflict == "overwrite"
            is_copy = existing is not None and not overwrite
            target = existing if overwrite else File(user_id=job.user_id, source="google_drive")
            if is_copy:
                name = _unique_copy_name(session, job.user_id, name)

            target.name = name
            target.mime_type = mime_type
            target.status = "ready"
            # A copy is a standalone snapshot, so clear the Drive id: the
            # (user, source, source_file_id) partial unique index enforces one
            # canonical import per Drive file, and copies must not collide with it.
            target.source_file_id = None if is_copy else item.source_file_id
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
