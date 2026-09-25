import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.preview import render_page_previews

REAL_SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "real_samples")


def test_render_page_previews_matches_page_count():
    previews = render_page_previews(os.path.join(REAL_SAMPLES_DIR, "German.pdf"))
    assert len(previews) == 1
    assert previews[0].startswith("data:image/jpeg;base64,")


def test_render_page_previews_multi_page_pdf():
    previews = render_page_previews(os.path.join(REAL_SAMPLES_DIR, "SWE2001.pdf"))
    assert len(previews) == 3
    assert all(p.startswith("data:image/jpeg;base64,") for p in previews)


def test_render_page_previews_nonexistent_file_returns_empty_not_raises():
    previews = render_page_previews("/tmp/does_not_exist_at_all.pdf")
    assert previews == []


def test_render_page_previews_corrupt_file_returns_empty_not_raises():
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(b"not a real pdf")
        path = f.name

    try:
        previews = render_page_previews(path)
        assert previews == []
    finally:
        os.unlink(path)
