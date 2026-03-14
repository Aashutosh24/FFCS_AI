/**
 * timetableRenderer.js
 * Renders a schedule into the #timetable-grid element.
 */

'use strict';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_LABELS = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat' };

// Period index → display label
const PERIOD_LABELS = [
    '8:00–8:50',
    '9:00–9:50',
    '10:00–10:50',
    '11:00–11:50',
    '12:00–12:50',
    // period 5 = LUNCH (handled separately)
    '2:00–2:50',
    '3:00–3:50',
    '4:00–4:50',
    '5:00–5:50',
    '6:00–6:50'
];
const PERIODS_BEFORE_LUNCH = [0, 1, 2, 3, 4];  // periods 0-4
const PERIODS_AFTER_LUNCH  = [6, 7, 8, 9, 10]; // periods 6-10

/**
 * Build a lookup map: { "TUE-1": { course, type } }
 * @param {Array<{ course:string, slots:string[], blocks:Array }>} schedule
 * @returns {Object}
 */
function buildLookup(schedule) {
    const map = {};
    for (const entry of schedule) {
        for (const block of entry.blocks) {
            const key = `${block.day}-${block.period}`;
            if (!map[key]) {
                map[key] = { course: entry.course, type: block.type };
            } else {
                // Multiple slots same cell — append
                map[key].course += '\n' + entry.course;
            }
        }
    }
    return map;
}

/**
 * Render the timetable into the given container element.
 * @param {HTMLElement} container
 * @param {Array} schedule
 */
function renderTimetable(container, schedule) {
    container.innerHTML = '';

    const lookup = buildLookup(schedule);

    // ── Header row ──
    const headerCorner = document.createElement('div');
    headerCorner.className = 'tg-header tg-header time-col';
    headerCorner.textContent = 'Time';
    container.appendChild(headerCorner);

    for (const day of DAYS) {
        const h = document.createElement('div');
        h.className = 'tg-header';
        h.textContent = DAY_LABELS[day];
        container.appendChild(h);
    }

    // ── Period rows ──
    function renderPeriodRow(period, label) {
        const timeCell = document.createElement('div');
        timeCell.className = 'tg-time';
        timeCell.textContent = label;
        container.appendChild(timeCell);

        for (const day of DAYS) {
            const key = `${day}-${period}`;
            const cell = document.createElement('div');
            cell.className = 'tg-cell';

            const entry = lookup[key];
            if (entry) {
                const inner = document.createElement('div');
                inner.className = entry.type === 'lab' ? 'cell-lab' : 'cell-theory';
                inner.textContent = entry.course;
                inner.title = `${entry.course} (${entry.type})`;
                cell.appendChild(inner);
            }
            container.appendChild(cell);
        }
    }

    for (let i = 0; i < PERIODS_BEFORE_LUNCH.length; i++) {
        renderPeriodRow(PERIODS_BEFORE_LUNCH[i], PERIOD_LABELS[i]);
    }

    // ── Lunch break ──
    const lunch = document.createElement('div');
    lunch.className = 'tg-lunch';
    lunch.textContent = '🍱  LUNCH  1:00–2:00';
    lunch.style.gridColumn = '1 / -1';
    container.appendChild(lunch);

    for (let i = 0; i < PERIODS_AFTER_LUNCH.length; i++) {
        renderPeriodRow(PERIODS_AFTER_LUNCH[i], PERIOD_LABELS[5 + i]);
    }
}

/**
 * Download the timetable grid as a PNG image.
 * @param {HTMLElement} gridEl  The .timetable-grid element.
 * @param {string} filename
 */
async function downloadTimetableAsPNG(gridEl, filename = 'timetable.png') {
    // Use html2canvas if available; otherwise fall back to a simple message
    if (typeof html2canvas !== 'undefined') {
        const canvas = await html2canvas(gridEl, { backgroundColor: '#1a1d27', scale: 2 });
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } else {
        alert('Download requires the html2canvas library. For now, please use your browser\'s screenshot function (Print > Save as PDF).');
    }
}

// Export for use in app.js
window.TimetableRenderer = { renderTimetable, downloadTimetableAsPNG };
