'use strict';

/**
 * Slot pattern: matches individual slots like A1, TA1, TAA1, L26, SC1, SE2, etc.
 * Covers: single letter+digit, T+letter(s)+digit, L+digit(s), S+letter+digit
 */
const SLOT_PATTERN = /\b(L\d{1,2}|T[A-Z]{1,2}\d|S[A-Z]\d|[A-Z]\d)\b/g;

/**
 * VIT course-code pattern.
 * Matches standard theory codes (e.g. CSE1003, PHY1001, MAT2001)
 * and lab suffixed codes (e.g. CSE1003L, CHE1001P) via the optional trailing letter.
 */
const COURSE_CODE_PATTERN = /\b([A-Z]{2,4}\d{4}[A-Z]?)\b/;

/**
 * A compound slot string like "C1+TCC1" or "L26+L27".
 * Returns an array of individual slot strings.
 * @param {string} compound
 * @returns {string[]}
 */
function parseCompoundSlot(compound) {
    return compound
        .toUpperCase()
        .split('+')
        .map(s => s.trim())
        .filter(Boolean);
}

/**
 * Detect slot option groups from a single line of OCR text.
 * A line may look like:  "C1+TCC1   Mohinder Singh"
 * We extract the slot portion (the first token before spaces/faculty name).
 * @param {string} line
 * @returns {string[]|null} Array of individual slots, or null if no slots found.
 */
function extractSlotsFromLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Take the first token
    const firstToken = trimmed.split(/\s+/)[0];

    // Check it contains at least one valid slot
    const matches = firstToken.match(SLOT_PATTERN);
    if (!matches || matches.length === 0) return null;

    return parseCompoundSlot(firstToken);
}

/**
 * Parse raw OCR text into structured course data.
 *
 * Strategy:
 *  1. Scan lines for VIT course-code headers (e.g. "CSE1003 Computer Networks").
 *  2. When a header is found, begin a new course group.
 *  3. Slot rows below a header are collected as options for that course.
 *  4. If NO course headers are found, return all slot groups ungrouped so the
 *     frontend can ask the user to organise them.
 *
 * @param {string} rawText
 * @returns {{
 *   courses: Array<{ name: string, code: string, options: string[][] }>,
 *   rawSlots: string[][],
 *   lines: string[]
 * }}
 */
function parseOCRText(rawText) {
    const textStr = typeof rawText === 'string' ? rawText : (rawText && rawText.text ? rawText.text : String(rawText || ''));
    const lines = textStr
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

    const rawSlots = [];      // all detected slot groups (flat)
    const processedLines = [];

    // ── Pass 1: collect every slot group and flag course-header lines ──────────
    const annotated = lines.map(line => {
        const codeMatch = line.match(COURSE_CODE_PATTERN);
        const slots     = extractSlotsFromLine(line);

        if (slots) {
            rawSlots.push(slots);
            processedLines.push(line);
        }

        return { line, courseCode: codeMatch ? codeMatch[1] : null, slots };
    });

    // ── Pass 2: build per-course groups when headers were found ────────────────
    const courseHeaders = annotated.filter(a => a.courseCode && !a.slots);

    const courses = [];

    if (courseHeaders.length > 0) {
        let currentCourse = null;

        for (const a of annotated) {
            if (a.courseCode && !a.slots) {
                // Start of a new course block.
                // Extract a human-readable name: everything after the code.
                const nameMatch = a.line.match(
                    /[A-Z]{2,4}\d{4}[A-Z]?\s*[-–]?\s*(.*)/
                );
                const courseName = nameMatch ? nameMatch[1].trim() : a.courseCode;

                currentCourse = {
                    code: a.courseCode,
                    name: courseName || a.courseCode,
                    options: []
                };
                courses.push(currentCourse);
            } else if (a.slots && currentCourse) {
                // This slot row belongs to the current course.
                currentCourse.options.push(a.slots);
            } else if (a.slots && !currentCourse) {
                // Slot before any course header — make an "Unknown" course.
                currentCourse = { code: '', name: 'Unknown Course', options: [a.slots] };
                courses.push(currentCourse);
            }
        }

        // Remove courses with no slot options (pure header lines with no data below).
        return {
            courses: courses.filter(c => c.options.length > 0),
            rawSlots,
            lines: processedLines
        };
    }

    // ── No course headers found – return raw slots only ────────────────────────
    return {
        courses: [],   // empty → frontend will show grouping UI
        rawSlots,
        lines: processedLines
    };
}

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
