function diffPhotos(previous = [], current = []) {
  const events = [];
  const previousSet = new Set(previous);
  const currentSet = new Set(current);

  const added = current.filter((url) => !previousSet.has(url));
  const removed = previous.filter((url) => !currentSet.has(url));

  if (added.length === 0 && removed.length === 0 && previous.length === current.length) {
    return events;
  }

  if (added.length || removed.length || previous.length !== current.length) {
    const parts = [];
    if (added.length) {
      parts.push(`${added.length}\u4ef6\u8ffd\u52a0`);
    }
    if (removed.length) {
      parts.push(`${removed.length}\u4ef6\u524a\u9664`);
    }
    if (previous.length === current.length && added.length === removed.length && added.length > 0) {
      parts.push("\u753b\u50cfURL\u5dee\u3057\u66ff\u3048");
    }

    events.push({
      category: "photos",
      kind: "photos_changed",
      added,
      removed,
      message: `\ud83d\udcf7 \u5199\u771f\u66f4\u65b0: ${parts.join(" / ") || "\u4e26\u3073\u307e\u305f\u306f\u5185\u5bb9\u304c\u5909\u66f4\u3055\u308c\u307e\u3057\u305f"}`,
    });
  }

  return events;
}

module.exports = { diffPhotos };
