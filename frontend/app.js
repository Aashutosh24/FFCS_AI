/**
 * app.js – Main frontend application logic for FFCS AI Planner
 *
 * Flow:
 *  1. User uploads a registration screenshot (REQUIRED).
 *  2. OCR runs on the backend; structured course data (or raw slot chips) are shown.
 *     a. If course headers were detected → each course card is shown with its slot options.
 *     b. If only raw slot groups detected → slot chips shown; user groups them into courses.
 *  3. User sets preferences and clicks Generate.
 *  4. Best timetables are displayed.
 */

'use strict';

// ── API base URL (relative so it works when served by the backend) ──────────
const API_BASE = '';

// ── State ────────────────────────────────────────────────────────────────────
let currentSchedules = [];
let activeTabIndex = 0;
let pinnedSchedules = [];
let bucketCounter = 0;

// Map: slotString → which bucket id it's assigned to ('' = unassigned)
let chipAssignment = {};  // e.g. { 'C1+TCC1': 'bucket-1', ... }
let allDetectedSlots = []; // string[][] from OCR

// ── DOM refs ─────────────────────────────────────────────────────────────────
const dropZone         = document.getElementById('drop-zone');
const imageInput       = document.getElementById('image-input');
const previewArea      = document.getElementById('preview-area');
const previewImg       = document.getElementById('preview-img');
const removeImageBtn   = document.getElementById('remove-image-btn');
const ocrStatus        = document.getElementById('ocr-status');
const ocrStatusText    = document.getElementById('ocr-status-text');

const reviewSection    = document.getElementById('review-section');
const structuredPanel  = document.getElementById('structured-panel');
const ocrCoursesList   = document.getElementById('ocr-courses-list');
const groupingPanel    = document.getElementById('grouping-panel');
const noSlotsPanel     = document.getElementById('no-slots-panel');
const generatePanel    = document.getElementById('generate-panel');
const retryUploadBtn   = document.getElementById('retry-upload-btn');

const slotChipsEl      = document.getElementById('slot-chips');
const unassignedCount  = document.getElementById('unassigned-count');
const courseBuckets    = document.getElementById('course-buckets');
const addBucketBtn     = document.getElementById('add-bucket-btn');

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

const prefMorning      = document.getElementById('pref-morning');
const prefEvening      = document.getElementById('pref-evening');
const prefMinBreaks    = document.getElementById('pref-minimize-breaks');
const prefFreeDay      = document.getElementById('pref-free-day');

// ── Utility ───────────────────────────────────────────────────────────────────
function show(el)  { el.classList.remove('hidden'); }
function hide(el)  { el.classList.add('hidden'); }

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Drop Zone / Image Upload ──────────────────────────────────────────────────
dropZone.addEventListener('click', () => imageInput.click());
dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') imageInput.click();
});

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

removeImageBtn.addEventListener('click', resetUpload);
retryUploadBtn.addEventListener('click', resetUpload);

function resetUpload() {
    imageInput.value = '';
    previewImg.src = '';
    hide(previewArea);
    hide(ocrStatus);
    hide(reviewSection);
    hide(resultsSection);
    show(dropZone);
    allDetectedSlots = [];
    chipAssignment = {};
    currentSchedules = [];
}

async function handleImageFile(file) {
    // Show preview immediately
    const reader = new FileReader();
    reader.onload = e => { previewImg.src = e.target.result; };
    reader.readAsDataURL(file);

    hide(dropZone);
    show(previewArea);
    hide(reviewSection);
    show(ocrStatus);
    ocrStatusText.textContent = 'Processing with OCR… this may take up to 60 seconds';

    const formData = new FormData();
    formData.append('image', file);

    try {
        const resp = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });

        let data;
        try {
            data = await resp.json();
        } catch {
            hide(ocrStatus);
            ocrStatusText.textContent = 'Server error: could not parse response. Please try again.';
            show(ocrStatus);
            return;
        }

        hide(ocrStatus);

        if (!resp.ok || !data.success) {
            ocrStatusText.textContent = `❌ ${data.error || 'OCR failed. Please try again.'}`;
            show(ocrStatus);
            return;
        }

        // Render the review section based on what OCR found
        renderReviewSection(data);

    } catch (err) {
        hide(ocrStatus);
        ocrStatusText.textContent = `❌ Network error: ${err.message}`;
        show(ocrStatus);
    }
}

