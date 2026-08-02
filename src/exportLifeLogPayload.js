const fs = require("fs");
const path = require("path");
const { config } = require("./config");
const { buildPayload } = require("./lifeLogPayload");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const hasExplicitPaths = process.argv.length > 2;
  if (!hasExplicitPaths && !config.lifeLogExport) {
    console.log(`Skipping life-log export for target=${config.target}`);
    return;
  }

  const latestPath = process.argv[2] ? path.resolve(process.argv[2]) : config.dataPaths.latest;
  const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : config.dataPaths.lifeLog;
  const source = process.argv[4] || `${config.target}-discord-bot`;
  const previousPath = process.argv[5] ? path.resolve(process.argv[5]) : config.dataPaths.previous;
  const historyPath = process.argv[6] ? path.resolve(process.argv[6]) : config.dataPaths.fc2History;

  const currentSnapshot = readJsonWithLegacyFallback(latestPath, config.legacyDataPaths?.latest);
  let previousSnapshot = null;
  let historyShifts = [];

  if (fs.existsSync(previousPath)) {
    previousSnapshot = readJson(previousPath);
  } else if (config.legacyDataPaths?.previous && fs.existsSync(config.legacyDataPaths.previous)) {
    previousSnapshot = readJson(config.legacyDataPaths.previous);
  }

  if (fs.existsSync(historyPath)) {
    const historyPayload = readJson(historyPath);
    historyShifts = Array.isArray(historyPayload.shifts) ? historyPayload.shifts : [];
  }

  const payload = buildPayload(currentSnapshot, {
    source,
    previousSnapshot,
    historyShifts,
  });

  ensureDirForFile(outputPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote life-log payload to ${outputPath}`);
  console.log(`shifts=${payload.shifts.length} updates=${payload.updates.length}`);
  console.log(`rankingSnapshots=${payload.rankings?.rankingSnapshots?.length || 0}`);
}

function readJsonWithLegacyFallback(filePath, legacyPath) {
  if (fs.existsSync(filePath)) {
    return readJson(filePath);
  }

  if (legacyPath && fs.existsSync(legacyPath)) {
    return readJson(legacyPath);
  }

  return readJson(filePath);
}

if (require.main === module) {
  main();
}
