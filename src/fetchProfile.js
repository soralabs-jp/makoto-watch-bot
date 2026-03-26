const cheerio = require("cheerio");
const { fetchHtml } = require("./browser");
const { config } = require("./config");
const {
  guessDateSequence,
  normalizeInlineText,
  normalizePhotoUrls,
  normalizeText,
  normalizeTime,
} = require("./normalize");

const LABEL_KEY_MAP = {
  "\u6027\u683c": "personality",
  "\u597d\u304d\u306a\u97f3\u697d\u3084\u30a2\u30fc\u30c6\u30a3\u30b9\u30c8": "favoriteMusic",
  "\u8da3\u5473": "hobby",
  "\u6027\u611f\u5e2f\u306f\uff1f": "sensitiveSpot",
  "\u7279\u6280": "specialSkill",
  "\u4eca\u4e00\u756a\u6b32\u3057\u3044\u3082\u306e": "wantNow",
  "\u30c1\u30e3\u30fc\u30e0\u30dd\u30a4\u30f3\u30c8": "charmPoint",
  "\u5b66\u751f\u6642\u4ee3\u306e\u90e8\u6d3b\u52d5": "schoolClub",
  "S or M ?": "sOrM",
};

async function fetchProfile() {
  const html = await fetchHtml(config.profileUrl);
  const fetchedAt = new Date().toISOString();
  const $ = cheerio.load(html);

  const profileRoot = $(".profile").first();
  if (!profileRoot.length) {
    throw new Error("\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u9818\u57df `.profile` \u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3067\u3057\u305f");
  }

  return {
    sourceUrl: config.profileUrl,
    fetchedAt,
    profile: extractProfile($),
    photos: extractPhotos($),
    schedule: extractSchedule($, fetchedAt),
  };
}

function extractPhotos($) {
  const urls = $(".profile-slider__list-item img")
    .map((_, element) => $(element).attr("src"))
    .get();

  return normalizePhotoUrls(urls, config.profileUrl);
}

function extractProfile($) {
  const items = $(".profile-list > .profile-list--item").toArray();
  if (items.length === 0) {
    throw new Error("\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u9805\u76ee `.profile-list--item` \u304c\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f");
  }

  const nameText = normalizeInlineText($(".profile-name").first().text());
  const sizeText = normalizeInlineText($(".profile-3size").first().text());
  const titleText = normalizeInlineText($(".profile > h3").first().text());

  const nameMatch = nameText.match(/No\.\d+\s*([^(]+?)(?:\((\d+)\))?$/);
  const sizeMatch = sizeText.match(/T:(\d+)\s*B:(\d+\([^)]+\))\s*W:(\d+)\s*H:(\d+)/i);

  const basicInfo = {};
  if (nameMatch?.[2]) {
    basicInfo.age = nameMatch[2];
  }
  if (sizeMatch) {
    basicInfo.height = sizeMatch[1];
    basicInfo.bust = sizeMatch[2];
    basicInfo.waist = sizeMatch[3];
    basicInfo.hip = sizeMatch[4];
    basicInfo.size = `B:${sizeMatch[2]} W:${sizeMatch[3]} H:${sizeMatch[4]}`;
  }

  const texts = {
    catchcopy: titleText || "",
    message: "",
    shopMessage: "",
  };

  for (const item of items) {
    const node = $(item);

    if (
      node.hasClass("profile-name") ||
      node.hasClass("profile-3size") ||
      node.hasClass("profile-btn_prev")
    ) {
      continue;
    }

    if (node.hasClass("profile-message")) {
      const label = normalizeInlineText(node.find("span").first().text()).replace(/[:\uff1a]+$/, "");
      const cloned = node.clone();
      cloned.find("span").remove();
      const value = normalizeText(cloned.text());

      if (label.includes("\u4e00\u8a00")) {
        texts.message = value;
      } else if (label.includes("\u5e97\u9577")) {
        texts.shopMessage = value;
      }
      continue;
    }

    const rawText = normalizeInlineText(node.text());
    const match = rawText.match(/^(.+?)\s*[:\uff1a]\s*(.+)$/);
    if (!match) {
      continue;
    }

    const label = match[1].trim();
    const value = match[2].trim();
    const key = LABEL_KEY_MAP[label] || label;
    basicInfo[key] = value;
  }

  return {
    name: nameMatch?.[1]?.trim() || nameText,
    basicInfo,
    texts,
  };
}

function extractSchedule($, fetchedAt) {
  const dateLabels = $(".profile-week__date li")
    .map((_, element) => normalizeInlineText($(element).text()))
    .get();
  const timeNodes = $(".profile-week__time li").toArray();

  if (dateLabels.length === 0 || timeNodes.length === 0) {
    throw new Error("\u51fa\u52e4\u30b9\u30b1\u30b8\u30e5\u30fc\u30eb\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f");
  }

  const dates = guessDateSequence(dateLabels, new Date(fetchedAt));
  const schedule = {};

  for (const [index, date] of dates.entries()) {
    const node = $(timeNodes[index]);
    const text = normalizeText(node.text());
    const times = text.match(/\d{1,2}:\d{2}/g) || [];

    if (text.includes("\u304a\u4f11\u307f")) {
      schedule[date] = { type: "off" };
      continue;
    }

    if (text.includes("\u8981\u78ba\u8a8d")) {
      schedule[date] = { type: "pending" };
      continue;
    }

    if (times.length >= 2) {
      schedule[date] = {
        type: "work",
        start: normalizeTime(times[0]),
        end: normalizeTime(times[1]),
      };
      continue;
    }

    schedule[date] = {
      type: "unknown",
      raw: text,
    };
  }

  return schedule;
}

module.exports = { fetchProfile };
