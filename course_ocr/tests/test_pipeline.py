import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "fixtures"))

from build_synthetic_pdf import build as build_synthetic_pdf
from src.pipeline import process_file, process_folder


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
REAL_SAMPLES_DIR = os.path.join(FIXTURES_DIR, "real_samples")


def test_process_file_synthetic_pdf_with_text_layer_skips_ocr():
    with tempfile.TemporaryDirectory() as tmp:
        pdf_path = os.path.join(tmp, "synthetic.pdf")
        build_synthetic_pdf(pdf_path)

        result = process_file(pdf_path)

        assert result.error is None
        assert result.needs_ocr is False  # had a text layer, OCR never ran
        assert result.course_code == "SWE2001"
        assert result.course_name == "Introduction to Computer Networks"
        assert len(result.theory_slots) == 3
        assert len(result.lab_slots) == 2


def test_process_file_missing_file_records_error_not_crash():
    result = process_file("/tmp/does_not_exist_at_all.pdf")
    assert result.error is not None
    assert result.needs_ocr is False
    assert result.confidence == "error"


def test_process_folder_recurses_into_subfolders():
    # Phase 5: a folder extracted from a zip commonly wraps its PDFs in a
    # subfolder (this project's own Slot.zip does exactly this) —
    # process_folder must find them, not just look at the top level.
    with tempfile.TemporaryDirectory() as tmp:
        nested = os.path.join(tmp, "nested", "deeper")
        os.makedirs(nested)
        dst = os.path.join(nested, "German.pdf")
        with open(os.path.join(REAL_SAMPLES_DIR, "German.pdf"), "rb") as src, open(dst, "wb") as out:
            out.write(src.read())

        results = process_folder(tmp)
        assert len(results) == 1
        assert results[0].source_file == "German.pdf"
        assert results[0].course_code == "FRL1005"


def test_process_folder_one_bad_file_does_not_stop_batch():
    with tempfile.TemporaryDirectory() as tmp:
        good_copy = os.path.join(tmp, "German.pdf")
        with open(os.path.join(REAL_SAMPLES_DIR, "German.pdf"), "rb") as src, open(
            good_copy, "wb"
        ) as dst:
            dst.write(src.read())

        bad_path = os.path.join(tmp, "corrupt.pdf")
        with open(bad_path, "wb") as f:
            f.write(b"this is not a real pdf file")

        results = process_folder(tmp)

        assert len(results) == 2
        by_name = {r.source_file: r for r in results}
        assert by_name["German.pdf"].error is None
        assert by_name["German.pdf"].course_code == "FRL1005"
        assert by_name["corrupt.pdf"].error is not None


# --- Real-sample, OCR-path tests -----------------------------------------
#
# These run actual OCR (via the installed tesseract binary) against the
# real project PDFs bundled in tests/fixtures/real_samples/. Expected
# values below were confirmed by visually inspecting the rendered PDF
# pages, so this is checking OCR+parsing accuracy against known-correct
# ground truth, not just "did it crash".


def test_ocr_german_pdf_full_accuracy():
    """German.pdf is a small, single-page, theory-only course — OCR gets
    100% of its 5 slot rows correct, so this is the accuracy bar for a
    "clean" case.
    """
    result = process_file(os.path.join(REAL_SAMPLES_DIR, "German.pdf"))

    assert result.error is None
    assert result.needs_ocr is True
    assert result.course_code == "FRL1005"
    assert result.course_name == "German for Beginners"
    assert result.credit == "2.0"
    assert result.lab_slots == []

    # Phase 6: page previews are generated for every file, regardless of
    # which extraction path it took.
    assert len(result.page_previews) == 1
    assert result.page_previews[0].startswith("data:image/jpeg;base64,")

    got = {(s.slot, s.venue, s.faculty) for s in result.theory_slots}
    expected = {
        ("G1", "102", "Renuprasad Hemkiran Patki"),
        ("G2", "G10A", "Renuprasad Hemkiran Patki"),
        ("F2", "105", "Renuprasad Hemkiran Patki"),
        ("E2", "324", "Renuprasad Hemkiran Patki"),
        ("F1", "112", "Renuprasad Hemkiran Patki"),
    }
    assert got == expected


