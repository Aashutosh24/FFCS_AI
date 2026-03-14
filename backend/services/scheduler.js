'use strict';

const slotDB = require('../data/slotDB.json');

/**
 * Get all timetable time-blocks for a given slot name.
 * @param {string} slot  e.g. "A1"
 * @returns {{ day:string, period:number, type:string }[]}
 */
function getSlotBlocks(slot) {
    return slotDB[slot] || [];
}

/**
 * Get all time-blocks for a compound slot option (e.g. ["C1","TCC1"]).
 * @param {string[]} slots
 * @returns {{ day:string, period:number, type:string }[]}
 */
function getOptionBlocks(slots) {
    return slots.flatMap(s => getSlotBlocks(s));
}

/**
 * Check if two sets of blocks conflict (same day + same period).
 * @param {{ day:string, period:number }[]} blocksA
 * @param {{ day:string, period:number }[]} blocksB
 * @returns {boolean}
 */
function hasConflict(blocksA, blocksB) {
    for (const a of blocksA) {
        for (const b of blocksB) {
            if (a.day === b.day && a.period === b.period) return true;
        }
    }
    return false;
}

/**
 * Build all valid timetable combinations using backtracking + pruning.
 *
 * @param {Array<{ course: string, options: string[][] }>} courses
 *   Each course has multiple slot options; each option is an array of slot names.
 * @param {number} [maxResults=50]  Stop after collecting this many valid schedules.
 * @returns {Array<Array<{ course: string, slots: string[], blocks: object[] }>>}
 *   Array of valid schedules. Each schedule is an array of chosen options (one per course).
 */
function generateSchedules(courses, maxResults = 50) {
    const results = [];

    /**
     * @param {number} courseIndex  Current course being placed.
     * @param {Array<{ course:string, slots:string[], blocks:object[] }>} current  Chosen so far.
     * @param {{ day:string, period:number }[]} usedBlocks  All occupied time blocks so far.
     */
    function backtrack(courseIndex, current, usedBlocks) {
        if (results.length >= maxResults) return;

        if (courseIndex === courses.length) {
            results.push([...current]);
            return;
        }

        const { course, options } = courses[courseIndex];

        for (const optionSlots of options) {
            const blocks = getOptionBlocks(optionSlots);

            // Skip options with unknown slots (no blocks found at all but slots listed)
            if (blocks.length === 0 && optionSlots.length > 0) continue;

            // Prune if any block conflicts with already placed blocks
            if (hasConflict(blocks, usedBlocks)) continue;

            current.push({ course, slots: optionSlots, blocks });
            backtrack(courseIndex + 1, current, usedBlocks.concat(blocks));
            current.pop();
        }
    }

    backtrack(0, [], []);
    return results;
}

module.exports = { generateSchedules, getSlotBlocks, getOptionBlocks, hasConflict };
