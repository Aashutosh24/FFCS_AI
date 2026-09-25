"""
Phase 3: pattern recognition / slot-code validation.

VIT-AP's FFCS ("Fully Flexible Credit System") timetable uses a fixed,
well-defined set of slot codes — this isn't specific to any one course,
it's the university's standard grid, confirmed by cross-referencing the
slot codes that appear across all 7 sample course PDFs and the weekly
timetable grid in Mrng.pdf. Having this closed vocabulary lets us catch
and deterministically correct OCR character-level errors that survive
the l/I-vs-1 fix in parser.py, e.g. an inserted stray digit ("C14" for
"C1"), by snapping a not-quite-valid segment to the *single* vocabulary
entry it's one edit away from.

This is correction, not invention: a segment is only ever snapped when
exactly one vocabulary entry is within edit distance 1. Zero matches or
multiple equally-close matches are left untouched and reported via a
warning instead — the same "flag uncertainty, never guess" principle as
the rest of the pipeline.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

# Theory day-letter slots (single period): A1, A2, B1, B2, ... G1, G2
_DAY_LETTERS = "ABCDEFG"
_THEORY_LETTER_SLOTS = {f"{letter}{n}" for letter in _DAY_LETTERS for n in (1, 2)}

# Their paired "T" slots, used in combos like "A1+TA1": TA1, TA2, ... TG1, TG2
_THEORY_T_SLOTS = {f"T{letter}{n}" for letter in _DAY_LETTERS for n in (1, 2)}

# The doubled-letter "T" variant used for embedded-theory combos, e.g.
# "C1+TCC1", "F2+TFF2": TCC1, TCC2, TDD1, TDD2, TEE1, TEE2, TFF1, TFF2,
# TGG1, TGG2. (Observed only for C through G in the sample data — A/B
# theory slots pair with plain TA/TB, not doubled forms.)
_DOUBLED_LETTERS = "CDEFG"
_THEORY_TDOUBLE_SLOTS = {
    f"T{letter}{letter}{n}" for letter in _DOUBLED_LETTERS for n in (1, 2)
}

# Lab slots: L1 through L60 (VIT-AP's lab grid), used in combos like
# "L26+L27".
_LAB_SLOTS = {f"L{n}" for n in range(1, 61)}

CANONICAL_SLOT_SEGMENTS = (
    _THEORY_LETTER_SLOTS | _THEORY_T_SLOTS | _THEORY_TDOUBLE_SLOTS | _LAB_SLOTS
)

# Every valid *paired* combo: (day-letter segment, its matching T-segment).
# A raw two-segment slot is only ever a real theory combo if both halves
# refer to the same letter+digit — this cross-segment consistency is what
# lets us disambiguate an OCR error that's genuinely ambiguous when a
# segment is looked at on its own (e.g. "C14" is edit-distance-1 from both
# "C1" and "L14" in isolation, but paired with "TC1"/"TCC1" only "C1"
# makes it a valid combo at all).
_VALID_THEORY_PAIRS = {
    (f"{letter}{n}", f"T{letter}{n}") for letter in _DAY_LETTERS for n in (1, 2)
} | {
    (f"{letter}{n}", f"T{letter}{letter}{n}") for letter in _DOUBLED_LETTERS for n in (1, 2)
}


def _edit_distance_at_most_1(a: str, b: str) -> bool:
    """True if `a` can be turned into `b` with at most one single-character
    insertion, deletion, or substitution. Simple direct check (no DP table
    needed) since these strings are always short (<=6 chars).
    """
    if a == b:
        return True

    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False

    if la == lb:
        # substitution: must differ in exactly one position
        return sum(1 for x, y in zip(a, b) if x != y) == 1

    # one insertion/deletion apart: align the shorter against the longer,
    # allowing exactly one skipped character.
    shorter, longer = (a, b) if la < lb else (b, a)
    i = j = 0
    skipped = False
    while i < len(shorter) and j < len(longer):
        if shorter[i] == longer[j]:
            i += 1
            j += 1
        elif not skipped:
            skipped = True
            j += 1
        else:
            return False
    return True


def correct_slot_segment(segment: str) -> Tuple[str, Optional[str]]:
    """Validate one '+'-joined slot segment (e.g. "C1", "TCC1", "L26")
    against the canonical VIT-AP FFCS vocabulary.

    Returns (possibly-corrected segment, warning-or-None). The segment is
    only changed when it isn't already valid AND exactly one vocabulary
    entry is a single edit away — otherwise it's returned unchanged and a
    warning explains why nothing was corrected.
    """
    segment_upper = segment.upper()
    if segment_upper in CANONICAL_SLOT_SEGMENTS:
        return segment_upper, None

    candidates = [
        v for v in CANONICAL_SLOT_SEGMENTS if _edit_distance_at_most_1(segment_upper, v)
    ]

    if len(candidates) == 1:
        return candidates[0], None

    if len(candidates) == 0:
        return segment, (
            f"Slot segment '{segment}' does not match the known VIT-AP slot "
            f"vocabulary and could not be auto-corrected — left as-is."
        )

    return segment, (
        f"Slot segment '{segment}' is ambiguous between {sorted(candidates)} "
        f"(equally likely OCR corrections) — left as-is rather than guessing."
    )


def correct_slot_code(slot: str) -> Tuple[str, List[str]]:
    """Correct a full slot code (e.g. "C14+TCl" -> "C1+TC1").

    For a two-segment combo, correction is done *jointly*: a segment that
    looks ambiguous on its own (e.g. "C14" is one edit from both "C1" and
    "L14") is resolved using the other segment, since a real combo always
    pairs a day-letter segment with its matching T-segment (or two lab
    segments) — segments from different families never combine. Only when
    that joint search finds no single best-matching valid pair does this
    fall back to correcting each segment independently.
    """
    segments = slot.split("+")

    if len(segments) == 2 and not (segments[0].upper().startswith("L") or segments[1].upper().startswith("L")):
        joint = _correct_theory_pair(segments[0], segments[1])
        if joint is not None:
            corrected, warnings = joint
            return corrected, warnings

    warnings: List[str] = []
    corrected_segments = []
    for segment in segments:
        corrected, warning = correct_slot_segment(segment)
        corrected_segments.append(corrected)
        if warning:
            warnings.append(warning)
    return "+".join(corrected_segments), warnings


def _correct_theory_pair(seg1: str, seg2: str) -> Optional[Tuple[str, List[str]]]:
    """Try to resolve a two-segment theory combo jointly against
    `_VALID_THEORY_PAIRS`. Returns (corrected_slot, warnings) if a unique
    best-matching valid pair was found, else None (caller falls back to
    independent per-segment correction).
    """
    s1, s2 = seg1.upper(), seg2.upper()

    if (s1, s2) in _VALID_THEORY_PAIRS:
        return f"{s1}+{s2}", []

    best_pairs = []
    best_distance = None
    for p1, p2 in _VALID_THEORY_PAIRS:
        d1 = _edit_distance_value(s1, p1)
        d2 = _edit_distance_value(s2, p2)
        if d1 is None or d2 is None or d1 + d2 > 2:
            continue
        total = d1 + d2
        if best_distance is None or total < best_distance:
            best_distance = total
            best_pairs = [(p1, p2)]
        elif total == best_distance:
            best_pairs.append((p1, p2))

    if len(best_pairs) == 1:
        p1, p2 = best_pairs[0]
        return f"{p1}+{p2}", []

    return None


def _edit_distance_value(a: str, b: str) -> Optional[int]:
    """Like `_edit_distance_at_most_1` but returns 0, 1, or None (>1)."""
    if a == b:
        return 0
    if _edit_distance_at_most_1(a, b):
        return 1
    return None
