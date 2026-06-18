from app.models import File
from app.services import jobs


def test_copy_name_with_extension():
    assert jobs._copy_name("report.pdf") == "report (copy).pdf"


def test_copy_name_without_extension():
    assert jobs._copy_name("report") == "report (copy)"


def test_is_unchanged_by_md5():
    existing = File(source_md5="abc123")
    assert jobs._is_unchanged(existing, {"md5Checksum": "abc123"}) is True
    assert jobs._is_unchanged(existing, {"md5Checksum": "different"}) is False


def test_is_unchanged_by_version_when_no_md5():
    existing = File(source_version="7")
    assert jobs._is_unchanged(existing, {"version": 7}) is True
    assert jobs._is_unchanged(existing, {"version": 8}) is False


def test_is_unchanged_false_when_no_signal():
    existing = File()
    assert jobs._is_unchanged(existing, {}) is False


def test_parse_dt():
    assert jobs._parse_dt(None) is None
    assert jobs._parse_dt("bad") is None
    parsed = jobs._parse_dt("2026-06-16T21:00:00Z")
    assert parsed is not None and parsed.year == 2026
