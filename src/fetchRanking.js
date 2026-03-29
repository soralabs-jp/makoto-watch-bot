const cheerio = require("cheerio");
const { fetchHtml } = require("./browser");
const { config } = require("./config");

async function fetchRanking() {
  const html = await fetchHtml(config.rankingUrl);
  const detectedAt = new Date().toISOString();
  const month = formatMonthKey(detectedAt, config.timezone);
  const $ = cheerio.load(html);

  const nominationTop5 = extractRankingEntries($, "指名数ランキング", ["指名比率ランキング"]);
  const ratioTop5 = extractRankingEntries($, "指名比率ランキング");

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

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMonthKey(value, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  });

  return formatter.format(new Date(value));
}

module.exports = {
  fetchRanking,
  formatMonthKey,
};
