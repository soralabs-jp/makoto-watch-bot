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
      `🧪 テスト通知です ${config.profileUrl}`,
    ]);
    console.log("Test notification sent");
    return;
  }

  const previousLatest = await readJson(config.dataPaths.latest, null);
  const previousRankingState = normalizeRankingState(await readJson(config.dataPaths.rankingState, null));

  try {
    const profileData = await fetchProfile();
    const diary = await fetchDiary();
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

      console.log("Initial snapshot saved");
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

    console.log(`Completed. events=${events.length}`);
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
  return Boolean(snapshot && snapshot.profile && snapshot.photos && snapshot.schedule && snapshot.diary);
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
  try {
    return await fetchRanking(previousRankingState);
  } catch (error) {
    console.warn("[main] failed to fetch ranking", error);
    return null;
  }
}

async function maybeNotifyRanking(previousRankingState, nextRankingState) {
  const summary = nextRankingState.currentRankingSummary;
  if (!config.notify.ranking || !shouldNotifyRanking(previousRankingState, summary)) {
    return nextRankingState;
  }

  await notifyDiscord(createRankingNotificationLines(summary), {
    header: "まことちゃんランキング通知",
  });

  return markRankingMonthNotified(nextRankingState, summary.month);
}

main();
