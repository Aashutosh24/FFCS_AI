import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.slot_vocabulary import CANONICAL_SLOT_SEGMENTS, correct_slot_code, correct_slot_segment


def test_valid_segments_are_left_unchanged():
    for seg in ["C1", "TC1", "TCC1", "L26", "A2", "TA2"]:
        corrected, warning = correct_slot_segment(seg)
        assert corrected == seg
        assert warning is None


def test_inserted_digit_error_corrected_via_pairing_context():
    # "C14+TCl" is the actual OCR output seen on a real sample PDF for
    # what should be "C1+TC1". "C14" alone is ambiguous (equally one edit
    # from "C1" and "L14"), but paired with "TCl" (-> "TC1") the joint
    # search resolves it correctly.
    corrected, warnings = correct_slot_code("C14+TCl")
    assert corrected == "C1+TC1"
    assert warnings == []


def test_isolated_ambiguous_segment_is_left_as_is_with_warning():
    # With no pairing context to disambiguate, "C14" alone must not be
    # guessed — the tool should say so rather than silently pick one.
    corrected, warning = correct_slot_segment("C14")
    assert corrected == "C14"
    assert warning is not None
    assert "ambiguous" in warning


def test_completely_unrecognizable_segment_is_left_as_is_with_warning():
    corrected, warning = correct_slot_segment("ZZZ99")
    assert corrected == "ZZZ99"
    assert warning is not None


def test_lab_combo_not_affected_by_theory_pairing_logic():
    corrected, warnings = correct_slot_code("L26+L27")
    assert corrected == "L26+L27"
    assert warnings == []


def test_vocabulary_has_no_duplicates_between_theory_and_lab():
    theory = {s for s in CANONICAL_SLOT_SEGMENTS if not s.startswith("L")}
    lab = {s for s in CANONICAL_SLOT_SEGMENTS if s.startswith("L")}
    assert theory & lab == set()
    assert len(lab) == 60
