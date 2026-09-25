"""
CLI entrypoint.

Usage:
    python -m src.main <input_path> [--out-dir output] [--include-raw-text]

<input_path> can be either a folder containing PDFs, or a .zip archive
of PDFs — auto-detected from the path (a folder is walked recursively;
inside a ZIP, "Slot.zip" wrapping everything in a "Slot/" subfolder,
which is what a real export from this project looks like, is handled
the same way).

Processes every PDF found and writes:
    output/results.json         full nested results (every field)
    output/results.csv          one row per slot option, flat
    output/review_queue.txt     short report: only what needs a human glance
    output/review.html          interactive review UI (open in a browser)

A short summary (parsed via text/OCR, excluded, errored, needs review) is
printed to stdout so it's obvious at a glance what happened, without having
to open the output files.
"""

from __future__ import annotations

import argparse
import sys

from .pipeline import process_input
from .output_writer import write_csv, write_json, write_review_queue
from .review_ui import write_review_html
from .validation import CONFIDENCE_ERROR, CONFIDENCE_EXCLUDED, CONFIDENCE_OK, CONFIDENCE_REVIEW


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Course PDF slot extraction")
    parser.add_argument("input_path", help="Folder of PDFs, or a .zip archive of PDFs")
    parser.add_argument("--out-dir", default="output", help="Directory to write results into")
    parser.add_argument(
        "--include-raw-text",
        action="store_true",
        help="Include the raw extracted text of each PDF in the JSON output (debugging aid)",
    )
    args = parser.parse_args(argv)

    results = process_input(args.input_path)

    json_path = f"{args.out_dir}/results.json"
    csv_path = f"{args.out_dir}/results.csv"
    review_path = f"{args.out_dir}/review_queue.txt"
    html_path = f"{args.out_dir}/review.html"
    write_json(results, json_path, include_raw_text=args.include_raw_text)
    write_csv(results, csv_path)
    write_review_queue(results, review_path)
    write_review_html(results, html_path)

    total = len(results)
    by_confidence = {level: 0 for level in (CONFIDENCE_OK, CONFIDENCE_REVIEW, CONFIDENCE_EXCLUDED, CONFIDENCE_ERROR)}
    for r in results:
        by_confidence[r.confidence] = by_confidence.get(r.confidence, 0) + 1
    ocr_used = sum(1 for r in results if r.needs_ocr and r.confidence in (CONFIDENCE_OK, CONFIDENCE_REVIEW))
    parsed_directly = (by_confidence[CONFIDENCE_OK] + by_confidence[CONFIDENCE_REVIEW]) - ocr_used

    print(f"Processed {total} PDF(s):")
    print(f"  parsed directly (text layer) : {parsed_directly}")
    print(f"  parsed via OCR                : {ocr_used}")
    print(f"    clean (confidence: ok)      : {by_confidence[CONFIDENCE_OK]}")
    print(f"    needs review                : {by_confidence[CONFIDENCE_REVIEW]}")
    print(f"  excluded (not a course page)  : {by_confidence[CONFIDENCE_EXCLUDED]}")
    print(f"  errored                       : {by_confidence[CONFIDENCE_ERROR]}")
    print(f"\nWrote {json_path}")
    print(f"Wrote {csv_path}")
    print(f"Wrote {review_path}")
    print(f"Wrote {html_path}")
    if by_confidence[CONFIDENCE_REVIEW] or by_confidence[CONFIDENCE_ERROR]:
        print(f"\n{review_path} lists exactly what to look at — nothing else needs checking.")
    print(f"Open {html_path} in a browser to review courses interactively, see the source page next to each table, and correct flagged fields.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
