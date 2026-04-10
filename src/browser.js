const { chromium, request } = require("playwright");
const { config } = require("./config");

async function fetchHtml(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= config.fetchRetryCount; attempt += 1) {
    const context = await request.newContext({
      userAgent: config.userAgent,
      extraHTTPHeaders: {
        "accept-language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      timeout: config.fetchTimeoutMs,
    });

    try {
      const response = await context.get(url, {
        failOnStatusCode: false,
        timeout: config.fetchTimeoutMs,
      });
      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()} ${response.statusText()} for ${url}`);
      }

      const body = await response.body();
      return body.toString("utf8");
    } catch (error) {
      lastError = error;
      if (attempt < config.fetchRetryCount) {
        await wait(attempt * 2000);
      }
    } finally {
      await context.dispose();
    }
  }

  try {
    return await fetchHtmlWithBrowser(url);
  } catch (browserError) {
    if (lastError) {
      browserError.message =
        `${browserError.message}\nrequest fallback failed: ${lastError.message}`;
    }

    throw browserError;
  }
}

async function fetchHtmlWithBrowser(url) {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent: config.userAgent,
      locale: "ja-JP",
      extraHTTPHeaders: {
        "accept-language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    try {
      const page = await context.newPage();
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: config.fetchTimeoutMs,
      });

      if (!response) {
        throw new Error(`No response received for ${url}`);
      }

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()} ${response.statusText()} for ${url}`);
      }

      return await page.content();
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { fetchHtml };
