import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.models import CourseExtraction, SlotOption
from src.output_writer import write_review_queue
from src.validation import validate_course


def test_write_review_queue_omits_clean_courses():
    clean = CourseExtraction(
        source_file="clean.pdf",
        course_code="ABC123",
        course_name="Something",
        component_type="Theory Only",
        credit="2.0",
        theory_slots=[SlotOption(slot="G1", venue="102", faculty="X")],
    )
    validate_course(clean)

    with tempfile.TemporaryDirectory() as tmp:
        out_path = os.path.join(tmp, "review_queue.txt")
        count = write_review_queue([clean], out_path)

        assert count == 0
        content = open(out_path).read()
        assert "clean.pdf" not in content
        assert "Nothing needs review" in content


def test_write_review_queue_lists_flagged_row_and_reason():
    flagged_row = SlotOption(slot="G1", venue=None, faculty="X", flags=["missing_venue"])
    course = CourseExtraction(
        source_file="messy.pdf",
        course_code="ABC123",
        course_name="Something",
        component_type="Theory Only",
        theory_slots=[flagged_row],
    )
    validate_course(course)

    with tempfile.TemporaryDirectory() as tmp:
        out_path = os.path.join(tmp, "review_queue.txt")
        count = write_review_queue([course], out_path)

        assert count == 1
        content = open(out_path).read()
        assert "messy.pdf" in content
        assert "missing_venue" in content
        assert "G1" in content


def test_write_review_queue_lists_missing_fields_and_errors():
    missing_fields_course = CourseExtraction(
        source_file="incomplete.pdf",
        course_code="ABC123",
        # course_name deliberately absent
        component_type="Theory Only",
        theory_slots=[SlotOption(slot="G1", venue="102", faculty="X")],
    )
    validate_course(missing_fields_course)

    errored_course = CourseExtraction(source_file="bad.pdf", error="could not open file")
    validate_course(errored_course)

    with tempfile.TemporaryDirectory() as tmp:
        out_path = os.path.join(tmp, "review_queue.txt")
        count = write_review_queue([missing_fields_course, errored_course], out_path)

        assert count == 2
        content = open(out_path).read()
        assert "incomplete.pdf" in content
        assert "course_name" in content
        assert "bad.pdf" in content
        assert "could not open file" in content


def test_write_csv_includes_credit_column():
    import csv as csv_module

    course = CourseExtraction(
        source_file="credit_test.pdf",
        course_code="ABC123",
        course_name="Something",
        component_type="Theory Only",
        credit="4.0",
        theory_slots=[SlotOption(slot="G1", venue="102", faculty="X")],
    )
    validate_course(course)

    with tempfile.TemporaryDirectory() as tmp:
        out_path = os.path.join(tmp, "results.csv")
        from src.output_writer import write_csv

        write_csv([course], out_path)

        with open(out_path, newline="") as f:
            rows = list(csv_module.DictReader(f))

        assert len(rows) == 1
        assert rows[0]["credit"] == "4.0"
        assert rows[0]["course_code"] == "ABC123"
