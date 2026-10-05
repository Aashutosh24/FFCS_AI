console.log("VIT FFCS Timetable Planner initializing...");

// ✅ EXACT VIT THEORY SLOT MAPPINGS
const creditSlots = {
  4: [
    "A1+TA1+TAA1",
    "B1+TB1+TBB1",
    "C1+TC1+TCC1",
    "C1+SC1+TC1",
    "D1+TD1+TDD1",
    "D1+TD1+SD1",
    "A2+TA2+TAA2",
    "B2+TB2+TBB2",
    "C2+TC2+TCC2",
    "C2+SC2+TC2",
    "D2+TD2+TDD2",
    "D2+SD2+TD2",
    "E1+TE1+TEE1",
    "E1+SE1+TE1",
    "F1+TF1+TFF1",
    "F1+TF1+TBB2",
    "G1+TG1+TGG1",
    "E2+TE2+TEE2",
    "E2+SE2+TE2",
    "F2+TF2+TFF2",
    "F2+TF2+TBB1",
    "G2+TG2+TGG2",
  ],
  3: [
    "A1+TA1",
    "B1+TB1",
    "C1+TC1",
    "C1+TCC1",
    "D1+TD1",
    "D1+TDD1",
    "A2+TA2",
    "B2+TB2",
    "C2+TC2",
    "C2+TCC2",
    "D2+TD2",
    "D2+TDD2",
    "E1+TE1",
    "E1+TEE1",
    "F1+TF1",
    "F1+TFF1",
    "G1+TG1",
    "G1+TGG1",
    "E2+TE2",
    "E2+TEE2",
    "F2+TF2",
    "F2+TFF2",
    "G2+TG2",
    "G2+TGG2",
  ],
  2: [
    "A1",
    "B1",
    "C1",
    "D1",
    "E1",
    "F1",
    "A2",
    "B2",
    "C2",
    "D2",
    "E2",
    "F2",
    "G1",
    "G2",
  ],
  1: [
    "TA1",
    "TB1",
    "TC1",
    "TD1",
    "TE1",
    "TF1",
    "TA2",
    "TB2",
    "TC2",
    "TD2",
    "TE2",
    "TF2",
    "TG1",
    "TEE1",
    "TCC1",
    "TDD1",
    "TAA1",
    "TBB1",
    "TG2",
    "TAA2",
    "TBB2",
    "TDD2",
    "TCC2",
    "TEE2",
  ],
};

// ✅ LAB SLOT SUGGESTIONS
const labSlotSuggestions = [
  "L1+L2",
  "L3+L4",
  "L5+L6",
  "L7+L8",
  "L9+L10",
  "L11+L12",
  "L13+L14",
  "L15+L16",
  "L17+L18",
  "L19+L20",
  "L21+L22",
  "L23+L24",
  "L25+L26",
  "L27+L28",
  "L29+L30",
  "L31+L32",
  "L33+L34",
  "L35+L36",
  "L37+L38",
  "L39+L40",
  "L41+L42",
  "L43+L44",
  "L45+L46",
  "L47+L48",
  "L49+L50",
  "L51+L52",
  "L53+L54",
  "L55+L56",
  "L57+L58",
  "L59+L60",
];

