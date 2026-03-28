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

function normalizeStatus(text) {
  if (text.includes("出勤")) {
    return "working";
  }
  if (text.includes("要確認")) {
    return "pending";
  }
  return "off";
}

function normalizeTime(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed || trimmed === "-") {
    return undefined;
  }

  const match = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (!match) {
    return undefined;
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function extractRows(html, options = {}) {
  const fallbackYear = options.year || new Date().getFullYear();
  const importedAt = options.importedAt || new Date().toISOString();
  const source = options.source || "fc2-history";
  const $ = cheerio.load(html);
  const records = [];

  $("table tr").each((_index, row) => {
    const cells = $(row)
      .find("th, td")
      .map((_cellIndex, cell) => $(cell).text().trim())
      .get();

    if (cells.length < 4) {
      return;
    }

    const date = toDateKey(cells[0], fallbackYear);
    if (!date) {
      return;
    }

    records.push({
      id: `${source}-${date}`,
      date,
      status: normalizeStatus(cells[1]),
      startTime: normalizeTime(cells[2]),
      endTime: normalizeTime(cells[3]),
      updatedAt: importedAt,
      source,
      sourceId: `${source}:${date}`,
    });
  });

  return records.sort((left, right) => left.date.localeCompare(right.date));
}

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const inputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(rootDir, "data", "fc2-history.html");
  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(rootDir, "data", "fc2-history-import.json");
  const year = process.argv[4] ? Number(process.argv[4]) : new Date().getFullYear();
  const importedAt = new Date().toISOString();
  const source = "fc2-history";

  const html = readHtml(inputPath);
  const shifts = extractRows(html, { year, importedAt, source });
  const payload = {
    source,
    importedAt,
    shifts,
    updates: [],
  };

  ensureDirForFile(outputPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote FC2 history payload to ${outputPath}`);
  console.log(`shifts=${payload.shifts.length}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  extractRows,
};
