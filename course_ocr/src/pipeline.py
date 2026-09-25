"""
Orchestrates the pipeline for one or many PDFs, from either a folder or a
ZIP archive:

    folder/.zip -> discover PDFs -> direct text extraction -> if
    insufficient -> OCR -> field parsing -> validation

Direct text extraction is always tried first (cheap, exact) and OCR is
used only as a fallback when a PDF has no usable text layer at all —
matching the project's core extraction principle. This isn't just a
performance shortcut: it also means a future PDF that *does* have a real
text layer skips OCR entirely and gets exact results.

A single bad/corrupt PDF — or, for `process_zip`, a corrupt ZIP member
or the archive itself being unreadable — must never stop the rest of the
batch from being processed. Every failure is caught and recorded on that
file's result instead of raising, all the way from a single PDF up
through a whole ZIP archive.
"""

from __future__ import annotations

import os
import re
import tempfile
import zipfile
from typing import List

from . import ocr, pdf_reader, preview
from .models import CourseExtraction
from .parser import parse_course_text
from .validation import validate_course

# Marks a "registered courses" summary/timetable page (e.g. the project's
# original Mrng.pdf, or its new-UI equivalent TT.pdf) rather than a single
# course's detail+slot-options page. Confirmed with the user: this tool's
# scope is the per-course slot-options pages, and a registration summary
# is a different document shape entirely (many courses, only the chosen
# slot each, plus a timetable grid) that would otherwise get mangled by
# the course-detail parser. Detected by content, not filename, so it
# isn't tied to one file's name or one portal UI version — "REGISTERED
# COURSE"/"REGISTERED CREDIT" matched the old UI's summary page; "Time
# Table" plus the "highlighted with a green background" caption is the
# new UI's equivalent grid view (confirmed by inspecting TT.pdf directly:
# it's the same personal timetable, just a different page layout).
_REGISTRATION_SUMMARY_MARKER_RE = re.compile(
    r"REGISTERED\s+COURSE|REGISTERED\s+CREDIT"
    r"|Time\s+Table.{0,80}(highlighted|background)",
    re.IGNORECASE | re.DOTALL,
)

# Marks a course *catalog/browse* listing (many courses with a STATUS
# column like "AVAILABLE"/"REGISTERED", no Slot/Venue/Faculty table at
# all) rather than one course's detail+slot-options page — a third
# document shape seen in the new UI (e.g. HUMAN_1.pdf, HUMAN_2.pdf).
# There is nothing for this tool to extract from this page shape (no
# slots exist on it to find), so it's excluded with a distinct reason
# rather than silently reported as "0 slots found" on a page that was
# never going to have any.
_COURSE_CATALOG_MARKER_RE = re.compile(
    r"PRE-REQUISITE.{0,40}CO-REQUISITE.{0,40}ANTI-REQUISITE", re.IGNORECASE | re.DOTALL
)


def _excluded_reason(text: str) -> "str | None":
    if _REGISTRATION_SUMMARY_MARKER_RE.search(text):
        return (
            "this looks like a 'registered courses' summary/timetable page "
            "(e.g. Mrng.pdf / TT.pdf), not a single course's detail+slot-options "
            "page. This tool's scope is per-course slot listings, so this file "
            "was not parsed as a course — confirmed project decision, not an error."
        )
    if _COURSE_CATALOG_MARKER_RE.search(text):
        return (
            "this looks like a course catalog/browse listing (multiple courses "
            "with a STATUS column), not a single course's detail+slot-options "
            "page. There are no Slot/Venue/Faculty rows on this kind of page to "
            "extract — confirmed project decision, not an error."
        )
    return None


def process_file(file_path: str) -> CourseExtraction:
    """Process a single PDF. Never raises — errors are captured on the result.

    Every return path funnels through `validate_course()` (below) so
    `confidence`/`missing_fields` are always populated, including on the
    error and excluded-file paths — `parse_course_text` already does this
    for successfully-parsed results, but this wrapper guarantees it holds
    for every path without having to remember to call it at each of the
    several early-return sites in this function.
    """
    return validate_course(_process_file_uncomputed(file_path))


def _process_file_uncomputed(file_path: str) -> CourseExtraction:
    """Runs the actual extraction logic, then attaches page previews to
    whatever result comes back — a single choke point so every return
    path (success, OCR, excluded, or error) gets a preview without having
    to remember to attach it at each of the several early-return sites
    inside `_extract(...)`, mirroring how `process_file` funnels every
    path through `validate_course()`.
    """
    result = _extract(file_path)
    result.page_previews = preview.render_page_previews(file_path)
    return result


