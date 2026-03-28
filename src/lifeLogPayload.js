const { diffDiary } = require("./diffDiary");
const { diffPhotos } = require("./diffPhotos");
const { diffProfile } = require("./diffProfile");
const { diffSchedule } = require("./diffSchedule");

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
  if (["off_added", "work_to_off", "work_cancelled"].includes(event.kind)) {
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
  const historyShifts = Array.isArray(options.historyShifts) ? options.historyShifts : [];
  const diffEvents = previousSnapshot
    ? collectEvents(previousSnapshot, currentSnapshot, options.notify)
    : [];
  const updates = diffEvents.map((event) => toExternalUpdateFromEvent(event, currentSnapshot, source));

  return {
    source,
    importedAt,
    shifts: mergeShiftRecords(historyShifts, latestShifts),
    updates,
  };
}

module.exports = {
  buildPayload,
  buildShiftRecords,
  collectEvents,
  mergeShiftRecords,
  toExternalUpdateFromEvent,
};
