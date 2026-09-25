"""
OCR fallback, used only for PDFs where ``pdf_reader.extract_text`` found
no usable text layer — direct text extraction is always tried first and
is strongly preferred when it works, per the project's core extraction
principle (direct extraction -> OCR fallback).

Two preprocessing strategies, picked per-page by actual OCR confidence
------------------------------------------------------------------------
The original finding (from the first UI this tool was built against) was
that colored table borders/banners sitting right next to text badly
confuse Tesseract, and that isolating near-grayscale pixels (real text)
while flattening every colored pixel to white fixed it completely — see
``_color_isolated()`` below.

When the source university portal's UI changed, that same preprocessing
started *failing* on the new export: investigation (comparing the raw
embedded screenshot against the color-isolated version) showed the new
UI's body text itself is rendered in a dark navy-slate tone, not true
black — so the color-isolation filter, built to strip colored borders,
was stripping the actual text too, since "colored border" and "colored
text" look identical to a pure R≈G≈B check. Reverting to plain grayscale
(no color-stripping at all) fixed the new UI but reintroduced the
original problem on the old one — neither strategy is safe to use
unconditionally.

Rather than hardcode a rule tied to one export tool's specific colors
(which would just break again on the next redesign), both strategies are
tried on every page and the actual Tesseract output confidence decides
the winner — see ``_pick_best_ocr_result()``. This is intentionally
UI-agnostic: it doesn't know or care what changed, only which result
Tesseract itself is more confident it read correctly.

Sideways pages
------------------------------------------------------------------------
A browser "print to PDF" of a wide page can land landscape content
rotated 90° into a portrait page (seen on one real sample file, where two
full table pages were rotated sideways and placed one above the other).
Tesseract's own orientation detection (`image_to_osd`) is used to detect
and correct this before either preprocessing strategy runs — same
reasoning as above: rather than hardcode "rotate by X", ask Tesseract
what orientation it actually thinks the text is in.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import fitz  # PyMuPDF
import numpy as np
from PIL import Image
import pytesseract

from . import parser as parser_module


OCR_DPI = 300

# Pixels where R, G, B are all within this tolerance of each other are
# treated as "grayscale" (i.e. plausibly black text or a light gray
# background) and kept; everything else (colored borders, banners,
# buttons) is flattened to white. Helps when body text is true black/gray
# and only decorative elements are colored; hurts when body text itself
# is a colored (e.g. navy-slate) tone — see module docstring.
GRAYSCALE_TOLERANCE = 20

TESSERACT_CONFIG = "--psm 6"

# Only trust Tesseract's own orientation-detection confidence enough to
# rotate a page when it clears this bar — a low-confidence OSD call on an
# already-upright page tends to still report "rotate: 0" (safe no-op),
# but a spurious *non-zero* suggestion at very low confidence is exactly
# the failure mode this threshold guards against.
MIN_TRUSTED_OSD_CONFIDENCE = 1.0


@dataclass
class OcrPageResult:
    page_number: int
    text: str
    strategy_used: str = ""  # "color_isolated" | "plain_grayscale" — for debugging


@dataclass
class OcrResult:
    file_path: str
    pages: List[OcrPageResult]

    @property
    def combined_text(self) -> str:
        return "\n".join(p.text for p in self.pages)


def _color_isolated(img: Image.Image) -> Image.Image:
    """Strip colored borders/banners/buttons, keeping only near-grayscale
    pixels (text/backgrounds that are already black/white/gray), flattened
    onto a white background.
    """
    arr = np.array(img.convert("RGB")).astype(int)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]

    is_gray = (
        (np.abs(r - g) < GRAYSCALE_TOLERANCE)
        & (np.abs(g - b) < GRAYSCALE_TOLERANCE)
        & (np.abs(r - b) < GRAYSCALE_TOLERANCE)
    )
    gray_val = ((r + g + b) / 3).astype(np.uint8)
    out = np.where(is_gray, gray_val, 255).astype(np.uint8)
    return Image.fromarray(out)


def _plain_grayscale(img: Image.Image) -> Image.Image:
    """No color stripping at all — just a plain grayscale conversion."""
    return img.convert("L")


def _correct_orientation(img: Image.Image) -> Image.Image:
    """Detect and correct a sideways/upside-down page using Tesseract's
    own orientation detection, run on a plain grayscale render (OSD looks
    at text shape, not color, so the color/plain-gray choice doesn't
    matter here). Returns the image unchanged if OSD can't determine an
    orientation at all (e.g. a near-blank page) or reports no rotation
    needed — never guesses.
    """
    try:
        osd = pytesseract.image_to_osd(img.convert("L"), output_type=pytesseract.Output.DICT)
    except pytesseract.TesseractError:
        return img  # too little text to determine orientation — leave as-is

    rotate = osd.get("rotate", 0)
    confidence = osd.get("orientation_conf", 0)

    if rotate == 0 or confidence < MIN_TRUSTED_OSD_CONFIDENCE:
        return img

    # PIL's rotate() is counter-clockwise; Tesseract's "rotate" value is
    # the clockwise correction needed, hence the sign flip.
    return img.rotate(-rotate, expand=True)


def render_page_variants(page: "fitz.Page") -> List[Tuple[str, Image.Image]]:
    """Render one PDF page to every preprocessed candidate image, paired
    with a name for each strategy. Orientation is corrected once, before
    either color strategy is applied, so both variants benefit from it.
    """
    pix = page.get_pixmap(dpi=OCR_DPI)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    img = _correct_orientation(img)
    return [
        ("color_isolated", _color_isolated(img)),
        ("plain_grayscale", _plain_grayscale(img)),
    ]


def render_page_for_ocr(page: "fitz.Page") -> Image.Image:
    """Backward-compatible single-image entry point (color-isolated
    variant only) — kept for any external/test code that wants the
    original preprocessing directly rather than the picked-best result.
    """
    return render_page_variants(page)[0][1]


def _score_ocr_output(img: Image.Image) -> Tuple[float, int, str]:
    """OCR one image and score the result: (confidence mass, word count,
    the actual text).

    "Confidence mass" is the *sum* (not average) of per-word confidence
    over every recognized word — deliberately not a plain mean. A mean
    can be fooled: a preprocessing variant that gives up on a hard region
    (e.g. an actual data table) and only confidently reads a few easy
    leftover words (page headers, a copyright line) can score a *higher*
    mean confidence than a variant that correctly read the whole table
    at slightly lower per-word confidence — this happened for real (see
    module docstring test case: SWE2006.pdf page 2, where a 13-word,
    94.7%-confidence result that missed the entire slot table nearly won
    over a 158-word, 89.7%-confidence result that got it right). Summing
    rewards actually recognizing more real content, not just being
    confident about whatever little it did recognize.
    """
    data = pytesseract.image_to_data(img, config=TESSERACT_CONFIG, output_type=pytesseract.Output.DICT)
    confidences = [
        int(conf) for conf, word in zip(data["conf"], data["text"])
        if word.strip() and int(conf) >= 0
    ]
    text = pytesseract.image_to_string(img, config=TESSERACT_CONFIG).strip()
    confidence_mass = float(sum(confidences))
    return confidence_mass, len(confidences), text


def _pick_best_ocr_result(variants: List[Tuple[str, Image.Image]]) -> Tuple[str, str]:
    """Run OCR on every preprocessing variant of a page and return
    (strategy_name, text) for the best one.

    Confidence mass is the primary signal (see `_score_ocr_output`), but
    it isn't perfect either: it's still just "how much did Tesseract
    confidently read", with no notion of *which* text actually matters.
    On a real sample (SWE2006.pdf page 0), one variant correctly read the
    single line that matters most on that kind of page — the "CODE -
    Name - Component" course detail line — while the other missed that
    line entirely but confidently read enough incidental UI button/header
    chrome ("Delete Registered", "SignOut", table headers) to *out-mass*
    it by about 1%. A generic confidence metric can't tell "the one
    important line" from "a lot of unimportant chrome" — so if exactly
    one candidate's text actually contains a recognizable course detail
    line (`parser.COURSE_DETAIL_LINE_RE`, the same pattern the real
    parser looks for), that candidate wins outright, overriding a close
    mass comparison. This only overrides on a *clear, single* match, not
    a guess: if neither or both candidates contain that line, mass alone
    still decides.
    """
    scored = [(name, *_score_ocr_output(img)) for name, img in variants]

    has_detail_line = [
        any(
            parser_module.COURSE_DETAIL_LINE_RE.match(line.strip())
            for line in text.splitlines()
        )
        for _, _, _, text in scored
    ]
    if sum(has_detail_line) == 1:
        winner = scored[has_detail_line.index(True)]
        return winner[0], winner[3]

    best_name, best_mass, best_words, best_text = max(scored, key=lambda s: s[1])
    return best_name, best_text


def ocr_pdf(file_path: str) -> OcrResult:
    """Run OCR over every page of a PDF and return the extracted text.

    Never raises for OCR-quality issues (a page that OCRs to gibberish or
    empty text is still a valid result) — it only raises if the PDF
    genuinely cannot be opened, matching the contract of
    ``pdf_reader.extract_text``.
    """
    doc = fitz.open(file_path)
    try:
        pages: List[OcrPageResult] = []
        for i, page in enumerate(doc):
            variants = render_page_variants(page)
            strategy, text = _pick_best_ocr_result(variants)
            pages.append(OcrPageResult(page_number=i, text=text, strategy_used=strategy))
        return OcrResult(file_path=file_path, pages=pages)
    finally:
        doc.close()
