'use strict';

/**
 * Matches compound slots joined by '+' or space-'+'-space, e.g.:
 * "C1+TCC1", "F1 + TF1", "A1+TA1+TAA1", "L1+L2", "B1", "L31"
 */
const COMPOUND_SLOT_PATTERN = /\b(?:L\d{1,2}|T[A-Z]{1,2}\d|S[A-Z]\d|[A-G]\d)(?:\s*\+\s*(?:L\d{1,2}|T[A-Z]{1,2}\d|S[A-Z]\d|[A-G]\d))*\b/gi;

/**
 * VIT course-code pattern:
 * Matches 2-4 letters followed by 4 digits, optional letter (e.g. CSE3001, MAT2001, PHY1001L)
 */
const COURSE_CODE_PATTERN = /\b([A-Z]{2,4}\d{4}[A-Z]?)\b/i;

/**
 * Extract all valid slot strings from a line (normalizing "F1 + TF1" -> "F1+TF1")
 */
function extractAllSlotsFromLine(line) {
    if (!line) return [];
    const matches = line.match(COMPOUND_SLOT_PATTERN);
    if (!matches) return [];

    return matches.map(m => m.replace(/\s+/g, '').toUpperCase());
}

/**
 * Clean course title from raw text line
 */
function cleanCourseName(rawName) {
    if (!rawName) return '';
    return rawName
        .replace(/^[\s\-–:\d\.\(\)]+/, '')
        .replace(/[\s\-–:\d\.\(\)]+$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Parse raw OCR text into structured courses and slot groups.
 */
function parseOCRText(rawText) {
    const textStr = typeof rawText === 'string' ? rawText : (rawText && rawText.text ? rawText.text : String(rawText || ''));
    const lines = textStr
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

    const rawSlotStrings = [];
    const courses = [];
    let currentCourse = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const codeMatch = line.match(COURSE_CODE_PATTERN);
        const slotsOnLine = extractAllSlotsFromLine(line);

        if (slotsOnLine.length > 0) {
            slotsOnLine.forEach(s => {
                if (!rawSlotStrings.includes(s)) rawSlotStrings.push(s);
            });
        }

        // Case 1: Line has both course code AND slot(s) -> Standard table row!
        if (codeMatch && slotsOnLine.length > 0) {
            const courseCode = codeMatch[1].toUpperCase();

            // Extract course title between code and first slot, or before code
            let namePart = line;
            const slotIdx = line.indexOf(slotsOnLine[0]);
            const codeIdx = line.indexOf(codeMatch[1]);
            if (codeIdx !== -1 && slotIdx > codeIdx) {
                namePart = line.substring(codeIdx + codeMatch[1].length, slotIdx);
            } else if (codeIdx > 0) {
                namePart = line.substring(0, codeIdx);
            }

            let cleanName = cleanCourseName(namePart);
            if (!cleanName || cleanName.length < 2) cleanName = courseCode;

            let existing = courses.find(c => c.code === courseCode);
            if (!existing) {
                existing = {
                    code: courseCode,
                    name: cleanName,
                    slots: [],
                    options: []
                };
                courses.push(existing);
            } else if (existing.name === courseCode && cleanName !== courseCode) {
                existing.name = cleanName;
            }

            slotsOnLine.forEach(s => {
                if (!existing.slots.includes(s)) existing.slots.push(s);
                const optKey = s.split('+').sort().join('+');
                const alreadyHas = existing.options.some(opt => opt.slice().sort().join('+') === optKey);
                if (!alreadyHas) {
                    existing.options.push(s.split('+'));
                }
            });
            currentCourse = existing;
            continue;
        }

        // Case 2: Line has course code without slot -> Header line or timetable card label
        if (codeMatch && slotsOnLine.length === 0) {
            const courseCode = codeMatch[1].toUpperCase();

            // Name could be after code or before code
            const codeIdx = line.toUpperCase().indexOf(courseCode);
            let before = line.substring(0, codeIdx);
            let after = line.substring(codeIdx + courseCode.length);

            let cleanBefore = cleanCourseName(before);
            let cleanAfter = cleanCourseName(after);

            let courseName = cleanAfter || cleanBefore;

            // Check if line right before this was an orphaned title line
            if (cleanBefore && i > 0) {
                const prev = lines[i - 1];
                if (prev && !prev.match(COURSE_CODE_PATTERN) && extractAllSlotsFromLine(prev).length === 0 && prev.length < 60 && !prev.includes(':')) {
                    courseName = cleanCourseName(prev + ' ' + cleanBefore);
                }
            }

            if (!courseName || courseName.length < 2) courseName = courseCode;

            let existing = courses.find(c => c.code === courseCode);
            if (!existing) {
                existing = {
                    code: courseCode,
                    name: courseName,
                    slots: [],
                    options: []
                };
                courses.push(existing);
            } else if (existing.name === courseCode && courseName !== courseCode) {
                existing.name = courseName;
            }

            currentCourse = existing;
            continue;
        }

        // Case 3: Line has slots without course code
        if (!codeMatch && slotsOnLine.length > 0) {
            if (currentCourse) {
                slotsOnLine.forEach(s => {
                    if (!currentCourse.slots.includes(s)) currentCourse.slots.push(s);
                    const optKey = s.split('+').sort().join('+');
                    const alreadyHas = currentCourse.options.some(opt => opt.slice().sort().join('+') === optKey);
                    if (!alreadyHas) {
                        currentCourse.options.push(s.split('+'));
                    }
                });
            } else {
                slotsOnLine.forEach(s => {
                    courses.push({
                        code: '',
                        name: `Course (${s})`,
                        slots: [s],
                        options: [s.split('+')]
                    });
                });
            }
        }
    }

    const validCourses = courses.filter(c => c.options.length > 0);

    return {
        courses: validCourses,
        detectedSlots: rawSlotStrings,
        rawSlots: rawSlotStrings.map(s => s.split('+')),
        lines
    };
}

function parseCompoundSlot(compound) {
    if (!compound) return [];
    return compound
        .toUpperCase()
        .split('+')
        .map(s => s.trim())
        .filter(Boolean);
}

const SLOT_PATTERN = COMPOUND_SLOT_PATTERN;

/**
 * Validate that all slots in a compound slot array exist in the slot DB.
 * Returns unknown slots.
 * @param {string[]} slots
 * @param {Object} slotDB
 * @returns {string[]} Unknown slot names
 */
function validateSlots(slots, slotDB) {
    return slots.filter(s => !slotDB[s]);
}

module.exports = { parseOCRText, parseCompoundSlot, validateSlots, SLOT_PATTERN };
