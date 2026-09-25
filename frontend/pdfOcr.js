// =============================================================================
// pdfOcr.js - course_ocr pipeline integration for FFCS AI Planner
// =============================================================================
'use strict';

(function pdfOcrModule() {

    var pdfDropZone      = document.getElementById('pdf-drop-zone');
    var pdfFileInput     = document.getElementById('pdf-file-input');
    var pdfOcrStatus     = document.getElementById('pdf-ocr-status');
    var pdfOcrStatusText = document.getElementById('pdf-ocr-status-text');
    var pdfOcrSubmitBtn  = document.getElementById('pdf-ocr-submit-btn');
    var pdfOcrLoadBtn    = document.getElementById('pdf-ocr-load-btn');
    var pdfReviewSection = document.getElementById('pdf-review-section');
    var pdfCoursesList   = document.getElementById('pdf-courses-list');
    var pdfReviewCount   = document.getElementById('pdf-review-count');
    var pdfGenerateBtn   = document.getElementById('pdf-generate-btn');
    var pdfGenerateStatus= document.getElementById('pdf-generate-status');

    var selectedSlots    = new Map();
    var currentPdfFile   = null;
    var extractedCourses = [];

    function showEl(el) { el.classList.remove('hidden'); }
    function hideEl(el) { el.classList.add('hidden'); }
    function esc(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ---- Drop-zone ----
    pdfDropZone.addEventListener('click', function() { pdfFileInput.click(); });
    pdfDropZone.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') pdfFileInput.click();
    });
    pdfDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        pdfDropZone.classList.add('drag-over');
    });
    pdfDropZone.addEventListener('dragleave', function() {
        pdfDropZone.classList.remove('drag-over');
    });
    pdfDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        pdfDropZone.classList.remove('drag-over');
        var file = e.dataTransfer.files[0];
        if (file) setPdfFile(file);
    });
    pdfFileInput.addEventListener('change', function() {
        if (pdfFileInput.files[0]) setPdfFile(pdfFileInput.files[0]);
    });

    function setPdfFile(file) {
        currentPdfFile = file;
        var p = pdfDropZone.querySelector('p');
        if (p) p.innerHTML = '<strong>' + esc(file.name) + '</strong> ready to process';
        pdfOcrSubmitBtn.disabled = false;
    }

    // ---- Run pipeline ----
    pdfOcrSubmitBtn.addEventListener('click', function() {
        if (currentPdfFile) runPdfOcr(currentPdfFile);
    });

    function runPdfOcr(file) {
        showEl(pdfOcrStatus);
        pdfOcrStatusText.textContent = 'Running course_ocr pipeline... this may take up to 2 minutes';
        pdfOcrSubmitBtn.disabled = true;
        hideEl(pdfReviewSection);

        var formData = new FormData();
        formData.append('pdfs', file);

        fetch('/api/pdf-ocr', { method: 'POST', body: formData })
            .then(function(resp) { return resp.json(); })
            .then(function(data) {
                hideEl(pdfOcrStatus);
                if (!data.success) {
                    pdfOcrStatusText.textContent = 'Error: ' + (data.error || 'Pipeline failed.');
                    showEl(pdfOcrStatus);
                    pdfOcrSubmitBtn.disabled = false;
                    return;
                }
                renderPdfResults(data.courses);
            })
            .catch(function(err) {
                hideEl(pdfOcrStatus);
                pdfOcrStatusText.textContent = 'Network error: ' + err.message;
                showEl(pdfOcrStatus);
                pdfOcrSubmitBtn.disabled = false;
            });
    }

    // ---- Load last results ----
    pdfOcrLoadBtn.addEventListener('click', function() {
        showEl(pdfOcrStatus);
        pdfOcrStatusText.textContent = 'Loading last results...';
        hideEl(pdfReviewSection);

        fetch('/api/pdf-ocr/results')
            .then(function(resp) { return resp.json(); })
            .then(function(data) {
                hideEl(pdfOcrStatus);
                if (!data.success) {
                    pdfOcrStatusText.textContent = 'Warning: ' + data.error;
                    showEl(pdfOcrStatus);
                    return;
                }
                renderPdfResults(data.courses);
            })
            .catch(function(err) {
                hideEl(pdfOcrStatus);
                pdfOcrStatusText.textContent = 'Error: ' + err.message;
                showEl(pdfOcrStatus);
            });
    });

    // ---- Render course cards ----
    function renderPdfResults(courses) {
        extractedCourses = courses;
        selectedSlots.clear();
        pdfCoursesList.innerHTML = '';

        var usable  = courses.filter(function(c) { return !c.error && (c.theorySlots.length || c.labSlots.length); });
        var skipped = courses.filter(function(c) { return  c.error || (!c.theorySlots.length && !c.labSlots.length); });

        pdfReviewCount.textContent =
            usable.length + ' course' + (usable.length !== 1 ? 's' : '') + ' found' +
            (skipped.length ? ' · ' + skipped.length + ' skipped' : '');

        usable.forEach(function(course, idx) {
            pdfCoursesList.appendChild(buildCourseCard(course, idx));
        });

        if (skipped.length) {
            var note = document.createElement('p');
            note.className = 'hint-text';
            note.style.marginTop = '1rem';
            note.innerHTML = '<strong>' + skipped.length + '</strong> file(s) excluded or errored — see <code>course_ocr/output/review.html</code> for details.';
            pdfCoursesList.appendChild(note);
        }

        showEl(pdfReviewSection);
        pdfReviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function buildCourseCard(course, idx) {
        var card = document.createElement('div');
        card.className = 'pdf-course-card';
        card.dataset.courseIdx = idx;

        var hdr = document.createElement('div');
        hdr.className = 'pdf-course-header';
        hdr.innerHTML =
            '<div class="pdf-course-title">' +
                '<span class="course-code-tag">' + esc(course.code || '-') + '</span>' +
                '<strong class="pdf-course-name">' + esc(course.name || 'Unknown Course') + '</strong>' +
            '</div>' +
            '<div class="pdf-course-meta">' +
                (course.component ? '<span class="pdf-meta-chip">' + esc(course.component) + '</span>' : '') +
                (course.credit    ? '<span class="pdf-meta-chip">' + esc(course.credit) + ' Credits</span>' : '') +
                buildConfidenceBadge(course.confidence) +
            '</div>';
        card.appendChild(hdr);

        if (course.theorySlots && course.theorySlots.length)
            card.appendChild(buildSlotTable('Theory Slots', course.theorySlots, idx, 'theory'));
        if (course.labSlots && course.labSlots.length)
            card.appendChild(buildSlotTable('Lab Slots', course.labSlots, idx, 'lab'));

        if (course.warnings && course.warnings.length) {
            var warn = document.createElement('div');
            warn.className = 'pdf-course-warnings';
            warn.innerHTML = course.warnings.map(function(w) { return '<p>Note: ' + esc(w) + '</p>'; }).join('');
            card.appendChild(warn);
        }
        return card;
    }

    function buildConfidenceBadge(conf) {
        var map = {
            ok:       { cls: 'badge-ok',   label: 'Confident' },
            review:   { cls: 'badge-warn', label: 'Needs review' },
            excluded: { cls: 'badge-warn', label: 'Excluded' },
            error:    { cls: 'badge-err',  label: 'Error' }
        };
        var info = map[conf] || { cls: '', label: conf || '' };
        return '<span class="badge ' + info.cls + '" style="font-size:.7rem">' + info.label + '</span>';
    }

    function buildSlotTable(title, slots, courseIdx, slotType) {
        var wrap = document.createElement('div');
        wrap.className = 'pdf-slot-section';

        var heading = document.createElement('h4');
        heading.className = 'pdf-slot-heading';
        heading.textContent = title;
        wrap.appendChild(heading);

        var table = document.createElement('table');
        table.className = 'pdf-slot-table';
        table.innerHTML = '<thead><tr><th>Select</th><th>Slot</th><th>Venue</th><th>Faculty</th><th>Flags</th></tr></thead>';

        var tbody = document.createElement('tbody');
        slots.forEach(function(s, rowIdx) {
            var tr = document.createElement('tr');
            tr.className = 'pdf-slot-row';
            tr.dataset.courseIdx = courseIdx;
            tr.dataset.slotType  = slotType;
            tr.dataset.rowIdx    = rowIdx;

            var flags = (s.flags && s.flags.length)
                ? s.flags.map(function(f) { return '<span class="pdf-flag">' + esc(f) + '</span>'; }).join(' ')
                : '<span class="pdf-flag-none">-</span>';

            tr.innerHTML =
                '<td><button class="pdf-select-btn" data-course-idx="' + courseIdx +
                    '" data-slot-type="' + slotType + '" data-row-idx="' + rowIdx + '">Select</button></td>' +
                '<td><code class="slot-code">' + esc(s.slot || '-') + '</code></td>' +
                '<td>' + esc(s.venue   || '-') + '</td>' +
                '<td>' + esc(s.faculty || '-') + '</td>' +
                '<td>' + flags + '</td>';

            (function(slotObj, ri) {
                tr.querySelector('.pdf-select-btn').addEventListener('click', function() {
                    toggleSlotSelection(courseIdx, slotType, ri, slotObj, table, tr, this);
                });
            })(s, rowIdx);

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        wrap.appendChild(table);
        return wrap;
    }

    function toggleSlotSelection(courseIdx, slotType, rowIdx, slotObj, table, tr, btn) {
        var key  = courseIdx + '-' + slotType;
        var prev = selectedSlots.get(key);

        if (prev) {
            var prevRow = table.querySelector(
                'tr[data-row-idx="' + prev.rowIdx + '"][data-slot-type="' + slotType + '"]'
            );
            if (prevRow) {
                prevRow.classList.remove('pdf-slot-selected');
                var prevBtn = prevRow.querySelector('.pdf-select-btn');
                if (prevBtn) { prevBtn.textContent = 'Select'; prevBtn.classList.remove('selected'); }
            }
        }

        if (prev && prev.rowIdx === rowIdx) {
            selectedSlots.delete(key);
            tr.classList.remove('pdf-slot-selected');
            btn.textContent = 'Select';
            btn.classList.remove('selected');
        } else {
            selectedSlots.set(key, { rowIdx: rowIdx, slotObj: slotObj, slotType: slotType });
            tr.classList.add('pdf-slot-selected');
            btn.textContent = 'Selected';
            btn.classList.add('selected');
        }
        updatePdfGenerateButton();
    }

    function updatePdfGenerateButton() {
        var count = selectedSlots.size;
        pdfGenerateBtn.textContent = count > 0
            ? 'Generate Timetables (' + count + ' slot' + (count !== 1 ? 's' : '') + ' selected)'
            : 'Generate Timetables from Selected Slots';
    }

    // ---- Generate timetables from PDF-selected slots ----
    pdfGenerateBtn.addEventListener('click', function() {
        if (selectedSlots.size === 0) {
            pdfGenerateStatus.textContent = 'Please select at least one slot option first.';
            return;
        }
        pdfGenerateStatus.textContent = '';

        var usable = extractedCourses.filter(function(c) {
            return !c.error && (c.theorySlots.length || c.labSlots.length);
        });

        var courseMap = new Map();
        selectedSlots.forEach(function(val, key) {
            var courseIdx = parseInt(key.split('-')[0], 10);
            var course    = usable[courseIdx];
            if (!course) return;
            var parts = [course.code, course.name].filter(Boolean);
            var courseName = parts.join(' - ') || ('Course ' + (courseIdx + 1));
            if (!courseMap.has(courseIdx)) courseMap.set(courseIdx, { course: courseName, options: [] });
            var slotParts = (val.slotObj.slot || '').split('+').map(function(s) { return s.trim(); }).filter(Boolean);
            if (slotParts.length) courseMap.get(courseIdx).options.push(slotParts);
        });

        var courses = [];
        courseMap.forEach(function(v) { if (v.options.length) courses.push(v); });

        if (courses.length === 0) {
            pdfGenerateStatus.textContent = 'No valid slot options in selection.';
            return;
        }

        pdfGenerateBtn.disabled = true;
        pdfGenerateBtn.textContent = 'Generating...';

        var prefMorningEl   = document.getElementById('pref-morning');
        var prefEveningEl   = document.getElementById('pref-evening');
        var prefMinBreaksEl = document.getElementById('pref-minimize-breaks');
        var prefFreeDayEl   = document.getElementById('pref-free-day');
        var preferences = {
            preferMorning:     prefMorningEl   ? prefMorningEl.checked  : false,
            preferEvening:     prefEveningEl   ? prefEveningEl.checked  : false,
            minimizeBreaks:    prefMinBreaksEl ? prefMinBreaksEl.checked : true,
            freeDayPreference: prefFreeDayEl   ? prefFreeDayEl.value    : null
        };

        fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courses: courses, preferences: preferences, topN: 5 })
        })
        .then(function(resp) { return resp.json(); })
        .then(function(data) {
            if (!data.success) {
                pdfGenerateStatus.textContent = 'Error: ' + (data.error || 'Generation failed.');
                return;
            }
            if (!data.schedules || data.schedules.length === 0) {
                pdfGenerateStatus.textContent = 'No conflict-free timetables found. Try different slots.';
                return;
            }
            // Reuse globals from app.js
            currentSchedules = data.schedules;
            displayResults(data);
            show(resultsSection);
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function(err) {
            pdfGenerateStatus.textContent = 'Network error: ' + err.message;
        })
        .finally(function() {
            pdfGenerateBtn.disabled = false;
            updatePdfGenerateButton();
        });
    });

})(); // end pdfOcrModule
