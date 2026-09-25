"""
Turns raw extracted text (from direct PDF extraction, or OCR text in
Phase 2) into structured fields: course code/name, and the list of
theory/lab slot options.

This module knows nothing about PDFs, images, or OCR — it only works on
plain text, so the exact same parsing logic is reused for both the
direct-extraction path (Phase 1) and the OCR path (Phase 2).

IMPORTANT: this module never invents a value. If a field can't be found
with reasonable confidence, it's left as None and a warning is recorded
instead of guessing.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from .models import CourseExtraction, SlotOption
from .slot_vocabulary import correct_slot_code
from .validation import FLAG_SLOT_CODE_UNCERTAIN, validate_course, validate_slot


# --- Patterns -----------------------------------------------------------

# e.g. "SWE2001", "FRL1005", "STS2009"
COURSE_CODE_RE = re.compile(r"\b([A-Z]{2,6}\d{3,5})\b")

# "SWE2001 - Introduction to Computer Networks - Embedded Theory and Lab"
COURSE_DETAIL_LINE_RE = re.compile(
    r"^\s*([A-Z]{2,6}\d{3,5})\s*-\s*(.+?)\s*-\s*(.+?)\s*$"
)

# The component field is immediately followed by the LTPJC number block
# on the same line in OCR'd text (e.g. "...Embedded Theory and Lab 30204.0
# Embedded Theory..."). Cut it off at the first run of digits so we don't
# glue unrelated trailing columns onto component_type.
COMPONENT_TRAILING_DIGITS_RE = re.compile(r"\s+\d.*$")

# The LTPJC block is 4 single digits (L T P J — each 0-9, occasionally
# OCR'd with stray spaces between them, e.g. "3 0003.0") immediately
# followed by the Credit value, which is always a one-digit decimal
# (observed: 1.0, 2.0, 3.0, 4.0). Matched against the *raw* (untrimmed)
# text captured after the course detail line's second " - ", i.e. before
# COMPONENT_TRAILING_DIGITS_RE strips this block out to get component_type.
CREDIT_INLINE_RE = re.compile(r"\b\d\s?\d\s?\d\s?\d\s?(\d(?:\.\d)?)\b")

# On the new UI's portal export, a long Course Detail cell wraps onto a
# second physical line *within the table row* — and because the LTPJC
# cell sits in the same row, Tesseract's line-by-line reading interleaves
# the wrapped leftovers of every column in that row onto one OCR text
# line (confirmed against real samples, e.g. SWE2009.pdf: row line 1 ends
# "...Embedded Theory 3020 Embedded Theory / Embedded Lab PC", row line 2
# reads "and Lab 4.0" — the Credit's decimal half landing on its own,
# separate from the LTPJ digits above it). Rather than try to fully
# reconstruct the wrapped component_type text (which mixes with a second
# wrapped column and risks being wrong), this narrowly looks for just the
# standalone Credit token on the line immediately following the course
# detail line — the one piece of information actually needed here.
CREDIT_CONTINUATION_TOKEN_RE = re.compile(r"^\d\.\d$")

# A slot code segment like "A2", "TA2", "TCC1", "L26", "TFF1"
_SLOT_SEGMENT = r"[A-Za-z]{1,4}\d{0,3}"
# A full slot value like "A2+TA2", "C2+TCC2", "L26+L27", or a bare "G1"
SLOT_TOKEN_RE = re.compile(rf"^{_SLOT_SEGMENT}(?:\+{_SLOT_SEGMENT})*$")

# Words that would otherwise match SLOT_TOKEN_RE (all-letters, <=4 chars
# per segment) but are table chrome / OCR noise, not real slot codes.
_SLOT_STOPWORDS = {
    "slot", "slots", "venue", "faculty", "available", "full", "theory",
    "lab", "labs", "course", "option", "regular", "register", "back",
    "home", "view", "edit", "nil", "all",
}

# Venue tokens seen in the source data: "G17", "504", "502B", "G10A", "121"
# Venue tokens seen in the source data. Old UI: "G17", "504", "502B",
# "G10A", "121" (bare room codes). New UI: "CB-501", "AB2-112", "CB-G15"
# (a building-code prefix, a hyphen, then a room code that can itself be
# alphanumeric) — the hyphenated form is optional so both eras match the
# same pattern rather than needing two separate regexes.
VENUE_TOKEN_RE = re.compile(r"^[A-Za-z]{0,4}\d{0,4}-?[A-Za-z]{0,3}\d{1,4}[A-Za-z]{0,2}$")

# Same l/I-vs-1 OCR confusion as slot codes shows up in venue codes too
# (e.g. "G11" misread as "Gll") — without correction, a venue token with
# no digit at all fails VENUE_TOKEN_RE and silently gets swallowed into
# the faculty name instead of being recognized as the venue.
_VENUE_LI_FIX_RE = re.compile(r"[lI]")


def normalize_venue_code(token: str) -> str:
    """Only accepted if substituting l/I -> 1 turns an otherwise-invalid
    token into one that matches the venue shape — never applied to a
    token that's already a plausible non-venue word.
    """
    if VENUE_TOKEN_RE.match(token):
        return token
    candidate = _VENUE_LI_FIX_RE.sub("1", token)
    return candidate if VENUE_TOKEN_RE.match(candidate) else token

AVAILABILITY_TOKEN_RE = re.compile(r"^(\d+|Full)$", re.IGNORECASE)

# Trailing "available seats" noise as it comes out of OCR: the source
# radio-button glyph is frequently misread as a stray "o"/"O"/"0", a
# symbol like "©"/"®"/"°"/"•", or (seen on the newer portal UI, which
# renders the radio button as an outlined circle) a "C" or "©" merged
# with a trailing parenthesis, e.g. "C)", "©)" — directly followed by
# (or merged with) the seat count, e.g. "O 67", "O41", "07", "©", "C) 69".
# Stripped from the end of a faculty-name token run — never from the
# middle, so real names (which may legitimately contain digits/
# punctuation, e.g. "Prof.Six Phrase Faculty-6") are never touched.
_TRAILING_AVAILABILITY_TOKEN_RE = re.compile(
    r"^([oO0©®°•]\)?|[Cc]\))\d*\W?$|^\d+\W?$|^Full$", re.IGNORECASE
)

TABLE_HEADER_RE = re.compile(r"^\s*slot\s+venue\s+faculty", re.IGNORECASE)

# Splits a row on 2-or-more spaces / tabs — the usual column separator when
# a PDF's text extractor preserves whitespace-based table alignment.
COLUMN_SPLIT_RE = re.compile(r"\s{2,}|\t+")

# Lab slot codes in this data are always "L<digits>", optionally combined
# ("L26+L27"). Every other slot code observed (A/B/C/D/E/F/G + their T*
# combos) is a theory slot. This is far more reliable than trying to
# detect "Theory Slots"/"Lab Slots" section-header text, which OCR often
# drops entirely (white text on a dark banner is easy to lose).
_LAB_SLOT_RE = re.compile(r"^L\d", re.IGNORECASE)

# Tesseract frequently confuses a lowercase "l"/"i" or uppercase "I" with
# the digit "1" inside slot codes (e.g. "TCCl" for "TCC1", "FI+TF1" for
# "F1+TF1", "Ci" for "C1" on the newer portal UI's font). Slot codes are
# always letters-then-digits (optionally "+"-joined segments), so an
# l/I/i immediately after a letter run, at the end of a segment, is
# unambiguously meant to be "1". This is a deterministic character-shape
# correction, not a guess at missing data.
_SLOT_LI_FIX_RE = re.compile(r"(?<=[A-Za-z])[lIi](?=\+|$)")


def normalize_slot_code(token: str) -> str:
    return _SLOT_LI_FIX_RE.sub("1", token)


def classify_slot_type(slot: str) -> str:
    """Return "lab" or "theory" based on the slot code's prefix."""
    return "lab" if _LAB_SLOT_RE.match(slot) else "theory"


