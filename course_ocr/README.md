# Course PDF Extraction Tool

Extracts course name, credit, and all available Theory/Lab slot options
(slot code, venue, faculty) from a batch of course-registration PDFs,
with an interactive review UI for checking the results.

## Current phase

**Phase 7 — portal UI change response + credit extraction.** The
university's registration portal was redesigned partway through this
project. This phase made the tool work against *both* the original and
the redesigned portal exports — not by detecting which one a file is,
but by making the OCR/parsing pipeline genuinely robust to either — and
added Credit extraction (the "C" in LTPJC), which the user wants for
classifying courses.

## Background

The source PDFs are screenshots of a university course registration
portal, exported to PDF, always 100% raster images (no selectable text
layer). Two portal generations have been seen:

- **Original UI** (`Slot.zip`, `tests/fixtures/real_samples/`): dark-blue
  table borders/banners next to plain black text.
- **Redesigned UI** (`SLOT_.zip`, `tests/fixtures/real_samples_new_ui/`):
  a full browser print-to-PDF (URL bar, timestamp, page number in the
  margins) with body text rendered in a dark navy-slate tone rather than
  true black, table rows that can wrap onto a second physical line, and
  at least one real sample page that's genuinely rotated 90 degrees.

Each portal generation also produces PDFs this tool is not meant to
parse as a course: the user's own final registered timetable
(`Mrng.pdf` / `TT.pdf`) and, new in the redesigned UI, a course
catalog/browse listing (`HUMAN_1.pdf`, `HUMAN_2.pdf` -- multiple courses
with an AVAILABLE/REGISTERED status column, no slot table at all). All
three are out of scope by design (confirmed with the user) and are
excluded, not force-parsed.

## What Phase 7 fixed

### 1. OCR broke completely on the redesigned UI

The original OCR preprocessing (`_color_isolated` -- strip every colored
pixel, keep only near-black/gray text) was built because the original
UI's colored borders confused Tesseract. On the redesigned UI, that same
filter wiped out the actual body text too, because that text itself is a
colored (navy-slate) tone -- "colored border" and "colored text" look
identical to a plain R-approx-G-approx-B check. Reverting to plain
grayscale fixed the redesigned UI but broke the original one again.

**Fix:** `src/ocr.py` now renders *two* preprocessed variants of every
page -- `_color_isolated` and `_plain_grayscale` -- runs Tesseract on
both, and picks the result that actually recognized more content, more
confidently. This is intentionally UI-agnostic: it doesn't know or care
which portal generation a file is from, only which OCR result Tesseract
itself trusts more. Getting the scoring right took two iterations:

- Mean confidence alone let a variant that recognized *fewer* words "win"
  by being smugly confident about easy leftovers (page headers, button
  labels) while missing the real table -- switched to **summed**
  confidence ("mass"), which rewards recognizing more real content.
- Even that failed once on a genuinely close case (SWE2006.pdf page 0):
  two variants within about 1% of each other, where the loser had
  correctly read the one line that matters -- the "CODE - Name -
  Component" course detail line -- but lost by a hair to a variant that
  only read UI button chrome. Fixed by giving a variant outright priority
  if it's the *only* one whose text contains a real, regex-matched course
  detail line (reusing `parser.COURSE_DETAIL_LINE_RE`, the same pattern
  the parser itself looks for) -- tying OCR selection to the same domain
  knowledge the rest of the pipeline uses, not a generic score.

Verified by re-running the entire original 8-file batch after this
change and confirming it produces the exact same 5 clean / 2 review / 1
excluded result as before -- this was a real regression during
development, caught and fixed before shipping, not assumed safe.

### 2. Sideways pages

One real sample (`STS.pdf` in the redesigned UI) is genuinely rotated 90
degrees in the source PDF -- confirmed by direct visual inspection, not
inferred. `src/ocr.py` now runs Tesseract's orientation detection (OSD)
on each page and rotates it upright before the main OCR pass, only
acting when OSD's own confidence clears a threshold (never guessing a
rotation).

### 3. Two new out-of-scope document shapes

The redesigned UI's course catalog listing (`HUMAN_1/2.pdf`) is a
different document shape from the timetable summary (`Mrng.pdf`/
`TT.pdf`) -- both are excluded, but `src/pipeline.py` now gives each a
distinct, specific reason (`_excluded_reason()`) instead of one generic
message, since they're different things for different reasons.

### 4. Credit extraction

The "C" in the portal's `LTPJC` column (e.g. `20002.0` = L2 T0 P0 J0
C2.0) was previously discarded entirely. `extract_course_detail()` in
`src/parser.py` now extracts it as `course.credit`, kept as the exact
string shown on the portal (e.g. `"4.0"`) -- never cast to float, so
nothing is silently rounded. Handles two real layouts:

- **Inline** (original UI): the whole LTPJC block is on the course
  detail line itself, sometimes with a stray OCR-inserted space (e.g.
  `"3 0003.0"`, `"3002 4.0"` -- both still resolve correctly).
