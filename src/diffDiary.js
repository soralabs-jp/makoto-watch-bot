function diffDiary(previous = [], current = []) {
  const events = [];
  const previousMap = new Map(previous.map((entry) => [entry.id, entry]));

  for (const entry of current) {
    const before = previousMap.get(entry.id);
    if (!before) {
      events.push({
        category: "diary",
        kind: "added",
        id: entry.id,
        message: `\ud83d\udcd4 \u5199\u30e1\u65e5\u8a18\u66f4\u65b0: \u300c${entry.title}\u300d\u304c\u8ffd\u52a0\u3055\u308c\u307e\u3057\u305f`,
      });
      continue;
    }

    if (before.title !== entry.title) {
      events.push({
        category: "diary",
        kind: "title_changed",
        id: entry.id,
        message: `\ud83d\udcd4 \u5199\u30e1\u65e5\u8a18\u66f4\u65b0: \u30bf\u30a4\u30c8\u30eb\u304c\u300c${before.title}\u300d->\u300c${entry.title}\u300d\u306b\u5909\u308f\u308a\u307e\u3057\u305f`,
      });
    }

    if ((before.image || "") !== (entry.image || "")) {
      events.push({
        category: "diary",
        kind: "image_changed",
        id: entry.id,
        message: `\ud83d\udcd4 \u5199\u30e1\u65e5\u8a18\u66f4\u65b0: \u300c${entry.title}\u300d\u306e\u753b\u50cf\u304c\u5909\u66f4\u3055\u308c\u307e\u3057\u305f`,
      });
    }

    if ((before.url || "") !== (entry.url || "")) {
      events.push({
        category: "diary",
        kind: "url_changed",
        id: entry.id,
        message: `\ud83d\udcd4 \u5199\u30e1\u65e5\u8a18\u66f4\u65b0: \u300c${entry.title}\u300d\u306eURL\u304c\u5909\u66f4\u3055\u308c\u307e\u3057\u305f`,
      });
    }

    if ((before.date || "") !== (entry.date || "")) {
      events.push({
        category: "diary",
        kind: "date_changed",
        id: entry.id,
        message: `\ud83d\udcd4 \u5199\u30e1\u65e5\u8a18\u66f4\u65b0: \u300c${entry.title}\u300d\u306e\u65e5\u4ed8\u304c\u5909\u66f4\u3055\u308c\u307e\u3057\u305f`,
      });
    }
  }

  return events;
}

module.exports = { diffDiary };
