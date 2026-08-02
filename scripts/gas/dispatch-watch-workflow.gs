const GITHUB_OWNER = "soralabs-jp";
const GITHUB_REPO = "makoto-watch-bot";
const WORKFLOW_ID = "watch.yml";
const WORKFLOW_REF = "main";
const MAX_DISPATCH_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const GITHUB_STATUS_SUMMARY_URL = "https://www.githubstatus.com/api/v2/summary.json";

const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

function dispatchMakotoWatch() {
  return dispatchWorkflow_("makoto", false);
}

function dispatchMakotoWatchTest() {
  return dispatchWorkflow_("makoto", true);
}

function dispatchMikiWatch() {
  return dispatchWorkflow_("miki", false);
}

function dispatchMikiWatchTest() {
  return dispatchWorkflow_("miki", true);
}

function dispatchWorkflow_(target, testNotification) {
  const token = SCRIPT_PROPERTIES.getProperty("GITHUB_TOKEN");
  if (!token) {
    throw new Error("Set GITHUB_TOKEN in Script Properties.");
  }

  if (!isGitHubActionsOperational_()) {
    return;
  }

  const url =
    "https://api.github.com/repos/" +
    encodeURIComponent(GITHUB_OWNER) +
    "/" +
    encodeURIComponent(GITHUB_REPO) +
    "/actions/workflows/" +
    encodeURIComponent(WORKFLOW_ID) +
    "/dispatches";

  const requestOptions = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    payload: JSON.stringify({
      ref: WORKFLOW_REF,
      inputs: {
        target: String(target || "makoto"),
        test_notification: String(Boolean(testNotification)),
      },
    }),
    muteHttpExceptions: true,
  };

  for (let attempt = 1; attempt <= MAX_DISPATCH_ATTEMPTS; attempt++) {
    const response = UrlFetchApp.fetch(url, requestOptions);
    const status = response.getResponseCode();
    const body = response.getContentText();

    if (status >= 200 && status < 300) {
      console.log("Workflow dispatched: HTTP " + status + " on attempt " + attempt);
      return;
    }

    if (shouldRetryDispatch_(status) && attempt === MAX_DISPATCH_ATTEMPTS) {
      console.error(
        "GitHub Actions dispatch was unavailable after " +
          attempt +
          " attempt(s): HTTP " +
          status +
          " " +
          body,
      );
      return;
    }

    if (!shouldRetryDispatch_(status)) {
      throw new Error(
        "GitHub Actions dispatch failed after " +
          attempt +
          " attempt(s): HTTP " +
          status +
          " " +
          body,
      );
    }

    const retryDelay = getRetryDelayMs_(response, attempt);
    console.warn(
      "GitHub Actions dispatch attempt " +
        attempt +
        " failed with HTTP " +
        status +
        ". Retrying in " +
        retryDelay +
        "ms.",
    );
    Utilities.sleep(retryDelay);
  }
}

function shouldRetryDispatch_(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isGitHubActionsOperational_() {
  const response = UrlFetchApp.fetch(GITHUB_STATUS_SUMMARY_URL, {
    method: "get",
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();

  if (status < 200 || status >= 300) {
    console.warn("Could not fetch GitHub Status: HTTP " + status);
    return true;
  }

  const summary = JSON.parse(response.getContentText());
  const components = summary.components || [];
  const actions = components.find(function (component) {
    return component.name === "Actions";
  });

  if (!actions) {
    console.warn("Could not find Actions component in GitHub Status.");
    return true;
  }

  if (actions.status !== "operational") {
    console.warn("Skipping workflow dispatch because GitHub Actions status is " + actions.status + ".");
    return false;
  }

  return true;
}

function getRetryDelayMs_(response, attempt) {
  const headers = response.getAllHeaders();
  const retryAfter = Number(headers["Retry-After"] || headers["retry-after"]);

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, MAX_RETRY_DELAY_MS);
  }

  const exponentialDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
  return Math.min(exponentialDelay, MAX_RETRY_DELAY_MS);
}
