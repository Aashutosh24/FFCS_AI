"""
Data models used throughout the extraction pipeline.

Keeping these as plain dataclasses (rather than dicts passed around)
gives us type safety and a single place to change the shape of a
"slot option" or a "course result" later without hunting through
every function that touches it.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import List, Optional


@dataclass
class SlotOption:
    """One row of a Theory/Lab slot options table.

    Example source row: "C2+TCC2 | G17 | Mohinder Singh. B | 67"
    """

    slot: Optional[str] = None
    venue: Optional[str] = None
    faculty: Optional[str] = None

    # Phase 4: row-level quality flags, e.g. "missing_venue",
    # "missing_faculty", "slot_code_uncertain" — populated by the parser
    # and/or src/validation.py. Never fabricated: a flag only ever
    # records something that's actually true about this row (a field is
    # empty, a correction was ambiguous), never a guess.
    flags: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class CourseExtraction:
    """Everything extracted from a single course PDF."""

    source_file: str

    course_code: Optional[str] = None
    course_name: Optional[str] = None
    component_type: Optional[str] = None  # e.g. "Embedded Theory and Lab"
    credit: Optional[str] = None  # the "C" in LTPJC, e.g. "4.0" — kept as the
    # exact string shown on the portal (not cast to float) so a value is
    # never silently reformatted/rounded away from what the source said

    theory_slots: List[SlotOption] = field(default_factory=list)
    lab_slots: List[SlotOption] = field(default_factory=list)

    # Pipeline metadata — never fabricated, always reflects what actually
    # happened while processing this file.
    needs_ocr: bool = False       # True when this result came from OCR (no direct text layer)
    pages: int = 0
    warnings: List[str] = field(default_factory=list)
    error: Optional[str] = None   # set only if the file could not be processed at all

    # Phase 4: derived, never-fabricated review signals — computed purely
    # from what's already present/absent/flagged elsewhere on this object
    # (see src/validation.py). missing_fields lists expected-but-absent
    # fields; confidence is one of "ok" / "review" / "excluded" / "error".
    missing_fields: List[str] = field(default_factory=list)
    confidence: Optional[str] = None

    # Kept for debugging; excluded from normal JSON/CSV output unless requested.
    raw_text: str = ""

    # Phase 6: base64 JPEG data URIs, one per PDF page, for the review UI.
    # Deliberately never included in to_dict()/results.json — it's sizeable
    # image data that belongs in the review HTML, not in every JSON export
    # (e.g. --include-raw-text users debugging OCR text don't want ~200KB
    # of image data per course bloating the file they're reading).
    page_previews: List[str] = field(default_factory=list)

    def to_dict(self, include_raw_text: bool = False) -> dict:
        d = {
            "source_file": self.source_file,
            "course_code": self.course_code,
            "course_name": self.course_name,
            "component_type": self.component_type,
            "credit": self.credit,
            "theory_slots": [s.to_dict() for s in self.theory_slots],
            "lab_slots": [s.to_dict() for s in self.lab_slots],
            "needs_ocr": self.needs_ocr,
            "pages": self.pages,
            "warnings": self.warnings,
            "error": self.error,
            "missing_fields": self.missing_fields,
            "confidence": self.confidence,
        }
        if include_raw_text:
            d["raw_text"] = self.raw_text
        return d
