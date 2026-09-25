"""
Tests against the *new* portal UI export — a different screenshot/print
layout than the original sample data (see src/ocr.py's module docstring
for the investigation that prompted the dual-preprocessing-strategy fix,
and src/pipeline.py's exclusion markers for the two new out-of-scope
document shapes this UI also produces).

Ground truth below was confirmed by inspecting the actual rendered PDF
pages (not assumed), the same way the original tests/test_pipeline.py
ground truth was established.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.pipeline import process_folder

REAL_SAMPLES_NEW_UI_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "real_samples_new_ui")
REAL_SLOT_NEW_UI_ZIP = os.path.join(os.path.dirname(__file__), "fixtures", "SLOT_new_ui.zip")


def test_new_ui_batch_matches_known_ground_truth():
    results = process_folder(REAL_SAMPLES_NEW_UI_DIR)
    assert len(results) == 11

    by_name = {r.source_file: r for r in results}
    for r in results:
        assert r.error is None, r.source_file

    expected = {
        "AGILE_PROGRAM.pdf": {"code": "CSE3001", "credit": "4.0", "theory": 4, "lab": 0, "confidence": "ok"},
        "CLOUD_PROE.pdf": {"code": "SWE4004", "credit": "4.0", "theory": 5, "lab": 0, "confidence": "ok"},
        "FRENCH.pdf": {"code": "FRL1001", "credit": "2.0", "theory": 8, "lab": 0, "confidence": "ok"},
        "GERMAN.pdf": {"code": "FRL1005", "credit": "2.0", "theory": 6, "lab": 0, "confidence": "ok"},
        "SWE2009.pdf": {"code": "SWE2009", "credit": "4.0", "theory": 6, "lab": 6, "confidence": "ok"},
        "SWE3002.pdf": {"code": "SWE3002", "credit": "4.0", "theory": 5, "lab": 0, "confidence": "ok"},
        "SWE3003.pdf": {"code": "SWE3003", "credit": "4.0", "theory": 3, "lab": 3, "confidence": "ok"},
    }
    for fname, exp in expected.items():
        r = by_name[fname]
        assert r.course_code == exp["code"], fname
        assert r.credit == exp["credit"], fname
        assert len(r.theory_slots) == exp["theory"], fname
        assert len(r.lab_slots) == exp["lab"], fname
        assert r.confidence == exp["confidence"], fname
        assert r.missing_fields == [], fname

    # STS.pdf: genuinely rotated 90 degrees in the source PDF (confirmed
    # by direct visual inspection) — orientation correction fixes it
    # enough to extract the course code and 23 slot rows, but the LTPJC
    # block near the course-name line OCR'd badly enough on this
    # particular page that no credit digit survived; correctly left
    # unset rather than guessed.
    sts = by_name["STS.pdf"]
    assert sts.course_code == "STS2007"
    assert sts.credit is None
    assert "credit" in sts.missing_fields
    assert sts.confidence == "review"
    assert len(sts.theory_slots) + len(sts.lab_slots) == 23

    # Excluded document shapes unique to this UI: a course catalog/browse
    # listing (HUMAN_1/2.pdf) and this UI's version of the personal
    # timetable summary (TT.pdf) — none of these are course-detail pages,
    # so none should be parsed as a course.
    for fname in ["HUMAN_1.pdf", "HUMAN_2.pdf", "TT.pdf"]:
        r = by_name[fname]
        assert r.confidence == "excluded", fname
        assert r.course_code is None, fname
        assert any(w.startswith("Excluded") for w in r.warnings), fname


def test_new_ui_catalog_pages_get_distinct_exclusion_reason_from_timetable_page():
    # HUMAN_1/2.pdf (a course catalog listing) and TT.pdf (a personal
    # timetable) are both excluded, but for genuinely different reasons —
    # each should say so, not share one generic "excluded" message.
    results = process_folder(REAL_SAMPLES_NEW_UI_DIR)
    by_name = {r.source_file: r for r in results}

    catalog_reason = by_name["HUMAN_1.pdf"].warnings[0]
    timetable_reason = by_name["TT.pdf"].warnings[0]

    assert catalog_reason != timetable_reason
    assert "catalog" in catalog_reason.lower()
    assert "timetable" in timetable_reason.lower() or "registered courses" in timetable_reason.lower()


def test_new_ui_zip_matches_folder_results():
    from src.pipeline import process_zip

    zip_results = process_zip(REAL_SLOT_NEW_UI_ZIP)
    assert len(zip_results) == 11

    by_name = {r.source_file: r for r in zip_results}
    assert by_name["GERMAN.pdf"].course_code == "FRL1005"
    assert by_name["GERMAN.pdf"].credit == "2.0"
    assert by_name["SWE2009.pdf"].credit == "4.0"  # the wrapped-line credit case
    assert by_name["TT.pdf"].confidence == "excluded"
