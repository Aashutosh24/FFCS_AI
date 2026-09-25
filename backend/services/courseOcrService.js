'use strict';

/**
 * courseOcrService.js
 *
 * Bridge between the Node.js backend and the Python `course_ocr` pipeline.
 * Spawns `python -m src.main <input_path> --out-dir <out_dir>` from inside
 * the course_ocr package directory, then reads back results.json.
 *
 * The course_ocr source code (course_ocr/src/**) is NEVER modified.
 * This service is purely a caller/reader on top of that pipeline.
 */

const path = require('path');
const fs   = require('fs');
const { spawn } = require('child_process');

// Absolute path to the course_ocr package root (sibling of backend/)
const COURSE_OCR_DIR = path.resolve(__dirname, '../../course_ocr');

// The output directory that course_ocr writes into (unchanged per spec)
const COURSE_OCR_OUT_DIR = path.join(COURSE_OCR_DIR, 'output');

/**
 * Run the course_ocr Python pipeline on a PDF folder or .zip archive and
 * resolve with the parsed results.json array.
 *
 * @param {string} inputPath  Absolute path to a PDF folder or .zip file.
 * @returns {Promise<Array>}
 */
function runCourseOcr(inputPath) {
    return new Promise((resolve, reject) => {
        const args = ['-m', 'src.main', inputPath, '--out-dir', COURSE_OCR_OUT_DIR];

        const proc = spawn('python', args, {
            cwd: COURSE_OCR_DIR,
            env: process.env,  // preserve PATH, TESSDATA_PREFIX, etc.
        });

        let stderr = '';
        proc.stderr.on('data', chunk => { stderr += chunk.toString(); });

        proc.on('error', err => {
            reject(new Error(
                `Failed to start Python: ${err.message}. ` +
                `Ensure Python is on PATH and course_ocr deps are installed.`
            ));
        });

        proc.on('close', exitCode => {
            if (exitCode !== 0) {
                return reject(new Error(
                    `course_ocr exited with code ${exitCode}.\nStderr:\n${stderr.slice(0, 2000)}`
                ));
            }

            const resultsPath = path.join(COURSE_OCR_OUT_DIR, 'results.json');
            if (!fs.existsSync(resultsPath)) {
                return reject(new Error(
                    'course_ocr ran but results.json was not found in the output directory.'
                ));
            }

            let results;
            try {
                results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
            } catch (e) {
                return reject(new Error(`Failed to parse results.json: ${e.message}`));
            }

            resolve(results);
        });
    });
}

/**
 * Transform raw results.json array into the frontend-friendly shape.
 *
 * Each item becomes:
 * {
 *   code, name, component, credit,
 *   confidence, sourceFile,
 *   theorySlots: [{ slot, venue, faculty, flags }],
 *   labSlots:    [{ slot, venue, faculty, flags }],
 *   warnings, error, needsOcr, missingFields
 * }
 */
function transformResults(rawResults) {
    return rawResults.map(r => ({
        code:          r.course_code    || null,
        name:          r.course_name    || null,
        component:     r.component_type || null,
        credit:        r.credit         || null,
        confidence:    r.confidence     || 'unknown',
        sourceFile:    r.source_file    || '',
        theorySlots:   r.theory_slots   || [],
        labSlots:      r.lab_slots      || [],
        warnings:      r.warnings       || [],
        error:         r.error          || null,
        needsOcr:      r.needs_ocr      || false,
        missingFields: r.missing_fields || [],
    }));
}

module.exports = { runCourseOcr, transformResults, COURSE_OCR_OUT_DIR };
