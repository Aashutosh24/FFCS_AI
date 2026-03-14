'use strict';

const { createWorker } = require('tesseract.js');
const path = require('path');

/**
 * Extract text from an image buffer using Tesseract OCR.
 * @param {Buffer} imageBuffer - The uploaded image data.
 * @returns {Promise<string>} Raw extracted text.
 */
async function extractTextFromImage(imageBuffer) {
    const worker = await createWorker('eng');
    try {
        const { data: { text } } = await worker.recognize(imageBuffer);
        return text;
    } finally {
        await worker.terminate();
    }
}

module.exports = { extractTextFromImage };
