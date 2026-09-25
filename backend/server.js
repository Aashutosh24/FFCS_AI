'use strict';

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const rateLimit = require('express-rate-limit');

const { extractTextFromImage } = require('./services/ocrService');
const { parseOCRText } = require('./services/parser');
const { generateSchedules } = require('./services/scheduler');
const { rankSchedules } = require('./services/optimizer');
const { runCourseOcr, transformResults, COURSE_OCR_OUT_DIR } = require('./services/courseOcrService');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Rate limiters ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many upload requests, please try again later.' }
});

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Multer – in-memory storage for uploaded images ──────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter(_req, file, cb) {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are accepted (JPEG, PNG, GIF, WEBP, BMP).'));
        }
    }
});

// ── Multer – disk storage for PDF / ZIP uploads (course_ocr pipeline) ────────
const pdfUploadDir = path.join(os.tmpdir(), 'ffcs_ai_pdf_uploads');
if (!fs.existsSync(pdfUploadDir)) fs.mkdirSync(pdfUploadDir, { recursive: true });

const pdfUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, pdfUploadDir),
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
        }
    }),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB (batch of PDFs as ZIP)
    fileFilter(_req, file, cb) {
        const mime = file.mimetype;
        const ext  = path.extname(file.originalname).toLowerCase();
        const ok   = mime === 'application/pdf'
                  || mime === 'application/zip'
                  || mime === 'application/x-zip-compressed'
                  || ext === '.pdf'
                  || ext === '.zip';
        if (ok) cb(null, true);
        else cb(new Error('Only PDF or ZIP files are accepted for the course OCR pipeline.'));
    }
});

/**
 * Wrap multer so that any multer-level error is returned as JSON
 * instead of Express's default HTML error page.
 */
function uploadSingle(fieldName) {
    const multerMiddleware = upload.single(fieldName);
    return (req, res, next) => {
        multerMiddleware(req, res, err => {
            if (err) {
                return res.status(400).json({ success: false, error: err.message });
            }
            next();
        });
    };
}

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/upload
 * Accept a screenshot and extract slot text via OCR.
 * Returns rawText, structured courses (if course headers detected) and raw slot groups.
 */
app.post('/api/upload', uploadLimiter, uploadSingle('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image file provided.' });
        }

        const ocrResult = await extractTextFromImage(req.file.buffer);
        const rawText = typeof ocrResult === 'string' ? ocrResult : (ocrResult.text || '');
        const { courses, rawSlots, lines } = parseOCRText(rawText);

        return res.json({
            success: true,
            rawText,
            courses,        // structured: [{ code, name, options: string[][] }]
            detectedSlots: rawSlots,
            lines
        });
    } catch (err) {
        console.error('OCR error:', err);
        return res.status(500).json({ success: false, error: 'OCR processing failed.', detail: err.message });
    }
});

/**
 * POST /api/generate
 * Accept structured course data + preferences and return ranked timetables.
 *
 * Body:
 * {
 *   courses: [
 *     { course: "CN", options: [["C1","TCC1"], ["F2","TF2"]] },
 *     ...
 *   ],
 *   preferences: {
 *     preferMorning: false,
 *     preferEvening: false,
 *     minimizeBreaks: true,
 *     freeDayPreference: "SAT"   // optional
 *   },
 *   topN: 5
 * }
 */
