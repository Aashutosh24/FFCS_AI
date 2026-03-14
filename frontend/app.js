/**
 * app.js – Main frontend application logic for FFCS AI Planner
 */

'use strict';

// ── API base URL (relative so it works when served by the backend) ──────────
const API_BASE = '';

// ── State ────────────────────────────────────────────────────────────────────
let courseCounter = 0;
let currentSchedules = [];  // Array of { schedule, score }
let activeTabIndex = 0;
let pinnedSchedules = [];

// ── DOM refs ─────────────────────────────────────────────────────────────────
const dropZone         = document.getElementById('drop-zone');
const imageInput       = document.getElementById('image-input');
const previewArea      = document.getElementById('preview-area');
const previewImg       = document.getElementById('preview-img');
const removeImageBtn   = document.getElementById('remove-image-btn');
const ocrStatus        = document.getElementById('ocr-status');
const ocrStatusText    = document.getElementById('ocr-status-text');
const ocrResult        = document.getElementById('ocr-result');
const detectedSlotsList= document.getElementById('detected-slots-list');
const coursesList      = document.getElementById('courses-list');
const addCourseBtn     = document.getElementById('add-course-btn');
const generateBtn      = document.getElementById('generate-btn');
const generateStatus   = document.getElementById('generate-status');
const resultsSection   = document.getElementById('results-section');
const resultsSummary   = document.getElementById('results-summary');
const scheduleTabs     = document.getElementById('schedule-tabs');
const timetableGrid    = document.getElementById('timetable-grid');
const scheduleDetail   = document.getElementById('schedule-detail');
const detailTbody      = document.querySelector('#schedule-detail-table tbody');
const downloadBtn      = document.getElementById('download-btn');
const pinBtn           = document.getElementById('pin-btn');
const pinnedSection    = document.getElementById('pinned-section');
const pinnedList       = document.getElementById('pinned-list');

const prefMorning       = document.getElementById('pref-morning');
const prefEvening       = document.getElementById('pref-evening');
const prefMinBreaks     = document.getElementById('pref-minimize-breaks');
const prefFreeDay       = document.getElementById('pref-free-day');

// ── Utility ───────────────────────────────────────────────────────────────────
function show(el)  { el.classList.remove('hidden'); }
function hide(el)  { el.classList.add('hidden'); }

/**
 * Parse a slot option string like "C1+TCC1" into ["C1","TCC1"]
 */
function parseSlotString(str) {
    return str.toUpperCase().split('+').map(s => s.trim()).filter(Boolean);
}

// ── Drop Zone / Image Upload ──────────────────────────────────────────────────
dropZone.addEventListener('click', () => imageInput.click());
dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') imageInput.click(); });

dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
});

imageInput.addEventListener('change', () => {
    if (imageInput.files[0]) handleImageFile(imageInput.files[0]);
});

removeImageBtn.addEventListener('click', () => {
    imageInput.value = '';
    previewImg.src = '';
    hide(previewArea);
    hide(ocrResult);
    hide(ocrStatus);
    show(dropZone);
});

async function handleImageFile(file) {
    // Show preview
    const reader = new FileReader();
    reader.onload = e => { previewImg.src = e.target.result; };
    reader.readAsDataURL(file);

    hide(dropZone);
    show(previewArea);
    hide(ocrResult);
    show(ocrStatus);
    ocrStatusText.textContent = 'Processing with OCR…';

    // Upload to backend
    const formData = new FormData();
    formData.append('image', file);

    try {
        const resp = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await resp.json();

        hide(ocrStatus);

        if (!resp.ok || !data.success) {
            ocrStatusText.textContent = data.error || 'OCR failed.';
            show(ocrStatus);
            return;
        }

        // Show detected slots
        detectedSlotsList.innerHTML = '';
        if (data.detectedSlots && data.detectedSlots.length > 0) {
            data.detectedSlots.forEach(slotGroup => {
                const li = document.createElement('li');
                const slotStr = slotGroup.join('+');
                li.innerHTML = `<code>${slotStr}</code>`;

                const useBtn = document.createElement('button');
                useBtn.className = 'use-slot-btn';
                useBtn.textContent = '+ Add';
                useBtn.addEventListener('click', () => addDetectedSlotToLastCourse(slotGroup));
                li.appendChild(useBtn);
                detectedSlotsList.appendChild(li);
            });
            show(ocrResult);
        } else {
            detectedSlotsList.innerHTML = '<li>No slot patterns detected. Please enter slots manually below.</li>';
            show(ocrResult);
        }
    } catch (err) {
        hide(ocrStatus);
        ocrStatusText.textContent = `Error: ${err.message}`;
        show(ocrStatus);
    }
}

