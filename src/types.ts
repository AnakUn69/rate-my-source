export interface RateableSource {
  title: string;
  /** File size in bytes. Powers the optional size-bonus rule (see `sizeBonusPerGiB`). */
  size?: number;
  /** Raw resolution/format tags, e.g. ["2160p"], ["1080"], ["4k", "hdr"]. */
  qualityKeys?: string[];
  /** Audio/dub language codes present, e.g. ["cs"], ["cs", "en"]. Powers `languagePriority`. */
  languages?: string[];
  /** Whether the release carries subtitles (as opposed to a dubbed audio track). */
  hasSubtitles?: boolean;
  /** Set when the release looks suspicious (cam/screener/etc); powers the suspicious-release penalty. */
  suspiciousReason?: string;
  [key: string]: unknown;
}

export interface ScoreReason {
  label: string;
  points: number;
}

export interface ScoreBreakdown {
  titleMatch: {
    score: number;
    max: number;
    /** Which knownTitle produced the winning score, if any. */
    matchedTitle?: string;
  };
  quality: {
    score: number;
    max: number;
    label: string;
  };
  bonuses: ScoreReason[];
  penalties: ScoreReason[];
  total: number;
}

export interface ScoreResult<T extends RateableSource = RateableSource> {
  /** Echoes exactly what was passed in. */
  input: T;
  normalizedTitle: string;
  /** What was scored, and how. */
  breakdown: ScoreBreakdown;
  score: number;
}

export interface ScoringRuleContext<T extends RateableSource = RateableSource> {
  item: T;
  normalizedTitle: string;
  type?: string;
  /** Echoed from `ScoringOptions` so rules (built-in or custom) can read the query context. */
  season?: number;
  episode?: number;
  year?: string;
  languagePriority?: string[];
  preferredQuality?: string;
  sizeBonusPerGiB?: number;
}

export type ScoringRule<T extends RateableSource = RateableSource> = (
  ctx: ScoringRuleContext<T>
) => ScoreReason | ScoreReason[] | null | undefined;

export interface ScoringOptions<T extends RateableSource = RateableSource> {
  /** Titles the source is expected to match against (e.g. the searched title + known aliases). */
  knownTitles?: string[];
  /** Category hint used by the default type-mismatch rule (e.g. "movie" | "series"). */
  type?: string;
  /** Words to ignore when computing the title-match ratio. Defaults to DEFAULT_IGNORED_WORDS_RE. */
  ignoredWords?: RegExp;
  /** Maps a substring found in qualityKeys to a point value. The highest-scoring match wins. */
  qualityWeights?: Record<string, number>;
  /** Maps a qualityWeights pattern to a human-readable label (e.g. "2160" -> "4K"). */
  qualityLabels?: Record<string, string>;
  /** Score used when no qualityWeights pattern matches. Defaults to 5. */
  defaultQualityScore?: number;
  /** Max points awarded for title match and quality. Defaults to { titleMatch: 50, quality: 50 }. */
  weights?: { titleMatch?: number; quality?: number };
  /** Extra rules appended to the built-in defaults (trailer penalty, type mismatch, ...). */
  rules?: ScoringRule<T>[];
  /** When true, skips the built-in default rules entirely and only runs `rules`. */
  disableDefaultRules?: boolean;

  /**
   * When true, a source that doesn't match any `knownTitles` at all gets a strong negative
   * title-match score (proportional to `weights.titleMatch`) instead of 0, once at least one
   * `knownTitles` entry has more than one word. Off by default so existing callers relying on
   * "no match -> 0" keep seeing that; turn it on when ranking a noisy/scraped candidate list
   * where a confident non-match should sink below results that simply didn't score anything
   * (see also `allowNegativeTotal`, which this typically needs to have an effect on `.total`).
   */
  strictTitleMatch?: boolean;
  /**
   * When true, the final `.total` isn't floored at 0. Needed when ranking a list (rather than
   * displaying a single 0-100-ish score to a user) so a strong penalty (`strictTitleMatch`,
   * a suspicious-release hit, ...) can still rank below a source that merely scored nothing.
   */
  allowNegativeTotal?: boolean;

  /** Season being searched for (series only). Enables the season/episode-match bonus rule. */
  season?: number;
  /** Episode being searched for (series only). Enables the season/episode-match bonus rule. */
  episode?: number;
  /** Release year being searched for. Enables the year-match bonus rule (+25 when present). */
  year?: string;
  /**
   * Preferred languages in priority order, e.g. `["cs", "sk", "en"]`. Enables the
   * language-priority rule: +50 for a source whose `languages` includes the top preference,
   * -10 if that's "cs" and the source `hasSubtitles` (a dub is preferred over subtitles),
   * -80 if the top preference is "en" but the source is dubbed in "cs"/"sk".
   */
  languagePriority?: string[];
  /** A quality label the user prefers (e.g. "1080p"); "best" (the default) disables this rule. */
  preferredQuality?: string;
  /** Points awarded per GiB of `item.size`. Unset (default) disables the size-bonus rule. */
  sizeBonusPerGiB?: number;
}
