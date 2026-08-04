const path = require("path");
const dotenv = require("dotenv");
const { targets } = require("./targets");

const dotEnv = {};
dotenv.config({ processEnv: dotEnv });

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const target = process.env.TARGET || dotEnv.TARGET || "makoto";
const targetConfig = targets[target];

if (!targetConfig) {
  throw new Error(`Unknown TARGET: ${target}. Known targets: ${Object.keys(targets).join(", ")}`);
}

const targetDataDir = path.join(DATA_DIR, target);
const legacyDataPaths =
  target === "makoto"
    ? {
        latest: path.join(DATA_DIR, "latest.json"),
        previous: path.join(DATA_DIR, "previous.json"),
        rankingState: path.join(DATA_DIR, "ranking-state.json"),
        lifeLog: path.join(DATA_DIR, "life-log-import.json"),
      }
    : null;

const config = {
  target,
  siteType: getEnv("SITE_TYPE") || targetConfig.siteType,
  profileUrl: getEnv("PROFILE_URL") || targetConfig.profileUrl,
  rankingUrl: getEnv("RANKING_URL") || targetConfig.rankingUrl || "",
  diaryUrl: getEnv("DIARY_URL") || targetConfig.diaryUrl || "",
  diaryCategoryKeywords: parseList(getEnv("DIARY_CATEGORY_KEYWORDS"), targetConfig.diaryCategoryKeywords),
  rankingTargetCastNo: parseOptionalNumber(getEnv("RANKING_TARGET_CAST_NO"), targetConfig.rankingTargetCastNo),
  discordWebhookUrl: getEnv("DISCORD_WEBHOOK_URL") || "",
  discordUsername: getEnv("DISCORD_USERNAME") || targetConfig.discordUsername,
  discordAvatarUrl: getEnv("DISCORD_AVATAR_URL") || "",
  timezone: getEnv("TIMEZONE") || "Asia/Tokyo",
  fetchTimeoutMs: Number(getEnv("FETCH_TIMEOUT_MS") || 60000),
  fetchRequestTimeoutMs: Number(getEnv("FETCH_REQUEST_TIMEOUT_MS") || 15000),
  fetchBrowserTimeoutMs: Number(getEnv("FETCH_BROWSER_TIMEOUT_MS") || 20000),
  fetchRetryCount: Number(getEnv("FETCH_RETRY_COUNT") || 3),
  diaryPageLimit: Number(getEnv("DIARY_PAGE_LIMIT") || 3),
  notifyInitialSnapshot: parseBoolean(getEnv("NOTIFY_INITIAL_SNAPSHOT"), false),
  testNotification: parseBoolean(getEnv("TEST_NOTIFICATION"), false),
  lifeLogSource: getEnv("LIFE_LOG_SOURCE") || targetConfig.lifeLogSource || `${target}-discord-bot`,
  lifeLogExport: parseBoolean(getEnv("LIFE_LOG_EXPORT"), targetConfig.lifeLogExport),
  notify: {
    schedule: parseBoolean(getEnv("NOTIFY_SCHEDULE"), targetConfig.notify.schedule),
    profile: parseBoolean(getEnv("NOTIFY_PROFILE"), targetConfig.notify.profile),
    photos: parseBoolean(getEnv("NOTIFY_PHOTOS"), targetConfig.notify.photos),
    diary: parseBoolean(getEnv("NOTIFY_DIARY"), targetConfig.notify.diary),
    ranking: parseBoolean(getEnv("NOTIFY_RANKING"), targetConfig.notify.ranking),
  },
  userAgent:
    getEnv("USER_AGENT") ||
    targetConfig.userAgent ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 MakotoWatchBot/1.0",
  dataPaths: {
    latest: path.join(targetDataDir, "latest.json"),
    previous: path.join(targetDataDir, "previous.json"),
    rankingState: path.join(targetDataDir, "ranking-state.json"),
    lifeLog:
      target === "makoto"
        ? path.join(DATA_DIR, "life-log-import.json")
        : path.join(targetDataDir, "life-log-import.json"),
    fc2History:
      target === "makoto"
        ? path.join(DATA_DIR, "fc2-history-import.json")
        : path.join(targetDataDir, "fc2-history-import.json"),
  },
  legacyDataPaths,
};

function parseBoolean(value, defaultValue) {
  if (value == null || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function getEnv(name) {
  const targetSpecificName = `${target.toUpperCase()}_${name}`;

  if (process.env[targetSpecificName] != null) {
    return process.env[targetSpecificName];
  }
  if (dotEnv[targetSpecificName] != null) {
    return dotEnv[targetSpecificName];
  }
  if (process.env[name] != null) {
    return process.env[name];
  }
  if (target === "makoto" && dotEnv[name] != null) {
    return dotEnv[name];
  }

  return undefined;
}

function parseOptionalNumber(value, defaultValue) {
  if (value == null || value === "") {
    return defaultValue == null ? null : Number(defaultValue);
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseList(value, defaultValue) {
  if (value == null || value === "") {
    return Array.isArray(defaultValue) ? defaultValue : [];
  }

  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

module.exports = { config, ROOT_DIR, DATA_DIR };
