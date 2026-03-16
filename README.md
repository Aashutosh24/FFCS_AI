# FFCS AI Timetable Planner

An AI-powered web application that automatically generates the best possible university timetable for VIT students.

---

## 🚀 Features

- **OCR Screenshot Processing** – Upload your registration screenshot and let AI extract course names and slot options automatically
- **Smart Course Review** – Detected courses appear as editable cards; if course headers aren't detected, use the slot-chip grouping UI to organise options
- **Conflict Detection** – Backtracking algorithm with pruning prevents all slot clashes
- **Smart Optimization** – Schedules ranked by break gaps, class timing preferences, and free day goals
- **Visual Timetable Grid** – Color-coded grid view (theory = blue, lab = orange)
- **Top 5 Schedules** – Compare the best options side by side
- **Pin & Download** – Pin favorite schedules and download as PNG

---

## 🗂 Project Structure

```
FFCS_AI/
├── backend/
│   ├── server.js              # Express API server
│   ├── package.json
│   ├── services/
│   │   ├── ocrService.js      # Tesseract OCR wrapper
│   │   ├── parser.js          # Slot pattern extraction from OCR text
│   │   ├── scheduler.js       # Backtracking timetable generator
│   │   └── optimizer.js       # Schedule scoring & ranking
│   └── data/
│       └── slotDB.json        # Slot → day/period mapping database
└── frontend/
    ├── index.html             # Main UI
    ├── styles.css             # Dark-mode styling
    ├── app.js                 # Frontend application logic
    └── timetableRenderer.js   # Timetable grid renderer
```

---

## ⚙️ Tech Stack

| Layer     | Technology              |
|-----------|-------------------------|
| Frontend  | HTML5, CSS3, Vanilla JS |
| Backend   | Node.js + Express       |
| OCR       | Tesseract.js            |
| Algorithm | Backtracking + Pruning  |

---

## 🛠 Setup

### Prerequisites

- Node.js ≥ 18.0.0
- npm

### Installation

```bash
cd backend
npm install
```

### Running the Server

```bash
cd backend
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

For development with auto-reload:

```bash
cd backend
npm run dev
```

---

## 📡 API Reference

### `POST /api/upload`

Upload a registration screenshot for OCR processing.

**Body:** `multipart/form-data` with field `image` (JPEG/PNG/WEBP/BMP, max 10MB)

**Response:**
```json
{
  "success": true,
  "rawText": "CSE3001 Computer Networks\nC1+TCC1 Mohinder Singh\n...",
  "courses": [
    {
      "code": "CSE3001",
      "name": "Computer Networks",
      "options": [["C1","TCC1"], ["F2","TF2"]]
    }
  ],
  "detectedSlots": [["C1","TCC1"], ["F2","TF2"]],
  "lines": ["C1+TCC1 Mohinder Singh", "..."]
}
```

> `courses` is populated when the screenshot contains recognisable VIT course-code headers (e.g. `CSE3001`).
> If no headers are detected, `courses` is an empty array and the frontend shows the slot-chip grouping UI.

---

### `POST /api/generate`

Generate optimized timetables from course slot options.

**Body:**
```json
{
  "courses": [
    {
      "course": "Computer Networks",
      "options": [["C1","TCC1"], ["F2","TF2"]]
    },
    {
      "course": "CN Lab",
      "options": [["L26","L27"], ["L1","L2"]]
    }
  ],
  "preferences": {
    "preferMorning": false,
    "preferEvening": false,
    "minimizeBreaks": true,
    "freeDayPreference": "SAT"
  },
  "topN": 5
}
```

**Response:**
```json
{
  "success": true,
  "totalFound": 42,
  "topN": 5,
  "schedules": [
    {
      "score": 6,
      "schedule": [
        { "course": "Computer Networks", "slots": ["C1","TCC1"], "blocks": [...] }
      ]
    }
  ]
}
```

---

### `GET /api/health`

Health check endpoint.

---

## 📋 Slot Format

Slots follow the VIT FFCS pattern:

| Credit | Format example                  |
|--------|----------------------------------|
| 4      | `A1+TA1+TAA1`                   |
| 3      | `C1+TCC1`                       |
| 2      | `A1`                             |
| 1      | `TA1`                            |
| Lab    | `L26+L27`                       |

---

## 🧠 Algorithm

1. **Backtracking** – Builds timetables course by course
2. **Pruning** – Stops branch immediately on any conflict (same day + same period)
3. **Scoring** – Ranks valid schedules by:
   - Break gap hours × 5
   - Very early (8:00) or very late (18:00) classes × 3
   - Preference bonuses for morning/evening preference
   - Heavy penalty for classes on preferred free day

---

## 🔮 Future Extensions

- Teacher rating integration
- Friend timetable matching
- AI assistant for suggestions
- Mobile app version
- Supabase database for saving preferences