/**
 * Add a detected slot group as an option to the last course row,
 * or create a new course if none exists.
 */
function addDetectedSlotToLastCourse(slotGroup) {
    const courseRows = coursesList.querySelectorAll('.course-row');
    if (courseRows.length === 0) {
        addCourseRow();
    }
    const lastRow = coursesList.querySelector('.course-row:last-child');
    const optionsList = lastRow.querySelector('.options-list');

    // Check if there's an empty option input to fill
    const emptyOption = optionsList.querySelector('.option-input[value=""], .option-input:not([value])');
    if (emptyOption && emptyOption.value.trim() === '') {
        emptyOption.value = slotGroup.join('+');
    } else {
        const optionRow = createOptionRow(slotGroup.join('+'));
        optionsList.appendChild(optionRow);
    }
}

// ── Course Editor ─────────────────────────────────────────────────────────────
addCourseBtn.addEventListener('click', () => addCourseRow());

function addCourseRow(name = '', options = []) {
    const template = document.getElementById('course-row-template');
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.course-row');

    courseCounter++;
    const id = `course-${courseCounter}`;
    row.dataset.courseId = id;

    const nameInput = row.querySelector('.course-name-input');
    if (name) nameInput.value = name;

    const optionsList = row.querySelector('.options-list');

    // Add existing options
    if (options.length > 0) {
        options.forEach(opt => optionsList.appendChild(createOptionRow(opt)));
    } else {
        // Start with one empty option
        optionsList.appendChild(createOptionRow(''));
    }

    // Add option button
    row.querySelector('.add-option-btn').addEventListener('click', () => {
        optionsList.appendChild(createOptionRow(''));
    });

    // Remove course button
    row.querySelector('.remove-course-btn').addEventListener('click', () => {
        row.remove();
    });

    coursesList.appendChild(row);
    return row;
}

function createOptionRow(value = '') {
    const template = document.getElementById('option-row-template');
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector('.option-row');
    const input = row.querySelector('.option-input');
    input.value = value;

    row.querySelector('.remove-option-btn').addEventListener('click', () => row.remove());

    return row;
}

// Add a default empty course to start
addCourseRow();

// ── Generate ──────────────────────────────────────────────────────────────────
generateBtn.addEventListener('click', generateTimetables);

