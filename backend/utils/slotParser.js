/**
 * Extract slot combinations from OCR text.
 * Handles examples:
 * C1+TCC1
 * F2 + TF2
 * L26+L27
 * A1, B1+TB1, etc.
 */

function normalizeText(raw) {
  return raw
    .toUpperCase()
    .replace(/[|]/g, "I")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSlotCombos(rawText) {
  const text = normalizeText(rawText);

  // General token pattern: letters + digits (e.g., A1, TCC1, L26)
  const token = "[A-Z]{1,4}\\d{1,2}";
  const comboRegex = new RegExp(`\\b(${token}(?:\\s*\\+\\s*${token})+)\\b`, "g");
  const singleSlotRegex = /\b([A-Z]{1,4}\d{1,2})\b/g;

  const comboMatches = [...text.matchAll(comboRegex)].map((m) =>
    m[1].replace(/\s+/g, "")
  );

  // Also capture isolated lab blocks if needed
  const singleMatches = [...text.matchAll(singleSlotRegex)].map((m) => m[1]);

  // Deduplicate
  const uniqueCombos = [...new Set(comboMatches)];
  const uniqueSingles = [...new Set(singleMatches)];

  return {
    combinations: uniqueCombos,
    singles: uniqueSingles,
  };
}

module.exports = {
  extractSlotCombos,
};