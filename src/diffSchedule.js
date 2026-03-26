const { deepEqual, formatDateShort, formatScheduleEntry } = require("./normalize");

function diffSchedule(previous = {}, current = {}) {
  const events = [];
  const previousDates = Object.keys(previous).sort();
  const currentDates = Object.keys(current).sort();
  const currentSet = new Set(currentDates);

  const previousMaxDate = previousDates[previousDates.length - 1] || null;
  const currentMinDate = currentDates[0] || null;

  for (const date of currentDates) {
    const before = previous[date];
    const after = current[date];

    if (!before) {
      if (previousMaxDate && date <= previousMaxDate) {
        continue;
      }

      if (after.type === "off") {
        events.push(createEvent("off_added", date, null, after));
      } else if (after.type === "work") {
        events.push(createEvent("work_added", date, null, after));
      } else if (after.type === "pending") {
        events.push(createEvent("pending_added", date, null, after));
      } else {
        events.push(createEvent("schedule_added", date, null, after));
      }
      continue;
    }

    if (deepEqual(before, after)) {
      continue;
    }

    if (before.type === "off" && after.type === "work") {
      events.push(createEvent("off_to_work", date, before, after));
      continue;
    }

    if (before.type === "work" && after.type === "off") {
      events.push(createEvent("work_to_off", date, before, after));
      continue;
    }

    if (before.type === "work" && after.type === "work") {
      events.push(createEvent("time_changed", date, before, after));
      continue;
    }

    events.push(createEvent("schedule_changed", date, before, after));
  }

  for (const date of previousDates) {
    if (currentSet.has(date)) {
      continue;
    }

    if (currentMinDate && date < currentMinDate) {
      continue;
    }

    if (previous[date]?.type === "work") {
      events.push(createEvent("work_cancelled", date, previous[date], null));
    }
  }

  return events;
}

function createEvent(kind, date, before, after) {
  return {
    category: "schedule",
    kind,
    date,
    before,
    after,
    message: formatScheduleMessage(kind, date, before, after),
  };
}

function formatScheduleMessage(kind, date, before, after) {
  const shortDate = formatDateShort(date);

  switch (kind) {
    case "work_added":
      return `\ud83d\udfe2 \u51fa\u52e4\u8ffd\u52a0: ${shortDate} ${formatScheduleEntry(after)}`;
    case "off_added":
      return `\ud83d\udca4 \u304a\u4f11\u307f\u8ffd\u52a0: ${shortDate}`;
    case "pending_added":
      return `\ud83d\udfe1 \u8981\u78ba\u8a8d\u8ffd\u52a0: ${shortDate}`;
    case "off_to_work":
      return `\ud83d\udd04 \u5909\u66f4: ${shortDate} \u304a\u4f11\u307f -> ${formatScheduleEntry(after)}`;
    case "work_to_off":
      return `\u274c \u51fa\u52e4\u30ad\u30e3\u30f3\u30bb\u30eb: ${shortDate} ${formatScheduleEntry(before)} -> \u304a\u4f11\u307f`;
    case "time_changed":
      return `\ud83d\udd04 \u6642\u9593\u5909\u66f4: ${shortDate} ${formatScheduleEntry(before)} -> ${formatScheduleEntry(after)}`;
    case "work_cancelled":
      return `\u274c \u51fa\u52e4\u30ad\u30e3\u30f3\u30bb\u30eb: ${shortDate} ${formatScheduleEntry(before)}`;
    default:
      return `\ud83d\udd04 \u51fa\u52e4\u60c5\u5831\u66f4\u65b0: ${shortDate} ${formatScheduleEntry(before)} -> ${formatScheduleEntry(after)}`;
  }
}

module.exports = { diffSchedule };
