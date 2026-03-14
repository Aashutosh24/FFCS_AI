'use strict';

// Period index → hour of day (0-based period → actual start hour)
// Period 0  → 8:00, 1→9:00, 2→10:00, 3→11:00, 4→12:00,
// period 5 is LUNCH (skipped in scheduling), 6→14:00, 7→15:00, 8→16:00, 9→17:00, 10→18:00
const PERIOD_TO_HOUR = {
    0: 8, 1: 9, 2: 10, 3: 11, 4: 12,
    6: 14, 7: 15, 8: 16, 9: 17, 10: 18
};

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * Score a schedule. Lower score = better.
 *
 * Scoring factors:
 *  - earlyClasses (period 0 = 8:00): +3 per class (penalize very early starts)
 *  - lateClasses  (period 10 = 18:00): +3 per class
 *  - breakGaps: sum of wasted gap hours between classes on the same day × 5
 *
 * @param {Array<{ course: string, slots: string[], blocks: { day:string, period:number }[] }>} schedule
 * @param {object} preferences  { preferMorning, preferEvening, minimizeBreaks, freeDayPreference }
 * @returns {number} score
 */
function scoreSchedule(schedule, preferences = {}) {
    const {
        preferMorning = false,
        preferEvening = false,
        minimizeBreaks = true,
        freeDayPreference = null
    } = preferences;

    let score = 0;

    // Collect all blocks grouped by day
    const byDay = {};
    for (const entry of schedule) {
        for (const block of entry.blocks) {
            if (!byDay[block.day]) byDay[block.day] = [];
            byDay[block.day].push(block.period);
        }
    }

    for (const day of DAYS) {
        const periods = (byDay[day] || []).slice().sort((a, b) => a - b);
        if (periods.length === 0) continue;

        // Free day bonus
        if (freeDayPreference && day === freeDayPreference.toUpperCase()) {
            score += periods.length * 10; // heavy penalty for having classes on preferred free day
        }

        // Early / late class penalties
        for (const p of periods) {
            if (p === 0) score += preferEvening ? 5 : (preferMorning ? -2 : 3);
            if (p === 10) score += preferMorning ? 5 : (preferEvening ? -2 : 3);
            if (p >= 1 && p <= 4 && preferMorning) score -= 1; // reward morning
            if (p >= 6 && p <= 9 && preferEvening) score -= 1; // reward evening
        }

        // Break gap penalty: sum of internal gaps between consecutive classes
        if (minimizeBreaks && periods.length > 1) {
            for (let i = 1; i < periods.length; i++) {
                const gap = periods[i] - periods[i - 1] - 1;
                // Gap of 1 period (lunch break excluded) counts differently
                if (gap > 0) {
                    score += gap * 5;
                }
            }
        }
    }

    return score;
}

/**
 * Rank schedules by score (ascending = best first) and return the top N.
 * @param {Array<Array>} schedules
 * @param {object} preferences
 * @param {number} [topN=5]
 * @returns {Array<{ schedule: Array, score: number }>}
 */
function rankSchedules(schedules, preferences = {}, topN = 5) {
    const scored = schedules.map(schedule => ({
        schedule,
        score: scoreSchedule(schedule, preferences)
    }));

    scored.sort((a, b) => a.score - b.score);

    return scored.slice(0, topN);
}

module.exports = { rankSchedules, scoreSchedule };
