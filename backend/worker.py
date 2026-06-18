"""Background worker entrypoint. Consumes the import queue via RQ."""
from rq import Connection, Worker

from app.config import Config
from app.services.jobs import build_redis


def main() -> None:
    redis = build_redis()

    # Self-heal: re-enqueue any imports orphaned by a previous worker
    # restart/crash before we start consuming.
    try:
        from app.services.jobs import reclaim_orphaned_jobs

        reclaimed = reclaim_orphaned_jobs()
        if reclaimed:
            print(f"Reclaimed {reclaimed} orphaned import job(s)")
    except Exception as exc:  # noqa: BLE001 - never block startup on reclaim
        print(f"Orphaned-job reclaim failed: {exc!r}")

    with Connection(redis):
        worker = Worker([Config.IMPORT_QUEUE_NAME])
        worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
