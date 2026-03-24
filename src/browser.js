const { request } = require("playwright");
const { config } = require("./config");

async function fetchHtml(url) {
  const context = await request.newContext({
    userAgent: config.userAgent,
    extraHTTPHeaders: {
      "accept-language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    timeout: config.fetchTimeoutMs,
  });

  try {
    const response = await context.get(url);
    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()} ${response.statusText()} for ${url}`);
    }

    const body = await response.body();
    return body.toString("utf8");
  } finally {
    await context.dispose();
  }
}

module.exports = { fetchHtml };
