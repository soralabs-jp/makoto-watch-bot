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

  const state = normalizeRankingState(currentState);
  if (state.notifiedMonths.includes(rankingSummary.month)) {
    return false;
  }

  return hasTopFiveRank(rankingSummary) || hasDropOutFromTopFive(state.currentRankingSummary, rankingSummary);
}

function createRankingNotificationLines(summary, previousSummary = null) {
  const hasComparison = shouldShowComparison(previousSummary, summary);

  return [
    "🏆 月初ランキングを検知しました",
    `対象月: ${formatMonthLabel(summary.month)}`,
    `指名数ランキング: ${formatRankNotificationLabel(previousSummary?.nominationRank, summary.nominationRank, hasComparison)}`,
    `指名比率ランキング: ${formatRankNotificationLabel(previousSummary?.ratioRank, summary.ratioRank, hasComparison)}`,
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

function hasTopFiveRank(summary) {
  return isTopFive(summary?.nominationRank) || isTopFive(summary?.ratioRank);
}

function hasDropOutFromTopFive(previousSummary, currentSummary) {
  if (!shouldShowComparison(previousSummary, currentSummary)) {
    return false;
  }

  return [
    [previousSummary.nominationRank, currentSummary.nominationRank],
    [previousSummary.ratioRank, currentSummary.ratioRank],
  ].some(([previousRank, currentRank]) => isTopFive(previousRank) && !isTopFive(currentRank));
}

function shouldShowComparison(previousSummary, currentSummary) {
  return Boolean(
    previousSummary?.month &&
    currentSummary?.month &&
    previousSummary.month !== currentSummary.month,
  );
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

function formatRankNotificationLabel(previousRank, currentRank, hasComparison) {
  if (!hasComparison) {
    return formatRankLabel(currentRank);
  }

  const previousLabel = formatRankLabel(previousRank);
  const currentLabel = formatRankLabel(currentRank);
  if (previousLabel === currentLabel) {
    return currentLabel;
  }

  return `${previousLabel} → ${currentLabel}`;
}

module.exports = {
  buildNextRankingState,
  createEmptyRankingState,
  createRankingNotificationLines,
  markRankingMonthNotified,
  normalizeRankingState,
  shouldNotifyRanking,
};
