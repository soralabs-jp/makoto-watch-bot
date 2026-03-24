const { config } = require("./config");
const { diffDiary } = require("./diffDiary");
const { diffPhotos } = require("./diffPhotos");
const { diffProfile } = require("./diffProfile");
const { diffSchedule } = require("./diffSchedule");
const { fetchDiary } = require("./fetchDiary");
const { fetchProfile } = require("./fetchProfile");
const { notifyDiscord } = require("./notifyDiscord");
const { readJson, writeJson } = require("./storage");

async function main() {
  const previousLatest = await readJson(config.dataPaths.latest, null);

  try {
    const profileData = await fetchProfile();
    const diary = await fetchDiary();

    const currentSnapshot = {
      fetchedAt: new Date().toISOString(),
      source: {
        profileUrl: config.profileUrl,
        diaryUrl: config.diaryUrl,
      },
      profile: profileData.profile,
      photos: profileData.photos,
      schedule: profileData.schedule,
      diary,
    };

    if (!hasSnapshot(previousLatest)) {
      await writeJson(config.dataPaths.previous, {});
      await writeJson(config.dataPaths.latest, currentSnapshot);

      if (config.notifyInitialSnapshot) {
        await notifyDiscord(["\ud83c\udd95 \u521d\u671f\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u4f5c\u6210\u5b8c\u4e86"]);
      }

      console.log("Initial snapshot saved");
      return;
    }

    const events = collectEvents(previousLatest, currentSnapshot);

    if (events.length > 0) {
      await notifyDiscord(events.map((event) => event.message));
    }

    await writeJson(config.dataPaths.previous, previousLatest);
    await writeJson(config.dataPaths.latest, currentSnapshot);

    console.log(`Completed. events=${events.length}`);
  } catch (error) {
    console.error("[main] execution failed", error);

    try {
      await notifyDiscord([
        "\u26a0\ufe0f \u76e3\u8996BOT\u3067\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f",
        `\u5185\u5bb9: ${error.message}`,
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

main();
