export { normalizeTitle, hasEpisodeMarker, DEFAULT_IGNORED_WORDS_RE } from "./normalize.js";
export { trailerPenaltyRule, typeMismatchRule, DEFAULT_RULES } from "./rules.js";
export { scoreSource, rateSources } from "./scoring.js";
export type {
  RateableSource,
  ScoreReason,
  ScoreBreakdown,
  ScoreResult,
  ScoringRule,
  ScoringRuleContext,
  ScoringOptions,
} from "./types.js";
