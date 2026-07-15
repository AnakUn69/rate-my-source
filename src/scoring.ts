import { DEFAULT_IGNORED_WORDS_RE, normalizeTitle, stripEpisodeMarker } from "./normalize.js";
import { DEFAULT_RULES } from "./rules.js";
import type {
  RateableSource,
  ScoreBreakdown,
  ScoreReason,
  ScoreResult,
  ScoringOptions,
  ScoringRule,
} from "./types.js";

const DEFAULT_QUALITY_WEIGHTS: Record<string, number> = {
  "2160": 50,
  "4k": 50,
  "1080": 35,
  "720": 20,
};

const DEFAULT_QUALITY_LABELS: Record<string, string> = {
  "2160": "4K",
  "4k": "4K",
  "1080": "1080p",
  "720": "720p",
};

function scoreTitleMatch(
  normalizedItemTitle: string,
  normalizedKnownTitles: string[],
  ignoredWords: RegExp,
  maxPoints: number
): { score: number; matchedTitle?: string } {
  const itemForScoring = stripEpisodeMarker(normalizedItemTitle) || normalizedItemTitle;
  const itemWords = itemForScoring.split(/\s+/).filter(Boolean);
  const allItemWords = normalizedItemTitle.split(/\s+/).filter(Boolean);
  const relevantItemWords = itemWords.filter((w) => !ignoredWords.test(w));

  let best = 0;
  let matchedTitle: string | undefined;

  for (const known of normalizedKnownTitles) {
    const searchWords = known.split(/\s+/).filter(Boolean);
    if (searchWords.length === 0) continue;

    const matchedSearch = searchWords.filter((sw) => allItemWords.some((iw) => iw === sw)).length;
    const searchRatio = matchedSearch / searchWords.length;

    const matchedItem = relevantItemWords.filter((iw) => searchWords.some((sw) => iw === sw)).length;
    const itemRatio = relevantItemWords.length > 0 ? matchedItem / relevantItemWords.length : 0;

    const searchWeight = searchWords.length <= 2 ? 0.3 : 0.6;
    const combined = searchRatio * searchWeight + itemRatio * (1 - searchWeight);
    const score = Math.round(combined * maxPoints);

    if (score > best) {
      best = score;
      matchedTitle = known;
    }
  }

  return { score: best, matchedTitle };
}

function scoreQuality(
  qualityKeys: string[],
  weights: Record<string, number>,
  labels: Record<string, string>,
  defaultScore: number
): { score: number; label: string } {
  const keysLower = qualityKeys.map((k) => k.toLowerCase());
  let bestScore: number | undefined;
  let bestPattern: string | undefined;

  for (const [pattern, points] of Object.entries(weights)) {
    const patternLower = pattern.toLowerCase();
    if (!keysLower.some((k) => k.includes(patternLower))) continue;
    if (bestScore === undefined || points > bestScore) {
      bestScore = points;
      bestPattern = pattern;
    }
  }

  if (bestPattern === undefined || bestScore === undefined) {
    return { score: defaultScore, label: "SD" };
  }
  return { score: bestScore, label: labels[bestPattern] ?? bestPattern };
}

export function scoreSource<T extends RateableSource>(
  item: T,
  options: ScoringOptions<T> = {}
): ScoreResult<T> {
  const {
    knownTitles = [],
    type,
    ignoredWords = DEFAULT_IGNORED_WORDS_RE,
    qualityWeights = DEFAULT_QUALITY_WEIGHTS,
    qualityLabels = DEFAULT_QUALITY_LABELS,
    defaultQualityScore = 5,
    weights = {},
    rules = [],
    disableDefaultRules = false,
  } = options;

  const titleMax = weights.titleMatch ?? 50;
  const qualityMax = weights.quality ?? 50;

  const normalizedTitle = normalizeTitle(item.title);
  const normalizedKnownTitles = knownTitles
    .map((t) => normalizeTitle(t))
    .filter((t, i, arr) => t.length > 0 && arr.indexOf(t) === i);

  const titleMatch = scoreTitleMatch(normalizedTitle, normalizedKnownTitles, ignoredWords, titleMax);
  const quality = scoreQuality(item.qualityKeys ?? [], qualityWeights, qualityLabels, defaultQualityScore);

  const activeRules: ScoringRule<T>[] = disableDefaultRules
    ? rules
    : [...(DEFAULT_RULES as ScoringRule<T>[]), ...rules];

  const bonuses: ScoreReason[] = [];
  const penalties: ScoreReason[] = [];

  for (const rule of activeRules) {
    const result = rule({ item, normalizedTitle, type });
    if (!result) continue;
    const reasons = Array.isArray(result) ? result : [result];
    for (const reason of reasons) {
      if (reason.points >= 0) bonuses.push(reason);
      else penalties.push(reason);
    }
  }

  const adjustmentTotal = [...bonuses, ...penalties].reduce((sum, r) => sum + r.points, 0);
  const total = Math.max(0, titleMatch.score + quality.score + adjustmentTotal);

  const breakdown: ScoreBreakdown = {
    titleMatch: { score: titleMatch.score, max: titleMax, matchedTitle: titleMatch.matchedTitle },
    quality: { score: quality.score, max: qualityMax, label: quality.label },
    bonuses,
    penalties,
    total,
  };

  return { input: item, normalizedTitle, breakdown, score: total };
}

export function rateSources<T extends RateableSource>(
  items: T[],
  options: ScoringOptions<T> = {}
): ScoreResult<T>[] {
  return items.map((item) => scoreSource(item, options)).sort((a, b) => b.score - a.score);
}