// ✅ TIME SLOTS MAPPING (for display purposes)
const theoryTimeSlots = [
  "8:00-8:50",
  "9:00-9:50",
  "10:00-10:50",
  "11:00-11:50",
  "12:00-12:50",
  "—",
  "2:00-2:50",
  "3:00-3:50",
  "4:00-4:50",
  "5:00-5:50",
  "6:00-6:50",
  "—",
];
const timeSlots = [
  "8:00-8:50",
  "9:00-9:50",
  "10:00-10:50",
  "11:00-11:50",
  "12:00-12:50",
  "LUNCH",
  "2:00-2:50",
  "3:00-3:50",
  "4:00-4:50",
  "5:00-5:50",
  "6:00-6:50",
];
const labTimeSlots = [
  "8:00-8:50",
  "8:50-9:40",
  "9:50-10:40",
  "10:40-11:30",
  "11:40-12:30",
  "12:30-1:10",
  "2:00-2:50",
  "2:50-3:40",
  "3:50-4:40",
  "4:40-5:30",
  "5:40-6:30",
  "6:30-7:10",
];
// ✅ CORRECT SLOT MAPPINGS - MAIN SLOTS GET 2 CLASSES, T-SLOTS GET 1 CLASS
const slotMappings = {
  // ====== MAIN THEORY SLOTS (2 classes each for proper credit distribution) ======

  // A1 slots (2 classes per week)
  A1: [
    { day: "TUE", period: 1, type: "theory" },
    { day: "SAT", period: 4, type: "theory" },
  ],

  // A2 slots (2 classes per week)
  A2: [
    { day: "TUE", period: 7, type: "theory" },
    { day: "THU", period: 9, type: "theory" },
  ],

  // B1 slots (2 classes per week)
  B1: [
    { day: "TUE", period: 2, type: "theory" },
    { day: "WED", period: 4, type: "theory" },
  ],

  // B2 slots (2 classes per week)
  B2: [
    { day: "TUE", period: 8, type: "theory" },
    { day: "WED", period: 9, type: "theory" },
  ],

  // C1 slots (2 classes per week)
  C1: [
    { day: "THU", period: 1, type: "theory" },
    { day: "SAT", period: 2, type: "theory" },
  ],

  // C2 slots (2 classes per week)
  C2: [
    { day: "THU", period: 7, type: "theory" },
    { day: "FRI", period: 6, type: "theory" },
  ],

  // D1 slots (2 classes per week)
  D1: [
    { day: "TUE", period: 4, type: "theory" },
    { day: "WED", period: 1, type: "theory" },
  ],

  // D2 slots (2 classes per week)
  D2: [
    { day: "WED", period: 6, type: "theory" },
    { day: "SAT", period: 6, type: "theory" },
  ],

  // E1 slots (2 classes per week)
  E1: [
    { day: "WED", period: 3, type: "theory" },
    { day: "SAT", period: 1, type: "theory" },
  ],

  // E2 slots (2 classes per week)
  E2: [
    { day: "WED", period: 8, type: "theory" },
    { day: "SAT", period: 7, type: "theory" },
  ],

  // F1 slots (2 classes per week)
  F1: [
    { day: "WED", period: 2, type: "theory" },
    { day: "FRI", period: 3, type: "theory" },
  ],

  // F2 slots (2 classes per week)
  F2: [
    { day: "TUE", period: 6, type: "theory" },
    { day: "FRI", period: 9, type: "theory" },
  ],

  // G1 slots (2 classes per week)
  G1: [
    { day: "TUE", period: 3, type: "theory" },
    { day: "SAT", period: 3, type: "theory" },
  ],

  // G2 slots (2 classes per week)
  G2: [
    { day: "TUE", period: 9, type: "theory" },
    { day: "WED", period: 7, type: "theory" },
  ],

  // ====== T-THEORY SLOTS (1 class each) ======

  TA1: [{ day: "FRI", period: 2, type: "theory" }],
  TA2: [{ day: "FRI", period: 8, type: "theory" }],
  TB1: [{ day: "FRI", period: 1, type: "theory" }],
  TB2: [{ day: "FRI", period: 7, type: "theory" }],
  TC1: [{ day: "TUE", period: 3, type: "theory" }],
  TC2: [{ day: "TUE", period: 9, type: "theory" }],
  TD1: [{ day: "THU", period: 2, type: "theory" }],
  TD2: [{ day: "THU", period: 8, type: "theory" }],
  TE1: [{ day: "FRI", period: 4, type: "theory" }],
  TE2: [{ day: "THU", period: 6, type: "theory" }],
  TF1: [{ day: "SAT", period: 3, type: "theory" }],
  TF2: [{ day: "WED", period: 7, type: "theory" }],
  TG1: [{ day: "THU", period: 2, type: "theory" }],
  TG2: [{ day: "THU", period: 8, type: "theory" }],

  // ====== TAA/TBB/TCC/TDD/TEE/TFF/TGG SLOTS (1 class each) ======

  TAA1: [{ day: "THU", period: 3, type: "theory" }],
  TAA2: [{ day: "SAT", period: 8, type: "theory" }],
  TBB1: [{ day: "THU", period: 4, type: "theory" }],
  TBB2: [{ day: "SAT", period: 9, type: "theory" }],
  TCC1: [{ day: "FRI", period: 0, type: "theory" }],
  TCC2: [{ day: "WED", period: 10, type: "theory" }],
  TDD1: [{ day: "SAT", period: 0, type: "theory" }],
  TDD2: [{ day: "TUE", period: 10, type: "theory" }],
  TEE1: [{ day: "THU", period: 0, type: "theory" }],
  TEE2: [{ day: "FRI", period: 10, type: "theory" }],
  TFF1: [{ day: "TUE", period: 0, type: "theory" }],
  TFF2: [{ day: "THU", period: 10, type: "theory" }],
  TGG1: [{ day: "WED", period: 0, type: "theory" }],
  TGG2: [{ day: "SAT", period: 10, type: "theory" }],

  // ====== SPECIAL SLOTS (1 class each) ======

  SC1: [{ day: "WED", period: 8, type: "theory" }],
  SC2: [{ day: "WED", period: 3, type: "theory" }],
  SD1: [{ day: "SAT", period: 7, type: "theory" }],
  SD2: [{ day: "FRI", period: 4, type: "theory" }],
  SE1: [{ day: "THU", period: 6, type: "theory" }],
  SE2: [{ day: "SAT", period: 1, type: "theory" }],

  // ====== LAB SLOTS ======

  // TUESDAY Labs
  L1: [{ day: "TUE", period: 0, type: "lab" }],
  L2: [{ day: "TUE", period: 1, type: "lab" }],
  L3: [{ day: "TUE", period: 2, type: "lab" }],
  L4: [{ day: "TUE", period: 3, type: "lab" }],
  L5: [{ day: "TUE", period: 4, type: "lab" }],
  L31: [{ day: "TUE", period: 6, type: "lab" }],
  L32: [{ day: "TUE", period: 7, type: "lab" }],
  L33: [{ day: "TUE", period: 8, type: "lab" }],
  L34: [{ day: "TUE", period: 9, type: "lab" }],
  L35: [{ day: "TUE", period: 10, type: "lab" }],

  // WEDNESDAY Labs
  L7: [{ day: "WED", period: 0, type: "lab" }],
  L8: [{ day: "WED", period: 1, type: "lab" }],
  L9: [{ day: "WED", period: 2, type: "lab" }],
  L10: [{ day: "WED", period: 3, type: "lab" }],
  L11: [{ day: "WED", period: 4, type: "lab" }],
  L37: [{ day: "WED", period: 6, type: "lab" }],
  L38: [{ day: "WED", period: 7, type: "lab" }],
  L39: [{ day: "WED", period: 8, type: "lab" }],
  L40: [{ day: "WED", period: 9, type: "lab" }],
  L41: [{ day: "WED", period: 10, type: "lab" }],

  // THURSDAY Labs
  L13: [{ day: "THU", period: 0, type: "lab" }],
  L14: [{ day: "THU", period: 1, type: "lab" }],
  L15: [{ day: "THU", period: 2, type: "lab" }],
  L16: [{ day: "THU", period: 3, type: "lab" }],
  L17: [{ day: "THU", period: 4, type: "lab" }],
  L43: [{ day: "THU", period: 6, type: "lab" }],
  L44: [{ day: "THU", period: 7, type: "lab" }],
  L45: [{ day: "THU", period: 8, type: "lab" }],
  L46: [{ day: "THU", period: 9, type: "lab" }],
  L47: [{ day: "THU", period: 10, type: "lab" }],

  // FRIDAY Labs
  L19: [{ day: "FRI", period: 0, type: "lab" }],
  L20: [{ day: "FRI", period: 1, type: "lab" }],
  L21: [{ day: "FRI", period: 2, type: "lab" }],
  L22: [{ day: "FRI", period: 3, type: "lab" }],
  L23: [{ day: "FRI", period: 4, type: "lab" }],
  L49: [{ day: "FRI", period: 6, type: "lab" }],
  L50: [{ day: "FRI", period: 7, type: "lab" }],
  L51: [{ day: "FRI", period: 8, type: "lab" }],
  L52: [{ day: "FRI", period: 9, type: "lab" }],
  L53: [{ day: "FRI", period: 10, type: "lab" }],

  // SATURDAY Labs
  L25: [{ day: "SAT", period: 0, type: "lab" }],
  L26: [{ day: "SAT", period: 1, type: "lab" }],
  L27: [{ day: "SAT", period: 2, type: "lab" }],
  L28: [{ day: "SAT", period: 3, type: "lab" }],
  L29: [{ day: "SAT", period: 4, type: "lab" }],
  L55: [{ day: "SAT", period: 6, type: "lab" }],
  L56: [{ day: "SAT", period: 7, type: "lab" }],
  L57: [{ day: "SAT", period: 8, type: "lab" }],
  L58: [{ day: "SAT", period: 9, type: "lab" }],
  L59: [{ day: "SAT", period: 10, type: "lab" }],

  // Additional Labs
  L6: [{ day: "TUE", period: 5, type: "lab" }],
  L12: [{ day: "WED", period: 5, type: "lab" }],
  L18: [{ day: "THU", period: 5, type: "lab" }],
  L24: [{ day: "FRI", period: 5, type: "lab" }],
  L30: [{ day: "SAT", period: 5, type: "lab" }],
  L36: [{ day: "TUE", period: 11, type: "lab" }],
  L42: [{ day: "WED", period: 11, type: "lab" }],
  L48: [{ day: "THU", period: 11, type: "lab" }],
  L54: [{ day: "FRI", period: 11, type: "lab" }],
  L60: [{ day: "SAT", period: 11, type: "lab" }],
};

let selectedCourses = [];
let timetableData = {};
let currentCreditType = 4;
let selectedSlot = null;
let currentLabSlot = null;

// ✅ Initialize properly when DOM loads
document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM Content Loaded - Initializing...");
  initializeTimetableData();
  populateSlots(4);
  populateLabSlots("all");
  updateStats();
  updateSelectedCoursesList();
  setupDropzone();
  console.log("✅ Initialization Complete!");
});

function initializeTimetableData() {
  const days = ["TUE", "WED", "THU", "FRI", "SAT"];
  days.forEach((day) => {
    timetableData[day] = {
      theory: Array(12).fill(null),
      lab: Array(12).fill(null),
    };
  });
  console.log("✅ Timetable data initialized");
}

function switchCreditTab(credits) {
  console.log("Switching to credit tab:", credits);
  currentCreditType = credits;

  document
    .querySelectorAll(".credit-tab")
    .forEach((tab) => tab.classList.remove("active"));
  event.target.classList.add("active");

  populateSlots(credits);
  selectedSlot = null;
}

