const { deepEqual } = require("./normalize");

function diffProfile(previous = {}, current = {}) {
  const events = [];

  if (previous.name && current.name && previous.name !== current.name) {
    events.push(createEvent("name_changed", `\ud83d\udcdd \u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u66f4\u65b0: \u540d\u524d\u304c\u300c${previous.name}\u300d->\u300c${current.name}\u300d\u306b\u5909\u308f\u308a\u307e\u3057\u305f`));
  }

  const previousTexts = previous.texts || {};
  const currentTexts = current.texts || {};
  const textLabels = {
    catchcopy: "\u30ad\u30e3\u30c3\u30c1\u30b3\u30d4\u30fc",
    message: "\u4e00\u8a00\u30b3\u30e1\u30f3\u30c8",
    shopMessage: "\u5e97\u9577\u30b3\u30e1\u30f3\u30c8",
  };

  for (const [key, label] of Object.entries(textLabels)) {
    if ((previousTexts[key] || "") !== (currentTexts[key] || "")) {
      events.push(createEvent("text_changed", `\ud83d\udcdd \u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u66f4\u65b0: ${label}\u304c\u5909\u66f4\u3055\u308c\u307e\u3057\u305f`, { field: key }));
    }
  }

  const previousInfo = previous.basicInfo || {};
  const currentInfo = current.basicInfo || {};
  const infoKeys = Array.from(new Set([...Object.keys(previousInfo), ...Object.keys(currentInfo)])).sort();

  for (const key of infoKeys) {
    if ((previousInfo[key] || "") === (currentInfo[key] || "")) {
      continue;
    }

    events.push(
      createEvent(
        "basic_info_changed",
        `\ud83d\udcdd \u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u66f4\u65b0: ${key} \u304c\u300c${previousInfo[key] || "\u672a\u8a2d\u5b9a"}\u300d->\u300c${currentInfo[key] || "\u672a\u8a2d\u5b9a"}\u300d\u306b\u5909\u308f\u308a\u307e\u3057\u305f`,
        { field: key },
      ),
    );
  }

  if (events.length === 0 && !deepEqual(previous, current)) {
    events.push(createEvent("profile_changed", "\ud83d\udcdd \u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u66f4\u65b0: \u8a73\u7d30\u60c5\u5831\u306b\u5909\u5316\u304c\u3042\u308a\u307e\u3057\u305f"));
  }

  return events;
}

function createEvent(kind, message, extra = {}) {
  return {
    category: "profile",
    kind,
    message,
    ...extra,
  };
}

module.exports = { diffProfile };
