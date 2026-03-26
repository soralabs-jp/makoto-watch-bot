const { URL } = require("url");

function normalizeText(value) {
  if (value == null) {
    return "";
  }

  return String(value)
    .replace(/\r/g, "")
    .replace(/\u3000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function normalizeInlineText(value) {
  return normalizeText(value).replace(/\n+/g, " ").replace(/[ ]{2,}/g, " ").trim();
}

function normalizeTime(value) {
  const text = normalizeInlineText(value);
  const match = text.match(/(\d{1,2})[:\uff1a](\d{2})/);
  if (!match) {
    return null;
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function normalizeDate(value) {
  const text = normalizeInlineText(value);
  const full = text.match(/(\d{4})[\/\-\u5e74](\d{1,2})[\/\-\u6708](\d{1,2})/);
  if (full) {
    return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  }

  return null;
}

function normalizeUrl(value, baseUrl) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value, baseUrl);
    url.hash = "";

    if (url.searchParams.has("w")) {
      url.searchParams.delete("w");
    }

    const retainedEntries = [];
    for (const [key, paramValue] of url.searchParams.entries()) {
      if (/^\d{8,}$/.test(key) && paramValue === "") {
        continue;
      }
      if (/^\d{8,}$/.test(paramValue)) {
        continue;
      }
      retainedEntries.push([key, paramValue]);
    }

    url.search = "";
    for (const [key, paramValue] of retainedEntries) {
      url.searchParams.append(key, paramValue);
    }

    return url.toString();
  } catch (_error) {
    return String(value).trim();
  }
}

function normalizePhotoUrls(urls, baseUrl) {
  return Array.from(
    new Set(
      (urls || [])
        .map((url) => normalizeUrl(url, baseUrl))
        .filter(Boolean),
    ),
  );
}

function formatDateShort(isoDate) {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return isoDate;
  }

  return `${Number(match[2])}/${Number(match[3])}`;
}

function formatScheduleEntry(entry) {
  if (!entry) {
    return "\u4e0d\u660e";
  }

  if (entry.type === "off") {
    return "\u304a\u4f11\u307f";
  }

  if (entry.type === "pending") {
    return "\u8981\u78ba\u8a8d";
  }

  if (entry.type === "unknown") {
    return entry.raw || "\u4e0d\u660e";
  }

  return `${entry.start || "??:??"}-${entry.end || "??:??"}`;
}

function parseMonthDay(value) {
  const text = normalizeInlineText(value);
  const match = text.match(/(\d{1,2})\D+(\d{1,2})/);
  if (!match) {
    return null;
  }

  return {
    month: Number(match[1]),
    day: Number(match[2]),
  };
}

function guessDateSequence(monthDayValues, baseDate = new Date()) {
  if (!Array.isArray(monthDayValues) || monthDayValues.length === 0) {
    return [];
  }

  const parsed = monthDayValues.map((value) => parseMonthDay(value));
  if (parsed.some((item) => !item)) {
    return [];
  }

  const base = new Date(baseDate);
  const baseUtc = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
  const first = parsed[0];
  const candidates = [
    new Date(Date.UTC(base.getUTCFullYear() - 1, first.month - 1, first.day)),
    new Date(Date.UTC(base.getUTCFullYear(), first.month - 1, first.day)),
    new Date(Date.UTC(base.getUTCFullYear() + 1, first.month - 1, first.day)),
  ];

  candidates.sort(
    (a, b) => Math.abs(a.getTime() - baseUtc) - Math.abs(b.getTime() - baseUtc),
  );

  const start = candidates[0];

  return parsed.map((_item, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

module.exports = {
  deepEqual,
  formatDateShort,
  formatScheduleEntry,
  guessDateSequence,
  normalizeDate,
  normalizeInlineText,
  normalizePhotoUrls,
  normalizeText,
  normalizeTime,
  normalizeUrl,
  parseMonthDay,
};