- **Wrapped onto the next line** (redesigned UI): a long Course Detail
  cell wraps within the table row, and Tesseract's line-by-line reading
  interleaves the wrapped LTPJC cell's Credit value onto its own,
  separate line (confirmed against two real files, `SWE2009.pdf` and
  `SWE3002.pdf` -- the second case has *another* wrapped column's
  leftover text on the same continuation line, and the fix correctly
  ignores it).

Never guesses: if no credit-shaped token is found inline or on the
immediately-following line, `credit` stays `None` with an explicit
warning, and `credit` joins `missing_fields`. This happens for real on
one sample (`STS.pdf`'s LTPJC text OCR'd too badly to recover a digit --
confirmed by inspecting the raw OCR text, not assumed) -- that file
correctly reports `credit: null` rather than a fabricated value.

`credit` is surfaced everywhere the other fields are: `results.json`,
a new `credit` column in `results.csv`, and both the sidebar and detail
header of `review.html`.

## Features completed

**Phases 1-6:** see prior README versions / phase ZIPs for full detail --
project structure; direct-text extraction with OCR fallback; OCR-error
correction against a validated VIT-AP slot-code vocabulary; per-row/
per-course confidence with a `review_queue.txt` report; direct `.zip`
input; the interactive `review.html` UI.

**Phase 7 (this phase):**
- `src/ocr.py`: dual preprocessing strategies with confidence-mass +
  course-detail-line-aware selection; OSD-based orientation correction.
- `src/pipeline.py`: `_excluded_reason()` replaces the old single-purpose
  registration-summary detector, now distinguishing timetable-summary
  pages from course-catalog pages.
- `src/parser.py` / `src/models.py` / `src/validation.py`: `credit`
  field extraction, storage, and missing-field detection.
- `src/output_writer.py` / `src/review_ui.py`: `credit` surfaced in CSV
  and the review UI.
- New test fixtures: `tests/fixtures/real_samples_new_ui/` (11 real
  redesigned-UI PDFs) and `tests/fixtures/SLOT_new_ui.zip` (the actual
  uploaded archive), mirroring the existing original-UI fixture pattern.
- New/updated tests: `tests/test_new_ui.py` (ground truth for all 11
  redesigned-UI files, both exclusion reasons, and the redesigned-UI
  zip), `tests/test_ocr.py` rewritten against the current dual-strategy
  API, plus credit-specific tests added to `test_parser.py`,
  `test_validation.py`, `test_output_writer.py`, `test_review_ui.py`,
  and `test_pipeline.py`.
- **80 tests total, all passing** (56 fast + 21 original-UI OCR + 3
  redesigned-UI OCR -- split across separate runs during development
  because the full real-OCR suite runs long, but every one has been
  confirmed green).

## Installation

```bash
pip install -r requirements.txt
```

Plus the Tesseract OCR engine on `PATH` (not a pip package) -- see
`requirements.txt` comments; the default English language data is
sufficient for both portal UI generations.

## How to run

```bash
python -m src.main <input_path> [--out-dir output] [--include-raw-text]
```

`<input_path>` can be a folder of PDFs or a `.zip` archive -- works the
same regardless of which portal UI generation the PDFs came from:

```bash
python -m src.main Slot.zip --out-dir output
```

Then open `output/review.html` in a browser.

### Run tests

```bash
python -m pytest tests/ -v
```

Real OCR runs throughout, against real PDFs from both portal
generations -- this takes a while (tens of minutes for the full suite).
If running interactively, consider splitting by file, e.g.
`pytest tests/test_parser.py tests/test_validation.py -q` for the fast,
non-OCR checks first.

## Input / output format

Unchanged shape from Phase 4-6, with `credit` added alongside
`component_type` in `results.json`, `results.csv`, and `review.html`.

## Known limitations

- **Credit extraction has the same "left unset rather than guessed"
  philosophy as everything else in this tool** -- on badly-OCR'd pages
  (rare, but real -- see `STS.pdf` above) it will correctly report
  `credit: null` instead of a wrong number. This is safer for a
  classification workflow than a silently-wrong credit value would be,
  but it does mean occasional pages need a 5-second manual check in
  `review.html`.
- **The dual-OCR-strategy approach doubles OCR work per page** (both
  variants are always tried) -- a reasonable trade for correctness on
  course-registration-sized batches, not tuned for very large volumes.
- Everything from prior phases' known limitations still applies (a
  handful of genuinely ambiguous slot-code corrections are left as-is
  with a `slot_code_uncertain` flag; row parsing is pattern-based, not
  full layout-aware table recognition; `review.html` has no
  write-back-to-source mechanism).

## Next phase

No further phases are currently planned by the user. If the portal UI
changes again, `src/ocr.py`'s dual-strategy-plus-confidence-mass
approach is designed to need no changes -- but if OCR quality regresses
again, start by comparing `_color_isolated` vs `_plain_grayscale` output
on a sample page directly (as this phase's investigation did) before
assuming the existing fix is at fault.
