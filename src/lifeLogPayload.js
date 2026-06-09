const { diffDiary } = require("./diffDiary");
const { diffPhotos } = require("./diffPhotos");
const { diffProfile } = require("./diffProfile");
const { diffSchedule } = require("./diffSchedule");

const knownScheduleCorrections = [
  {
    date: "2026-06-05",
    detectedAt: "2026-06-05T00:00:00+09:00",
    title: "\uD83D\uDCA4 \u304A\u4F11\u307F\u8FFD\u52A0: 6/5(\u91D1)",
  },
];

function toShiftRecord(date, entry, fetchedAt, source) {
  const status =
    entry && entry.type === "work"
      ? "working"
      : entry && entry.type === "pending"
        ? "pending"
        : "off";

  return {
    id: `${source}-shift-${date}`,
    date,
    status,
    startTime: entry && entry.type === "work" ? entry.start || undefined : undefined,
    endTime: entry && entry.type === "work" ? entry.end || undefined : undefined,
    updatedAt: fetchedAt,
    source,
    sourceId: `schedule:${date}`,
  };
}

function buildShiftRecords(snapshot, source) {
  const fetchedAt = snapshot.fetchedAt || new Date().toISOString();
  return Object.entries(snapshot.schedule || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entry]) => toShiftRecord(date, entry, fetchedAt, source));
}

function mergeShiftRecords(...groups) {
  const byDate = new Map();
  groups.flat().forEach((record) => {
    byDate.set(record.date, record);
  });
  return Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function buildKnownCorrectionShifts(source) {
  return knownScheduleCorrections.map((correction) => ({
    id: `${source}-shift-${correction.date}`,
    date: correction.date,
    status: "off",
    updatedAt: correction.detectedAt,
    source,
    sourceId: `schedule:${correction.date}`,
  }));
}

function buildKnownCorrectionUpdates(source, profileUrl) {
  return knownScheduleCorrections.map((correction) => ({
    id: `${source}-schedule-off-added-${correction.date}-correction`,
    date: correction.date,
    detectedAt: correction.detectedAt,
    type: "day_off",
    title: correction.title,
    source,
    sourceUrl: profileUrl,
    metadata: {
      category: "schedule",
      kind: "off_added",
      corrected: true,
    },
  }));
}

function mergeUpdates(...groups) {
  const byId = new Map();
  groups.flat().forEach((update) => {
    byId.set(update.id, update);
  });
  return Array.from(byId.values()).sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);
    return dateOrder === 0 ? left.id.localeCompare(right.id) : dateOrder;
  });
}

function classifyProfileEvent(event) {
  if (event.kind === "basic_info_changed") {
    const field = String(event.field || "").toLowerCase();
    if (["bust", "waist", "hip", "size"].includes(field)) {
      return "size_update";
    }
  }

  return "profile_update";
}

function classifyScheduleEvent(event) {
  if (["off_added", "work_to_off", "pending_to_off", "work_cancelled"].includes(event.kind)) {
    return "day_off";
  }

  return "shift_update";
}

function toExternalUpdateFromEvent(event, snapshot, source) {
  const detectedAt = snapshot.fetchedAt || new Date().toISOString();
  const date = event.date || detectedAt.slice(0, 10);
  let type = "event_notice";
  let sourceUrl = snapshot.source?.profileUrl;

  if (event.category === "diary") {
    type = "diary";
    sourceUrl = findDiaryUrl(snapshot.diary, event.id) || snapshot.source?.diaryUrl;
  } else if (event.category === "schedule") {
    type = classifyScheduleEvent(event);
  } else if (event.category === "profile") {
    type = classifyProfileEvent(event);
  } else if (event.category === "photos") {
    type = "profile_update";
  }

  return {
    id: `${source}-${event.category}-${event.kind}-${date}-${slugify(event.id || event.field || "entry")}`,
    date,
    detectedAt,
    type,
    title: event.message,
    body: buildEventBody(event),
    source,
    sourceUrl,
    metadata: cleanMetadata({
      category: event.category,
      kind: event.kind,
      eventId: event.id || null,
      field: event.field || null,
      before: event.before || null,
      after: event.after || null,
      added: event.added || null,
      removed: event.removed || null,
    }),
  };
}

function findDiaryUrl(entries, id) {
  const match = (entries || []).find((entry) => String(entry.id) === String(id));
  return match ? match.url : undefined;
}

function buildEventBody(event) {
  if (event.category === "schedule") {
    return undefined;
  }

  if (event.category === "photos") {
    const added = Array.isArray(event.added) ? event.added.length : 0;
    const removed = Array.isArray(event.removed) ? event.removed.length : 0;
    return `added=${added}, removed=${removed}`;
  }

  return undefined;
}

function cleanMetadata(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined),
  );
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "entry";
}

function collectEvents(previousSnapshot, currentSnapshot, notify = {}) {
  const events = [];
  const enabled = {
    schedule: notify.schedule !== false,
    profile: notify.profile !== false,
    photos: notify.photos !== false,
    diary: notify.diary !== false,
  };

  if (enabled.schedule) {
    events.push(...diffSchedule(previousSnapshot?.schedule || {}, currentSnapshot.schedule || {}));
  }
  if (enabled.profile) {
    events.push(...diffProfile(previousSnapshot?.profile || {}, currentSnapshot.profile || {}));
  }
  if (enabled.photos) {
    events.push(...diffPhotos(previousSnapshot?.photos || [], currentSnapshot.photos || []));
  }
  if (enabled.diary) {
    events.push(...diffDiary(previousSnapshot?.diary || [], currentSnapshot.diary || []));
  }

  return events;
}

function buildPayload(currentSnapshot, options = {}) {
  const source = options.source || "discord-bot";
  const previousSnapshot = options.previousSnapshot || null;
  const importedAt = currentSnapshot.fetchedAt || new Date().toISOString();
  const latestShifts = buildShiftRecords(currentSnapshot, source);
  const correctionShifts = buildKnownCorrectionShifts(source);
  const historyShifts = Array.isArray(options.historyShifts) ? options.historyShifts : [];
  const diffEvents = previousSnapshot
    ? collectEvents(previousSnapshot, currentSnapshot, options.notify)
    : [];
  const diffUpdates = diffEvents.map((event) => toExternalUpdateFromEvent(event, currentSnapshot, source));
  const correctionUpdates = buildKnownCorrectionUpdates(source, currentSnapshot.source?.profileUrl);

  return {
    source,
    importedAt,
    shifts: mergeShiftRecords(historyShifts, correctionShifts, latestShifts),
    updates: mergeUpdates(correctionUpdates, diffUpdates),
    rankings: normalizeRankings(currentSnapshot.rankings),
  };
}

function normalizeRankings(value) {
  if (!value || typeof value !== "object") {
    return {
      currentRankingSummary: null,
      rankingSnapshots: [],
    };
  }

  return {
    currentRankingSummary: value.currentRankingSummary || null,
    rankingSnapshots: Array.isArray(value.rankingSnapshots) ? value.rankingSnapshots : [],
  };
}

module.exports = {
  buildPayload,
  buildShiftRecords,
  collectEvents,
  mergeShiftRecords,
  toExternalUpdateFromEvent,
};
