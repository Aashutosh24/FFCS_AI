'use strict';

const { createWorker } = require('tesseract.js');

const OCR_TIMEOUT_MS = 120_000; // 2 minutes

// ── Singleton worker ──────────────────────────────────────────────────────────
// We keep one persistent Tesseract worker so language data is downloaded once
// (on server start) rather than on every request.  If the initial download
// fails the promise is reset so the next request gets a fresh attempt.

let initPromise = null;

/**
 * Return the singleton Tesseract worker, initialising it on first call.
 * @returns {Promise<import('tesseract.js').Worker>}
 */
function getWorker() {
    if (!initPromise) {
        initPromise = createWorker('eng').catch(err => {
            // Allow a retry on the next request if initialisation fails.
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

/**
 * Extract text from an image buffer using Tesseract OCR.
 * Throws if OCR takes longer than OCR_TIMEOUT_MS.
 * @param {Buffer} imageBuffer - The uploaded image data.
 * @returns {Promise<string>} Raw extracted text.
 */
async function extractTextFromImage(imageBuffer) {
    const worker = await Promise.race([
        getWorker(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Tesseract worker initialisation timed out')), OCR_TIMEOUT_MS)
        )
    ]);

    const recognisePromise = worker.recognize(imageBuffer).then(r => r.data.text);

    return Promise.race([
        recognisePromise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('OCR recognition timed out after 2 minutes')), OCR_TIMEOUT_MS)
        )
    ]);
}

module.exports = { extractTextFromImage };
