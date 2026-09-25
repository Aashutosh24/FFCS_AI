"""
Builds a synthetic PDF *with a real text layer* that mimics the layout
of the real course-registration screenshots (course detail line, then
Theory Slots / Lab Slots tables).

We use this because all 8 of the real sample PDFs are pure images with
no text layer at all — so they can't exercise the direct-text parsing
logic. This fixture lets Phase 1's parser be tested properly; Phase 2
will add OCR-based tests against the real image PDFs.
"""

from __future__ import annotations

import fitz  # PyMuPDF


LINES = [
    "WINTER 2025-26 COURSE REGISTRATION",
    "",
    "SWE2001 - Introduction to Computer Networks - Embedded Theory and Lab",
    "",
    "Slot  Venue  Faculty  Available",
    "Embedded Theory Slots",
    "C2+TCC2  G17  Mohinder Singh. B  67",
    "C1+TCC1  504  Mohinder Singh. B  65",
    "F1+TFF1  G14  Tauseef Khan  54",
    "Lab Slots",
    "L26+L27  121  Prabha Selvaraj  62",
    "L8+L9  105  Surendra Reddy Vinta  58",
]


def build(path: str) -> str:
    doc = fitz.open()
    page = doc.new_page()
    point = fitz.Point(36, 36)
    text = "\n".join(LINES)
    page.insert_text(point, text, fontsize=11)
    doc.save(path)
    doc.close()
    return path
