function createEmptyRankingState() {
  return {
    currentRankingSummary: null,
    rankingSnapshots: [],
    notifiedMonths: [],
  };
}

function normalizeRankingState(value) {
  if (!value || typeof value !== "object") {
    return createEmptyRankingState();
  }

  return {
    currentRankingSummary: normalizeRankingSummary(value.currentRankingSummary),
    rankingSnapshots: normalizeRankingSnapshots(value.rankingSnapshots),
    notifiedMonths: normalizeNotifiedMonths(value.notifiedMonths),
  };
}

function buildNextRankingState(currentState, latestRanking) {
  const base = normalizeRankingState(currentState);
  if (!latestRanking) {
    return base;
  }

  return {
    ...base,
    currentRankingSummary: latestRanking.currentRankingSummary,
    rankingSnapshots: mergeRankingSnapshots(base.rankingSnapshots, latestRanking.rankingSnapshot),
  };
}

function markRankingMonthNotified(currentState, month) {
  const base = normalizeRankingState(currentState);
  if (!month) {
    return base;
  }

  return {
    ...base,
    notifiedMonths: Array.from(new Set([...base.notifiedMonths, month])).sort(),
  };
}

function shouldNotifyRanking(currentState, rankingSummary) {
  if (!rankingSummary?.month) {
    return false;
  }

  const inTop5 = isTopFive(rankingSummary.nominationRank) || isTopFive(rankingSummary.ratioRank);

  return inTop5 && !normalizeRankingState(currentState).notifiedMonths.includes(rankingSummary.month);
}

function createRankingNotificationLines(summary) {
  return [
    "🏆 月初ランキングを検知しました",
    `対象月: ${formatMonthLabel(summary.month)}`,
    `指名数ランキング: ${formatRankLabel(summary.nominationRank)}`,
    `指名比率ランキング: ${formatRankLabel(summary.ratioRank)}`,
  ];
}

function normalizeRankingSummary(value) {
  if (!value || typeof value !== "object" || typeof value.month !== "string") {
    return null;
  }

  return {
    month: value.month,
    nominationRank: normalizeRank(value.nominationRank),
    ratioRank: normalizeRank(value.ratioRank),
    detectedAt: typeof value.detectedAt === "string" ? value.detectedAt : new Date().toISOString(),
  };
}

function normalizeRankingSnapshots(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeRankingSnapshot(entry))
    .filter(Boolean)
    .sort((left, right) => left.month.localeCompare(right.month));
}

function normalizeRankingSnapshot(value) {
  if (!value || typeof value !== "object" || typeof value.month !== "string") {
    return null;
  }

  return {
    month: value.month,
    detectedAt: typeof value.detectedAt === "string" ? value.detectedAt : new Date().toISOString(),
    nominationTop5: normalizeRankingEntries(value.nominationTop5),
    ratioTop5: normalizeRankingEntries(value.ratioTop5),
  };
}

function normalizeRankingEntries(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const rank = normalizeRank(entry.rank);
      const castNo = Number(entry.castNo);
      if (!rank || !Number.isFinite(castNo)) {
        return null;
      }

      return {
        rank,
        castNo,
        castName: typeof entry.castName === "string" ? entry.castName : "",
      };
    })
    .filter(Boolean);
}

function normalizeNotifiedMonths(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((entry) => typeof entry === "string" && /^\d{4}-\d{2}$/.test(entry))),
  ).sort();
}

function mergeRankingSnapshots(currentSnapshots, incomingSnapshot) {
  const snapshots = normalizeRankingSnapshots(currentSnapshots);
  const nextSnapshot = normalizeRankingSnapshot(incomingSnapshot);
  if (!nextSnapshot) {
    return snapshots;
  }

  const byMonth = new Map(snapshots.map((entry) => [entry.month, entry]));
  byMonth.set(nextSnapshot.month, nextSnapshot);

  return Array.from(byMonth.values()).sort((left, right) => left.month.localeCompare(right.month));
}

function normalizeRank(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function isTopFive(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function formatMonthLabel(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return month || "-";
  }

  const [year, monthNumber] = month.split("-");
  return `${year}年${Number(monthNumber)}月`;
}

function formatRankLabel(rank) {
  return rank ? `${rank}位` : "圏外";
}

module.exports = {
  buildNextRankingState,
  createEmptyRankingState,
  createRankingNotificationLines,
  markRankingMonthNotified,
  normalizeRankingState,
  shouldNotifyRanking,
};

