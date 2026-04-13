const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

const config = {
  profileUrl: process.env.PROFILE_URL || "https://m-surprise.com/profile/?id=4967",
  rankingUrl: process.env.RANKING_URL || "https://m-surprise.com/ranking/",
  diaryUrl:
    process.env.DIARY_URL ||
    "https://diary.m-surprise.com/category/no-75-%e3%81%be%e3%81%93%e3%81%a8/",
  rankingTargetCastNo: Number(process.env.RANKING_TARGET_CAST_NO || 75),
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  discordUsername: process.env.DISCORD_USERNAME || "まことちゃん通知",
  discordAvatarUrl: process.env.DISCORD_AVATAR_URL || "",
  timezone: process.env.TIMEZONE || "Asia/Tokyo",
  fetchTimeoutMs: Number(process.env.FETCH_TIMEOUT_MS || 60000),
  fetchRequestTimeoutMs: Number(process.env.FETCH_REQUEST_TIMEOUT_MS || 15000),
  fetchBrowserTimeoutMs: Number(process.env.FETCH_BROWSER_TIMEOUT_MS || 20000),
  fetchRetryCount: Number(process.env.FETCH_RETRY_COUNT || 3),
  diaryPageLimit: Number(process.env.DIARY_PAGE_LIMIT || 3),
  notifyInitialSnapshot: parseBoolean(process.env.NOTIFY_INITIAL_SNAPSHOT, false),
  testNotification: parseBoolean(process.env.TEST_NOTIFICATION, false),
  notify: {
    schedule: parseBoolean(process.env.NOTIFY_SCHEDULE, true),
    profile: parseBoolean(process.env.NOTIFY_PROFILE, true),
    photos: parseBoolean(process.env.NOTIFY_PHOTOS, true),
    diary: parseBoolean(process.env.NOTIFY_DIARY, true),
    ranking: parseBoolean(process.env.NOTIFY_RANKING, true),
  },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 MakotoWatchBot/1.0",
  dataPaths: {
    latest: path.join(DATA_DIR, "latest.json"),
    previous: path.join(DATA_DIR, "previous.json"),
    rankingState: path.join(DATA_DIR, "ranking-state.json"),
  },
};

function parseBoolean(value, defaultValue) {
  if (value == null || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

module.exports = { config, ROOT_DIR, DATA_DIR };
