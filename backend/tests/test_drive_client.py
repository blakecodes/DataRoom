from app.services import drive_client


class _FakeResponse:
    ok = True
    status_code = 200

    def __init__(self, chunks=(b"exported-bytes",)):
        self._chunks = chunks
        self.closed = False

    def iter_content(self, chunk_size=None):
        yield from self._chunks

    def close(self):
        self.closed = True


def test_export_map_docs_to_docx():
    export_mime, ext = drive_client.EXPORT_MAP["application/vnd.google-apps.document"]
    assert ext == "docx"
    assert export_mime.endswith("wordprocessingml.document")


def test_download_native_export(monkeypatch):
    monkeypatch.setattr(drive_client.requests, "get", lambda *a, **k: _FakeResponse())
    meta = {"id": "1", "name": "Brief", "mimeType": "application/vnd.google-apps.document"}
    chunks, name, mime, export_mime = drive_client.open_download("token", meta)
    assert b"".join(chunks) == b"exported-bytes"
    assert name == "Brief.docx"
    assert export_mime.endswith("wordprocessingml.document")
    assert mime == export_mime


def test_download_binary_passthrough(monkeypatch):
    monkeypatch.setattr(
        drive_client.requests, "get", lambda *a, **k: _FakeResponse((b"abc", b"def"))
    )
    meta = {"id": "2", "name": "scan.pdf", "mimeType": "application/pdf"}
    chunks, name, mime, export_mime = drive_client.open_download("token", meta)
    assert b"".join(chunks) == b"abcdef"
    assert name == "scan.pdf"
    assert mime == "application/pdf"
    assert export_mime is None
