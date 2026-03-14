'use strict';

/**
 * Slot pattern: matches individual slots like A1, TA1, TAA1, L26, SC1, SE2, etc.
 * Covers: single letter+digit, T+letter(s)+digit, L+digit(s), S+letter+digit
 */
const SLOT_PATTERN = /\b(L\d{1,2}|T[A-Z]{1,2}\d|S[A-Z]\d|[A-Z]\d)\b/g;

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
    // The slot group is usually the first "word" in the line (before spaces)
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
 * Parse raw OCR text into a list of course slot option groups.
 *
 * The OCR output typically has rows like:
 *   C1+TCC1  Mohinder Singh
 *   F2+TF2   Nandha Kumar
 *   L26+L27  Prabha Selvaraj
 *
 * We group consecutive rows that belong to the same course (same faculty block),
 * but since we can't reliably tell course boundaries from OCR alone, we return
 * each distinct slot group as an option. Callers are expected to group options
 * per course via the manual input flow when OCR is insufficient.
 *
 * @param {string} rawText
 * @returns {{ rawSlots: string[][], lines: string[] }}
 */
function parseOCRText(rawText) {
    const lines = rawText
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

    const rawSlots = [];
    const processedLines = [];

    for (const line of lines) {
        const slots = extractSlotsFromLine(line);
        if (slots) {
            rawSlots.push(slots);
            processedLines.push(line);
        }
    }

    return { rawSlots, lines: processedLines };
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