def _looks_like_slot(token: str) -> bool:
    # Every real slot code observed in the source data contains at least one
    # digit (e.g. "G1", "C2+TCC2", "L26+L27"). Requiring a digit is what
    # rules out OCR noise words like "VIT", "AP", or a stray "O" (radio
    # button glyph misread as a letter) that would otherwise satisfy the
    # shape of SLOT_TOKEN_RE.
    return (
        bool(SLOT_TOKEN_RE.match(token))
        and any(ch.isdigit() for ch in token)
        and token.lower() not in _SLOT_STOPWORDS
    )


# --- Course detail --------------------------------------------------------


def extract_course_detail(
    text: str,
) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str], List[str]]:
    """Find the course code, name, component type, and credit value.

    Returns (course_code, course_name, component_type, credit, warnings).
    """
    warnings: List[str] = []
    lines = text.splitlines()

    for i, raw_line in enumerate(lines):
        line = raw_line.strip()
        if not line:
            continue
        m = COURSE_DETAIL_LINE_RE.match(line)
        if not m and line.startswith("$"):
            # OCR occasionally misreads a leading "S" as "$" (the two
            # glyphs share the same basic shape) at the very start of a
            # course code, e.g. "$TS3007" for "STS3007" — retry with that
            # one substitution rather than losing the whole line.
            m = COURSE_DETAIL_LINE_RE.match("S" + line[1:])
        if m:
            code = m.group(1)
            name = m.group(2).strip()
            raw_component = m.group(3)
            component = COMPONENT_TRAILING_DIGITS_RE.sub("", raw_component).strip()

            credit = None
            credit_match = CREDIT_INLINE_RE.search(raw_component)
            if credit_match:
                credit = credit_match.group(1)
            elif i + 1 < len(lines):
                # LTPJC block wrapped onto the row's second physical
                # line — see CREDIT_CONTINUATION_TOKEN_RE.
                for token in lines[i + 1].split():
                    if CREDIT_CONTINUATION_TOKEN_RE.match(token):
                        credit = token
                        break

            if credit is None:
                warnings.append(
                    "Found the course detail line but could not locate a "
                    "Credit value (LTPJC) near it — left unset rather than guessing."
                )

            return code, name, component or None, credit, warnings

    # Fall back to at least finding a course code on its own, so partial
    # results are still possible instead of an all-or-nothing failure.
    m = COURSE_CODE_RE.search(text)
    if m:
        warnings.append(
            "Found a course code but could not match the full "
            "'CODE - Name - Component' line; course_name left unset."
        )
        return m.group(1), None, None, None, warnings

    warnings.append("Could not locate a course detail line (code - name - component).")
    return None, None, None, None, warnings


