const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

const config = {
  profileUrl: process.env.PROFILE_URL || "https://m-surprise.com/profile/?id=4967",
  diaryUrl:
    process.env.DIARY_URL ||
    "https://diary.m-surprise.com/category/no-75-%e3%81%be%e3%81%93%e3%81%a8/",
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  discordUsername: process.env.DISCORD_USERNAME || "\u307e\u3053\u3068\u3061\u3083\u3093\u76e3\u8996BOT",
  discordAvatarUrl: process.env.DISCORD_AVATAR_URL || "",
  timezone: process.env.TIMEZONE || "Asia/Tokyo",
  fetchTimeoutMs: Number(process.env.FETCH_TIMEOUT_MS || 45000),
  diaryPageLimit: Number(process.env.DIARY_PAGE_LIMIT || 3),
  notifyInitialSnapshot: parseBoolean(process.env.NOTIFY_INITIAL_SNAPSHOT, false),
  notify: {
    schedule: parseBoolean(process.env.NOTIFY_SCHEDULE, true),
    profile: parseBoolean(process.env.NOTIFY_PROFILE, true),
    photos: parseBoolean(process.env.NOTIFY_PHOTOS, true),
    diary: parseBoolean(process.env.NOTIFY_DIARY, true),
  },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 MakotoWatchBot/1.0",
  dataPaths: {
    latest: path.join(DATA_DIR, "latest.json"),
    previous: path.join(DATA_DIR, "previous.json"),
  },
};

function parseBoolean(value, defaultValue) {
  if (value == null || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

module.exports = { config, ROOT_DIR, DATA_DIR };
