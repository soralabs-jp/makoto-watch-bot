const cheerio = require("cheerio");
const { fetchHtml } = require("./browser");
const { config } = require("./config");

async function fetchRanking(previousRankingState = null) {
  const html = await fetchHtml(config.rankingUrl);
  const detectedAt = new Date().toISOString();
  const $ = cheerio.load(html);

  const nominationTop5 = extractRankingEntries($, "指名数ランキング", ["指名比率ランキング"]);
  const ratioTop5 = extractRankingEntries($, "指名比率ランキング");
  const month = resolveRankingMonth({
    $,
    html,
    detectedAt,
    nominationTop5,
    ratioTop5,
    previousRankingState,
  });

  return {
    currentRankingSummary: {
      month,
      nominationRank: findRank(nominationTop5, config.rankingTargetCastNo),
      ratioRank: findRank(ratioTop5, config.rankingTargetCastNo),
      detectedAt,
    },
    rankingSnapshot: {
      month,
      detectedAt,
      nominationTop5,
      ratioTop5,
    },
  };
}

function extractRankingEntries($, headingText, stopHeadings = []) {
  const heading = $("h1, h2, h3, h4")
    .filter((_, element) => normalizeText($(element).text()).includes(headingText))
    .first();

  if (!heading.length) {
    throw new Error(`ランキング見出しが見つかりませんでした: ${headingText}`);
  }

  const fragments = [];
  let node = heading.next();

  while (node.length) {
    const nodeText = normalizeText(node.text());
    if (node.is("h1, h2, h3, h4") && stopHeadings.some((value) => nodeText.includes(value))) {
      break;
    }

    fragments.push(node.text());
    node = node.next();
  }

  const entries = parseRankingEntries(fragments.join("\n"));
  if (entries.length === 0) {
    throw new Error(`ランキング項目が取得できませんでした: ${headingText}`);
  }

  return entries;
}

function parseRankingEntries(text) {
  const normalized = normalizeText(text);
  const matches = normalized.matchAll(/No\.\s*(\d+)\s+([^\s()（）]+)/gu);
  const entries = [];
  const seenCastNos = new Set();

  for (const match of matches) {
    const castNo = Number(match[1]);
    if (!Number.isFinite(castNo) || seenCastNos.has(castNo)) {
      continue;
    }

    seenCastNos.add(castNo);
    entries.push({
      rank: entries.length + 1,
      castNo,
      castName: match[2],
    });

    if (entries.length >= 5) {
      break;
    }
  }

  return entries;
}

function findRank(entries, castNo) {
  const matched = entries.find((entry) => entry.castNo === castNo);
  return matched ? matched.rank : null;
}

function resolveRankingMonth({ $, html, detectedAt, nominationTop5, ratioTop5, previousRankingState }) {
  const detectedMonth = formatMonthKey(detectedAt, config.timezone);
  const explicitMonth =
    extractRankingMonthFromText($("title").text()) ||
    extractRankingMonthFromText($("body").text()) ||
    extractRankingMonthFromText(html);

  if (explicitMonth) {
    return explicitMonth;
  }

  const previousSummary = previousRankingState?.currentRankingSummary;
  const previousSnapshot = findSnapshotByMonth(previousRankingState?.rankingSnapshots, previousSummary?.month);
  if (
    previousSummary?.month &&
    isNextMonth(previousSummary.month, detectedMonth) &&
    previousSnapshot &&
    hasSameRankingEntries(previousSnapshot.nominationTop5, nominationTop5) &&
    hasSameRankingEntries(previousSnapshot.ratioTop5, ratioTop5)
  ) {
    return previousSummary.month;
  }

  return detectedMonth;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRankingMonthFromText(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const patterns = [
    /((?:20)\d{2})\s*[\/.-]\s*(\d{1,2})(?!\d)/gu,
    /((?:20)\d{2})\s*\u5e74\s*(\d{1,2})\s*\u6708/gu,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const month = toMonthKey(match[1], match[2]);
      if (month) {
        return month;
      }
    }
  }

  return null;
}

function formatMonthKey(value, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  });

  return formatter.format(new Date(value));
}

function toMonthKey(yearValue, monthValue) {
  const year = Number(yearValue);
  const month = Number(monthValue);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

function findSnapshotByMonth(snapshots, month) {
  if (!Array.isArray(snapshots) || !month) {
    return null;
  }

  return snapshots.find((entry) => entry?.month === month) || null;
}

function hasSameRankingEntries(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((entry, index) => {
    const other = right[index];
    return entry?.rank === other?.rank && entry?.castNo === other?.castNo;
  });
}

function isNextMonth(previousMonth, currentMonth) {
  if (!/^\d{4}-\d{2}$/.test(previousMonth) || !/^\d{4}-\d{2}$/.test(currentMonth)) {
    return false;
  }

  const [previousYear, previousMonthNumber] = previousMonth.split("-").map(Number);
  const [currentYear, currentMonthNumber] = currentMonth.split("-").map(Number);
  const previousValue = previousYear * 12 + (previousMonthNumber - 1);
  const currentValue = currentYear * 12 + (currentMonthNumber - 1);
  return currentValue === previousValue + 1;
}

module.exports = {
  extractRankingMonthFromText,
  fetchRanking,
  formatMonthKey,
};
