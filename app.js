const SHEET_ID = "1fWU2Wz2vwHibOVA_EtHsX8fvCVu4brBr4jKhoMcKnm0";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzERbhUiAk5qehRqu3rOrTb2L1vEIbQxUNp20T8SnZeaTGF33nF4IqYx_6DccYyJ0cV3g/exec";
const CLASS_TABS = ["5A", "5B", "5C", "5D", "5H", "5G", "5I", "5J"];
const CACHE_KEY = "hafazan_dashboard_cache";
const SURAH_FALLBACK = [
  "Surah 1",
  "Surah 2",
  "Surah 3",
  "Surah 4",
  "Surah 5",
  "Surah 6"
];

const NAME_COLUMN_INDEX = 0;
const SCORE_START_INDEX = 1;
const SCORE_END_INDEX = 6;

const state = {
  activeClass: CLASS_TABS[0],
  classes: {},
  lastUpdated: null,
  isRefreshing: false
};

// DOM Elements
const classSelect = document.getElementById("classSelect");
const studentsContainer = document.getElementById("studentsContainer");
const statusEl = document.getElementById("status"); // Old status element, kept for safety
const updateStatusEl = document.getElementById("updateStatus");
const lastUpdatedEl = document.getElementById("lastUpdated");
const refreshBtn = document.getElementById("refreshBtn");
const studentCountEl = document.getElementById("studentCount");
const classAverageEl = document.getElementById("classAverage");

// --- Utility Functions ---

function getScoreBand(score) {
  if (score < 40) return "score-low";
  if (score < 80) return "score-mid";
  return "score-high";
}

function clampScore(value) {
  const score = Number(value);
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

function parseGviz(text) {
  const startIndex = text.indexOf("{");
  const endIndex = text.lastIndexOf("}");
  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Format data Google Sheet tidak sah.");
  }
  return JSON.parse(text.slice(startIndex, endIndex + 1));
}

function normalizeCell(cell) {
  if (!cell) return "";
  if (typeof cell.v === "number") return cell.v;
  if (typeof cell.v === "string") return cell.v;
  if (typeof cell.f === "string") return cell.f;
  return "";
}

function getSurahNames(cols) {
  const surahNames = [];
  for (let i = SCORE_START_INDEX; i <= SCORE_END_INDEX; i += 1) {
    const label = (cols[i]?.label || cols[i]?.id || "").trim();
    surahNames.push(label || SURAH_FALLBACK[i - SCORE_START_INDEX]);
  }
  return surahNames;
}

function sortStudents(students) {
  return students
    .filter(Boolean)
    .sort((a, b) => b.average - a.average || a.name.localeCompare(b.name, "ms"));
}

// --- Data Mapping Functions ---

function mapRowsToStudents(rows) {
  const students = rows.map((row) => {
    const cells = row.c || [];
    const name = String(normalizeCell(cells[NAME_COLUMN_INDEX]) || "").trim();
    const surahScores = [];

    for (let i = SCORE_START_INDEX; i <= SCORE_END_INDEX; i += 1) {
      surahScores.push(clampScore(normalizeCell(cells[i])));
    }

    const hasValue = name || surahScores.some((score) => score > 0);
    if (!hasValue) return null;

    const average = surahScores.length
      ? Math.round(surahScores.reduce((sum, score) => sum + score, 0) / surahScores.length)
      : 0;

    return {
      name: name || "Tanpa Nama",
      surahScores,
      average
    };
  });

  return sortStudents(students);
}

function extractAppsScriptSurahKeys(row) {
  return Object.keys(row)
    .filter((key) => /^Surah_\d+$/i.test(key))
    .sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]));
}

function mapAppsScriptRows(payload) {
  if (!Array.isArray(payload)) {
    throw new Error("Respons Apps Script bukan senarai data.");
  }

  const firstRowWithSurah = payload.find((item) => item && typeof item === "object" && extractAppsScriptSurahKeys(item).length > 0);
  const surahKeys = firstRowWithSurah ? extractAppsScriptSurahKeys(firstRowWithSurah) : [];

  const surahNames = surahKeys.length
    ? surahKeys.map((key, idx) => String(payload.find((r) => r?.[key]?.Tajuk)?.[key]?.Tajuk || SURAH_FALLBACK[idx]))
    : SURAH_FALLBACK;

  const students = payload.map((row) => {
    if (!row || typeof row !== "object") return null;

    const name = String(row.Nama || row.nama || "").trim();
    const scores = surahKeys.length
      ? surahKeys.map((key) => clampScore(row[key]?.Skor))
      : SURAH_FALLBACK.map(() => 0);

    if (!name && !scores.some((score) => score > 0)) return null;

    const average = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;

    return {
      name: name || "Tanpa Nama",
      surahScores: scores,
      average
    };
  });

  return {
    surahNames,
    students: sortStudents(students)
  };
}

// --- Fetching Functions ---

async function loadClassDataFromAppsScript(className) {
  if (!GAS_WEB_APP_URL.trim()) {
    throw new Error("URL Apps Script belum diisi.");
  }

  const sep = GAS_WEB_APP_URL.includes("?") ? "&" : "?";
  const url = `${GAS_WEB_APP_URL}${sep}kelas=${encodeURIComponent(className)}&_t=${Date.now()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Apps Script gagal untuk tab ${className} (${response.status})`);
  }

  const rawText = await response.text();
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch (parseError) {
    if (rawText.toLowerCase().includes("<html")) {
      throw new Error("Respons Apps Script bukan JSON.");
    }
    throw new Error("Respons Apps Script tidak boleh dibaca sebagai JSON.");
  }
  
  if (payload && payload.error) {
    throw new Error(payload.error);
  }

  const mapped = mapAppsScriptRows(payload);
  return {
    className,
    surahNames: mapped.surahNames,
    students: mapped.students
  };
}

