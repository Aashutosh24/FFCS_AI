"""
Phase 6: page preview images for the review UI.

Renders each page of a PDF to a modest-resolution JPEG, base64-encoded as
a data URI, so `output/review.html` can show the actual source page next
to the extracted data — without embedding full-resolution images (which
would make the HTML file unreasonably large) and without requiring the
reviewer to keep the original PDF/folder around after generating the
report (the HTML is fully self-contained and works offline).

This is deliberately separate from `src/ocr.py`'s page rendering: OCR
renders at 300 DPI and then strips color entirely (see
`ocr._isolate_text_pixels`) because that's what makes text recognizable
to Tesseract — a preview for a human reviewer wants the opposite: normal
colors, lower resolution, smaller file size.
"""

from __future__ import annotations

import base64
import io
from typing import List

import fitz  # PyMuPDF
from PIL import Image

PREVIEW_DPI = 110
PREVIEW_JPEG_QUALITY = 65
PREVIEW_MAX_WIDTH = 1000  # further downscaled if the rendered page exceeds this


def render_page_previews(file_path: str) -> List[str]:
    """Return one base64 JPEG data URI per page of the PDF.

    Never raises for rendering issues — a preview is a nice-to-have for
    the review UI, not part of the extraction result itself, so a
    problem generating it must never take down the actual extraction
    pipeline. Returns an empty list on any failure.
    """
    try:
        doc = fitz.open(file_path)
    except Exception:  # noqa: BLE001
        return []

    previews: List[str] = []
    try:
        for page in doc:
            try:
                previews.append(_render_one_page(page))
            except Exception:  # noqa: BLE001
                previews.append("")  # keep page-index alignment even if one page fails
    finally:
        doc.close()

    return previews


def _render_one_page(page: "fitz.Page") -> str:
    pix = page.get_pixmap(dpi=PREVIEW_DPI)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

    if img.width > PREVIEW_MAX_WIDTH:
        ratio = PREVIEW_MAX_WIDTH / img.width
        img = img.resize((PREVIEW_MAX_WIDTH, int(img.height * ratio)), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=PREVIEW_JPEG_QUALITY)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"
