export interface RateableSource {
  title: string;
  size?: number;
  /** Raw resolution/format tags, e.g. ["2160p"], ["1080"], ["4k", "hdr"]. */
  qualityKeys?: string[];
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
  /** Extra rules appended to the built-in defaults (trailer penalty, type mismatch). */
  rules?: ScoringRule<T>[];
  /** When true, skips the two built-in default rules and only runs `rules`. */
  disableDefaultRules?: boolean;
}