function populateSlots(credits) {
  console.log("Populating slots for credits:", credits);
  const container = document.getElementById("theorySlots");
  if (!container) return;
  container.innerHTML = "";

  (creditSlots[credits] || []).forEach((slot) => {
    const isSelected = selectedSlot && selectedSlot.slot === slot;
    const option = document.createElement("div");
    option.className = `slot-option ${isSelected ? "selected" : ""}`;
    option.setAttribute("role", "button");
    option.setAttribute("tabindex", "0");
    option.innerHTML = `
      <span class="slot-code">${slot}</span>
      <span class="credit-badge">${credits}C</span>
    `;
    option.onclick = () => selectSlot(option, slot, "theory");
    option.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectSlot(option, slot, "theory");
        const nameInput = document.getElementById("theoryCourseName");
        if (nameInput && nameInput.value.trim()) {
          addTheoryCourse();
        } else if (nameInput) {
          nameInput.focus();
        }
      }
    };
    container.appendChild(option);
  });
  console.log(`✅ Populated ${creditSlots[credits]?.length || 0} slots`);
}

function selectSlot(element, slot, type) {
  console.log("Slot selected:", slot, type);
  const container = element.parentNode;
  if (container) {
    container
      .querySelectorAll(".slot-option")
      .forEach((opt) => opt.classList.remove("selected"));
  }

  element.classList.add("selected");
  selectedSlot = {
    slot,
    type,
    credits: type === "lab" ? 1 : currentCreditType,
  };
  const badge = document.getElementById("selectedTheoryBadge");
  if (badge) badge.textContent = `Selected: ${slot}`;
  console.log("Selected slot:", selectedSlot);
}

let currentLabShift = "all";

function getLabSlotTiming(slotStr) {
  if (!slotStr) return "";
  const parts = slotStr.split("+");
  const firstSlot = parts[0];
  const lastSlot = parts[parts.length - 1];
  const firstMap = slotMappings[firstSlot]?.[0];
  const lastMap = slotMappings[lastSlot]?.[0];
  if (!firstMap) return "";

  const day = firstMap.day;
  const startPeriod = firstMap.period;
  const endPeriod = lastMap ? lastMap.period : startPeriod;

  const startTime = (labTimeSlots[startPeriod] || "").split("-")[0] || "";
  const endTime = (labTimeSlots[endPeriod] || "").split("-")[1] || "";

  return `${day} ${startTime}–${endTime}`;
}

function getLabSlotShift(slotStr) {
  if (!slotStr) return "all";
  const parts = slotStr.split("+");
  const firstMap = slotMappings[parts[0]]?.[0];
  if (!firstMap) return "all";
  return firstMap.period < 6 ? "morning" : "evening";
}

function switchLabTab(shift) {
  currentLabShift = shift;
  const container = document.getElementById("labTabs");
  if (container) {
    container
      .querySelectorAll(".credit-tab")
      .forEach((tab) => tab.classList.remove("active"));
    const matchingBtn = Array.from(container.querySelectorAll(".credit-tab")).find(
      (b) => b.getAttribute("onclick")?.includes(`'${shift}'`)
    );
    if (matchingBtn) {
      matchingBtn.classList.add("active");
    }
  }
  if (window.event && window.event.target && window.event.target.classList.contains("credit-tab")) {
    window.event.target.classList.add("active");
  }
  const filterVal = document.getElementById("labSlotInput")?.value || "";
  populateLabSlots(shift, filterVal);
}

