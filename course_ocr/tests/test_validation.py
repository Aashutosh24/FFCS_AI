import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.models import CourseExtraction, SlotOption
from src.validation import (
    CONFIDENCE_ERROR,
    CONFIDENCE_EXCLUDED,
    CONFIDENCE_OK,
    CONFIDENCE_REVIEW,
    compute_missing_fields,
    validate_course,
    validate_slot,
)


def test_validate_slot_flags_missing_venue_and_faculty():
    assert validate_slot(SlotOption(slot="G1", venue=None, faculty="Someone")) == [
        "missing_venue"
    ]
    assert validate_slot(SlotOption(slot="G1", venue="102", faculty=None)) == [
        "missing_faculty"
    ]
    assert validate_slot(SlotOption(slot="G1", venue=None, faculty=None)) == [
        "missing_venue",
        "missing_faculty",
    ]


def test_validate_slot_clean_row_has_no_flags():
    assert validate_slot(SlotOption(slot="G1", venue="102", faculty="Someone")) == []


def test_compute_missing_fields_flags_absent_top_level_fields():
    course = CourseExtraction(source_file="x.pdf")
    missing = compute_missing_fields(course)
    assert "course_code" in missing
    assert "course_name" in missing
    assert "component_type" in missing


def test_compute_missing_fields_detects_theory_mentioned_but_absent():
    course = CourseExtraction(
        source_file="x.pdf",
        course_code="ABC123",
        course_name="Something",
        component_type="Theory Only",
        theory_slots=[],
    )
    missing = compute_missing_fields(course)
    assert any("theory_slots" in m for m in missing)


def test_compute_missing_fields_theory_only_course_does_not_flag_missing_lab():
    course = CourseExtraction(
        source_file="x.pdf",
        course_code="ABC123",
        course_name="Something",
        component_type="Theory Only",
        credit="2.0",
        theory_slots=[SlotOption(slot="G1", venue="102", faculty="X")],
    )
    missing = compute_missing_fields(course)
    assert missing == []  # theory present, lab correctly not expected


def test_compute_missing_fields_flags_absent_credit():
    course = CourseExtraction(
        source_file="x.pdf",
        course_code="ABC123",
        course_name="Something",
        component_type="Theory Only",
        theory_slots=[SlotOption(slot="G1", venue="102", faculty="X")],
    )
    missing = compute_missing_fields(course)
    assert "credit" in missing


def test_compute_missing_fields_skips_excluded_and_errored_files():
    excluded = CourseExtraction(source_file="Mrng.pdf", warnings=["Excluded: not a course page"])
    assert compute_missing_fields(excluded) == []

    errored = CourseExtraction(source_file="bad.pdf", error="could not open file")
    assert compute_missing_fields(errored) == []


def test_validate_course_confidence_ok_when_clean():
    course = CourseExtraction(
        source_file="x.pdf",
        course_code="ABC123",
        course_name="Something",
        component_type="Theory Only",
        credit="2.0",
        theory_slots=[SlotOption(slot="G1", venue="102", faculty="X")],
    )
    validate_course(course)
    assert course.confidence == CONFIDENCE_OK
    assert course.missing_fields == []


def test_validate_course_confidence_review_when_row_flagged():
    course = CourseExtraction(
        source_file="x.pdf",
        course_code="ABC123",
        course_name="Something",
        component_type="Theory Only",
        theory_slots=[SlotOption(slot="G1", venue=None, faculty="X", flags=["missing_venue"])],
    )
    validate_course(course)
    assert course.confidence == CONFIDENCE_REVIEW


def test_validate_course_confidence_excluded():
    course = CourseExtraction(source_file="Mrng.pdf", warnings=["Excluded: not a course page"])
    validate_course(course)
    assert course.confidence == CONFIDENCE_EXCLUDED
    assert course.missing_fields == []  # excluded files don't get missing-field noise


def test_validate_course_confidence_error():
    course = CourseExtraction(source_file="bad.pdf", error="boom")
    validate_course(course)
    assert course.confidence == CONFIDENCE_ERROR


def test_validate_course_is_idempotent():
    course = CourseExtraction(
        source_file="x.pdf",
        course_code="ABC123",
        course_name="Something",
        component_type="Theory Only",
        credit="2.0",
        theory_slots=[SlotOption(slot="G1", venue="102", faculty="X")],
    )
    validate_course(course)
    first = (course.confidence, list(course.missing_fields))
    validate_course(course)
    second = (course.confidence, list(course.missing_fields))
    assert first == second