# --- Slot table rows --------------------------------------------------------


def _strip_trailing_availability(tokens: List[str]) -> List[str]:
    """Drop trailing tokens that are leftover 'available seats' noise
    (e.g. a stray "o"/"0", "67", "O41", "Full"), without touching real
    name tokens.
    """
    tokens = list(tokens)
    while tokens and _TRAILING_AVAILABILITY_TOKEN_RE.match(tokens[-1]):
        tokens.pop()
    return tokens


def _row_from_tokens(slot: str, rest: List[str]) -> Tuple[Optional[SlotOption], List[str]]:
    # Normalize (fixes OCR's l/I <-> 1 confusion, e.g. "Gl" -> "G1") *before*
    # checking whether this looks like a real slot code — otherwise a slot
    # whose only digit got misread as a letter (like "Gl") would fail the
    # "must contain a digit" check and the whole row would be silently
    # dropped.
    normalized_slot = normalize_slot_code(slot)
    if not _looks_like_slot(normalized_slot):
        return None, []

    # Phase 3: catch OCR errors the l/I fix doesn't cover (e.g. an inserted
    # stray digit, "C14" for "C1") by validating/correcting against the
    # known VIT-AP slot vocabulary.
    corrected_slot, vocab_warnings = correct_slot_code(normalized_slot)

    rest = _strip_trailing_availability(rest)

    venue = None
    if rest:
        candidate_venue = normalize_venue_code(rest[0])
        if VENUE_TOKEN_RE.match(candidate_venue):
            venue = candidate_venue
            rest = rest[1:]

    faculty = " ".join(rest).strip() or None

    option = SlotOption(slot=corrected_slot, venue=venue, faculty=faculty)
    option.flags.extend(validate_slot(option))
    if vocab_warnings:
        # correct_slot_code only returns warnings when it left something
        # ambiguous/unmatched (a clean correction or already-valid code
        # returns no warnings) — so this is precisely "the vocabulary
        # check couldn't confidently resolve this row's slot code",
        # attached to the exact row it's about.
        option.flags.append(FLAG_SLOT_CODE_UNCERTAIN)
    return option, vocab_warnings


def _classify_row_columns(cols: List[str]) -> Tuple[Optional[SlotOption], List[str]]:
    """A row already split into whitespace-delimited columns (2+ spaces)."""
    if not cols:
        return None, []
    return _row_from_tokens(cols[0], cols[1:])


