import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.parser import (
    classify_slot_type,
    extract_course_detail,
    extract_slots,
    normalize_slot_code,
    parse_course_text,
)


SAMPLE_TEXT = "\n".join(
    [
        "WINTER 2025-26 COURSE REGISTRATION",
        "SWE2001 - Introduction to Computer Networks - Embedded Theory and Lab 30204.0 Embedded Theory / Embedded Lab PC",
        "Slot  Venue  Faculty  Available",
        "Embedded Theory Slots",
        "C2+TCC2  G17  Mohinder Singh. B  67",
        "C1+TCC1  504  Mohinder Singh. B  65",
        "F1+TFF1  G14  Tauseef Khan  54",
        "Lab Slots",
        "L26+L27  121  Prabha Selvaraj  62",
        "L8+L9  105  Surendra Reddy Vinta  58",
    ]
)

THEORY_ONLY_TEXT = "\n".join(
    [
        "FRL1005 - German for Beginners - Theory Only 20002.0 Theory Only UC",
        "Slot  Venue  Faculty  Available",
        "Theory Slots",
        "G1  102  Renuprasad Hemkiran Patki  43",
        "G2  G10A  Renuprasad Hemkiran Patki  41",
        "F1  112  Renuprasad Hemkiran Patki  Full",
    ]
)


def test_extract_course_detail_full_match():
    code, name, component, credit, warnings = extract_course_detail(SAMPLE_TEXT)
    assert code == "SWE2001"
    assert name == "Introduction to Computer Networks"
    assert component == "Embedded Theory and Lab"
    assert credit == "4.0"
    assert warnings == []


def test_extract_course_detail_missing_returns_none_not_guess():
    code, name, component, credit, warnings = extract_course_detail("no course info here at all")
    assert code is None
    assert name is None
    assert component is None
    assert credit is None
    assert warnings  # a warning should be recorded


def test_extract_slots_theory_and_lab():
    theory, lab, warnings = extract_slots(SAMPLE_TEXT)

    assert len(theory) == 3
    assert theory[0].slot == "C2+TCC2"
    assert theory[0].venue == "G17"
    assert theory[0].faculty == "Mohinder Singh. B"

    assert len(lab) == 2
    assert lab[0].slot == "L26+L27"
    assert lab[0].venue == "121"
    assert lab[0].faculty == "Prabha Selvaraj"


def test_extract_slots_theory_only_course():
    theory, lab, warnings = extract_slots(THEORY_ONLY_TEXT)

    assert len(theory) == 3
    assert theory[2].slot == "F1"
    assert theory[2].venue == "112"
    assert theory[2].faculty == "Renuprasad Hemkiran Patki"
    assert lab == []


def test_slot_plus_combo_preserved_not_split():
    theory, _, _ = extract_slots(SAMPLE_TEXT)
    # "A2 + TA2" style combined slots must stay as one value, not be split
    # into separate fields or lose the "+".
    assert theory[0].slot == "C2+TCC2"
    assert "+" in theory[0].slot


def test_parse_course_text_end_to_end():
    result = parse_course_text("SWE2001.pdf", SAMPLE_TEXT)
    assert result.course_code == "SWE2001"
    assert result.course_name == "Introduction to Computer Networks"
    assert result.credit == "4.0"
    assert len(result.theory_slots) == 3
    assert len(result.lab_slots) == 2
    assert result.error is None


def test_parse_course_text_never_fabricates_on_empty_input():
    result = parse_course_text("empty.pdf", "")
    assert result.course_code is None
    assert result.course_name is None
    assert result.theory_slots == []
    assert result.lab_slots == []
    assert result.warnings  # should explain why nothing was found


# --- Phase 2 additions: OCR-text robustness --------------------------------


def test_classify_slot_type_lab_vs_theory():
    assert classify_slot_type("L26+L27") == "lab"
    assert classify_slot_type("L8+L9") == "lab"
    assert classify_slot_type("l4+l5") == "lab"  # case-insensitive
    assert classify_slot_type("C2+TCC2") == "theory"
    assert classify_slot_type("G1") == "theory"


def test_normalize_slot_code_fixes_l_i_digit_confusion():
    # Tesseract commonly misreads the digit "1" as a lowercase l or
    # uppercase I right after a letter run, at the end of a slot segment.
    assert normalize_slot_code("Gl") == "G1"
    assert normalize_slot_code("Fl") == "F1"
    assert normalize_slot_code("TCCl") == "TCC1"
    assert normalize_slot_code("FI+TF1") == "F1+TF1"
    # must not touch already-correct codes
    assert normalize_slot_code("C2+TCC2") == "C2+TCC2"
    assert normalize_slot_code("L26+L27") == "L26+L27"


def test_extract_slots_handles_single_space_ocr_style_rows():
    # OCR output rarely preserves multi-space column alignment — rows come
    # out with single spaces between every field, like: "G1 102 Renuprasad
    # Hemkiran Patki O 41" (trailing "O 41" is misread availability noise).
    ocr_text = "\n".join(
        [
            "FRL1005 - German for Beginners - Theory Only 20002.0 Theory Only UC",
            "Gl 102 Renuprasad Hemkiran Patki O 43",
            "G2 G10A Renuprasad Hemkiran Patki O41",
            "Fl 112 Renuprasad Hemkiran Patki Full",
        ]
    )
    theory, lab, warnings = extract_slots(ocr_text)

    assert len(theory) == 3
    assert theory[0].slot == "G1"  # normalized from "Gl"
    assert theory[0].venue == "102"
    assert theory[0].faculty == "Renuprasad Hemkiran Patki"
    assert theory[2].slot == "F1"  # normalized from "Fl"
    assert theory[2].faculty == "Renuprasad Hemkiran Patki"
    assert lab == []


