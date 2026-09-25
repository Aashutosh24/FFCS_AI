import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
from PIL import Image

from src.ocr import (
    _color_isolated,
    _correct_orientation,
    _pick_best_ocr_result,
    _plain_grayscale,
    _score_ocr_output,
)

REAL_SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "real_samples")
REAL_SAMPLES_NEW_UI_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "real_samples_new_ui")


# --- _color_isolated (old-UI strategy: strip colored borders/banners) -----


def test_color_isolated_keeps_black_text_on_white():
    img = Image.new("RGB", (10, 10), "white")
    arr = np.array(img)
    arr[5, 5] = [10, 10, 10]  # a near-black "text" pixel
    img = Image.fromarray(arr)

    out = np.array(_color_isolated(img))
    assert out[5, 5] == 10


def test_color_isolated_removes_colored_border():
    img = Image.new("RGB", (10, 10), "white")
    arr = np.array(img)
    arr[0, :] = [31, 90, 153]  # a colored (non-gray) border line, like the
    # table borders/banners seen in the old-UI source PDFs
    img = Image.fromarray(arr)

    out = np.array(_color_isolated(img))
    # the colored border must be flattened to white, not left colored
    # (output is a grayscale image, so a plain 255 scalar means "white")
    assert out[0, 0] == 255


def test_color_isolated_keeps_light_gray_background():
    img = Image.new("RGB", (10, 10), "white")
    arr = np.array(img)
    arr[3, 3] = [240, 240, 240]  # light gray table-row background
    img = Image.fromarray(arr)

    out = np.array(_color_isolated(img))
    assert out[3, 3] == 240


# --- _plain_grayscale (new-UI strategy: text itself is a colored tone) ----


def test_plain_grayscale_keeps_colored_text_unlike_color_isolated():
    # The new UI's body text is a dark navy-slate tone, not true black/gray
    # — _color_isolated would wipe it (it isn't "gray" by an R≈G≈B check),
    # but _plain_grayscale must preserve it as a dark value.
    img = Image.new("RGB", (10, 10), "white")
    arr = np.array(img)
    arr[5, 5] = [20, 27, 46]  # real navy-slate text color sampled from the new UI
    img = Image.fromarray(arr)

    isolated_out = np.array(_color_isolated(img))
    plain_out = np.array(_plain_grayscale(img))

    assert isolated_out[5, 5] == 255  # wiped to white — the original bug
    assert plain_out[5, 5] < 100  # preserved as a dark pixel — the fix


# --- _correct_orientation --------------------------------------------------


def test_correct_orientation_leaves_upright_image_unchanged():
    # A blank/near-blank image gives Tesseract nothing to determine
    # orientation from — must return the image as-is, never guess a rotation.
    img = Image.new("RGB", (200, 200), "white")
    out = _correct_orientation(img)
    assert out.size == img.size


def test_correct_orientation_fixes_real_rotated_page():
    # Real, confirmed case: the new UI's STS.pdf page 0 is genuinely
    # rotated 90 degrees in the source PDF (verified by direct visual
    # inspection of the rendered page before writing this fix).
    import fitz

    doc = fitz.open(os.path.join(REAL_SAMPLES_NEW_UI_DIR, "STS.pdf"))
    page = doc[0]
    pix = page.get_pixmap(dpi=150)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    doc.close()

    corrected = _correct_orientation(img)
    # a 90-degree correction swaps width and height
    assert corrected.size == (img.size[1], img.size[0])


# --- _score_ocr_output / _pick_best_ocr_result -----------------------------


def test_pick_best_ocr_result_prefers_more_recognized_content():
    # A trivial, deliberately synthetic case: an all-white (no text) image
    # loses to one with real rendered text, regardless of which strategy
    # name is attached to which.
    blank = Image.new("RGB", (300, 100), "white")
    from PIL import ImageDraw

    with_text = Image.new("RGB", (300, 100), "white")
    d = ImageDraw.Draw(with_text)
    d.text((10, 30), "HELLO WORLD", fill="black")

    strategy, text = _pick_best_ocr_result([("blank", blank), ("with_text", with_text)])
    assert strategy == "with_text"
    assert "HELLO" in text.upper()


def test_score_ocr_output_returns_confidence_mass_word_count_and_text():
    from PIL import ImageDraw

    img = Image.new("RGB", (300, 100), "white")
    d = ImageDraw.Draw(img)
    d.text((10, 30), "TEST", fill="black")

    mass, n_words, text = _score_ocr_output(img)
    assert mass >= 0
    assert n_words >= 0
    assert isinstance(text, str)
