import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base_mixin import created_at_col, updated_at_col, uuid_pk


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    on_conflict: Mapped[str] = mapped_column(Text, nullable=False, default="overwrite")
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime | None] = updated_at_col()

    items = relationship(
        "ImportJobItem", back_populates="job", cascade="all, delete-orphan"
    )

    def to_public(self) -> dict:
        return {
            "jobId": str(self.id),
            "status": self.status,
            "totalCount": self.total_count,
            "completedCount": self.completed_count,
            "failedCount": self.failed_count,
            "items": [item.to_public() for item in self.items],
        }


class ImportJobItem(Base):
    __tablename__ = "import_job_items"

    id: Mapped[uuid.UUID] = uuid_pk()
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("import_jobs.id", ondelete="CASCADE"), nullable=False
    )
    source_file_id: Mapped[str] = mapped_column(Text, nullable=False)
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("files.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    action: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    job = relationship("ImportJob", back_populates="items")
    file = relationship("File")

    def to_public(self) -> dict:
        result = {
            "sourceFileId": self.source_file_id,
            "status": self.status,
            "action": self.action,
            "name": self.name,
            "error": self.error,
        }
        if self.file is not None and self.file.deleted_at is None:
            result["file"] = {"id": str(self.file.id), "name": self.file.name}
        return result
