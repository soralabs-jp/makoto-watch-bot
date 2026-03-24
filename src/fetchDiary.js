const cheerio = require("cheerio");
const { fetchHtml } = require("./browser");
const { config } = require("./config");
const { normalizeDate, normalizeInlineText, normalizeUrl } = require("./normalize");

async function fetchDiary() {
  const entries = [];
  const seenIds = new Set();
  let pageNumber = 1;

  while (pageNumber <= config.diaryPageLimit) {
    const pageUrl = buildDiaryPageUrl(pageNumber);
    const html = await fetchHtml(pageUrl);
    const pageEntries = extractDiaryEntries(html, pageUrl);

    if (pageEntries.length === 0) {
      break;
    }

    for (const entry of pageEntries) {
      if (!seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        entries.push(entry);
      }
    }

    pageNumber += 1;
  }

  return entries;
}

function buildDiaryPageUrl(pageNumber) {
  if (pageNumber <= 1) {
    return config.diaryUrl;
  }

  return `${config.diaryUrl.replace(/\/$/, "")}/page/${pageNumber}/`;
}

function extractDiaryEntries(html, pageUrl) {
  const $ = cheerio.load(html);
  const articles = $("article.post").toArray();

  return articles
    .map((article) => {
      const node = $(article);
      const titleLink = node.find(".entry-title a").first();
      const timeNode = node.find(".entry-time").first();
      const imageNode = node.find("img.wp-post-image").first();
      const categoryTexts = node
        .find(".post-categories a")
        .map((_, element) => normalizeInlineText($(element).text()))
        .get();

      if (!categoryTexts.some((text) => text.includes("No.75") && text.includes("\u307e\u3053\u3068"))) {
        return null;
      }

      const url = normalizeUrl(titleLink.attr("href"), pageUrl);
      const idMatch = (node.attr("id") || "").match(/post-(\d+)/);
      const urlIdMatch = url.match(/\/(\d+)\/?$/);

      return {
        id: idMatch?.[1] || urlIdMatch?.[1] || url,
        title: normalizeInlineText(titleLink.text()),
        url,
        image: normalizeUrl(imageNode.attr("src"), pageUrl),
        date: normalizeDate(timeNode.text()),
      };
    })
    .filter(Boolean);
}

module.exports = { fetchDiary };