def _extract(file_path: str) -> CourseExtraction:
    source_file = os.path.basename(file_path)

    try:
        text_result = pdf_reader.extract_text(file_path)
    except Exception as exc:  # noqa: BLE001 - deliberately broad: one bad file must not kill the batch
        result = CourseExtraction(source_file=source_file)
        result.error = f"Failed to open/read PDF: {exc}"
        return result

    if text_result.has_usable_text:
        reason = _excluded_reason(text_result.combined_text)
        if reason:
            return _excluded_result(source_file, text_result.page_count, reason)
        try:
            result = parse_course_text(source_file, text_result.combined_text)
            result.pages = text_result.page_count
            return result
        except Exception as exc:  # noqa: BLE001
            result = CourseExtraction(source_file=source_file, pages=text_result.page_count)
            result.error = f"Failed to parse extracted text: {exc}"
            return result

    # No usable text layer -> fall back to OCR.
    try:
        ocr_result = ocr.ocr_pdf(file_path)
    except Exception as exc:  # noqa: BLE001
        result = CourseExtraction(source_file=source_file, pages=text_result.page_count)
        result.needs_ocr = True
        result.error = f"OCR failed: {exc}"
        return result

    reason = _excluded_reason(ocr_result.combined_text)
    if reason:
        return _excluded_result(source_file, text_result.page_count, reason, needs_ocr=True)

    try:
        result = parse_course_text(source_file, ocr_result.combined_text)
        result.pages = text_result.page_count
        result.needs_ocr = True  # accurate record of how this result was produced
        if not result.course_name and not result.theory_slots and not result.lab_slots:
            result.warnings.append(
                "OCR ran but nothing usable was parsed from its output — "
                "check raw_text (--include-raw-text) to see what OCR actually saw."
            )
        return result
    except Exception as exc:  # noqa: BLE001
        result = CourseExtraction(source_file=source_file, pages=text_result.page_count)
        result.needs_ocr = True
        result.error = f"Failed to parse OCR text: {exc}"
        return result


def _excluded_result(
    source_file: str, page_count: int, reason: str, needs_ocr: bool = False
) -> CourseExtraction:
    result = CourseExtraction(source_file=source_file, pages=page_count, needs_ocr=needs_ocr)
    result.warnings.append(f"Excluded: {reason}")
    return result


def process_folder(folder_path: str) -> List[CourseExtraction]:
    """Process every PDF found under a folder, recursively. One bad PDF
    does not stop the rest of the batch.

    Recursive (not just top-level) because a ZIP's contents are commonly
    wrapped in a subfolder once extracted (e.g. this project's own
    ``Slot.zip`` extracts to ``Slot/*.pdf``, not flat files) — the
    Phase 1-4 folder-only version only looked at the top level, which
    would have silently processed zero files against a real zip export.
    """
    results: List[CourseExtraction] = []

    if not os.path.isdir(folder_path):
        raise NotADirectoryError(f"Not a directory: {folder_path}")

    pdf_paths = sorted(_find_pdfs_recursive(folder_path))

    for full_path in pdf_paths:
        results.append(process_file(full_path))

    return results


def _find_pdfs_recursive(folder_path: str) -> List[str]:
    found: List[str] = []
    for root, _dirs, files in os.walk(folder_path):
        for fname in files:
            if fname.lower().endswith(".pdf"):
                found.append(os.path.join(root, fname))
    return found


def process_zip(zip_path: str) -> List[CourseExtraction]:
    """Process every PDF inside a ZIP archive. One bad PDF — or the ZIP
    itself being unreadable/corrupt — never silently loses the rest of
    the batch: a ZIP that can't be opened at all returns a single-item
    result list carrying the error, exactly like a single bad PDF does
    in `process_file`, rather than raising and losing all context about
    what was attempted.

    The archive is extracted to a temporary directory (cleaned up
    afterwards) and then handed to `process_folder`, so ZIP handling adds
    no separate parsing logic to maintain — it's the same recursive
    folder walk plus per-file isolation already used for a plain folder.
    """
    source_name = os.path.basename(zip_path)

    if not zipfile.is_zipfile(zip_path):
        result = CourseExtraction(source_file=source_name)
        result.error = f"Not a valid ZIP file: {zip_path}"
        return [validate_course(result)]

    with tempfile.TemporaryDirectory(prefix="course_ocr_zip_") as tmp_dir:
        try:
            with zipfile.ZipFile(zip_path) as zf:
                _safe_extract_pdfs(zf, tmp_dir)
        except Exception as exc:  # noqa: BLE001 - a corrupt archive must not crash the whole run
            result = CourseExtraction(source_file=source_name)
            result.error = f"Failed to extract ZIP: {exc}"
            return [validate_course(result)]

        return process_folder(tmp_dir)


def _safe_extract_pdfs(zf: "zipfile.ZipFile", dest_dir: str) -> None:
    """Extract only .pdf members, guarding against "zip slip" path
    traversal (a malicious/corrupt entry name like "../../etc/passwd")
    by resolving each member's destination path and refusing to write
    outside `dest_dir`. Non-PDF members (READMEs, .DS_Store, nested
    folders that are just directory entries, etc.) are silently skipped
    — only PDFs are this tool's concern.
    """
    dest_root = os.path.realpath(dest_dir)

    for member in zf.infolist():
        if member.is_dir():
            continue
        if not member.filename.lower().endswith(".pdf"):
            continue

        target_path = os.path.realpath(os.path.join(dest_dir, member.filename))
        if not (target_path == dest_root or target_path.startswith(dest_root + os.sep)):
            continue  # zip-slip attempt or otherwise escapes the extraction dir — skip it

        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        with zf.open(member) as src, open(target_path, "wb") as dst:
            dst.write(src.read())


def process_input(input_path: str) -> List[CourseExtraction]:
    """Single entry point for the CLI: accepts either a folder of PDFs or
    a .zip archive of PDFs and dispatches to the right pipeline. Detected
    by file extension for a `.zip`, falling back to "is it a directory"
    otherwise — mirrors how a person would describe what they're pointing
    the tool at, rather than requiring a separate flag.
    """
    if os.path.isfile(input_path) and input_path.lower().endswith(".zip"):
        return process_zip(input_path)
    if os.path.isdir(input_path):
        return process_folder(input_path)
    raise FileNotFoundError(
        f"Input path is neither a folder nor a .zip file: {input_path}"
    )