def test_extract_slots_ignores_ocr_noise_words_without_digits():
    # Header chrome and stray glyphs ("VIT", "AP", a misread "O" for the
    # radio-button icon) must never be treated as slot rows — a real slot
    # code always contains a digit.
    ocr_text = "\n".join(
        [
            "VIT-AP  WINTER 2025-26 COURSE REGISTRATION",
            "VIT - AP CAMPUS",
            "FRL1005 - German for Beginners - Theory Only",
            "G1 102 Renuprasad Hemkiran Patki O 43",
            "O",
        ]
    )
    theory, lab, warnings = extract_slots(ocr_text)
    assert len(theory) == 1
    assert theory[0].slot == "G1"


# --- Phase 3 additions: venue normalization & vocabulary correction ------


def test_extract_slots_recovers_venue_with_li_confusion():
    # Real OCR output from STS.pdf: "G11" (a real room) was misread as
    # "Gll", which has no digit and would otherwise fail the venue check
    # and get folded into the faculty name instead.
    ocr_text = "\n".join(
        [
            "STS2009 - Arithmetic Problem Solving Skills - Theory Only",
            "G1+TG1 Gll Prof Musthaq O 98",
        ]
    )
    theory, _, _ = extract_slots(ocr_text)
    assert len(theory) == 1
    assert theory[0].venue == "G11"
    assert theory[0].faculty == "Prof Musthaq"


def test_extract_slots_applies_vocabulary_correction_to_slot_code():
    # Real OCR output from SWE2001.pdf.
    ocr_text = "\n".join(
        [
            "SWE2001 - Introduction to Computer Networks - Embedded Theory and Lab",
            "C14+TCl 514 Asish Kumar Dalai O 30",
        ]
    )
    theory, _, _ = extract_slots(ocr_text)
    assert len(theory) == 1
    assert theory[0].slot == "C1+TC1"
    assert theory[0].venue == "514"


def test_extract_slots_strips_stray_symbol_noise_from_faculty():
    ocr_text = "\n".join(
        [
            "STS2009 - Arithmetic Problem Solving Skills - Theory Only",
            "B1+TB1 G17 Prof.Six Phrase Faculty-6 ©",
        ]
    )
    theory, _, _ = extract_slots(ocr_text)
    assert len(theory) == 1
    assert theory[0].faculty == "Prof.Six Phrase Faculty-6"


# --- Credit (LTPJC) extraction ---------------------------------------------


def test_extract_course_detail_credit_inline_old_ui():
    # Old UI: the full LTPJC block, including the Credit digit, sits on
    # the same physical line as the course detail — e.g. "20002.0" is
    # L=2 T=0 P=0 J=0 C=2.0.
    text = "FRL1005 - German for Beginners - Theory Only 20002.0 Theory Only UC"
    code, name, component, credit, warnings = extract_course_detail(text)
    assert credit == "2.0"
    assert warnings == []


def test_extract_course_detail_credit_inline_with_stray_spaces():
    # Real OCR output sometimes inserts a stray space inside the LTPJC
    # digit run (e.g. "3 0003.0" for SWE2002.pdf, "3002 4.0" for
    # SWE2004.pdf) — both must still resolve to the correct Credit.
    code, name, component, credit, warnings = extract_course_detail(
        "SWE2002 - Human Computer Interaction - Theory Only 3 0003.0 Theory Only PE"
    )
    assert credit == "3.0"

    code, name, component, credit, warnings = extract_course_detail(
        "SWE2004 - Software Design and Architecture - Embedded Theory and Project 3002 4.0 Embedded Theory / Embedded Project PC"
    )
    assert credit == "4.0"


def test_extract_course_detail_credit_wrapped_to_next_line_new_ui():
    # New UI: a long Course Detail cell wraps within the table row, and
    # Tesseract's line-by-line reading interleaves the wrapped LTPJC
    # cell's Credit value onto the following OCR text line, separate from
    # the L T P J digits above it. Real example from SWE2009.pdf.
    text = "\n".join(
        [
            "SWE2009 - Analysis of Algorithms - Embedded Theory 3020 Embedded Theory / Embedded Lab PC",
            "and Lab 4.0",
        ]
    )
    code, name, component, credit, warnings = extract_course_detail(text)
    assert code == "SWE2009"
    assert credit == "4.0"
    assert warnings == []


def test_extract_course_detail_credit_wrapped_real_swe3002_case():
    # Real example from SWE3002.pdf — the continuation line also contains
    # leftover text from a *different* wrapped column ("Project" at the
    # end, from the Course Type cell) after the Credit token. The Credit
    # must still be found correctly without being confused by that
    # trailing text.
    text = "\n".join(
        [
            "SWE3002 - Software Project Management - Embedded 3002 Embedded Theory / Embedded PC",
            "Theory and Project 4.0 Project",
        ]
    )
    code, name, component, credit, warnings = extract_course_detail(text)
    assert code == "SWE3002"
    assert credit == "4.0"


def test_extract_course_detail_credit_not_found_leaves_none_with_warning():
    # No LTPJC-shaped block anywhere near the detail line — must not
    # guess a credit value.
    text = "\n".join(
        [
            "SWE2001 - Introduction to Computer Networks - Embedded Theory and Lab",
            "Slot  Venue  Faculty  Available",
        ]
    )
    code, name, component, credit, warnings = extract_course_detail(text)
    assert credit is None
    assert any("Credit" in w for w in warnings)


def test_parse_course_text_credit_reaches_course_extraction_result():
    result = parse_course_text("German.pdf", THEORY_ONLY_TEXT)
    assert result.credit == "2.0"
