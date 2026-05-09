/**
 * GOOGLE APPS SCRIPT - OPTIMIZED FOR DASHBOARD
 * Sila gantikan kod di Apps Script anda dengan kod ini untuk prestasi lebih laju.
 */

const SPREADSHEET_ID = "1fWU2Wz2vwHibOVA_EtHsX8fvCVu4brBr4jKhoMcKnm0";

function doGet(e) {
  const kelas = e.parameter.kelas;
  const useCache = e.parameter.cache !== "false";
  
  if (!kelas) {
    return createJsonResponse({ error: "Parameter 'kelas' diperlukan." });
  }

  // Gunakan CacheService untuk mengelakkan membaca spreadsheet berulang kali
  const cache = CacheService.getScriptCache();
  const cacheKey = "data_" + kelas;
  const cachedData = cache.get(cacheKey);

  if (useCache && cachedData) {
    return createJsonResponse(JSON.parse(cachedData), true);
  }

  try {
    const data = getSheetData(kelas);
    
    // Simpan dalam cache selama 20 minit (1200 saat)
    cache.put(cacheKey, JSON.stringify(data), 1200);
    
    return createJsonResponse(data);
  } catch (err) {
    return createJsonResponse({ error: err.message });
  }
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error("Tab '" + sheetName + "' tidak dijumpai.");
  }

  // Ambil semua data dalam satu panggilan (getValues)
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  if (values.length < 2) return [];

  const headers = values[0];
  const rows = values.slice(1);

  return rows.map(row => {
    const student = {
      Nama: row[0] || "Tanpa Nama"
    };

    // Cari kolum Surah secara dinamik
    headers.forEach((header, index) => {
      // Ikut format yang dikehendaki app.js: Surah_1, Surah_2, dll
      // Kita anggap kolum 1-6 adalah Surah 1-6
      if (index >= 1 && index <= 6) {
        student["Surah_" + index] = {
          Tajuk: header,
          Skor: row[index] || 0
        };
      }
    });

    return student;
  }).filter(s => s.Nama && s.Nama !== "Tanpa Nama");
}

function createJsonResponse(data, fromCache = false) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  
  return output;
}

/**
 * Fungsi untuk mengosongkan cache jika anda telah mengemas kini Sheet secara manual
 * dan mahu dashboard terus nampak perubahan tersebut.
 */
function clearAllCache() {
  const cache = CacheService.getScriptCache();
  const classes = ["5A", "5B", "5C", "5D", "5H", "5G", "5I", "5J"];
  classes.forEach(c => cache.remove("data_" + c));
}