// ── Review Section ────────────────────────────────────────────────────────────
function renderReviewSection(data) {
    // Reset sub-panels
    hide(structuredPanel);
    hide(groupingPanel);
    hide(noSlotsPanel);
    hide(generatePanel);

    show(reviewSection);

    const hasCourses  = Array.isArray(data.courses) && data.courses.length > 0;
    const hasRawSlots = Array.isArray(data.detectedSlots) && data.detectedSlots.length > 0;

    if (hasCourses) {
        // ── Panel A: Structured course data available ─────────────────────────
        renderStructuredCourses(data.courses);
        show(structuredPanel);
        show(generatePanel);

    } else if (hasRawSlots) {
        // ── Panel B: Only raw slot chips, no course headers ───────────────────
        allDetectedSlots = data.detectedSlots;
        chipAssignment = {};
        data.detectedSlots.forEach(slots => { chipAssignment[slots.join('+')] = ''; });
        renderSlotChips(data.detectedSlots);
        show(groupingPanel);
        show(generatePanel);

    } else {
        // ── Panel C: Nothing useful detected ─────────────────────────────────
        show(noSlotsPanel);
    }

    reviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Panel A: Structured courses (auto-detected course headers) ────────────────

function renderStructuredCourses(courses) {
    ocrCoursesList.innerHTML = '';

    courses.forEach((course, idx) => {
        const card = document.createElement('div');
        card.className = 'ocr-course-card';
        card.dataset.idx = idx;

        const header = document.createElement('div');
        header.className = 'ocr-course-card-header';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'input ocr-course-name-input';
        nameInput.value = course.name || course.code || `Course ${idx + 1}`;
        nameInput.placeholder = 'Course name';
        nameInput.dataset.idx = idx;
        nameInput.setAttribute('aria-label', 'Course name');

        const codeTag = document.createElement('span');
        codeTag.className = 'course-code-tag';
        codeTag.textContent = course.code || '';

        header.appendChild(nameInput);
        if (course.code) header.appendChild(codeTag);
        card.appendChild(header);

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'ocr-options';

        if (course.options && course.options.length > 0) {
            course.options.forEach(optSlots => {
                const chip = document.createElement('span');
                chip.className = 'slot-chip assigned-chip';
                chip.textContent = optSlots.join('+');
                chip.title = `Slot option: ${optSlots.join('+')}`;
                optionsDiv.appendChild(chip);
            });
        } else {
            const emptyMsg = document.createElement('span');
            emptyMsg.className = 'hint-text';
            emptyMsg.textContent = 'No slot options detected for this course.';
            optionsDiv.appendChild(emptyMsg);
        }

        card.appendChild(optionsDiv);
        ocrCoursesList.appendChild(card);
    });
}

// ── Panel B: Slot chips + course buckets ──────────────────────────────────────

function renderSlotChips(slotsArray) {
    slotChipsEl.innerHTML = '';

    slotsArray.forEach(slots => {
        const key = slots.join('+');
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'slot-chip unassigned-chip';
        chip.textContent = key;
        chip.dataset.slotKey = key;
        chip.title = 'Click to assign to a course';
        chip.addEventListener('click', () => handleChipClick(key, chip));
        slotChipsEl.appendChild(chip);
    });

    updateUnassignedCount();
}

function handleChipClick(slotKey, chipEl) {
    // If already assigned, unassign it (return to pool)
    if (chipAssignment[slotKey]) {
        const prevBucketId = chipAssignment[slotKey];
        removeSlotFromBucket(slotKey, prevBucketId);
        chipAssignment[slotKey] = '';
        chipEl.classList.remove('assigned-chip');
        chipEl.classList.add('unassigned-chip');
        chipEl.title = 'Click to assign to a course';
        updateUnassignedCount();
        return;
    }

    // Otherwise pick a target bucket via a simple inline menu
    const buckets = courseBuckets.querySelectorAll('.course-bucket');
    if (buckets.length === 0) {
        generateStatus.textContent = '⚠ Create at least one course bucket first.';
        return;
    }
    generateStatus.textContent = '';

    // Show a tiny dropdown next to the chip
    showBucketPicker(slotKey, chipEl);
}

function showBucketPicker(slotKey, anchorEl) {
    // Remove any existing picker
    const existing = document.getElementById('bucket-picker');
    if (existing) existing.remove();

    const picker = document.createElement('div');
    picker.id = 'bucket-picker';
    picker.className = 'bucket-picker';

    const buckets = courseBuckets.querySelectorAll('.course-bucket');
    buckets.forEach(bucket => {
        const bucketId = bucket.dataset.bucketId;
        const nameInput = bucket.querySelector('.bucket-name-input');
        const label = nameInput.value.trim() || 'Unnamed Course';

        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'picker-option';
        opt.textContent = label;
        opt.addEventListener('click', () => {
            assignChipToBucket(slotKey, bucketId, anchorEl);
            picker.remove();
        });
        picker.appendChild(opt);
    });

    // Position below the chip
    const rect = anchorEl.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.top = `${rect.bottom + 4}px`;
    picker.style.left = `${rect.left}px`;
    picker.style.zIndex = '9999';
    document.body.appendChild(picker);

    // Close on outside click
    const closeHandler = e => {
        if (!picker.contains(e.target) && e.target !== anchorEl) {
            picker.remove();
            document.removeEventListener('click', closeHandler, true);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler, true), 0);
}

function assignChipToBucket(slotKey, bucketId, chipEl) {
    chipAssignment[slotKey] = bucketId;
    chipEl.classList.remove('unassigned-chip');
    chipEl.classList.add('assigned-chip');
    chipEl.title = 'Click to unassign';

    const bucket = courseBuckets.querySelector(`[data-bucket-id="${bucketId}"]`);
    if (!bucket) return;

    const slotsDiv = bucket.querySelector('.bucket-slots');
    const hint = bucket.querySelector('.bucket-empty-hint');
    if (hint) hide(hint);

    const tag = document.createElement('span');
    tag.className = 'slot-chip bucket-slot-chip';
    tag.textContent = slotKey;
    tag.dataset.slotKey = slotKey;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chip-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove from this course';
    removeBtn.addEventListener('click', () => {
        removeSlotFromBucket(slotKey, bucketId);
        chipAssignment[slotKey] = '';
        // Re-enable the original chip
        const origChip = slotChipsEl.querySelector(`[data-slot-key="${slotKey}"]`);
        if (origChip) {
            origChip.classList.remove('assigned-chip');
            origChip.classList.add('unassigned-chip');
            origChip.title = 'Click to assign to a course';
        }
        updateUnassignedCount();
    });
    tag.appendChild(removeBtn);
    slotsDiv.appendChild(tag);
    updateUnassignedCount();
}

function removeSlotFromBucket(slotKey, bucketId) {
    const bucket = courseBuckets.querySelector(`[data-bucket-id="${bucketId}"]`);
    if (!bucket) return;
    const slotsDiv = bucket.querySelector('.bucket-slots');
    const tag = slotsDiv.querySelector(`[data-slot-key="${slotKey}"]`);
    if (tag) tag.remove();
    if (!slotsDiv.children.length) {
        const hint = bucket.querySelector('.bucket-empty-hint');
        if (hint) show(hint);
    }
}

function updateUnassignedCount() {
    const total      = Object.keys(chipAssignment).length;
    const unassigned = Object.values(chipAssignment).filter(v => v === '').length;
    unassignedCount.textContent = `${unassigned} unassigned / ${total} total`;
    unassignedCount.className   = `badge ${unassigned > 0 ? 'badge-warn' : 'badge-ok'}`;
}

addBucketBtn.addEventListener('click', () => addCourseBucket());

function addCourseBucket(name = '') {
    bucketCounter++;
    const id = `bucket-${bucketCounter}`;

    const template = document.getElementById('bucket-template');
    const clone = template.content.cloneNode(true);
    const bucket = clone.querySelector('.course-bucket');
    bucket.dataset.bucketId = id;

    const nameInput = bucket.querySelector('.bucket-name-input');
    if (name) nameInput.value = name;

    bucket.querySelector('.remove-bucket-btn').addEventListener('click', () => {
        // Unassign all chips currently in this bucket
        const chips = bucket.querySelectorAll('[data-slot-key]');
        chips.forEach(c => {
            const key = c.dataset.slotKey;
            chipAssignment[key] = '';
            const origChip = slotChipsEl.querySelector(`[data-slot-key="${key}"]`);
            if (origChip) {
                origChip.classList.remove('assigned-chip');
                origChip.classList.add('unassigned-chip');
                origChip.title = 'Click to assign to a course';
            }
        });
        bucket.remove();
        updateUnassignedCount();
    });

    courseBuckets.appendChild(bucket);
    return id;
}

// ── Collect final course data before generation ───────────────────────────────

/**
 * Return course data ready for /api/generate from whichever review panel is active.
 * @returns {{ courses: Array<{course:string, options:string[][]}>|null, error: string|null }}
 */
function collectCourseData() {
    // Panel A: structured courses from OCR
    if (!structuredPanel.classList.contains('hidden')) {
        const cards = ocrCoursesList.querySelectorAll('.ocr-course-card');
        const courses = [];
        cards.forEach((card, idx) => {
            const nameInput = card.querySelector('.ocr-course-name-input');
            const name = nameInput ? nameInput.value.trim() : `Course ${idx + 1}`;
            const chips = card.querySelectorAll('.slot-chip');
            const options = [];
            chips.forEach(chip => {
                const optSlots = chip.textContent.trim().split('+').map(s => s.trim()).filter(Boolean);
                if (optSlots.length > 0) options.push(optSlots);
            });
            if (options.length > 0) courses.push({ course: name || `Course ${idx + 1}`, options });
        });
        if (courses.length === 0) return { courses: null, error: '⚠ No courses with slot options found.' };
        return { courses, error: null };
    }

    // Panel B: bucket-based grouping
    if (!groupingPanel.classList.contains('hidden')) {
        const buckets = courseBuckets.querySelectorAll('.course-bucket');
        const courses = [];
        buckets.forEach((bucket, idx) => {
            const nameInput = bucket.querySelector('.bucket-name-input');
            const name = nameInput ? nameInput.value.trim() : `Course ${idx + 1}`;
            const slotsDiv = bucket.querySelector('.bucket-slots');
            const options = [];
            slotsDiv.querySelectorAll('[data-slot-key]').forEach(tag => {
                const optSlots = tag.dataset.slotKey.split('+').map(s => s.trim()).filter(Boolean);
                if (optSlots.length > 0) options.push(optSlots);
            });
            if (options.length > 0) courses.push({ course: name || `Course ${idx + 1}`, options });
        });
        if (courses.length === 0) return { courses: null, error: '⚠ Assign at least one slot to a course.' };
        return { courses, error: null };
    }

    return { courses: null, error: '⚠ Upload a screenshot first.' };
}

// ── Generate ──────────────────────────────────────────────────────────────────
generateBtn.addEventListener('click', generateTimetables);

async function generateTimetables() {
    const { courses, error } = collectCourseData();
    if (!courses) {
        generateStatus.textContent = error || '⚠ No course data available.';
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

        let data;
        try {
            data = await resp.json();
        } catch {
            generateStatus.textContent = '❌ Server error: could not parse response.';
            return;
        }

        if (!resp.ok || !data.success) {
            generateStatus.textContent = `❌ ${data.error || 'Generation failed.'}`;
            return;
        }

        if (data.schedules.length === 0) {
            generateStatus.textContent = '⚠ No conflict-free timetables found. Try different slot options.';
            return;
        }

        currentSchedules = data.schedules;
        displayResults(data);
        show(resultsSection);
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
        generateStatus.textContent = `❌ Network error: ${err.message}`;
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '✨ Generate Best Timetables';
    }
}

// ── Display Results ───────────────────────────────────────────────────────────
function displayResults(data) {
    resultsSummary.textContent =
        `Found ${data.totalFound} valid timetable${data.totalFound !== 1 ? 's' : ''}. Showing top ${data.schedules.length}.`;

    scheduleTabs.innerHTML = '';
    data.schedules.forEach((item, idx) => {
        const tab = document.createElement('button');
        tab.className = 'schedule-tab' + (idx === 0 ? ' active' : '');
        tab.textContent = `Schedule ${idx + 1}  (score: ${item.score})`;
        tab.addEventListener('click', () => selectSchedule(idx));
        scheduleTabs.appendChild(tab);
    });

    activeTabIndex = 0;
    selectSchedule(0);
}

function selectSchedule(index) {
    activeTabIndex = index;

    scheduleTabs.querySelectorAll('.schedule-tab').forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
    });

    const { schedule } = currentSchedules[index];
    TimetableRenderer.renderTimetable(timetableGrid, schedule);

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
    await TimetableRenderer.downloadTimetableAsPNG(
        timetableGrid,
        `timetable-schedule-${activeTabIndex + 1}.png`
    );
});

// ── Pin ───────────────────────────────────────────────────────────────────────
pinBtn.addEventListener('click', () => {
    if (!currentSchedules.length) return;
    const item = currentSchedules[activeTabIndex];
    pinnedSchedules.push({ ...item, pinnedAt: Date.now() });
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

