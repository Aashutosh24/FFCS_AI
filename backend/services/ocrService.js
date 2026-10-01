const path = require("path");
const sharp = require("sharp");
const { createWorker } = require("tesseract.js");

const LANG_PATH = path.resolve(__dirname, "..");

/**
 * Scale image up if it is small or low DPI, for optimal Tesseract recognition
 */
async function preparePipeline(inputBuffer, scaleUp = true) {
  let pipeline = sharp(inputBuffer).rotate();
  if (scaleUp) {
    const meta = await sharp(inputBuffer).metadata();
    if (meta.width && meta.width < 1600) {
      pipeline = pipeline.resize({
        width: Math.min(meta.width * 2, 2400),
        kernel: "lanczos3",
      });
    }
  }
  return pipeline;
}

/**
 * Standard enhanced grayscale
 */
async function preprocessGrayscale(inputBuffer) {
  const p = await preparePipeline(inputBuffer);
  return await p
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.2 })
    .toBuffer();
}

/**
 * Color-channel separation (Red channel)
 * Maximizes contrast for warm-colored cards (red, orange, pink) with cyan/blue/dark text
 */
async function preprocessRedChannel(inputBuffer) {
  const p = await preparePipeline(inputBuffer);
  return await p
    .extractChannel("red")
    .normalize()
    .sharpen({ sigma: 1.5 })
    .toBuffer();
}

/**
 * Color-channel separation (Blue channel)
 * Maximizes contrast for cool-colored cards (blue, cyan, green) with yellow/red/dark text
 */
async function preprocessBlueChannel(inputBuffer) {
  const p = await preparePipeline(inputBuffer);
  return await p
    .extractChannel("blue")
    .normalize()
    .sharpen({ sigma: 1.5 })
    .toBuffer();
}

/**
 * High-contrast threshold fallback
 */
async function preprocessThreshold(inputBuffer) {
  const p = await preparePipeline(inputBuffer);
  return await p
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(160)
    .toBuffer();
}

/**
 * Check if text contains likely VIT slot or course patterns
 */
function textHasCourseSignals(text) {
  if (!text) return false;
  // Match standard slots like A1, B1, TFF1, L1+L2, or course codes like CSE3001
  return /\b([A-Z]{2,4}\d{4}|[A-G]\d|T[A-Z]{1,2}\d|L\d{1,2})\b/i.test(text);
}

/**
 * OCR using Tesseract.js with multi-pass color channel adaptation
 */
async function extractTextFromImage(inputBuffer) {
  const worker = await createWorker("eng", 1, {
    langPath: LANG_PATH,
    cachePath: LANG_PATH,
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: "6", // Assume uniform block of text
      preserve_interword_spaces: "1",
    });

    // Pass 1: Standard enhanced grayscale
    const grayBuffer = await preprocessGrayscale(inputBuffer);
    let { data: { text, confidence } } = await worker.recognize(grayBuffer);

    // If text already has strong course signals, return immediately
    if (text && textHasCourseSignals(text) && text.trim().length > 30) {
      return { text: text || "", confidence: confidence || 0 };
    }

    // Pass 2: Red channel separation (handles red/orange timetable cards with blue/cyan text)
    try {
      const redBuffer = await preprocessRedChannel(inputBuffer);
      const resRed = await worker.recognize(redBuffer);
      if (resRed.data.text && textHasCourseSignals(resRed.data.text)) {
        return { text: resRed.data.text, confidence: resRed.data.confidence };
      }
      // If red channel produced significantly more text, keep it
      if (resRed.data.text && resRed.data.text.trim().length > (text ? text.trim().length : 0)) {
        text = resRed.data.text;
        confidence = resRed.data.confidence;
      }
    } catch (_) {}

    // Pass 3: Blue channel separation (handles blue/cyan timetable cards)
    try {
      const blueBuffer = await preprocessBlueChannel(inputBuffer);
      const resBlue = await worker.recognize(blueBuffer);
      if (resBlue.data.text && textHasCourseSignals(resBlue.data.text)) {
        return { text: resBlue.data.text, confidence: resBlue.data.confidence };
      }
      if (resBlue.data.text && resBlue.data.text.trim().length > (text ? text.trim().length : 0)) {
        text = resBlue.data.text;
        confidence = resBlue.data.confidence;
      }
    } catch (_) {}

    // Pass 4: Threshold fallback for low-contrast/faint text
    if (!text || text.trim().length < 20) {
      try {
        const thresholdBuffer = await preprocessThreshold(inputBuffer);
        const resThresh = await worker.recognize(thresholdBuffer);
        if (resThresh.data.text && resThresh.data.text.trim().length > (text ? text.trim().length : 0)) {
          text = resThresh.data.text;
          confidence = resThresh.data.confidence;
        }
      } catch (_) {}
    }

    return { text: text || "", confidence: confidence || 0 };
  } finally {
    await worker.terminate();
  }
}

module.exports = {
  extractTextFromImage,
};