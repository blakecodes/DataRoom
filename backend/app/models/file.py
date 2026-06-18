import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base_mixin import created_at_col, updated_at_col, uuid_pk

# Map our stored mime/source to the frontend's FileKind union.
_KIND_BY_MIME = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-powerpoint": "pptx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "docx",
    "image/png": "png",
    "image/jpeg": "png",
    "image/gif": "png",
    "image/webp": "png",
    "application/zip": "zip",
}

# Types that are unsafe to render inline (download-only) per security doc.
_RISKY_MIME = {"text/html", "image/svg+xml", "application/zip", "application/x-zip-compressed"}


def _kind_for(mime: str | None) -> str:
    if not mime:
        return "generic"
    return _KIND_BY_MIME.get(mime, "generic")


def _human_size(num: int | None) -> str:
    if not num:
        return "0 B"
    units = ["B", "KB", "MB", "GB"]
    size = float(num)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} GB"


class File(Base):
    __tablename__ = "files"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folders.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)  # 'google_drive' | 'upload'
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    checksum: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="ready")

    # Drive provenance
    source_file_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_md5: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_modified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_owner: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_parent_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_web_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    export_mime: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime | None] = updated_at_col()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def kind(self) -> str:
        return _kind_for(self.mime_type)

    @property
    def previewable(self) -> bool:
        if self.mime_type in _RISKY_MIME:
            return False
        return self.kind != "zip"

    @property
    def ui_source(self) -> str:
        return "drive" if self.source == "google_drive" else "upload"

    def to_public(self) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "kind": self.kind,
            "typeLabel": (self.name.rsplit(".", 1)[-1].upper() if "." in self.name else "FILE"),
            "mimeType": self.mime_type,
            "sizeBytes": self.size_bytes,
            "sizeLabel": _human_size(self.size_bytes),
            "source": self.ui_source,
            "status": self.status,
            "folderId": str(self.folder_id) if self.folder_id else None,
            "dateAdded": self.created_at.strftime("%b %d, %Y") if self.created_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "description": self._description(),
            "previewable": self.previewable,
            "previewUri": f"/api/files/{self.id}/content",
            "sourceOwner": self.source_owner,
            "sourceModifiedAt": (
                self.source_modified_at.strftime("Modified %b %d")
                if self.source_modified_at
                else None
            ),
            "sourceWebLink": self.source_web_link,
        }

    def _description(self) -> str:
        labels = {
            "pdf": "PDF document",
            "xlsx": "Spreadsheet",
            "pptx": "Presentation",
            "docx": "Word document",
            "png": "Image",
            "zip": "Archive",
        }
        return labels.get(self.kind, "File")