def _parse_single_space_row(line: str) -> Tuple[Optional[SlotOption], List[str]]:
    """OCR text usually collapses a whole row onto one line with single
    spaces between every word (no reliable column alignment). Try
    splitting on single spaces instead.
    """
    tokens = line.split()
    if not tokens:
        return None, []
    return _row_from_tokens(tokens[0], tokens[1:])


def _parse_slot_rows(lines: List[str]) -> Tuple[List[SlotOption], List[str]]:
    """Parse a block of lines that may contain slot-option table rows,
    handling three possible layouts seen in practice:

      1. One full row per line, columns separated by 2+ spaces/tabs
         (typical of direct PDF text extraction).
      2. One full row per line, columns separated by single spaces
         (typical of OCR output).
      3. One cell per line: slot, then venue, then faculty, ... across
         several consecutive lines.
    """
    options: List[SlotOption] = []
    warnings: List[str] = []

    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        if TABLE_HEADER_RE.match(line):
            i += 1
            continue

        cols = COLUMN_SPLIT_RE.split(line)
        row, row_warnings = _classify_row_columns(cols) if len(cols) > 1 else (None, [])

        if row is None:
            row, row_warnings = _parse_single_space_row(line)

        if row is not None:
            options.append(row)
            warnings.extend(row_warnings)
            i += 1
            continue

        # Single-cell-per-line fallback: only start a row when we see a
        # standalone slot token.
        normalized_line = normalize_slot_code(line)
        if _looks_like_slot(normalized_line):
            corrected_slot, vocab_warnings = correct_slot_code(normalized_line)
            venue = None
            faculty_parts: List[str] = []
            j = i + 1

            if j < n:
                candidate_venue = normalize_venue_code(lines[j].strip())
                if VENUE_TOKEN_RE.match(candidate_venue):
                    venue = candidate_venue
                    j += 1

            while j < n:
                nxt = lines[j].strip()
                if not nxt:
                    j += 1
                    continue
                if _looks_like_slot(normalize_slot_code(nxt)) or AVAILABILITY_TOKEN_RE.match(nxt):
                    break
                faculty_parts.append(nxt)
                j += 1

            option = SlotOption(
                slot=corrected_slot,
                venue=venue,
                faculty=" ".join(faculty_parts).strip() or None,
            )
            option.flags.extend(validate_slot(option))
            if vocab_warnings:
                option.flags.append(FLAG_SLOT_CODE_UNCERTAIN)
            options.append(option)
            warnings.extend(vocab_warnings)
            if j < n and AVAILABILITY_TOKEN_RE.match(lines[j].strip()):
                j += 1
            i = j
            continue

        i += 1

    return options, warnings


def extract_slots(text: str) -> Tuple[List[SlotOption], List[SlotOption], List[str]]:
    """Find every Theory/Lab slot option row in the text.

    Rows are classified by their slot-code prefix (lab codes always start
    with "L<digit>"), not by scanning for "Theory Slots"/"Lab Slots"
    section-header text — that text is white-on-dark-banner in the source
    documents and is frequently lost entirely by OCR, whereas the slot
    code prefix is always part of the row itself and survives OCR far
    more reliably.

    Returns (theory_slots, lab_slots, warnings).
    """
    warnings: List[str] = []

    candidate_lines = [
        line for line in text.splitlines()
        if line.strip() and not COURSE_DETAIL_LINE_RE.match(line.strip())
    ]

    all_options, row_warnings = _parse_slot_rows(candidate_lines)
    warnings.extend(row_warnings)

    theory_slots = [o for o in all_options if classify_slot_type(o.slot) == "theory"]
    lab_slots = [o for o in all_options if classify_slot_type(o.slot) == "lab"]

    if not all_options:
        warnings.append("No Theory/Lab slot rows could be parsed from this text.")

    return theory_slots, lab_slots, warnings


def parse_course_text(source_file: str, text: str) -> CourseExtraction:
    """Top-level entry point: text in, a fully populated CourseExtraction out."""
    code, name, component, credit, detail_warnings = extract_course_detail(text)
    theory_slots, lab_slots, slot_warnings = extract_slots(text)

    result = CourseExtraction(
        source_file=source_file,
        course_code=code,
        course_name=name,
        component_type=component,
        credit=credit,
        theory_slots=theory_slots,
        lab_slots=lab_slots,
        raw_text=text,
    )
    result.warnings.extend(detail_warnings)
    result.warnings.extend(slot_warnings)
    validate_course(result)
    return result
