import os
import sys
import tempfile
import zipfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.pipeline import process_input, process_zip


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
REAL_SAMPLES_DIR = os.path.join(FIXTURES_DIR, "real_samples")
REAL_SLOT_ZIP = os.path.join(FIXTURES_DIR, "Slot.zip")


def test_process_zip_real_archive_matches_folder_results():
    """The bundled Slot.zip has the same real 8 PDFs as
    tests/fixtures/real_samples/, just wrapped in a "Slot/" subfolder
    inside the archive (exactly like a real export from this project).

    This runs OCR once, via the zip, and checks the results against the
    same known ground truth already used elsewhere in the test suite for
    the folder path (see test_pipeline.py) — rather than also re-running
    a second full OCR batch over the folder just to diff the two, which
    would roughly double this test's runtime for no extra confidence
    (folder-path OCR is already covered by test_pipeline.py).
    """
    results = process_zip(REAL_SLOT_ZIP)
    assert len(results) == 8

    by_name = {r.source_file: r for r in results}
    expected_codes = {
        "German.pdf": "FRL1005",
        "STS.pdf": "STS2009",
        "SWE2001.pdf": "SWE3001",
        "SWE2002.pdf": "SWE2002",
        "SWE2004.pdf": "SWE2004",
        "SWE2006.pdf": "SWE2006",
        "SWE3005.pdf": "SWE3005",
    }
    for fname, code in expected_codes.items():
        assert by_name[fname].course_code == code, fname
        assert by_name[fname].error is None, fname

    # Mrng.pdf is excluded by design, same as the folder path.
    assert by_name["Mrng.pdf"].course_code is None
    assert by_name["Mrng.pdf"].confidence == "excluded"


def test_process_zip_handles_nested_subfolder():
    # Confirms discovery is recursive, not just top-level — the real
    # Slot.zip wraps everything in "Slot/", so this is also implicitly
    # covered by the test above, but this isolates just that behavior
    # with a minimal synthetic archive.
    with tempfile.TemporaryDirectory() as tmp:
        zip_path = os.path.join(tmp, "nested.zip")
        with zipfile.ZipFile(zip_path, "w") as zf:
            zf.write(os.path.join(REAL_SAMPLES_DIR, "German.pdf"), "SomeFolder/German.pdf")

        results = process_zip(zip_path)
        assert len(results) == 1
        assert results[0].source_file == "German.pdf"
        assert results[0].course_code == "FRL1005"


def test_process_zip_corrupt_archive_reports_error_not_crash():
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as f:
        f.write(b"this is not a real zip file")
        bad_zip_path = f.name

    try:
        results = process_zip(bad_zip_path)
        assert len(results) == 1
        assert results[0].error is not None
        assert results[0].confidence == "error"
    finally:
        os.unlink(bad_zip_path)


def test_process_zip_with_no_pdfs_returns_empty_list_not_crash():
    with tempfile.TemporaryDirectory() as tmp:
        zip_path = os.path.join(tmp, "no_pdfs.zip")
        with zipfile.ZipFile(zip_path, "w") as zf:
            zf.writestr("readme.txt", "nothing to see here")

        results = process_zip(zip_path)
        assert results == []


def test_process_zip_rejects_path_traversal_members():
    with tempfile.TemporaryDirectory() as tmp:
        zip_path = os.path.join(tmp, "evil.zip")
        escape_target = os.path.join(tempfile.gettempdir(), "course_ocr_zip_slip_test.pdf")
        if os.path.exists(escape_target):
            os.remove(escape_target)

        with zipfile.ZipFile(zip_path, "w") as zf:
            # A traversal path relative to wherever the archive gets
            # extracted — must never land outside the temp extraction dir.
            zf.writestr("../../../../../../tmp/course_ocr_zip_slip_test.pdf", b"%PDF-1.4 fake")

        results = process_zip(zip_path)

        assert not os.path.exists(escape_target)
        assert results == []  # the malicious member was skipped, nothing else was in the zip


def test_process_input_dispatches_zip_vs_folder_by_extension():
    # Lightweight dispatch check (not a full 8-file OCR re-run, which
    # test_process_zip_real_archive_matches_folder_results already covers)
    # — this only needs to prove process_input routes a .zip to the zip
    # pipeline and a directory to the folder pipeline.
    with tempfile.TemporaryDirectory() as tmp:
        zip_path = os.path.join(tmp, "single.zip")
        with zipfile.ZipFile(zip_path, "w") as zf:
            zf.write(os.path.join(REAL_SAMPLES_DIR, "German.pdf"), "German.pdf")
        zip_results = process_input(zip_path)

    with tempfile.TemporaryDirectory() as tmp2:
        dst = os.path.join(tmp2, "German.pdf")
        with open(os.path.join(REAL_SAMPLES_DIR, "German.pdf"), "rb") as src, open(dst, "wb") as out:
            out.write(src.read())
        folder_results = process_input(tmp2)

    assert len(zip_results) == 1
    assert zip_results[0].course_code == "FRL1005"
    assert len(folder_results) == 1
    assert folder_results[0].course_code == "FRL1005"


def test_process_input_rejects_nonexistent_path():
    import pytest

    with pytest.raises(FileNotFoundError):
        process_input("/tmp/definitely_does_not_exist_anywhere.xyz")
