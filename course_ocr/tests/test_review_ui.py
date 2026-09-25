import json
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.models import CourseExtraction, SlotOption
from src.review_ui import build_review_html, write_review_html
from src.validation import validate_course

_DATA_SCRIPT_RE = re.compile(
    r'<script id="course-data" type="application/json">(.*?)</script>', re.S
)


def _embedded_data(html: str):
    m = _DATA_SCRIPT_RE.search(html)
    assert m, "course-data script tag not found in generated HTML"
    return json.loads(m.group(1))


def _sample_course():
    course = CourseExtraction(
        source_file="Sample.pdf",
        course_code="ABC123",
        course_name="Sample Course",
        component_type="Theory Only",
        credit="2.0",
        theory_slots=[SlotOption(slot="G1", venue="102", faculty="Someone")],
        page_previews=["data:image/jpeg;base64,AAAA"],
    )
    return validate_course(course)


def test_build_review_html_is_well_formed():
    html = build_review_html([_sample_course()])
    assert html.strip().startswith("<!DOCTYPE html>")
    assert html.strip().endswith("</html>")
    assert "<script" in html and "</script>" in html


def test_build_review_html_embeds_course_data_including_previews():
    html = build_review_html([_sample_course()])
    data = _embedded_data(html)

    assert len(data) == 1
    assert data[0]["course_code"] == "ABC123"
    assert data[0]["theory_slots"][0]["slot"] == "G1"
    assert data[0]["page_previews"] == ["data:image/jpeg;base64,AAAA"]
    # raw_text must not be duplicated into the review HTML (it's not
    # useful next to an actual rendered page image, and only bloats it)
    assert "raw_text" not in data[0]


def test_build_review_html_escapes_closing_script_tag_in_data():
    # A faculty name (or OCR warning) containing "</script>" must not be
    # able to break out of the embedded JSON <script> tag.
    course = CourseExtraction(
        source_file="Weird.pdf",
        course_code="X1",
        course_name="Weird</script><script>alert(1)</script> Course",
    )
    validate_course(course)

    html = build_review_html([course])
    # the literal, unescaped closing tag must not appear mid-document
    assert "</script><script>alert(1)</script>" not in html
    data = _embedded_data(html)
    assert "alert(1)" in data[0]["course_name"]  # content preserved, just safely escaped


def test_build_review_html_handles_empty_result_list():
    html = build_review_html([])
    data = _embedded_data(html)
    assert data == []


def test_write_review_html_creates_file():
    with tempfile.TemporaryDirectory() as tmp:
        out_path = os.path.join(tmp, "nested", "review.html")
        write_review_html([_sample_course()], out_path)

        assert os.path.exists(out_path)
        content = open(out_path, encoding="utf-8").read()
        assert "Sample Course" in content


def test_build_review_html_embeds_credit():
    course = CourseExtraction(
        source_file="Credit.pdf",
        course_code="ABC123",
        course_name="Something",
        component_type="Theory Only",
        credit="4.0",
        theory_slots=[SlotOption(slot="G1", venue="102", faculty="X")],
    )
    validate_course(course)

    html = build_review_html([course])
    data = _embedded_data(html)
    assert data[0]["credit"] == "4.0"
