"""
Writes a batch of CourseExtraction results out as JSON and/or CSV.

CSV is inherently a flat format, but our slot lists are one-to-many
per course — so the CSV writer emits one row per slot option (with the
course fields repeated), plus a separate summary CSV of just the
course-level fields. JSON keeps the full nested structure and is the
more complete/authoritative output.
"""

from __future__ import annotations

import csv
import json
import os
from typing import List

from .models import CourseExtraction


def write_json(results: List[CourseExtraction], out_path: str, include_raw_text: bool = False) -> None:
    data = [r.to_dict(include_raw_text=include_raw_text) for r in results]
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def write_review_queue(results: List[CourseExtraction], out_path: str) -> int:
    """Write a short, focused text report of exactly what needs a human
    glance: courses with missing fields, and every individually-flagged
    slot row (with the reason). Courses/rows with nothing to flag don't
    appear at all — this is meant to be short.

    Returns the number of courses that needed a mention (for the CLI
    summary), so "confidence: ok" courses can be confirmed as genuinely
    absent from the file, not just unmentioned by omission.
    """
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    flagged_count = 0
    lines: List[str] = []

    for r in results:
        row_notes = []
        for slot_type, slots in (("theory", r.theory_slots), ("lab", r.lab_slots)):
            for s in slots:
                if s.flags:
                    row_notes.append(
                        f"    - [{slot_type}] {s.slot or '?'} | venue={s.venue!r} "
                        f"faculty={s.faculty!r} -- {', '.join(s.flags)}"
                    )

        needs_mention = r.error or r.confidence == "review" or row_notes
        if not needs_mention:
            continue

        flagged_count += 1
        lines.append(f"{r.source_file}  (confidence: {r.confidence})")
        if r.error:
            lines.append(f"  error: {r.error}")
        if r.missing_fields:
            lines.append(f"  missing fields: {', '.join(r.missing_fields)}")
        lines.extend(row_notes)
        lines.append("")

    if not lines:
        lines = ["Nothing needs review — every course parsed with confidence: ok.\n"]

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return flagged_count


def write_csv(results: List[CourseExtraction], out_path: str) -> None:
    """One row per slot option. Courses with no parsed slots (e.g. needs_ocr)
    still get one row so they aren't silently dropped from the report.
    """
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    fieldnames = [
        "source_file",
        "course_code",
        "course_name",
        "component_type",
        "credit",
        "slot_type",  # "theory" | "lab"
        "slot",
        "venue",
        "faculty",
        "row_flags",       # e.g. "missing_venue,slot_code_uncertain" — empty means clean
        "course_confidence",  # "ok" | "review" | "excluded" | "error"
        "needs_ocr",
        "error",
    ]

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for r in results:
            base = {
                "source_file": r.source_file,
                "course_code": r.course_code,
                "course_name": r.course_name,
                "component_type": r.component_type,
                "credit": r.credit,
                "course_confidence": r.confidence,
                "needs_ocr": r.needs_ocr,
                "error": r.error,
            }

            rows_written = 0
            for slot_type, slots in (("theory", r.theory_slots), ("lab", r.lab_slots)):
                for s in slots:
                    writer.writerow(
                        {
                            **base,
                            "slot_type": slot_type,
                            "slot": s.slot,
                            "venue": s.venue,
                            "faculty": s.faculty,
                            "row_flags": ",".join(s.flags),
                        }
                    )
                    rows_written += 1

            if rows_written == 0:
                writer.writerow(
                    {
                        **base,
                        "slot_type": None,
                        "slot": None,
                        "venue": None,
                        "faculty": None,
                        "row_flags": None,
                    }
                )
