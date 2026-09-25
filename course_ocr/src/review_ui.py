"""
Phase 6: review UI.

Generates a single, self-contained `review.html` — no server, no build
step, works fully offline once written. All course/slot data and page
preview images are embedded directly in the file as JSON, so it's the
one artifact a reviewer needs; they don't need the original PDFs, the
folder/zip, or an internet connection to use it.

What it's for (per the project's Phase 6 scope): review extracted data,
view the source PDF page next to it, correct flagged fields, and see
uncertain results highlighted — not a general PDF viewer or a
replacement for results.json/results.csv, which remain the canonical
machine-readable output.

Corrections made in the browser are edits to a local copy of the data
only (there's no server to write back to) — "Download corrected JSON"
exports them as a new file in the same schema as results.json, so they
could be fed into a future phase or kept as the reviewer's own record.
"""

from __future__ import annotations

import json
import os
from typing import List

from .models import CourseExtraction


def _course_to_review_dict(course: CourseExtraction) -> dict:
    """A trimmed variant of CourseExtraction.to_dict() for the review UI:
    adds page_previews (never in the normal JSON export — see
    models.py), and drops raw_text (not useful to a reviewer looking at
    the actual rendered page instead).
    """
    d = course.to_dict(include_raw_text=False)
    d["page_previews"] = course.page_previews
    return d


def build_review_html(results: List[CourseExtraction]) -> str:
    data_json = json.dumps([_course_to_review_dict(r) for r in results], ensure_ascii=False)
    # Guard against "</script>" appearing inside embedded text (e.g. a
    # faculty name or OCR warning) prematurely closing the script tag.
    data_json = data_json.replace("</script>", "<\\/script>")

    return _HTML_TEMPLATE.replace("__COURSE_DATA_JSON__", data_json)


def write_review_html(results: List[CourseExtraction], out_path: str) -> None:
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(build_review_html(results))


_HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Course Slot Extraction Review</title>
<style>
  :root {
    --ink: #1b2130;
    --ink-soft: #4a5266;
    --paper: #f6f4ee;
    --panel: #ffffff;
    --line: #dedad0;
    --ok: #3f7d6b;
    --ok-bg: #e6efe9;
    --review: #b3762c;
    --review-bg: #faf1e2;
    --excluded: #7b7466;
    --excluded-bg: #efece3;
    --error: #a4423a;
    --error-bg: #f8e9e7;
    --accent: #2f4b8f;
    --mono: "IBM Plex Mono", ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace;
    --serif: Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif;
    --sans: "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    font-family: var(--sans);
    color: var(--ink);
    background: var(--paper);
    display: flex;
    flex-direction: column;
  }

  header {
    padding: 18px 24px;
    border-bottom: 1px solid var(--line);
    background: var(--panel);
    display: flex;
    align-items: baseline;
    gap: 16px;
    flex-wrap: wrap;
  }
  header h1 {
    font-family: var(--serif);
    font-weight: 600;
    font-size: 21px;
    margin: 0;
    letter-spacing: 0.2px;
  }
  header .subtitle {
    color: var(--ink-soft);
    font-size: 13px;
  }
  .summary-pills { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }
  .pill {
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 100px;
    cursor: pointer;
    border: 1px solid transparent;
    user-select: none;
  }
  .pill[data-active="true"] { border-color: currentColor; }
  .pill.ok { background: var(--ok-bg); color: var(--ok); }
  .pill.review { background: var(--review-bg); color: var(--review); }
  .pill.excluded { background: var(--excluded-bg); color: var(--excluded); }
  .pill.error { background: var(--error-bg); color: var(--error); }
  .pill.all { background: #eceadf; color: var(--ink); }

  .layout { flex: 1; display: flex; min-height: 0; }

  nav.course-list {
    width: 300px;
    flex-shrink: 0;
    border-right: 1px solid var(--line);
    background: var(--panel);
    overflow-y: auto;
  }
  .course-item {
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .course-item:hover { background: #faf9f4; }
  .course-item[data-selected="true"] { background: #eef1fa; border-left: 3px solid var(--accent); padding-left: 13px; }
  .course-item .filename { font-family: var(--mono); font-size: 11px; color: var(--ink-soft); }
  .course-item .course-name { font-family: var(--serif); font-size: 14.5px; font-weight: 600; }
  .course-item .meta { font-size: 11.5px; color: var(--ink-soft); display: flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .dot.ok { background: var(--ok); }
  .dot.review { background: var(--review); }
  .dot.excluded { background: var(--excluded); }
  .dot.error { background: var(--error); }

  main.detail { flex: 1; overflow-y: auto; padding: 28px 32px; }
  .empty-state { color: var(--ink-soft); font-style: italic; padding: 40px; }

  .detail-header { margin-bottom: 20px; }
  .detail-header h2 { font-family: var(--serif); font-size: 24px; margin: 0 0 4px; }
  .detail-header .code { font-family: var(--mono); color: var(--ink-soft); font-size: 13px; }
  .status-banner {
    margin-top: 12px;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 13px;
    display: inline-block;
  }
  .status-banner.ok { background: var(--ok-bg); color: var(--ok); }
  .status-banner.review { background: var(--review-bg); color: var(--review); }
  .status-banner.excluded { background: var(--excluded-bg); color: var(--excluded); }
  .status-banner.error { background: var(--error-bg); color: var(--error); }

  .columns { display: flex; gap: 28px; align-items: flex-start; }
  .previews { width: 340px; flex-shrink: 0; display: flex; flex-direction: column; gap: 14px; }
  .previews img {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 4px;
    display: block;
    background: #fff;
  }
  .previews .page-label { font-size: 11px; color: var(--ink-soft); margin-bottom: 4px; font-family: var(--mono); }

  .tables { flex: 1; min-width: 0; }
  h3.section-title {
    font-family: var(--serif);
    font-size: 16px;
    margin: 22px 0 8px;
    color: var(--ink);
  }
  h3.section-title:first-child { margin-top: 0; }
  table.slots { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  table.slots th {
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-soft);
    border-bottom: 1px solid var(--line);
    padding: 6px 10px;
  }
  table.slots td {
    padding: 7px 10px;
    border-bottom: 1px solid #eeece3;
    vertical-align: top;
  }
  table.slots tr.flagged td { background: var(--review-bg); }
  .slot-code { font-family: var(--mono); font-weight: 600; }
  .flag-badges { margin-top: 3px; }
  .flag-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    color: var(--review);
    background: #f3e2c4;
    border-radius: 3px;
    padding: 1px 5px;
    margin-right: 4px;
  }
  td[contenteditable="true"] {
    cursor: text;
    outline: none;
    border-radius: 3px;
  }
  td[contenteditable="true"]:focus { box-shadow: 0 0 0 2px var(--accent) inset; }
  td.edited { background: #e7edfa !important; }
  .empty-value { color: #b9b4a6; font-style: italic; }

  .missing-fields, .warnings-list {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--ink-soft);
  }
  .missing-fields b, .warnings-list b { color: var(--review); }

  footer {
    border-top: 1px solid var(--line);
    padding: 10px 24px;
    background: var(--panel);
    font-size: 12px;
    color: var(--ink-soft);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  button.export-btn {
    font-family: var(--sans);
    font-size: 12.5px;
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 5px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: #fff;
    cursor: pointer;
  }
  button.export-btn:hover { opacity: 0.9; }
</style>
</head>
<body>

<header>
  <h1>Course Slot Extraction — Review</h1>
  <span class="subtitle">Generated review of extracted theory/lab slot data</span>
  <div class="summary-pills" id="summary-pills"></div>
</header>

<div class="layout">
  <nav class="course-list" id="course-list"></nav>
  <main class="detail" id="detail">
    <div class="empty-state">Select a course on the left to review its extracted slots.</div>
  </main>
</div>

<footer>
  <span id="edit-count">No edits made yet.</span>
  <button class="export-btn" id="export-btn">Download corrected JSON</button>
</footer>

<script id="course-data" type="application/json">__COURSE_DATA_JSON__</script>
<script>
(function () {
  var courses = JSON.parse(document.getElementById('course-data').textContent);
  var selectedIndex = null;
  var activeFilter = 'all';
  var editCount = 0;

  var CONFIDENCE_LABEL = { ok: 'Clean', review: 'Needs review', excluded: 'Excluded', error: 'Error' };

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fieldOrEmpty(v) {
    return v ? esc(v) : '<span class="empty-value">\u2014</span>';
  }

  function renderSummaryPills() {
    var counts = { all: courses.length, ok: 0, review: 0, excluded: 0, error: 0 };
    courses.forEach(function (c) { counts[c.confidence] = (counts[c.confidence] || 0) + 1; });

    var pillsEl = document.getElementById('summary-pills');
    pillsEl.innerHTML = '';
    ['all', 'ok', 'review', 'excluded', 'error'].forEach(function (level) {
      var pill = document.createElement('span');
      pill.className = 'pill ' + level;
      pill.textContent = (level === 'all' ? 'All' : CONFIDENCE_LABEL[level]) + ' (' + counts[level] + ')';
      pill.dataset.active = (activeFilter === level).toString();
      pill.onclick = function () { activeFilter = level; renderSummaryPills(); renderCourseList(); };
      pillsEl.appendChild(pill);
    });
  }

  function renderCourseList() {
    var listEl = document.getElementById('course-list');
    listEl.innerHTML = '';
    courses.forEach(function (c, idx) {
      if (activeFilter !== 'all' && c.confidence !== activeFilter) return;

      var item = document.createElement('div');
      item.className = 'course-item';
      item.dataset.selected = (idx === selectedIndex).toString();
      item.onclick = function () { selectedIndex = idx; renderCourseList(); renderDetail(); };

      var rowCount = (c.theory_slots || []).length + (c.lab_slots || []).length;
      item.innerHTML =
        '<span class="filename">' + esc(c.source_file) + '</span>' +
        '<span class="course-name">' + (c.course_name ? esc(c.course_name) : (c.course_code ? esc(c.course_code) : '(unparsed)')) + '</span>' +
        '<span class="meta"><span class="dot ' + c.confidence + '"></span>' +
        CONFIDENCE_LABEL[c.confidence] + (c.credit ? ' \u00b7 ' + esc(c.credit) + ' cr' : '') + (rowCount ? ' \u00b7 ' + rowCount + ' slot' + (rowCount === 1 ? '' : 's') : '') + '</span>';
      listEl.appendChild(item);
    });

    if (!listEl.children.length) {
      listEl.innerHTML = '<div class="empty-state">No courses match this filter.</div>';
    }
  }

  function slotTable(course, slotType, slots) {
    if (!slots || !slots.length) return '';
    var rows = slots.map(function (s, i) {
      var flags = s.flags || [];
      var badges = flags.map(function (f) { return '<span class="flag-badge">' + esc(f) + '</span>'; }).join('');
      return '<tr class="' + (flags.length ? 'flagged' : '') + '" data-slot-type="' + slotType + '" data-row-index="' + i + '">' +
        '<td class="slot-code" contenteditable="true" data-field="slot">' + fieldOrEmpty(s.slot) + '</td>' +
        '<td contenteditable="true" data-field="venue">' + fieldOrEmpty(s.venue) + '</td>' +
        '<td contenteditable="true" data-field="faculty">' + fieldOrEmpty(s.faculty) + (badges ? '<div class="flag-badges">' + badges + '</div>' : '') + '</td>' +
        '</tr>';
    }).join('');

    return '<h3 class="section-title">' + (slotType === 'theory' ? 'Theory Slots' : 'Lab Slots') + ' (' + slots.length + ')</h3>' +
      '<table class="slots"><thead><tr><th style="width:110px">Slot</th><th style="width:90px">Venue</th><th>Faculty</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderDetail() {
    var detailEl = document.getElementById('detail');
    if (selectedIndex === null || !courses[selectedIndex]) {
      detailEl.innerHTML = '<div class="empty-state">Select a course on the left to review its extracted slots.</div>';
      return;
    }
    var c = courses[selectedIndex];

    var previewsHtml = (c.page_previews || [])
      .map(function (src, i) {
        if (!src) return '';
        return '<div><div class="page-label">Page ' + (i + 1) + ' of ' + c.pages + '</div><img src="' + src + '" alt="Page ' + (i + 1) + ' of ' + esc(c.source_file) + '"></div>';
      })
      .join('');

    var missingHtml = (c.missing_fields && c.missing_fields.length)
      ? '<div class="missing-fields"><b>Missing fields:</b> ' + c.missing_fields.map(esc).join('; ') + '</div>'
      : '';

    var warningsHtml = (c.warnings && c.warnings.length)
      ? '<div class="warnings-list"><b>Warnings:</b><ul>' + c.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>'
      : '';

    var errorHtml = c.error ? '<div class="warnings-list"><b>Error:</b> ' + esc(c.error) + '</div>' : '';

    detailEl.innerHTML =
      '<div class="detail-header">' +
      '<h2>' + (c.course_name ? esc(c.course_name) : '(course name not parsed)') + '</h2>' +
      '<span class="code">' + esc(c.source_file) + (c.course_code ? ' \u00b7 ' + esc(c.course_code) : '') + (c.component_type ? ' \u00b7 ' + esc(c.component_type) : '') + (c.credit ? ' \u00b7 ' + esc(c.credit) + ' credits' : '') + '</span>' +
      '<div><span class="status-banner ' + c.confidence + '">' + CONFIDENCE_LABEL[c.confidence] + '</span></div>' +
      missingHtml + warningsHtml + errorHtml +
      '</div>' +
      '<div class="columns">' +
      (previewsHtml ? '<div class="previews">' + previewsHtml + '</div>' : '') +
      '<div class="tables">' +
      (slotTable(c, 'theory', c.theory_slots) || '') +
      (slotTable(c, 'lab', c.lab_slots) || '') +
      (!(c.theory_slots || []).length && !(c.lab_slots || []).length ? '<p class="empty-state">No slot rows extracted for this file.</p>' : '') +
      '</div>' +
      '</div>';

    detailEl.querySelectorAll('td[contenteditable="true"]').forEach(function (td) {
      td.addEventListener('blur', onCellEdited);
    });
  }

  function onCellEdited(e) {
    var td = e.target;
    var tr = td.closest('tr');
    var slotType = tr.dataset.slotType;
    var rowIndex = parseInt(tr.dataset.rowIndex, 10);
    var field = td.dataset.field;
    var newValue = td.textContent.trim();

    var course = courses[selectedIndex];
    var list = slotType === 'theory' ? course.theory_slots : course.lab_slots;
    var row = list[rowIndex];
    var oldValue = row[field] || '';

    if (newValue !== oldValue) {
      row[field] = newValue || null;
      row._edited = true;
      td.classList.add('edited');
      editCount += 1;
      document.getElementById('edit-count').textContent =
        editCount + ' correction' + (editCount === 1 ? '' : 's') + ' made this session.';
    }
  }

  function downloadJson() {
    var blob = new Blob([JSON.stringify(courses, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'results_corrected.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  document.getElementById('export-btn').addEventListener('click', downloadJson);

  renderSummaryPills();
  renderCourseList();
  renderDetail();
})();
</script>

</body>
</html>
"""
