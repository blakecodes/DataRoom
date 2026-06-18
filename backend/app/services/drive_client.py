"""Thin Google Drive API wrapper: metadata, binary download, native export."""
import requests

from app.errors import ApiError

DRIVE_FILES = "https://www.googleapis.com/drive/v3/files"

# Google-native export mapping (decided in 04-google-drive-integration.md).
EXPORT_MAP = {
    "application/vnd.google-apps.document": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx",
    ),
    "application/vnd.google-apps.spreadsheet": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
    ),
    "application/vnd.google-apps.presentation": (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "pptx",
    ),
    "application/vnd.google-apps.drawing": ("image/png", "png"),
}

_META_FIELDS = (
    "id,name,mimeType,size,md5Checksum,version,modifiedTime,webViewLink,parents,owners(emailAddress,displayName)"
)


def _headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


# Stream downloads in chunks so large files never sit fully in memory.
DOWNLOAD_CHUNK_BYTES = 4 * 1024 * 1024


def get_metadata(access_token: str, file_id: str) -> dict:
    resp = requests.get(
        f"{DRIVE_FILES}/{file_id}",
        headers=_headers(access_token),
        params={"fields": _META_FIELDS, "supportsAllDrives": "true"},
        timeout=20,
    )
    if resp.status_code == 401:
        raise ApiError("token_expired", "Google access token expired.", 401)
    if not resp.ok:
        raise ApiError("drive_error", f"Drive metadata fetch failed ({resp.status_code}).", 502)
    return resp.json()


def _iter_response(resp):
    """Yield body chunks, always closing the streamed response when done."""
    try:
        for chunk in resp.iter_content(chunk_size=DOWNLOAD_CHUNK_BYTES):
            if chunk:
                yield chunk
    finally:
        resp.close()


def open_download(access_token: str, meta: dict):
    """Return (chunks_iterable, name, mime_type, export_mime).

    The content is streamed: callers iterate chunks (e.g. straight into Blob
    block staging) so memory stays flat regardless of file size.
    """
    mime = meta.get("mimeType", "")
    name = meta.get("name", "file")

    if mime in EXPORT_MAP:
        export_mime, ext = EXPORT_MAP[mime]
        resp = requests.get(
            f"{DRIVE_FILES}/{meta['id']}/export",
            headers=_headers(access_token),
            params={"mimeType": export_mime},
            timeout=300,
            stream=True,
        )
        if not resp.ok:
            resp.close()
            raise ApiError("export_failed", f"Could not export '{name}'.", 502)
        if not name.lower().endswith(f".{ext}"):
            name = f"{name}.{ext}"
        return _iter_response(resp), name, export_mime, export_mime

    if mime.startswith("application/vnd.google-apps"):
        raise ApiError("unsupported_native", f"'{name}' has no exportable format.", 422)

    resp = requests.get(
        f"{DRIVE_FILES}/{meta['id']}",
        headers=_headers(access_token),
        params={"alt": "media", "supportsAllDrives": "true"},
        timeout=300,
        stream=True,
    )
    if resp.status_code == 401:
        resp.close()
        raise ApiError("token_expired", "Google access token expired.", 401)
    if not resp.ok:
        resp.close()
        raise ApiError("download_failed", f"Could not download '{name}'.", 502)
    return _iter_response(resp), name, mime, None