app.post('/api/generate', apiLimiter, (req, res) => {
    try {
        const { courses, preferences = {}, topN = 5 } = req.body;

        if (!Array.isArray(courses) || courses.length === 0) {
            return res.status(400).json({ success: false, error: 'courses array is required and must not be empty.' });
        }

        // Validate structure
        for (const c of courses) {
            if (!c.course || !Array.isArray(c.options) || c.options.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid course entry: ${JSON.stringify(c)}. Each course needs "course" (string) and "options" (array of slot arrays).`
                });
            }
        }

        const allSchedules = generateSchedules(courses, Math.min(topN * 100, 5000));
        const ranked = rankSchedules(allSchedules, preferences, topN);

        return res.json({
            success: true,
            totalFound: allSchedules.length,
            topN: ranked.length,
            schedules: ranked
        });
    } catch (err) {
        console.error('Generate error:', err);
        return res.status(500).json({ success: false, error: 'Schedule generation failed.', detail: err.message });
    }
});

/**
 * POST /api/pdf-ocr
 * Accept one or multiple PDFs, or a ZIP of PDFs, run the course_ocr Python pipeline on them,
 * and return the structured course extraction results.
 *
 * The uploaded files are saved to a temporary folder, the pipeline is run across all files,
 * and the combined results.json produced in course_ocr/output/ is read and returned.
 * The course_ocr source code is never modified.
 *
 * Form field: "pdfs" (supports single or multiple files)
 */
app.post('/api/pdf-ocr', uploadLimiter, (req, res, next) => {
    pdfUpload.array('pdfs', 50)(req, res, err => {
        if (err) return res.status(400).json({ success: false, error: err.message });
        next();
    });
}, async (req, res) => {
    const files = req.files || (req.file ? [req.file] : []);
    if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: 'No PDF or ZIP files provided.' });
    }

    let inputPath;
    let tempFolderCreated = null;

    try {
        // If single ZIP file uploaded, we can pass it directly
        if (files.length === 1 && path.extname(files[0].originalname).toLowerCase() === '.zip') {
            inputPath = files[0].path;
        } else {
            // For one or more PDFs, copy into a dedicated temp folder
            tempFolderCreated = path.join(pdfUploadDir, `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            fs.mkdirSync(tempFolderCreated, { recursive: true });

            for (const file of files) {
                const dest = path.join(tempFolderCreated, file.originalname);
                fs.copyFileSync(file.path, dest);
            }
            inputPath = tempFolderCreated;
        }

        const rawResults = await runCourseOcr(inputPath);
        const courses    = transformResults(rawResults);

        return res.json({
            success: true,
            totalFiles: rawResults.length,
            courses,
            // Keep output paths in the response for debugging / review.html link
            outputDir: COURSE_OCR_OUT_DIR,
        });

    } catch (err) {
        console.error('PDF OCR error:', err);
        return res.status(500).json({ success: false, error: err.message });
    } finally {
        // Clean up individual uploaded temp files
        for (const file of files) {
            if (file.path && fs.existsSync(file.path)) {
                fs.unlink(file.path, () => {});
            }
        }
        // Clean up temp batch folder
        if (tempFolderCreated && fs.existsSync(tempFolderCreated)) {
            fs.rm(tempFolderCreated, { recursive: true, force: true }, () => {});
        }
    }
});

/**
 * GET /api/pdf-ocr/results
 * Return the most recently produced results.json without re-running OCR.
 * Useful when the user has already run the pipeline and wants to reload.
 */
app.get('/api/pdf-ocr/results', apiLimiter, (_req, res) => {
    const resultsPath = path.join(COURSE_OCR_OUT_DIR, 'results.json');
    if (!fs.existsSync(resultsPath)) {
        return res.status(404).json({ success: false, error: 'No results.json found. Run the PDF OCR pipeline first.' });
    }
    try {
        const raw     = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        const courses = transformResults(raw);
        return res.json({ success: true, totalFiles: raw.length, courses });
    } catch (e) {
        return res.status(500).json({ success: false, error: `Could not read results.json: ${e.message}` });
    }
});

/**
 * GET /api/health
 * Simple health check.
 */
app.get('/api/health', apiLimiter, (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Catch-all: serve the frontend SPA ───────────────────────────────────────
app.get('*', apiLimiter, (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Global JSON error handler ────────────────────────────────────────────────
// Catches any error passed via next(err) and always responds with JSON.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) {
        res.status(err.status || 500).json({
            success: false,
            error: err.message || 'Internal server error'
        });
    }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`FFCS AI Planner running on http://localhost:${PORT}`);
});

module.exports = app;
