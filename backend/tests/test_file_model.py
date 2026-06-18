from app.models import File


def test_pdf_is_previewable():
    file = File(name="deck.pdf", mime_type="application/pdf", source="upload", storage_key="k")
    assert file.kind == "pdf"
    assert file.previewable is True


def test_risky_types_not_previewable():
    svg = File(name="logo.svg", mime_type="image/svg+xml", source="upload", storage_key="k")
    assert svg.previewable is False

    archive = File(name="bundle.zip", mime_type="application/zip", source="upload", storage_key="k")
    assert archive.previewable is False


def test_to_public_maps_source_for_ui():
    drive_file = File(
        name="term-sheet.pdf",
        mime_type="application/pdf",
        size_bytes=482113,
        source="google_drive",
        storage_key="k",
        status="ready",
    )
    public = drive_file.to_public()
    assert public["source"] == "drive"
    assert public["kind"] == "pdf"
    assert public["typeLabel"] == "PDF"
    assert public["previewable"] is True
    assert any(unit in public["sizeLabel"] for unit in ("B", "KB", "MB", "GB"))
