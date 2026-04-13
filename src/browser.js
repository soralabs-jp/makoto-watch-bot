const { chromium, request } = require("playwright");
const { config } = require("./config");

async function fetchHtml(url) {
  let lastError = null;
  const requestTimeoutMs = resolveTimeout(config.fetchRequestTimeoutMs, config.fetchTimeoutMs);

  for (let attempt = 1; attempt <= config.fetchRetryCount; attempt += 1) {
    const context = await request.newContext({
      userAgent: config.userAgent,
      extraHTTPHeaders: {
        "accept-language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      timeout: requestTimeoutMs,
    });

    try {
      const response = await context.get(url, {
        failOnStatusCode: false,
        timeout: requestTimeoutMs,
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
  const browserTimeoutMs = resolveTimeout(config.fetchBrowserTimeoutMs, config.fetchTimeoutMs);
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
      page.setDefaultNavigationTimeout(browserTimeoutMs);

      const response = await page.goto(url, {
        waitUntil: "commit",
        timeout: browserTimeoutMs,
      });

      if (!response) {
        throw new Error(`No response received for ${url}`);
      }

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()} ${response.statusText()} for ${url}`);
      }

      try {
        await page.waitForLoadState("domcontentloaded", {
          timeout: Math.min(5000, browserTimeoutMs),
        });
      } catch {
        // Some pages keep third-party requests open. HTML is still usable after the initial response.
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

function resolveTimeout(primary, fallback) {
  return Number.isFinite(primary) && primary > 0 ? primary : fallback;
}

module.exports = { fetchHtml };