function populateLabSlots(shift = currentLabShift, filterText = "") {
  const container = document.getElementById("labSlots");
  if (!container) return;
  container.innerHTML = "";

  const q = filterText.trim().toUpperCase();

  const filtered = labSlotSuggestions.filter((slot) => {
    if (shift !== "all") {
      const slotShift = getLabSlotShift(slot);
      if (slotShift !== shift) return false;
    }
    if (q) {
      const timing = getLabSlotTiming(slot).toUpperCase();
      if (!slot.includes(q) && !timing.includes(q)) {
        return false;
      }
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 11px;">
        No lab slots match "${escapeHtml(filterText)}"
      </div>
    `;
    return;
  }

  filtered.forEach((slot) => {
    const isSelected = currentLabSlot === slot;
    const timing = getLabSlotTiming(slot);
    const option = document.createElement("div");
    option.className = `slot-option ${isSelected ? "selected" : ""}`;
    option.setAttribute("role", "button");
    option.setAttribute("tabindex", "0");
    option.innerHTML = `
      <span class="slot-code">${slot}</span>
      <span class="lab-badge">${timing}</span>
    `;
    option.onclick = () => selectLabSlot(slot, option);
    option.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectLabSlot(slot, option);
        const nameInput = document.getElementById("labCourseName");
        if (nameInput && nameInput.value.trim()) {
          addLabCourse();
        } else if (nameInput) {
          nameInput.focus();
        }
      }
    };
    container.appendChild(option);
  });
}

function selectLabSlot(slot, element) {
  currentLabSlot = slot;
  const input = document.getElementById("labSlotInput");
  if (input) input.value = slot;

  const badge = document.getElementById("selectedLabBadge");
  if (badge) badge.textContent = `Selected: ${slot}`;

  const container = document.getElementById("labSlots");
  if (container) {
    container
      .querySelectorAll(".slot-option")
      .forEach((opt) => opt.classList.remove("selected"));
  }
  if (element) {
    element.classList.add("selected");
  } else if (container) {
    container.querySelectorAll(".slot-option").forEach((opt) => {
      const codeSpan = opt.querySelector(".slot-code") || opt.querySelector("span");
      if (codeSpan && codeSpan.textContent.trim().replace(/^✓\s*/, "") === slot) {
        opt.classList.add("selected");
      }
    });
  }

  const validation = document.getElementById("labInputValidation");
  if (validation) {
    const timing = getLabSlotTiming(slot);
    validation.className = "input-validation validation-success";
    validation.textContent = `✓ Selected ${slot} (${timing})`;
    validation.style.display = "block";
  }
}

function handleLabSlotInput() {
  const input = document.getElementById("labSlotInput");
  if (!input) return;
  const rawVal = input.value.trim();
  const val = rawVal.toUpperCase();
  const validation = document.getElementById("labInputValidation");

  populateLabSlots(currentLabShift, val);

  if (val === "") {
    if (validation) validation.style.display = "none";
    const badge = document.getElementById("selectedLabBadge");
    if (badge) badge.textContent = "";
    currentLabSlot = null;
    return;
  }

  const exactMatch = labSlotSuggestions.find((s) => s.toUpperCase() === val);
  if (exactMatch) {
    selectLabSlot(exactMatch);
    return;
  }

  const labSlotPattern = /^L\d{1,2}(\+L\d{1,2})*$/;
  if (labSlotPattern.test(val)) {
    const parts = val.split("+");
    const allValid = parts.every((p) => slotMappings[p]);
    if (allValid) {
      currentLabSlot = val;
      if (validation) {
        validation.className = "input-validation validation-success";
        validation.textContent = `✓ Valid lab slot: ${val}`;
        validation.style.display = "block";
      }
      const badge = document.getElementById("selectedLabBadge");
      if (badge) badge.textContent = `Selected: ${val}`;
      return;
    }
  }

  currentLabSlot = null;
  if (validation) {
    validation.className = "input-validation validation-error";
    validation.textContent = "Type slot like L1+L2, L31+L32 or click from options list below";
    validation.style.display = "block";
  }
  const badge = document.getElementById("selectedLabBadge");
  if (badge) badge.textContent = "";
}

function handleCourseNameKeydown(event, type) {
  if (event.key === "Enter") {
    event.preventDefault();
    if (type === "lab") {
      addLabCourse();
    } else if (type === "theory") {
      addTheoryCourse();
    }
  }
}

function handleLabSlotKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const slotInput = document.getElementById("labSlotInput");
    let val = slotInput?.value.trim().toUpperCase();
    if (val) {
      if (/^\d{1,2}\+\d{1,2}$/.test(val)) {
        val = val.split("+").map((n) => "L" + n).join("+");
        slotInput.value = val;
      }
      const match = labSlotSuggestions.find((s) => s.toUpperCase() === val);
      if (match) {
        selectLabSlot(match);
      } else if (/^L\d{1,2}(\+L\d{1,2})*$/.test(val)) {
        const parts = val.split("+");
        if (parts.every((p) => slotMappings[p])) {
          selectLabSlot(val);
        }
      }
    }

    const courseName = document.getElementById("labCourseName")?.value.trim();
    if (courseName && currentLabSlot) {
      addLabCourse();
    } else if (!courseName) {
      document.getElementById("labCourseName")?.focus();
      if (currentLabSlot) {
        showToast(`Selected ${currentLabSlot}. Now enter course name and press Enter to submit`, "info");
      } else {
        showToast("Please enter a lab course name", "warning");
      }
    } else {
      showToast("Please select or enter a valid lab slot (e.g. L1+L2)", "warning");
    }
  }
}

// ✅ Check for duplicate course names
function checkForDuplicateCourse(courseName, courseType) {
  return selectedCourses.find(
    (course) =>
      course.name.toLowerCase() === courseName.toLowerCase() &&
      course.type === courseType,
  );
}

function addTheoryCourse() {
  console.log("🎓 Adding theory course...");
  const courseNameInput = document.getElementById("theoryCourseName");
  const courseName = courseNameInput?.value.trim() || "";

  if (!courseName) {
    showToast("Please enter a course name", "warning");
    courseNameInput?.focus();
    return;
  }

  if (!selectedSlot || selectedSlot.type !== "theory") {
    showToast(`Please select a theory slot for "${courseName}"`, "warning");
    const container = document.getElementById("theorySlots");
    if (container) {
      container.scrollIntoView({ behavior: "smooth", block: "nearest" });
      container.style.borderColor = "#4f46e5";
      setTimeout(() => {
        container.style.borderColor = "";
      }, 1500);
    }
    return;
  }

  // Check if course with same name exists
  const existingCourse = checkForDuplicateCourse(courseName, "theory");

  // If course exists, remove it first
  if (existingCourse) {
    console.log(`🔄 Updating existing course: ${courseName}`);
    removeCourseFromTimetable(existingCourse);
    selectedCourses = selectedCourses.filter((c) => c.id !== existingCourse.id);
  }

  const slots = selectedSlot.slot.split("+");
  console.log(
    `📝 Processing ${slots.length} slots for ${courseName}: ${slots.join(", ")}`,
  );

  const clashes = checkForClashes(slots, "theory", courseName);

  if (clashes.length > 0) {
    showClashAlert(clashes, courseName, selectedSlot.slot, "theory");
    return;
  }

  const course = {
    id: Date.now(),
    name: courseName,
    slot: selectedSlot.slot,
    type: "theory",
    credits: selectedSlot.credits,
    slots: slots,
  };

  selectedCourses.push(course);
  updateTimetable(course);
  updateSelectedCoursesList();
  updateStats();
  clearTheoryInputs();
  hideClashAlert();
  showToast(`✓ Added theory course: ${courseName} (${selectedSlot.slot})`, "success");

  console.log(
    `✅ Course ${existingCourse ? "updated" : "added"}: ${courseName} with ${slots.length} slots`,
  );
}

function addLabCourse() {
  console.log("🧪 Adding lab course...");
  const courseNameInput = document.getElementById("labCourseName");
  const courseName = courseNameInput?.value.trim() || "";

  // Auto-resolve currentLabSlot if user typed into labSlotInput without explicitly clicking
  if (!currentLabSlot) {
    const slotInput = document.getElementById("labSlotInput");
    let val = slotInput ? slotInput.value.trim().toUpperCase() : "";
    if (val) {
      if (/^\d{1,2}\+\d{1,2}$/.test(val)) {
        val = val.split("+").map((n) => "L" + n).join("+");
        if (slotInput) slotInput.value = val;
      }
      const match = labSlotSuggestions.find((s) => s.toUpperCase() === val);
      if (match) {
        currentLabSlot = match;
      } else if (/^L\d{1,2}(\+L\d{1,2})*$/.test(val)) {
        const parts = val.split("+");
        if (parts.every((p) => slotMappings[p])) {
          currentLabSlot = val;
        }
      }
    }
  }

  if (!courseName) {
    showToast("Please enter a lab course name", "warning");
    courseNameInput?.focus();
    return;
  }

  if (!currentLabSlot) {
    showToast(`Please select a lab slot for "${courseName}"`, "warning");
    const container = document.getElementById("labSlots");
    if (container) {
      container.scrollIntoView({ behavior: "smooth", block: "nearest" });
      container.style.borderColor = "#9333ea";
      setTimeout(() => {
        container.style.borderColor = "";
      }, 1500);
    }
    return;
  }

  // Check if course with same name exists
  const existingCourse = checkForDuplicateCourse(courseName, "lab");

  // If course exists, remove it first
  if (existingCourse) {
    console.log(`🔄 Updating existing lab course: ${courseName}`);
    removeCourseFromTimetable(existingCourse);
    selectedCourses = selectedCourses.filter((c) => c.id !== existingCourse.id);
  }

  const slots = currentLabSlot.split("+");
  const clashes = checkForClashes(slots, "lab", courseName);

  if (clashes.length > 0) {
    showClashAlert(clashes, courseName, currentLabSlot, "lab");
    return;
  }

  const course = {
    id: Date.now(),
    name: courseName,
    slot: currentLabSlot,
    type: "lab",
    credits: 1,
    slots: slots,
  };

  selectedCourses.push(course);
  updateTimetable(course);
  updateSelectedCoursesList();
  updateStats();
  clearLabInputs();
  hideClashAlert();
  showToast(`✓ Added lab course: ${courseName} (${currentLabSlot})`, "success");

  console.log(
    `✅ Lab course ${existingCourse ? "updated" : "added"}: ${courseName}`,
  );
}

// ✅ ENHANCED CLASH DETECTION - Detects both theory-theory and theory-lab clashes
function checkForClashes(newSlots, newCourseType, newCourseName) {
  const clashes = [];

  console.log(
    `🔍 Checking clashes for ${newCourseType} course: ${newCourseName}`,
  );
  console.log(`📋 New slots to check: ${newSlots.join(", ")}`);

  newSlots.forEach((slot) => {
    if (slotMappings[slot]) {
      const slotInfos = Array.isArray(slotMappings[slot])
        ? slotMappings[slot]
        : [slotMappings[slot]];

      slotInfos.forEach((slotInfo) => {
        const { day, period, type: slotType } = slotInfo;

        // Check both theory and lab layers for conflicts
        // This handles theory vs theory, lab vs lab, and cross-type conflicts
        const theoryConflict = timetableData[day]?.theory[period];
        const labConflict = timetableData[day]?.lab[period];

        // For theory slots, check if there's any existing course in that time slot
        if (slotType === "theory") {
          const tTime = theoryTimeSlots[period] || timeSlots[period] || `Period ${period}`;
          if (theoryConflict) {
            clashes.push({
              day: day,
              period: period,
              slot: slot,
              type: "theory",
              conflictType: "theory-theory",
              existingCourse: theoryConflict,
              timeSlot: tTime,
            });
            console.log(
              `❌ Theory-Theory clash detected: ${day} ${tTime} - ${theoryConflict.name}`,
            );
          }

          // Also check if lab conflicts with theory timing
          if (labConflict) {
            const lTime = labTimeSlots[period] || `Period ${period}`;
            clashes.push({
              day: day,
              period: period,
              slot: slot,
              type: "theory",
              conflictType: "theory-lab",
              existingCourse: labConflict,
              timeSlot: `${tTime} (Lab: ${lTime})`,
            });
            console.log(
              `❌ Theory-Lab clash detected: ${day} ${tTime} - ${labConflict.name}`,
            );
          }
        }

        // For lab slots, check if there's any existing course in that time slot
        if (slotType === "lab") {
          const lTime = labTimeSlots[period] || `Period ${period}`;
          if (labConflict) {
            clashes.push({
              day: day,
              period: period,
              slot: slot,
              type: "lab",
              conflictType: "lab-lab",
              existingCourse: labConflict,
              timeSlot: lTime,
            });
            console.log(
              `❌ Lab-Lab clash detected: ${day} ${lTime} - ${labConflict.name}`,
            );
          }

          // Also check if theory conflicts with lab timing
          if (theoryConflict) {
            const tTime = theoryTimeSlots[period] || timeSlots[period] || `Period ${period}`;
            clashes.push({
              day: day,
              period: period,
              slot: slot,
              type: "lab",
              conflictType: "lab-theory",
              existingCourse: theoryConflict,
              timeSlot: `${lTime} (Theory: ${tTime})`,
            });
            console.log(
              `❌ Lab-Theory clash detected: ${day} ${lTime} - ${theoryConflict.name}`,
            );
          }
        }
      });
    } else {
      console.warn(`⚠️ Slot mapping not found for: ${slot}`);
    }
  });

  console.log(`📊 Total clashes found: ${clashes.length}`);
  return clashes;
}

// ✅ ENHANCED CLASH ALERT - Shows detailed conflict information
function showClashAlert(clashes, courseName, slot, courseType) {
  const alertDiv = document.getElementById("clashAlert");
  const detailsDiv = document.getElementById("clashDetails");

  let clashText = `Cannot add "${courseName}" (${courseType.toUpperCase()}: ${slot}) due to scheduling conflicts:<br><br>`;

  // Group clashes by type for better display
  const clashGroups = {
    "theory-theory": [],
    "theory-lab": [],
    "lab-theory": [],
    "lab-lab": [],
  };

  clashes.forEach((clash) => {
    clashGroups[clash.conflictType].push(clash);
  });

  // Display each type of clash
  Object.keys(clashGroups).forEach((conflictType) => {
    const conflicts = clashGroups[conflictType];
    if (conflicts.length > 0) {
      const typeDescriptions = {
        "theory-theory": "🎓 Theory vs Theory Conflicts:",
        "theory-lab": "🎓⚗️ Theory vs Lab Conflicts:",
        "lab-theory": "⚗️🎓 Lab vs Theory Conflicts:",
        "lab-lab": "⚗️ Lab vs Lab Conflicts:",
      };

      clashText += `<strong>${typeDescriptions[conflictType]}</strong><br>`;

      conflicts.forEach((clash) => {
        clashText += `• <strong>${clash.day} ${clash.timeSlot}</strong> - Conflicts with "${clash.existingCourse.name}" (${clash.existingCourse.type.toUpperCase()}: ${clash.existingCourse.slot})<br>`;
      });

      clashText += "<br>";
    }
  });

  clashText +=
    "<em>Please choose a different time slot or remove the conflicting course first.</em>";

  detailsDiv.innerHTML = clashText;
  alertDiv.style.display = "block";

  // Auto hide after 10 seconds for better UX
  setTimeout(() => {
    hideClashAlert();
  }, 10000);
}

function hideClashAlert() {
  document.getElementById("clashAlert").style.display = "none";
}

// ✅ Update timetable with multiple slot mappings
function updateTimetable(course) {
  let classesPlaced = 0;
  const courseCode = course.code || "";
  let displayTitle = course.name;
  if (courseCode && displayTitle.includes(`(${courseCode})`)) {
    displayTitle = displayTitle.replace(`(${courseCode})`, "").trim();
  }

  course.slots.forEach((slot) => {
    if (slotMappings[slot]) {
      const slotInfos = Array.isArray(slotMappings[slot])
        ? slotMappings[slot]
        : [slotMappings[slot]];

      slotInfos.forEach((slotInfo) => {
        const day = slotInfo.day;
        const period = slotInfo.period;
        const type = slotInfo.type;

        // Store course data
        timetableData[day][type][period] = course;

        // Find the correct cell
        if (period <= 11) {
          const cell = document.querySelector(
            `[data-day="${day}"][data-period="${period}"][data-type="${type}"]`,
          );
          if (cell) {
            cell.className = `slot-cell ${type}-cell slot-occupied`;

            if (course.type === "lab") {
              cell.classList.add("lab-slot");
            } else {
              cell.classList.add(`credit-${course.credits}-slot`);
            }

            cell.innerHTML = `
                                    <div class="slot-card">
                                        <div class="slot-card-code">${escapeHtml(courseCode || displayTitle)}</div>
                                        <div class="slot-card-name" title="${escapeHtml(course.name)}">${escapeHtml(displayTitle)}</div>
                                        <div class="slot-card-meta">
                                            <span class="slot-card-badge">${escapeHtml(slot)}</span>
                                            ${course.venue ? `<span class="slot-card-venue">${escapeHtml(course.venue)}</span>` : `<span class="slot-card-venue">${course.type === "lab" ? "LAB" : course.credits + "C"}</span>`}
                                        </div>
                                    </div>
                                `;
            cell.title = `${course.name} - ${slot}${course.venue ? " (" + course.venue + ")" : ""}${course.faculty ? " - " + course.faculty : ""}`;
            classesPlaced++;
          }
        }
      });
    } else {
      console.warn(`No mapping found for slot: ${slot}`);
    }
  });
  console.log(`Placed ${classesPlaced} classes for ${course.name}`);
}

// ✅ Helper function to remove course from timetable only
function removeCourseFromTimetable(course) {
  course.slots.forEach((slot) => {
    if (slotMappings[slot]) {
      const slotInfos = Array.isArray(slotMappings[slot])
        ? slotMappings[slot]
        : [slotMappings[slot]];

      slotInfos.forEach((slotInfo) => {
        const day = slotInfo.day;
        const period = slotInfo.period;
        const type = slotInfo.type;

        // Clear course data
        if (timetableData[day] && timetableData[day][type][period]) {
          timetableData[day][type][period] = null;
        }

        // Find and clear the cell
        if (period <= 11) {
          // Updated to handle 12 periods (0-11)
          const cell = document.querySelector(
            `[data-day="${day}"][data-period="${period}"][data-type="${type}"]`,
          );
          if (cell) {
            cell.className = `slot-cell ${type}-cell`;
            cell.innerHTML = "";
            cell.title = "";
          }
        }
      });
    }
  });
  console.log(`🗑️ Removed course from timetable: ${course.name}`);
}

function removeCourse(courseId) {
  const course = selectedCourses.find((c) => c.id === courseId);
  if (!course) return;

  removeCourseFromTimetable(course);
  selectedCourses = selectedCourses.filter((c) => c.id !== courseId);
  updateSelectedCoursesList();
  updateStats();
  hideClashAlert();

  console.log(`🗑️ Course removed: ${course.name}`);
}

function updateSelectedCoursesList() {
  const container = document.getElementById("selectedCourses");

  if (selectedCourses.length === 0) {
    container.innerHTML =
      '<p style="color: #7f8c8d; font-style: italic; text-align: center; padding: 20px;">No courses selected yet. Add your first course!</p>';
    return;
  }

  container.innerHTML = selectedCourses
    .map(
      (course) => `
        <div class="course-item ${course.type === "lab" ? "lab" : `credit-${course.credits}`}">
            <div>
                <strong>${course.name}</strong><br>
                <small>${course.slot} (${course.type === "lab" ? "LAB" : course.credits + "C"} ${course.type})</small>
            </div>
            <button class="btn btn-danger" onclick="removeCourse(${course.id})" style="padding: 6px 12px; font-size: 11px; width: auto;">
                Remove
            </button>
        </div>
    `,
    )
    .join("");
}

function updateStats() {
  const totalCredits = selectedCourses.reduce(
    (sum, course) => sum + course.credits,
    0,
  );
  const totalCourses = selectedCourses.filter(
    (c) => c.type === "theory",
  ).length;
  const totalLabs = selectedCourses.filter((c) => c.type === "lab").length;

  document.getElementById("totalCredits").textContent = totalCredits;
  document.getElementById("totalCourses").textContent = totalCourses;
  document.getElementById("totalLabs").textContent = totalLabs;
}

function clearTheoryInputs() {
  const nameInput = document.getElementById("theoryCourseName");
  if (nameInput) nameInput.value = "";
  document
    .querySelectorAll("#theorySlots .slot-option")
    .forEach((opt) => opt.classList.remove("selected"));
  selectedSlot = null;
  const badge = document.getElementById("selectedTheoryBadge");
  if (badge) badge.textContent = "";
}

function clearLabInputs() {
  const nameInput = document.getElementById("labCourseName");
  if (nameInput) nameInput.value = "";
  const slotInput = document.getElementById("labSlotInput");
  if (slotInput) slotInput.value = "";
  const validation = document.getElementById("labInputValidation");
  if (validation) {
    validation.textContent = "";
    validation.style.display = "none";
  }
  const badge = document.getElementById("selectedLabBadge");
  if (badge) badge.textContent = "";
  currentLabSlot = null;
  populateLabSlots(currentLabShift || "all", "");
}

function clearAll() {
  if (selectedCourses.length === 0) return;

  if (
    confirm(
      "Are you sure you want to clear all courses? This action cannot be undone.",
    )
  ) {
    selectedCourses = [];

    // Clear all timetable data
    Object.keys(timetableData).forEach((day) => {
      timetableData[day].theory.fill(null);
      timetableData[day].lab.fill(null);
    });

    // Clear all occupied cells
    document.querySelectorAll(".slot-occupied").forEach((cell) => {
      const type = cell.getAttribute("data-type");
      cell.className = `slot-cell ${type}-cell`;
      cell.innerHTML = "";
      cell.title = "";
    });

    updateSelectedCoursesList();
    updateStats();
    hideClashAlert();

    console.log("🧹 All courses cleared");
  }
}

// Close suggestions helper
function hideLabSuggestions() {
  const sug = document.getElementById("labSuggestions");
  if (sug) sug.style.display = "none";
}

document.addEventListener("click", function (event) {
  if (
    !event.target.closest(".lab-input-container") &&
    !event.target.classList.contains("lab-suggestion")
  ) {
    hideLabSuggestions();
  }
});

console.log(
  "✅ VIT FFCS Timetable Manager with Enhanced Clash Detection Loaded Successfully!",
);

// ============================================================================
// OCR Import Hub & Automatic Timetable Placement
// ============================================================================

let ocrImportedCourses = [];
let placedOcrSlots = new Map(); // key: "courseCode_slot" -> courseId

function toggleOcrHub() {
  const hub = document.getElementById("ocrHub");
  hub.classList.toggle("collapsed");
}

function switchOcrTab(tabName) {
  document
    .querySelectorAll(".ocr-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".ocr-tab-content")
    .forEach((c) => c.classList.remove("active"));

  const tabBtn = document.getElementById("tabBtn_" + tabName);
  const tabContent = document.getElementById("tabContent_" + tabName);
  if (tabBtn) tabBtn.classList.add("active");
  if (tabContent) tabContent.classList.add("active");
}

// Drag & drop setup for PDF
function setupDropzone() {
  const dropzone = document.getElementById("pdfDropzone");
  const fileInput = document.getElementById("pdfFileInput");
  if (!dropzone || !fileInput) return;

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
    });
  });

  dropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelection(fileInput.files);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      handleFileSelection(fileInput.files);
    }
  });
}

function handleFileSelection(files) {
  const info = document.getElementById("selectedFileInfo");
  if (!info) return;
  if (!files || files.length === 0) {
    info.style.display = "none";
    return;
  }
  if (files.length === 1) {
    const file = files[0];
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    info.innerHTML = `📄 <strong>${escapeHtml(file.name)}</strong> (${sizeMb} MB)`;
  } else {
    let totalSize = 0;
    const names = [];
    for (let i = 0; i < files.length; i++) {
      totalSize += files[i].size;
      if (i < 3) names.push(files[i].name);
    }
    const totalMb = (totalSize / (1024 * 1024)).toFixed(2);
    const nameSummary =
      names.map((n) => escapeHtml(n)).join(", ") +
      (files.length > 3 ? ` +${files.length - 3} more` : "");
    info.innerHTML = `📚 <strong>${files.length} files selected:</strong> ${nameSummary} (${totalMb} MB total)`;
  }
  info.style.display = "inline-flex";
}

function setOcrStatus(message, type = "info", showSpinner = false) {
  const el = document.getElementById("ocrStatus");
  if (!el) return;
  el.className = `ocr-status ${type}`;
  el.style.display = "flex";
  const spinnerHtml = showSpinner ? '<span class="spinner"></span>' : "";
  el.innerHTML = `${spinnerHtml} <span>${message}</span>`;
}

function clearOcrStatus() {
  const el = document.getElementById("ocrStatus");
  if (el) el.style.display = "none";
}

// Run Course Import
async function runCourseOcr() {
  const fileInput = document.getElementById("pdfFileInput");
  if (!fileInput || !fileInput.files.length) {
    showToast("Please select or drop course PDF file(s) first.", "warning");
    return;
  }

  const files = fileInput.files;
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append("pdfs", files[i]);
  }

  const btn = document.getElementById("runOcrBtn");
  if (btn) btn.disabled = true;

  const fileLabel =
    files.length === 1 ? files[0].name : `${files.length} course files`;
  setOcrStatus(
    `Reading course details from ${fileLabel}... (takes a few moments)`,
    "info",
    true,
  );

  try {
    const res = await fetch("/api/pdf-ocr", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to import courses");
    }

    const count = data.courses ? data.courses.length : 0;
    setOcrStatus(
      `✓ Loaded ${count} courses from ${files.length} file(s)!`,
      "success",
    );
    handleOcrResults(data.courses || []);
    showToast(
      `Imported ${count} courses from ${files.length} file(s)!`,
      "success",
    );
  } catch (err) {
    console.error("Import Error:", err);
    setOcrStatus(`Error: ${err.message}`, "error");
    showToast(`Error: ${err.message}`, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Load Last Results from results.json
async function loadLastOcrResults() {
  const btn = document.getElementById("loadResultsBtn");
  if (btn) btn.disabled = true;

  setOcrStatus("Loading recent course list...", "info", true);

  try {
    const res = await fetch("/api/pdf-ocr/results");
    const data = await res.json();

    if (!data.success) {
      throw new Error(
        data.error || "No recent course list found. Please upload a PDF first.",
      );
    }

    const count = data.courses ? data.courses.length : 0;
    setOcrStatus(
      `✓ Loaded ${count} courses from previous results.json`,
      "success",
    );
    handleOcrResults(data.courses || []);
    showToast(`Loaded ${count} courses successfully!`, "success");
  } catch (err) {
    console.error("Load results error:", err);
    setOcrStatus(`Load failed: ${err.message}`, "error");
    showToast(`Failed: ${err.message}`, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function handleOcrResults(courses) {
  ocrImportedCourses = courses;
  const resultsSec = document.getElementById("ocrResultsSection");
  if (resultsSec) resultsSec.style.display = "block";

  const countBadge = document.getElementById("ocrCourseCount");
  if (countBadge) countBadge.textContent = `${courses.length} Courses`;

  renderOcrCourses(courses);
}

function filterOcrCourses() {
  const q = (document.getElementById("ocrCourseSearch")?.value || "")
    .trim()
    .toLowerCase();
  if (!q) {
    renderOcrCourses(ocrImportedCourses);
    return;
  }
  const filtered = ocrImportedCourses.filter(
    (c) =>
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)),
  );
  renderOcrCourses(filtered);
}

function renderOcrCourses(courses) {
  const container = document.getElementById("ocrCoursesGrid");
  if (!container) return;

  if (!courses || courses.length === 0) {
    container.innerHTML =
      '<p style="color:#64748b; font-style:italic; grid-column: 1/-1; padding:20px; text-align:center;">No matching courses found.</p>';
    return;
  }

  container.innerHTML = courses
    .map((course, cIdx) => {
      const code = escapeHtml(course.code || "N/A");
      const name = escapeHtml(course.name || "Unnamed Course");
      const comp = escapeHtml(course.component || "Theory");
      const credit = parseFloat(course.credit || 3);
      const theorySlots = course.theorySlots || [];
      const labSlots = course.labSlots || [];

      let theoryHtml = "";
      if (theorySlots.length > 0) {
        theoryHtml = `
                <div style="margin-top: 10px;">
                    <div style="font-size:11px; font-weight:700; color:#475569; margin-bottom:4px;">Theory Slots:</div>
                    <div class="ocr-slots-table-wrap">
                        <table class="ocr-slots-table">
                            <thead>
                                <tr>
                                    <th>Slot</th>
                                    <th>Faculty</th>
                                    <th>Venue</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${theorySlots
                                  .map((s, sIdx) => {
                                    const slotCode = escapeHtml(s.slot);
                                    const fac = escapeHtml(s.faculty || "TBA");
                                    const ven = escapeHtml(s.venue || "TBA");
                                    const key = `${code}_${slotCode}`;
                                    const isPlaced = placedOcrSlots.has(key);
                                    return `
                                        <tr>
                                            <td><span class="ocr-slot-pill">${slotCode}</span></td>
                                            <td>${fac}</td>
                                            <td>${ven}</td>
                                            <td>
                                                <button class="ocr-add-slot-btn ${isPlaced ? "placed" : ""}"
                                                    data-course-idx="${cIdx}"
                                                    data-slot-idx="${sIdx}"
                                                    data-slot-type="theory"
                                                    onclick="toggleOcrSlot(${cIdx}, ${sIdx}, 'theory', this)">
                                                    ${isPlaced ? "✓ Added" : "+ Add to Timetable"}
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                  })
                                  .join("")}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
      }

      let labHtml = "";
      if (labSlots.length > 0) {
        labHtml = `
                <div style="margin-top: 10px;">
                    <div style="font-size:11px; font-weight:700; color:#475569; margin-bottom:4px;">Lab Slots:</div>
                    <div class="ocr-slots-table-wrap">
                        <table class="ocr-slots-table">
                            <thead>
                                <tr>
                                    <th>Slot</th>
                                    <th>Faculty</th>
                                    <th>Venue</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${labSlots
                                  .map((s, sIdx) => {
                                    const slotCode = escapeHtml(s.slot);
                                    const fac = escapeHtml(s.faculty || "TBA");
                                    const ven = escapeHtml(s.venue || "TBA");
                                    const key = `${code}_${slotCode}`;
                                    const isPlaced = placedOcrSlots.has(key);
                                    return `
                                        <tr>
                                            <td><span class="ocr-slot-pill">${slotCode}</span></td>
                                            <td>${fac}</td>
                                            <td>${ven}</td>
                                            <td>
                                                <button class="ocr-add-slot-btn ${isPlaced ? "placed" : ""}"
                                                    data-course-idx="${cIdx}"
                                                    data-slot-idx="${sIdx}"
                                                    data-slot-type="lab"
                                                    onclick="toggleOcrSlot(${cIdx}, ${sIdx}, 'lab', this)">
                                                    ${isPlaced ? "✓ Added" : "+ Add to Timetable"}
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                  })
                                  .join("")}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
      }

      return `
            <div class="ocr-course-card">
                <div class="ocr-card-top">
                    <div>
                        <span class="ocr-course-code">${code}</span>
                        <div class="ocr-course-title">${name}</div>
                    </div>
                </div>
                <div class="ocr-badge-row">
                    <span class="ocr-badge ocr-badge-component">${comp}</span>
                    <span class="ocr-badge ocr-badge-credits">${credit} Credits</span>
                    <span class="ocr-badge" style="background:#e0f2fe; color:#0369a1;">${theorySlots.length + labSlots.length} Options</span>
                </div>
                ${theoryHtml}
                ${labHtml}
            </div>
        `;
    })
    .join("");
}

// 1-Click Toggle OCR slot into timetable
function toggleOcrSlot(courseIdx, slotIdx, slotType, btnEl) {
  const course = ocrImportedCourses[courseIdx];
  if (!course) return;

  const slotObj =
    slotType === "theory"
      ? course.theorySlots[slotIdx]
      : course.labSlots[slotIdx];
  if (!slotObj) return;

  const courseCode = course.code || "COURSE";
  const courseName = `${course.name || courseCode} (${courseCode})`;
  const slotStr = slotObj.slot;
  const key = `${courseCode}_${slotStr}`;

  // If already placed, remove it
  if (placedOcrSlots.has(key)) {
    const existingId = placedOcrSlots.get(key);
    removeCourse(existingId);
    placedOcrSlots.delete(key);
    if (btnEl) {
      btnEl.classList.remove("placed");
      btnEl.innerHTML = "+ Add to Timetable";
    }
    showToast(`Removed ${courseName} (${slotStr}) from timetable`, "info");
    return;
  }

  // Split compound slots (e.g. "B1" or "A1+TA1" or "L1+L2")
  const slots = slotStr.split("+").map((s) => s.trim());

  // Validate slots exist in slotMappings
  const unmapped = slots.filter((s) => !slotMappings[s]);
  if (unmapped.length > 0) {
    showToast(
      `Slot "${unmapped.join(", ")}" is not defined in timetable mappings.`,
      "warning",
    );
  }

  // Check for clashes
  const clashes = checkForClashes(slots, slotType, courseName);
  if (clashes.length > 0) {
    showClashAlert(clashes, courseName, slotStr, slotType);
    showToast(
      `Clash detected for ${courseName} (${slotStr})! Check the alert above.`,
      "error",
    );
    return;
  }

  // Calculate credits
  let credits =
    slotType === "lab" ? 1 : Math.round(parseFloat(course.credit || 3));
  if (credits < 1) credits = 1;
  if (credits > 4) credits = 4;

  const courseItem = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: courseName,
    code: courseCode,
    slot: slotStr,
    type: slotType,
    credits: credits,
    slots: slots,
    faculty: slotObj.faculty || "",
    venue: slotObj.venue || "",
  };

  selectedCourses.push(courseItem);
  updateTimetable(courseItem);
  updateSelectedCoursesList();
  updateStats();
  hideClashAlert();

  placedOcrSlots.set(key, courseItem.id);
  if (btnEl) {
    btnEl.classList.add("placed");
    btnEl.innerHTML = "✓ Added";
  }

  showToast(`✓ Added ${courseName} [${slotStr}] to timetable!`, "success");
}

// 1-Click Toggle Screenshot slot into timetable
function toggleScreenshotSlot(
  slotStr,
  courseCode = "",
  courseTitle = "",
  btnEl = null,
) {
  if (!slotStr) return;
  const compoundSlots = slotStr.split("+").map((s) => s.trim().toUpperCase());
  const isLab = compoundSlots.some((s) => s.startsWith("L"));
  const slotType = isLab ? "lab" : "theory";
  const code = courseCode || "CUSTOM";
  const title =
    courseTitle || (courseCode ? courseCode : `Course (${slotStr})`);
  const key = `SS_${code}_${slotStr}`;

  // If already placed, remove it
  if (placedOcrSlots.has(key)) {
    const existingId = placedOcrSlots.get(key);
    removeCourse(existingId);
    placedOcrSlots.delete(key);
    if (btnEl) {
      btnEl.classList.remove("placed");
      btnEl.innerHTML = `➕ ${escapeHtml(slotStr)}`;
    }
    showToast(`Removed ${title} [${slotStr}] from timetable`, "info");
    return;
  }

  // Validate against slot mappings
  const unmapped = compoundSlots.filter((s) => !slotMappings[s]);
  if (unmapped.length > 0) {
    showToast(
      `Warning: Slot "${unmapped.join(", ")}" is not defined in timetable mappings.`,
      "warning",
    );
  }

  // Check for timetable clashes
  const clashes = checkForClashes(compoundSlots, slotType, title);
  if (clashes.length > 0) {
    showClashAlert(clashes, title, slotStr, slotType);
    showToast(
      `Clash detected for ${title} (${slotStr})! Check the clash alert above.`,
      "error",
    );
    return;
  }

  // Calculate credits
  let credits = isLab
    ? 1
    : compoundSlots.length >= 3
      ? 4
      : compoundSlots.length === 2
        ? 3
        : 2;

  const courseItem = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: title,
    code: code,
    slot: slotStr,
    type: slotType,
    credits: credits,
    slots: compoundSlots,
    faculty: "",
    venue: "",
  };

  selectedCourses.push(courseItem);
  updateTimetable(courseItem);
  updateSelectedCoursesList();
  updateStats();
  hideClashAlert();

  placedOcrSlots.set(key, courseItem.id);
  if (btnEl) {
    btnEl.classList.add("placed");
    btnEl.innerHTML = `✓ ${escapeHtml(slotStr)} Added`;
  }

  showToast(`✓ Added ${title} [${slotStr}] to timetable!`, "success");
}

// Backwards compatibility alias
function addDetectedSlot(slotStr) {
  toggleScreenshotSlot(slotStr);
}

// Screenshot upload integration
async function uploadScreenshot() {
  const fileInput = document.getElementById("screenshotFileInput");
  const status = document.getElementById("screenshotStatus");
  const preview = document.getElementById("screenshotPreview");

  if (!fileInput || !fileInput.files.length) {
    showToast("Please select a registration screenshot image.", "warning");
    return;
  }

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("image", file);

  status.className = "ocr-status info";
  status.style.display = "flex";
  status.innerHTML =
    '<span class="spinner"></span> <span>Reading timetable from screenshot...</span>';

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Failed to process image");
    }

    const courses = data.courses || [];
    const detectedSlots = data.detectedSlots || [];

    status.className = "ocr-status success";
    status.style.display = "flex";
    status.innerHTML = `<span>✓ Screenshot read successfully! Detected ${courses.length} courses and ${detectedSlots.length} slot options.</span>`;

    if (preview) {
      preview.style.display = "block";
      let previewHtml = "";

      if (courses.length > 0) {
        previewHtml += `
                    <div style="font-weight:600; font-size:13px; margin-bottom:10px; color:#1e293b;">
                        Detected Courses (${courses.length}) — Click slot to add directly:
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:12px;">
                `;

        courses.forEach((c) => {
          const code = c.code || "COURSE";
          const name = c.name || code;
          const slots = c.slots || [];
          previewHtml += `
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:8px;">
                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <span class="ocr-badge" style="background:#e0f2fe; color:#0369a1; font-weight:700;">${escapeHtml(code)}</span>
                                <span style="font-weight:600; font-size:13px; color:#0f172a;">${escapeHtml(name)}</span>
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                                ${slots
                                  .map((s) => {
                                    const key = `SS_${code}_${s}`;
                                    const isPlaced = placedOcrSlots.has(key);
                                    return `
                                        <button class="ocr-add-slot-btn ${isPlaced ? "placed" : ""}"
                                                onclick="toggleScreenshotSlot('${escapeHtml(s)}', '${escapeHtml(code)}', '${escapeHtml(name)}', this)">
                                            ${isPlaced ? "✓ " + escapeHtml(s) + " Added" : "➕ " + escapeHtml(s)}
                                        </button>
                                    `;
                                  })
                                  .join("")}
                            </div>
                        </div>
                    `;
        });

        previewHtml += `</div>`;
      } else if (detectedSlots.length > 0) {
        previewHtml += `
                    <div style="font-weight:600; font-size:13px; margin-bottom:8px; color:#1e293b;">
                        Detected Slots (${detectedSlots.length}) — Click to add:
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                        ${detectedSlots
                          .map((slot) => {
                            const key = `SS_CUSTOM_${slot}`;
                            const isPlaced = placedOcrSlots.has(key);
                            return `
                                <button class="ocr-add-slot-btn ${isPlaced ? "placed" : ""}"
                                        onclick="toggleScreenshotSlot('${escapeHtml(slot)}', '', 'Course (${escapeHtml(slot)})', this)">
                                    ${isPlaced ? "✓ " + escapeHtml(slot) + " Added" : "➕ " + escapeHtml(slot)}
                                </button>
                            `;
                          })
                          .join("")}
                    </div>
                `;
      } else {
        previewHtml += `
                    <div style="padding:10px; background:#fff; border-radius:6px; font-size:13px; color:#64748b; border:1px dashed #cbd5e1; margin-bottom:10px;">
                        No courses or slot patterns found in this screenshot. Please verify image clarity.
                    </div>
                `;
      }

      // Raw OCR preview collapsible
      if (data.rawText) {
        previewHtml += `
                    <details style="margin-top:10px; font-size:12px; color:#64748b;">
                        <summary style="cursor:pointer; font-weight:600; user-select:none;">
                            View Extracted Raw Text (${data.lines ? data.lines.length : 0} lines)
                        </summary>
                        <pre style="background:#f1f5f9; padding:8px 12px; border-radius:6px; margin-top:6px; white-space:pre-wrap; max-height:160px; overflow-y:auto; font-family:var(--font-mono); font-size:11px; line-height:1.4; border:1px solid #e2e8f0;">${escapeHtml(data.rawText)}</pre>
                    </details>
                `;
      }

      preview.innerHTML = previewHtml;
    }

    showToast("Screenshot read successfully!", "success");
  } catch (err) {
    console.error("Screenshot upload error:", err);
    status.className = "ocr-status error";
    status.style.display = "flex";
    status.innerHTML = `<span>Upload failed: ${escapeHtml(err.message)}</span>`;
    showToast(`Screenshot Error: ${err.message}`, "error");
  }
}

// Print Timetable
function printTimetable() {
  window.print();
}

// Beautiful toast notification helper
function showToast(message, type = "info") {
  const existing = document.querySelector(".beautiful-alert");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `beautiful-alert ${type}`;

  let icon = "ℹ️";
  if (type === "success") icon = "✓";
  if (type === "error") icon = "⚠️";
  if (type === "warning") icon = "⚠️";

  toast.innerHTML = `
        <div class="alert-content">
            <span class="alert-icon">${icon}</span>
            <span class="alert-message">${escapeHtml(message)}</span>
            <button class="alert-close" onclick="this.closest('.beautiful-alert').remove()">&times;</button>
        </div>
    `;

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