async function generateTimetables() {
    const courses = collectCourseData();
    if (courses.length === 0) {
        generateStatus.textContent = '⚠ Please add at least one course with slot options.';
        return;
    }

    generateStatus.textContent = '';
    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ Generating…';

    const preferences = {
        preferMorning: prefMorning.checked,
        preferEvening: prefEvening.checked,
        minimizeBreaks: prefMinBreaks.checked,
        freeDayPreference: prefFreeDay.value || null
    };

    try {
        const resp = await fetch(`${API_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courses, preferences, topN: 5 })
        });
        const data = await resp.json();

        if (!resp.ok || !data.success) {
            generateStatus.textContent = `Error: ${data.error || 'Generation failed.'}`;
            return;
        }

        if (data.schedules.length === 0) {
            generateStatus.textContent = '⚠ No valid conflict-free timetables found. Check your slot options.';
            return;
        }

        currentSchedules = data.schedules;
        displayResults(data);
        show(resultsSection);
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
        generateStatus.textContent = `Error: ${err.message}`;
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '✨ Generate Best Timetables';
    }
}

/**
 * Read course rows from the DOM and return structured data.
 */
function collectCourseData() {
    const rows = coursesList.querySelectorAll('.course-row');
    const courses = [];

    rows.forEach(row => {
        const name = row.querySelector('.course-name-input').value.trim();
        if (!name) return;

        const optionInputs = row.querySelectorAll('.option-input');
        const options = [];
        optionInputs.forEach(input => {
            const val = input.value.trim();
            if (val) {
                options.push(parseSlotString(val));
            }
        });

        if (options.length > 0) {
            courses.push({ course: name, options });
        }
    });

    return courses;
}

// ── Display Results ───────────────────────────────────────────────────────────
function displayResults(data) {
    resultsSummary.textContent =
        `Found ${data.totalFound} valid timetable${data.totalFound !== 1 ? 's' : ''}. Showing top ${data.schedules.length}.`;

    // Build tabs
    scheduleTabs.innerHTML = '';
    data.schedules.forEach((item, idx) => {
        const tab = document.createElement('button');
        tab.className = 'schedule-tab' + (idx === 0 ? ' active' : '');
        tab.textContent = `Schedule ${idx + 1}  (score: ${item.score})`;
        tab.addEventListener('click', () => selectSchedule(idx));
        scheduleTabs.appendChild(tab);
    });

    // Show first
    activeTabIndex = 0;
    selectSchedule(0);
}

function selectSchedule(index) {
    activeTabIndex = index;

    // Update tab styles
    scheduleTabs.querySelectorAll('.schedule-tab').forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
    });

    const { schedule } = currentSchedules[index];
    TimetableRenderer.renderTimetable(timetableGrid, schedule);

    // Detail table
    detailTbody.innerHTML = '';
    schedule.forEach(entry => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(entry.course)}</td>
            <td><code>${escapeHtml(entry.slots.join('+'))}</code></td>
            <td>${entry.blocks[0]?.type || '–'}</td>
        `;
        detailTbody.appendChild(tr);
    });
    show(scheduleDetail);
}

// ── Download ──────────────────────────────────────────────────────────────────
downloadBtn.addEventListener('click', async () => {
    await TimetableRenderer.downloadTimetableAsPNG(timetableGrid, `timetable-schedule-${activeTabIndex + 1}.png`);
});

// ── Pin ───────────────────────────────────────────────────────────────────────
pinBtn.addEventListener('click', () => {
    if (!currentSchedules.length) return;
    const item = currentSchedules[activeTabIndex];
    pinnedSchedules.push({ ...item, pinnedAt: Date.now(), index: activeTabIndex });
    renderPinnedSection();
    show(pinnedSection);
    pinnedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function renderPinnedSection() {
    pinnedList.innerHTML = '';
    pinnedSchedules.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'pinned-item';

        const header = document.createElement('div');
        header.className = 'pinned-item-header';
        header.innerHTML = `<span>📌 Pinned Schedule ${idx + 1} <small style="color:var(--text-muted)">(score: ${item.score})</small></span>`;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-ghost btn-sm';
        removeBtn.textContent = '✕ Unpin';
        removeBtn.addEventListener('click', () => {
            pinnedSchedules.splice(idx, 1);
            renderPinnedSection();
            if (pinnedSchedules.length === 0) hide(pinnedSection);
        });
        header.appendChild(removeBtn);

        const gridWrap = document.createElement('div');
        gridWrap.className = 'pinned-item-timetable timetable-wrapper';
        const grid = document.createElement('div');
        grid.className = 'timetable-grid';
        gridWrap.appendChild(grid);
        TimetableRenderer.renderTimetable(grid, item.schedule);

        div.appendChild(header);
        div.appendChild(gridWrap);
        pinnedList.appendChild(div);
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
