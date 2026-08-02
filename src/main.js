const { config } = require("./config");
const { diffDiary } = require("./diffDiary");
const { diffPhotos } = require("./diffPhotos");
const { diffProfile } = require("./diffProfile");
const { diffSchedule } = require("./diffSchedule");
const { fetchDiary } = require("./fetchDiary");
const { fetchProfile } = require("./fetchProfile");
const { fetchRanking } = require("./fetchRanking");
const { notifyDiscord } = require("./notifyDiscord");
const {
  buildNextRankingState,
  createRankingNotificationLines,
  markRankingMonthNotified,
  normalizeRankingState,
  shouldNotifyRanking,
} = require("./rankingState");
const { readJson, writeJson } = require("./storage");

async function main() {
  if (config.testNotification) {
    await notifyDiscord([
      `🧪 ${config.target} テスト通知です ${config.profileUrl}`,
    ]);
    console.log("Test notification sent");
    return;
  }

  const previousLatest = await readJsonWithLegacyFallback("latest", null);
  const previousRankingState = normalizeRankingState(await readJsonWithLegacyFallback("rankingState", null));

  try {
    const profileData = await fetchWithSnapshotFallback({
      label: "profile",
      fetcher: fetchProfile,
      fallbackValue:
        previousLatest && previousLatest.profile && previousLatest.photos && previousLatest.schedule
          ? {
              sourceUrl: previousLatest.source?.profileUrl || config.profileUrl,
              fetchedAt: previousLatest.fetchedAt,
              profile: previousLatest.profile,
              photos: previousLatest.photos,
              schedule: previousLatest.schedule,
            }
          : null,
    });
    const diary =
      config.notify.diary && config.diaryUrl
        ? await fetchWithSnapshotFallback({
            label: "diary",
            fetcher: fetchDiary,
            fallbackValue: previousLatest?.diary ?? null,
          })
        : [];
    const latestRanking = await fetchLatestRanking(previousRankingState);
    const nextRankingState = buildNextRankingState(previousRankingState, latestRanking);

    const currentSnapshot = {
      fetchedAt: new Date().toISOString(),
      source: {
        profileUrl: config.profileUrl,
        rankingUrl: config.rankingUrl,
        diaryUrl: config.diaryUrl,
      },
      profile: profileData.profile,
      photos: profileData.photos,
      schedule: profileData.schedule,
      diary,
      rankings: {
        currentRankingSummary: nextRankingState.currentRankingSummary,
        rankingSnapshots: nextRankingState.rankingSnapshots,
      },
    };

    if (!hasSnapshot(previousLatest)) {
      await writeJson(config.dataPaths.previous, {});
      await writeJson(config.dataPaths.latest, currentSnapshot);

      const updatedRankingState = await maybeNotifyRanking(previousRankingState, nextRankingState);
      await writeJson(config.dataPaths.rankingState, updatedRankingState);

      if (config.notifyInitialSnapshot) {
        await notifyDiscord(["🆕 初期スナップショット作成完了"]);
      }

      console.log(`Initial snapshot saved for target=${config.target}`);
      return;
    }

    const events = collectEvents(previousLatest, currentSnapshot);

    if (events.length > 0) {
      await notifyDiscord(events.map((event) => formatEventMessage(event, currentSnapshot)));
    }

    const updatedRankingState = await maybeNotifyRanking(previousRankingState, nextRankingState);

    await writeJson(config.dataPaths.previous, previousLatest);
    await writeJson(config.dataPaths.latest, currentSnapshot);
    await writeJson(config.dataPaths.rankingState, updatedRankingState);

    console.log(`Completed. target=${config.target} events=${events.length}`);
  } catch (error) {
    console.error("[main] execution failed", error);

    try {
      await notifyDiscord([
        "⚠️ 監視BOTでエラーが発生しました",
        `内容: ${error.message}`,
      ]);
    } catch (notifyError) {
      console.error("[main] failed to notify error", notifyError);
    }

    process.exitCode = 1;
  }
}

function hasSnapshot(snapshot) {
  return Boolean(
    snapshot &&
      snapshot.profile &&
      snapshot.photos &&
      snapshot.schedule &&
      (!config.notify.diary || snapshot.diary),
  );
}

function collectEvents(previousSnapshot, currentSnapshot) {
  const events = [];

  if (config.notify.schedule) {
    events.push(...diffSchedule(previousSnapshot.schedule, currentSnapshot.schedule));
  }
  if (config.notify.profile) {
    events.push(...diffProfile(previousSnapshot.profile, currentSnapshot.profile));
  }
  if (config.notify.photos) {
    events.push(...diffPhotos(previousSnapshot.photos, currentSnapshot.photos));
  }
  if (config.notify.diary) {
    events.push(...diffDiary(previousSnapshot.diary, currentSnapshot.diary));
  }

  return events;
}

function formatEventMessage(event, snapshot) {
  const url = snapshot.source?.profileUrl || config.profileUrl;
  return url ? `${event.message} ${url}` : event.message;
}

async function fetchLatestRanking(previousRankingState) {
  if (!config.notify.ranking || !config.rankingUrl || !config.rankingTargetCastNo) {
    return null;
  }

  try {
    return await fetchRanking(previousRankingState);
  } catch (error) {
    console.warn("[main] failed to fetch ranking", error);
    return null;
  }
}

async function maybeNotifyRanking(previousRankingState, nextRankingState) {
  const summary = nextRankingState.currentRankingSummary;
  if (!summary || !config.notify.ranking || !shouldNotifyRanking(previousRankingState, summary)) {
    return nextRankingState;
  }

  await notifyDiscord(createRankingNotificationLines(summary, previousRankingState.currentRankingSummary), {
    header: `${config.discordUsername} ランキング通知`,
  });

  return markRankingMonthNotified(nextRankingState, summary.month);
}

main();

async function readJsonWithLegacyFallback(key, defaultValue) {
  const value = await readJson(config.dataPaths[key], null);
  if (value != null) {
    return value;
  }

  const legacyPath = config.legacyDataPaths?.[key];
  if (!legacyPath) {
    return defaultValue;
  }

  return readJson(legacyPath, defaultValue);
}

async function fetchWithSnapshotFallback({ label, fetcher, fallbackValue }) {
  try {
    return await fetcher();
  } catch (error) {
    if (fallbackValue != null) {
      console.warn(`[main] failed to fetch ${label}; reusing previous snapshot`, error);
      return fallbackValue;
    }

    error.message = `failed to fetch ${label}: ${error.message}`;
    throw error;
  }
}
