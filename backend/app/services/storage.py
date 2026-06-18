"""Azure Blob storage backend (works against Azurite locally and Azure in cloud)."""
import base64
import hashlib
from datetime import datetime, timedelta, timezone
from typing import BinaryIO, Iterable

from azure.storage.blob import (
    BlobBlock,
    BlobSasPermissions,
    BlobServiceClient,
    ContentSettings,
    generate_blob_sas,
)

from app.config import Config


class BlobStorage:
    def __init__(self):
        self._service = BlobServiceClient.from_connection_string(
            Config.AZURE_STORAGE_CONNECTION_STRING
        )
        self._container_name = Config.BLOB_CONTAINER

    def ensure_container(self) -> None:
        client = self._service.get_container_client(self._container_name)
        if not client.exists():
            client.create_container()

    def _blob(self, key: str):
        return self._service.get_blob_client(self._container_name, key)

    def upload(self, key: str, data: BinaryIO | bytes, content_type: str | None = None) -> None:
        settings = ContentSettings(content_type=content_type) if content_type else None
        self._blob(key).upload_blob(data, overwrite=True, content_settings=settings)

    def upload_stream(
        self, key: str, chunks: Iterable[bytes], content_type: str | None = None
    ) -> tuple[int, str]:
        """Stage a streamed upload as Blob blocks; return (size_bytes, sha256_hex).

        Memory stays O(chunk) regardless of file size, so large Drive imports
        can't OOM the worker. Returns the total size and content checksum.
        """
        blob = self._blob(key)
        block_ids: list[BlobBlock] = []
        hasher = hashlib.sha256()
        size = 0
        for index, chunk in enumerate(chunks):
            if not chunk:
                continue
            block_id = base64.b64encode(f"{index:010d}".encode()).decode()
            blob.stage_block(block_id, chunk)
            block_ids.append(BlobBlock(block_id=block_id))
            hasher.update(chunk)
            size += len(chunk)
        settings = ContentSettings(content_type=content_type) if content_type else None
        blob.commit_block_list(block_ids, content_settings=settings)
        return size, hasher.hexdigest()

    def download_bytes(self, key: str) -> bytes:
        return self._blob(key).download_blob().readall()

    def delete(self, key: str) -> None:
        try:
            self._blob(key).delete_blob()
        except Exception:  # noqa: BLE001 - best-effort cleanup
            pass

    def _public_url(self, key: str) -> str:
        if Config.BLOB_PUBLIC_ENDPOINT:
            return f"{Config.BLOB_PUBLIC_ENDPOINT.rstrip('/')}/{self._container_name}/{key}"
        return self._blob(key).url

    def download_sas_url(self, key: str, content_type: str | None = None) -> str:
        expiry = datetime.now(timezone.utc) + timedelta(seconds=Config.SAS_TTL_SECONDS)
        sas = generate_blob_sas(
            account_name=self._service.account_name,
            container_name=self._container_name,
            blob_name=key,
            account_key=self._service.credential.account_key,
            permission=BlobSasPermissions(read=True),
            expiry=expiry,
            content_type=content_type,
        )
        return f"{self._public_url(key)}?{sas}"

    def upload_sas_url(self, key: str) -> str:
        expiry = datetime.now(timezone.utc) + timedelta(seconds=Config.SAS_TTL_SECONDS)
        sas = generate_blob_sas(
            account_name=self._service.account_name,
            container_name=self._container_name,
            blob_name=key,
            account_key=self._service.credential.account_key,
            permission=BlobSasPermissions(create=True, write=True),
            expiry=expiry,
        )
        return f"{self._public_url(key)}?{sas}"


_storage: BlobStorage | None = None


def get_storage() -> BlobStorage:
    global _storage
    if _storage is None:
        _storage = BlobStorage()
    return _storage
