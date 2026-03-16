'use strict';

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { extractTextFromImage } = require('./services/ocrService');
const { parseOCRText } = require('./services/parser');
const { generateSchedules } = require('./services/scheduler');
const { rankSchedules } = require('./services/optimizer');

const app = express();
const PORT = process.env.PORT || 3000;

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

        const rawText = await extractTextFromImage(req.file.buffer);
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
