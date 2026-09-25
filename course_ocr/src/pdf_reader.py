"""
Phase 1: direct PDF text extraction.

Some PDFs have a real text layer (selectable text) and some are just
scanned/screenshotted images with no text layer at all. This module
only handles the first case. Detecting the second case (so it can be
handed off to OCR in Phase 2) is also its job — but it does not do
any OCR itself.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

import fitz  # PyMuPDF


# Below this many non-whitespace characters per page, we treat the page as
# having "no usable text" (covers pages with just a stray watermark glyph,
# not real content).
MIN_CHARS_PER_PAGE_TO_COUNT_AS_TEXT = 20


@dataclass
class PageText:
    page_number: int  # 0-indexed
    text: str
    char_count: int


@dataclass
class PdfTextResult:
    file_path: str
    page_count: int
    pages: List[PageText]
    has_usable_text: bool

    @property
    def combined_text(self) -> str:
        """All pages concatenated in reading order.

        Tables in these documents can span a page break (a course with many
        slot options overflows onto page 2, 3, ...), so downstream parsing
        should treat this as one continuous document rather than parsing
        each page in isolation.
        """
        return "\n".join(p.text for p in self.pages)


def extract_text(file_path: str) -> PdfTextResult:
    """Extract selectable text from every page of a PDF.

    Never raises for a "no text" PDF — that's a valid, expected result
    (flagged via ``has_usable_text=False``) and is exactly what Phase 2's
    OCR fallback exists to handle. This function only raises if the file
    genuinely cannot be opened (corrupt/not a PDF).
    """
    doc = fitz.open(file_path)
    try:
        pages: List[PageText] = []
        for i, page in enumerate(doc):
            text = page.get_text().strip()
            pages.append(PageText(page_number=i, text=text, char_count=len(text)))

        has_usable_text = any(
            p.char_count >= MIN_CHARS_PER_PAGE_TO_COUNT_AS_TEXT for p in pages
        )

        return PdfTextResult(
            file_path=file_path,
            page_count=len(pages),
            pages=pages,
            has_usable_text=has_usable_text,
        )
    finally:
        doc.close()
