const sharp = require("sharp");
const { createWorker } = require("tesseract.js");

/**
 * Preprocess image for better OCR:
 * - auto rotate
 * - grayscale
 * - normalize contrast
 * - binarize
 */
async function preprocessImage(inputPath) {
  const outputBuffer = await sharp(inputPath)
    .rotate()
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(165) // tune 140-190 based on screenshot quality
    .toBuffer();

  return outputBuffer;
}

/**
 * OCR using Tesseract.js
 */
async function extractTextFromImage(inputPath) {
  const processed = await preprocessImage(inputPath);

  const worker = await createWorker("eng");
  try {
    // Optional tuning:
    await worker.setParameters({
      tessedit_pageseg_mode: "6", // Assume a block of text/table-ish content
      preserve_interword_spaces: "1",
    });

    const {
      data: { text, confidence },
    } = await worker.recognize(processed);

    return { text, confidence };
  } finally {
    await worker.terminate();
  }
}

module.exports = {
  extractTextFromImage,
};