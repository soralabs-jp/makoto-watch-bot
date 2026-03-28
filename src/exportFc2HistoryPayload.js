const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function toDateKey(text, fallbackYear) {
  const match = String(text || "").match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  return `${fallbackYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeTimeRange(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }

  return {
    startTime: `${match[1].padStart(2, "0")}:${match[2]}`,
    endTime: `${match[3].padStart(2, "0")}:${match[4]}`,
  };
}

function guessYearFromPath(filePath, fallbackYear) {
  const match = String(filePath).match(/(20\d{2})/);
  return match ? Number(match[1]) : fallbackYear;
}

function isTargetCast(label) {
  const normalized = String(label || "").replace(/\s+/g, "");
  return normalized.includes("No.75");
}

function extractRows(html, options = {}) {
  const fallbackYear = options.year || new Date().getFullYear();
  const importedAt = options.importedAt || new Date().toISOString();
  const source = options.source || "fc2-history";
  const sourceName = options.sourceName || "single";
  const $ = cheerio.load(html);
  const table = $("table").first();
  const rows = table.find("tr");
  const headerCells = rows.first().find("th, td").toArray();
  const dateKeys = headerCells.map((cell, index) => {
    if (index === 0) {
      return null;
    }
    return toDateKey($(cell).text(), fallbackYear);
  });

  const targetRow = rows
    .toArray()
    .slice(1)
    .find((row) => {
      const firstCellText = $(row).find("th, td").first().text();
      return isTargetCast(firstCellText);
    });

  if (!targetRow) {
    return [];
  }

  const cells = $(targetRow).find("th, td").toArray();
  const records = [];

  cells.slice(1).forEach((cell, index) => {
    const date = dateKeys[index + 1];
    if (!date) {
      return;
    }

    const range = normalizeTimeRange($(cell).text());
    if (!range) {
      return;
    }

    records.push({
      id: `${source}-${date}`,
      date,
      status: "working",
      startTime: range.startTime,
      endTime: range.endTime,
      updatedAt: importedAt,
      source,
      sourceId: `${source}:${sourceName}:${date}`,
    });
  });

  return records.sort((left, right) => left.date.localeCompare(right.date));
}

function collectHtmlFiles(inputPath) {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) {
    return [inputPath];
  }

  return fs
    .readdirSync(inputPath)
    .filter((name) => name.toLowerCase().endsWith(".html"))
    .map((name) => path.join(inputPath, name))
    .sort((left, right) => left.localeCompare(right));
}

function mergeShiftRecords(records) {
  const byDate = new Map();
  records.forEach((record) => {
    byDate.set(record.date, record);
  });
  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const inputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(rootDir, "data", "fc2-history");
  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(rootDir, "data", "fc2-history-import.json");
  const fallbackYear = process.argv[4] ? Number(process.argv[4]) : new Date().getFullYear();
  const importedAt = new Date().toISOString();
  const source = "fc2-history";

  const htmlFiles = collectHtmlFiles(inputPath);
  const allRecords = htmlFiles.flatMap((filePath) => {
    const html = readHtml(filePath);
    const sourceName = path.basename(filePath, path.extname(filePath));
    const year = guessYearFromPath(filePath, fallbackYear);
    return extractRows(html, { year, importedAt, source, sourceName });
  });

  const payload = {
    source,
    importedAt,
    shifts: mergeShiftRecords(allRecords),
    updates: [],
  };

  ensureDirForFile(outputPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote FC2 history payload to ${outputPath}`);
  console.log(`files=${htmlFiles.length} shifts=${payload.shifts.length}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  collectHtmlFiles,
  extractRows,
  mergeShiftRecords,
};

