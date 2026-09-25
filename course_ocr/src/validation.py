"""
Phase 4: validation & confidence.

This module never re-parses, re-OCRs, or guesses a new field value — its
only job is to look at what the pipeline already produced (which fields
are present/absent, which slot rows the parser itself flagged as
uncertain) and turn that into an explicit, itemized signal:

  - `validate_slot()` — flags on one SlotOption, attached at the moment
    it's built (see src/parser.py) so a flag is always traceable to the
    exact row it's about, even in a 50+ row course.
  - `validate_course()` — missing-field detection, plus one aggregate
    confidence level per course, derived purely from the row flags and
    warnings that already exist.

A course/row with no flags and "ok" confidence has genuinely been
checked and found clean, not just "nothing went wrong that we bothered
to look for" — every check here is concrete and itemized below.
"""

from __future__ import annotations

import re
from typing import List

from .models import CourseExtraction, SlotOption

# --- Row-level flags (attached to SlotOption.flags) ------------------------

FLAG_MISSING_VENUE = "missing_venue"
FLAG_MISSING_FACULTY = "missing_faculty"
FLAG_SLOT_CODE_UNCERTAIN = "slot_code_uncertain"  # vocabulary correction was ambiguous/unmatched


def validate_slot(slot: SlotOption) -> List[str]:
    """Return the flags that apply to one slot row, based purely on its
    final field values. Does not mutate `slot`; callers attach the result
    (see src/parser.py, which also adds FLAG_SLOT_CODE_UNCERTAIN at the
    point it knows a vocabulary correction was ambiguous).
    """
    flags: List[str] = []
    if not slot.venue:
        flags.append(FLAG_MISSING_VENUE)
    if not slot.faculty:
        flags.append(FLAG_MISSING_FACULTY)
    return flags


# --- Course-level: missing fields + aggregate confidence -------------------

_EXCLUDED_WARNING_RE = re.compile(r"^Excluded", re.IGNORECASE)

CONFIDENCE_OK = "ok"
CONFIDENCE_REVIEW = "review"
CONFIDENCE_EXCLUDED = "excluded"
CONFIDENCE_ERROR = "error"


def _is_excluded(course: CourseExtraction) -> bool:
    return any(_EXCLUDED_WARNING_RE.match(w) for w in course.warnings)


def compute_missing_fields(course: CourseExtraction) -> List[str]:
    """Which expected top-level fields are absent.

    Skipped entirely for excluded/errored files — those aren't course
    results at all, so "missing course_name" would be a meaningless
    (and misleading) thing to report about them.
    """
    if course.error or _is_excluded(course):
        return []

    missing: List[str] = []
    if not course.course_code:
        missing.append("course_code")
    if not course.course_name:
        missing.append("course_name")
    if not course.component_type:
        missing.append("component_type")
    if not course.credit:
        missing.append("credit")

    # component_type itself tells us whether Theory/Lab rows should exist
    # at all — a "Theory Only" course with zero lab rows is correct, but
    # a "Theory Only" course with zero *theory* rows found nothing it
    # should have. This is a real, itemizable inconsistency, not a guess.
    component = (course.component_type or "").lower()
    mentions_theory = "theory" in component
    mentions_lab = "lab" in component

    if mentions_theory and not course.theory_slots:
        missing.append("theory_slots (component_type mentions Theory but none were found)")
    if mentions_lab and not course.lab_slots:
        missing.append("lab_slots (component_type mentions Lab but none were found)")

    if not course.theory_slots and not course.lab_slots and not component:
        missing.append("theory_slots/lab_slots (no slot rows found at all)")

    return missing


def compute_confidence(course: CourseExtraction) -> str:
    """One aggregate confidence level for the whole course, derived from
    signals that already exist elsewhere on the object — never a new
    judgment call about data this module hasn't seen.
    """
    if course.error:
        return CONFIDENCE_ERROR
    if _is_excluded(course):
        return CONFIDENCE_EXCLUDED
    if course.missing_fields:
        return CONFIDENCE_REVIEW
    if any(s.flags for s in course.theory_slots + course.lab_slots):
        return CONFIDENCE_REVIEW
    return CONFIDENCE_OK


def validate_course(course: CourseExtraction) -> CourseExtraction:
    """Populate `course.missing_fields` and `course.confidence` in place,
    and return it (for convenient chaining). Idempotent — safe to call
    more than once on the same object.
    """
    course.missing_fields = compute_missing_fields(course)
    course.confidence = compute_confidence(course)
    return course