async function loadClassDataFromGviz(className) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(className)}&tqx=out:json&_t=${Date.now()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Gagal akses tab ${className} (${response.status})`);
  }

  const text = await response.text();
  const payload = parseGviz(text);
  const table = payload.table;
  if (!table || !table.cols || !table.rows) {
    throw new Error(`Data tab ${className} tidak lengkap.`);
  }

  const surahNames = getSurahNames(table.cols);
  const students = mapRowsToStudents(table.rows);

  return {
    className,
    surahNames,
    students
  };
}

async function fetchClassData(className) {
  if (GAS_WEB_APP_URL.trim()) {
    try {
      return await loadClassDataFromAppsScript(className);
    } catch (appsScriptError) {
      console.warn(`Apps Script gagal untuk ${className}, guna fallback GViz.`, appsScriptError);
      return loadClassDataFromGviz(className);
    }
  }
  return loadClassDataFromGviz(className);
}

// --- UI & State Management ---

function saveCache() {
  const cacheData = {
    classes: state.classes,
    lastUpdated: Date.now()
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
}

function loadCache() {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    state.classes = data.classes || {};
    state.lastUpdated = data.lastUpdated || null;
    return true;
  } catch (e) {
    console.error("Gagal baca cache:", e);
    return false;
  }
}

function updateStatusUI(message, isLoading = false) {
  if (updateStatusEl) {
    updateStatusEl.textContent = message;
  }
  if (refreshBtn) {
    refreshBtn.classList.toggle("loading", isLoading);
    refreshBtn.disabled = isLoading;
  }
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.display = isLoading ? "block" : "none";
  }
  
  if (state.lastUpdated) {
    const date = new Date(state.lastUpdated);
    const timeStr = date.toLocaleTimeString("ms-MY", { hour: '2-digit', minute: '2-digit' });
    lastUpdatedEl.textContent = `Kemas kini: ${timeStr}`;
  }
}

function renderStudents(data) {
  const students = data?.students || [];
  const surahNames = data?.surahNames || SURAH_FALLBACK;

  studentCountEl.textContent = String(students.length);
  const classAvg = students.length
    ? Math.round(students.reduce((sum, student) => sum + student.average, 0) / students.length)
    : 0;
  classAverageEl.textContent = `${classAvg}%`;

  if (!students.length) {
    studentsContainer.innerHTML = '<div class="empty">Tiada data murid untuk kelas ini.</div>';
    return;
  }

  studentsContainer.innerHTML = students
    .map((student) => {
      const bars = surahNames
        .map((surahName, idx) => {
          const score = student.surahScores[idx] ?? 0;
          return `
            <li class="bar-row">
              <div class="bar-label">${surahName}</div>
              <div class="bar-track">
                <div class="bar-fill ${getScoreBand(score)}" style="width: ${score}%">${score}%</div>
              </div>
            </li>
          `;
        })
        .join("");

      return `
        <article class="student-card">
          <div class="student-header">
            <h3>${student.name}</h3>
            <span>${student.average}%</span>
          </div>
          <ul class="bars">${bars}</ul>
        </article>
      `;
    })
    .join("");
}

function renderActiveClass() {
  const data = state.classes[state.activeClass];
  renderStudents(data);
}

// --- Main Logic ---

async function refreshAllData(isManual = false) {
  if (state.isRefreshing) return;
  state.isRefreshing = true;
  updateStatusUI("Sedang menyemak data baharu...", true);

  try {
    // 1. Fetch active class first for immediate feedback
    const activeData = await fetchClassData(state.activeClass);
    state.classes[state.activeClass] = activeData;
    renderActiveClass();
    
    // 2. Fetch others in background
    updateStatusUI("Mengemas kini kelas lain...", true);
    const otherClasses = CLASS_TABS.filter(c => c !== state.activeClass);
    
    const results = await Promise.allSettled(otherClasses.map(c => fetchClassData(c)));
    
    results.forEach((result, idx) => {
      const className = otherClasses[idx];
      if (result.status === "fulfilled") {
        state.classes[className] = result.value;
      }
    });

    state.lastUpdated = Date.now();
    saveCache();
    updateStatusUI("Data terkini");
  } catch (error) {
    console.error("Gagal kemas kini:", error);
    updateStatusUI("Gagal mengemas kini");
  } finally {
    state.isRefreshing = false;
    updateStatusUI(state.lastUpdated ? "Sedia" : "Gagal", false);
  }
}

function renderClassOptions() {
  classSelect.innerHTML = "";
  CLASS_TABS.forEach((className) => {
    const option = document.createElement("option");
    option.value = className;
    option.textContent = className;
    classSelect.appendChild(option);
  });
  classSelect.value = state.activeClass;
}

async function init() {
  renderClassOptions();

  classSelect.addEventListener("change", (event) => {
    state.activeClass = event.target.value;
    renderActiveClass();
    // If we have data for this class, just render it. 
    // If not, it will be fetched by the background process.
  });

  refreshBtn.addEventListener("click", () => refreshAllData(true));

  // 1. Try load from cache
  const hasCache = loadCache();
  if (hasCache) {
    renderActiveClass();
    updateStatusUI("Menggunakan data simpanan");
  } else {
    updateStatusUI("Memuatkan data pertama kali...");
  }

  // 2. Always trigger a refresh in the background (Stale-While-Revalidate)
  refreshAllData();
}

init();

