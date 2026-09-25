const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { extractTextFromImage } = require("../services/ocrService");
const { extractSlotCombos } = require("../utils/slotParser");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    const ok = /image\/(png|jpe?g|webp)/.test(file.mimetype);
    cb(ok ? null : new Error("Only PNG/JPG/WEBP allowed"), ok);
  },
});

router.post("/extract-slots", upload.single("image"), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ error: "Image is required" });

    filePath = req.file.path;

    const { text, confidence } = await extractTextFromImage(filePath);
    const parsed = extractSlotCombos(text);

    res.json({
      success: true,
      ocrConfidence: confidence,
      extractedText: text,
      detected: parsed,
    });
  } catch (err) {
    console.error("OCR error:", err);
    res.status(500).json({ success: false, error: err.message || "OCR failed" });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }
});

module.exports = router;