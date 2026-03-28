const fs = require("fs");
const path = require("path");
const { buildPayload } = require("./lifeLogPayload");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const latestPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(rootDir, "data", "latest.json");
  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(rootDir, "data", "life-log-import.json");
  const source = process.argv[4] || "discord-bot";
  const previousPath = process.argv[5]
    ? path.resolve(process.argv[5])
    : path.join(rootDir, "data", "previous.json");

  const currentSnapshot = readJson(latestPath);
  let previousSnapshot = null;

  if (fs.existsSync(previousPath)) {
    previousSnapshot = readJson(previousPath);
  }

  const payload = buildPayload(currentSnapshot, {
    source,
    previousSnapshot,
  });

  ensureDirForFile(outputPath);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote life-log payload to ${outputPath}`);
  console.log(`shifts=${payload.shifts.length} updates=${payload.updates.length}`);
}

if (require.main === module) {
  main();
}
