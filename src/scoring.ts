import { DEFAULT_IGNORED_WORDS_RE, normalizeTitle } from "./normalize.js";
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * How many tokens outside the matched target title are *not* release-metadata noise —
 * i.e. how many "other real words" the source title has beyond the target. 0 means a clean
 * match; the higher this climbs, the more likely the source is a different, longer title
 * that merely starts with (or contains) the same word(s) as the target — not just a
 * single-word-title problem: "The Matrix" (2 words) matches just as falsely inside "The
 * Matrix - Path Of Neo (Full Gameplay...)" as a bare "House" does inside "House of the
 * Dragon".
 */
function outsideNonMetadataTokenCount(normalizedSourceTitle: string, targetTitle: string, ignoredWords: RegExp): number {
  const outsideTokens = normalizedSourceTitle
    .replace(new RegExp(`(^|\\s)${escapeRegExp(targetTitle)}($|\\s)`), " ")
    .split(" ")
    .filter(Boolean);
  return outsideTokens.filter((token) => !(/^\d+$/.test(token) || ignoredWords.test(token))).length;
}

/**
 * Scores how well `normalizedItemTitle` matches any of `normalizedKnownTitles`, as a tiered
 * fraction of `maxPoints`:
 *
 * - 1.0   — the whole target title appears, with nothing but release-metadata noise around it
 * - 0.875 — every target-title token is present somewhere (order/adjacency not required)
 * - 0.75  — a single-word target title appears, with at most one other "real" word nearby
 *           (an episode-title word like "Pilot" doesn't disqualify it, but two or more do —
 *           that's almost certainly a different, longer title that happens to start the
 *           same way, e.g. a bare "House" inside "House of the Dragon")
 * - 0.4375 — most (but not all) target-title tokens are present
 * - 0      — no meaningful overlap
 * - -2.25  — (only with `penalizeNoMatch`) a multi-word target title with *zero* token
 *            overlap at all — a confident "this is not it" signal for ranking a noisy list,
 *            not just "no evidence either way"
 */
function scoreTitleMatch(
  normalizedItemTitle: string,
  normalizedKnownTitles: string[],
  ignoredWords: RegExp,
  maxPoints: number,
  penalizeNoMatch: boolean
): { score: number; matchedTitle?: string } {
  const candidateTokens = new Set(normalizedItemTitle.split(" ").filter(Boolean));

  let bestScore = 0;
  let matchedTitle: string | undefined;
  let sawMultiWordTarget = false;

  for (const targetTitle of normalizedKnownTitles) {
    const targetTokens = targetTitle.split(" ").filter(Boolean);
    if (targetTokens.length === 0) continue;
    if (targetTokens.length > 1) sawMultiWordTarget = true;

    const wholeTitleRegex = new RegExp(`(^|\\s)${escapeRegExp(targetTitle)}($|\\s)`);
    const isWholeTitlePresent = wholeTitleRegex.test(normalizedItemTitle);
    const outsideDirtyCount = isWholeTitlePresent
      ? outsideNonMetadataTokenCount(normalizedItemTitle, targetTitle, ignoredWords)
      : -1;

    let tierScore = 0;
    if (isWholeTitlePresent && outsideDirtyCount === 0) {
      tierScore = maxPoints;
    } else {
      const overlap = targetTokens.filter((token) => candidateTokens.has(token)).length;
      if (targetTokens.length === 1 && overlap === 1) {
        if (outsideDirtyCount <= 1) tierScore = maxPoints * 0.75;
      } else if (overlap === targetTokens.length) {
        tierScore = maxPoints * 0.875;
      } else if (overlap >= 2 && overlap >= targetTokens.length - 1) {
        tierScore = maxPoints * 0.4375;
      }
    }

    if (tierScore > bestScore) {
      bestScore = tierScore;
      matchedTitle = targetTitle;
    }
  }

  if (bestScore > 0) return { score: bestScore, matchedTitle };
  if (penalizeNoMatch && sawMultiWordTarget) return { score: -(maxPoints * 2.25) };
  return { score: 0 };
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
    strictTitleMatch = false,
    allowNegativeTotal = false,
    season,
    episode,
    year,
    languagePriority,
    preferredQuality,
    sizeBonusPerGiB,
  } = options;

  const titleMax = weights.titleMatch ?? 50;
  const qualityMax = weights.quality ?? 50;

  const normalizedTitle = normalizeTitle(item.title);
  const normalizedKnownTitles = knownTitles
    .map((t) => normalizeTitle(t))
    .filter((t, i, arr) => t.length > 0 && arr.indexOf(t) === i);

  const titleMatch = scoreTitleMatch(normalizedTitle, normalizedKnownTitles, ignoredWords, titleMax, strictTitleMatch);
  const quality = scoreQuality(item.qualityKeys ?? [], qualityWeights, qualityLabels, defaultQualityScore);

  const activeRules: ScoringRule<T>[] = disableDefaultRules
    ? rules
    : [...(DEFAULT_RULES as ScoringRule<T>[]), ...rules];

  const bonuses: ScoreReason[] = [];
  const penalties: ScoreReason[] = [];

  for (const rule of activeRules) {
    const result = rule({ item, normalizedTitle, type, season, episode, year, languagePriority, preferredQuality, sizeBonusPerGiB });
    if (!result) continue;
    const reasons = Array.isArray(result) ? result : [result];
    for (const reason of reasons) {
      if (reason.points >= 0) bonuses.push(reason);
      else penalties.push(reason);
    }
  }

  const adjustmentTotal = [...bonuses, ...penalties].reduce((sum, r) => sum + r.points, 0);
  const rawTotal = titleMatch.score + quality.score + adjustmentTotal;
  const total = allowNegativeTotal ? rawTotal : Math.max(0, rawTotal);

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