def test_ocr_swe2001_theory_and_lab_split_correctly():
    """A 3-page course with both theory and lab slots — checks the
    lab-vs-theory split (by slot-code prefix) holds up under real OCR,
    that combined slot codes like "C2+TCC2" survive intact, and that the
    Phase 3 vocabulary correction fixes the one row that Phase 2 got
    wrong ("C14+TCl" -> "C1+TC1").
    """
    result = process_file(os.path.join(REAL_SAMPLES_DIR, "SWE2001.pdf"))

    assert result.error is None
    # NOTE: the source document's own COURSE DETAIL row says "SWE3001",
    # not "SWE2001" — confirmed by visual inspection of the PDF, so this
    # is the source data, not an OCR mistake.
    assert result.course_code == "SWE3001"
    assert result.course_name == "Introduction to Computer Networks"

    assert len(result.theory_slots) == 10
    assert len(result.lab_slots) == 12

    theory_slot_codes = {s.slot for s in result.theory_slots}
    lab_slot_codes = {s.slot for s in result.lab_slots}

    assert "C2+TCC2" in theory_slot_codes
    assert "C1+TC1" in theory_slot_codes  # Phase 3 fix, was "C14+TC1" in Phase 2
    assert all(not code.upper().startswith("L") for code in theory_slot_codes)
    assert "L26+L27" in lab_slot_codes
    assert all(code.upper().startswith("L") for code in lab_slot_codes)

    # Full row-level ground truth, verified against the rendered PDF.
    got = {(s.slot, s.venue, s.faculty) for s in result.theory_slots}
    expected = {
        ("C2+TCC2", "G17", "Mohinder Singh. B"),
        ("C1+TCC1", "504", "Mohinder Singh. B"),
        ("C2+TC2", "513", "Nandha Kumar R"),
        ("C2+TC2", "512", "Asish Kumar Dalai"),
        ("F1+TFF1", "G14", "Tauseef Khan"),
        ("F2+TFF2", "G18", "Tauseef Khan"),
        ("C1+TC1", "514", "Asish Kumar Dalai"),
        ("F2+TF2", "513", "Nandha Kumar R"),
        ("F1+TF1", "520", "Kumar Debasis"),
        ("F1+TF1", "519", "Bharathi V C"),
    }
    assert got == expected


def test_ocr_sts_pdf_venue_recovery_and_no_stray_symbols():
    """STS.pdf is the largest sample (4 pages, 54 rows) and previously lost
    the venue on 3 rows where OCR misread a room code's digit as a letter
    (e.g. "G11" -> "Gll"). Also checks stray OCR symbol noise (a misread
    availability-circle glyph, e.g. trailing "©") doesn't leak into
    faculty names.
    """
    result = process_file(os.path.join(REAL_SAMPLES_DIR, "STS.pdf"))

    assert result.error is None
    assert result.course_code == "STS2009"
    assert len(result.theory_slots) == 54

    by_slot_venue = {(s.slot, s.venue) for s in result.theory_slots}
    assert ("G1+TG1", "G11") in by_slot_venue
    assert ("G2+TG2", "G11") in by_slot_venue
    assert ("A1+TA1", "G11") in by_slot_venue

    for s in result.theory_slots:
        assert s.faculty is None or "©" not in s.faculty


def test_ocr_registration_summary_pdf_is_excluded_not_mangled():
    """Mrng.pdf is the user's own final registered timetable, not a
    course-detail page (confirmed with the user) — it must not be parsed
    as if it were one course.
    """
    result = process_file(os.path.join(REAL_SAMPLES_DIR, "Mrng.pdf"))

    assert result.error is None
    assert result.course_code is None
    assert result.course_name is None
    assert result.theory_slots == []
    assert result.lab_slots == []
    assert any("Excluded" in w for w in result.warnings)


def test_process_folder_all_real_samples_no_crash_and_courses_identified():
    results = process_folder(REAL_SAMPLES_DIR)
    assert len(results) == 8

    for r in results:
        assert r.error is None  # OCR quality issues are fine; hard failures are not

    by_name = {r.source_file: r for r in results}

    # Every real course-detail PDF should at least get its course code
    # right, even where individual slot rows have OCR imperfections.
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
        assert len(by_name[fname].theory_slots) + len(by_name[fname].lab_slots) > 0, fname

    # Mrng.pdf is excluded by design, not a course result.
    assert by_name["Mrng.pdf"].course_code is None


def test_process_folder_confidence_matches_known_review_cases():
    """Phase 4: confirms the exact courses/rows known (from manual PDF
    inspection, see Phase 3 README notes) to have a genuinely ambiguous
    OCR correction are — and only those — flagged for review, and that
    every course gets a confidence level (no path leaves it unset).
    """
    results = process_folder(REAL_SAMPLES_DIR)
    by_name = {r.source_file: r for r in results}

    for r in results:
        assert r.confidence is not None, r.source_file

    assert by_name["Mrng.pdf"].confidence == "excluded"

    # These two are the known "left as-is, ambiguous" rows from Phase 3.
    assert by_name["STS.pdf"].confidence == "review"
    assert by_name["SWE2002.pdf"].confidence == "review"

    flagged_sts = [s for s in by_name["STS.pdf"].theory_slots if s.flags]
    assert len(flagged_sts) == 1
    assert flagged_sts[0].flags == ["slot_code_uncertain"]

    flagged_swe2002 = [s for s in by_name["SWE2002.pdf"].theory_slots if s.flags]
    assert len(flagged_swe2002) == 1
    assert flagged_swe2002[0].flags == ["slot_code_uncertain"]

    # The other 5 course files have no known ambiguous rows -> clean.
    for fname in ["German.pdf", "SWE2001.pdf", "SWE2004.pdf", "SWE2006.pdf", "SWE3005.pdf"]:
        assert by_name[fname].confidence == "ok", fname
        assert by_name[fname].missing_fields == [], fname
