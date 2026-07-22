import { hasEpisodeMarker, hasSeasonEpisodeMatch } from "./normalize.js";
import { getQualityRank } from "./quality-rank.js";
import type { RateableSource, ScoringRule } from "./types.js";

export const trailerPenaltyRule: ScoringRule<RateableSource> = ({ normalizedTitle }) => {
  if (/\b(trailer|teaser|sample|ukazka)\b/i.test(normalizedTitle)) {
    return { label: "Trailer / sample", points: -30 };
  }
  return null;
};

export const typeMismatchRule: ScoringRule<RateableSource> = ({ normalizedTitle, type }) => {
  const episodeShaped = hasEpisodeMarker(normalizedTitle);
  if (type === "movie" && episodeShaped) {
    return { label: "Looks like a series episode, searching for a movie", points: -50 };
  }
  if (type === "series" && !episodeShaped) {
    return { label: "No episode marker, searching for a series", points: -35 };
  }
  return null;
};

/** No-ops unless both `season` and `episode` are supplied via `ScoringOptions`. */
export const seasonEpisodeMatchRule: ScoringRule<RateableSource> = ({ normalizedTitle, season, episode }) => {
  if (season == null || episode == null) return null;
  return hasSeasonEpisodeMatch(normalizedTitle, season, episode) ? { label: "Season/episode match", points: 100 } : null;
};

/** No-ops unless `year` is supplied via `ScoringOptions`. */
export const yearMatchRule: ScoringRule<RateableSource> = ({ normalizedTitle, year }) => {
  if (!year || !normalizedTitle.includes(year)) return null;
  return { label: "Year match", points: 25 };
};

/**
 * No-ops unless `languagePriority` is supplied via `ScoringOptions`. Rewards a source whose
 * `item.languages` includes the top-priority language; penalizes subtitles-only when the top
 * preference is a dub-first language ("cs"), and penalizes a "cs"/"sk" dub when the top
 * preference is "en" — a subtitled/dubbed-elsewhere release usually isn't what's wanted then.
 */
export const languagePriorityRule: ScoringRule<RateableSource> = ({ item, languagePriority }) => {
  const preferred = languagePriority?.[0];
  if (!preferred || preferred === "any") return null;

  const languages = item.languages ?? [];
  const reasons: { label: string; points: number }[] = [];
  if (languages.includes(preferred)) {
    reasons.push({ label: `Preferred language (${preferred})`, points: 50 });
  }
  if (preferred === "cs" && item.hasSubtitles) {
    reasons.push({ label: "Subtitles only, dub preferred", points: -10 });
  }
  if (preferred === "en" && languages.some((lang) => lang === "cs" || lang === "sk")) {
    reasons.push({ label: "Dubbed in cs/sk, English preferred", points: -80 });
  }
  return reasons.length > 0 ? reasons : null;
};

/** No-ops unless `preferredQuality` is supplied via `ScoringOptions` (and isn't "best"). */
export const qualityPreferenceRule: ScoringRule<RateableSource> = ({ item, preferredQuality }) => {
  if (!preferredQuality || preferredQuality === "best") return null;
  const matches = (item.qualityKeys ?? []).some((key) => key.toLowerCase().includes(preferredQuality.toLowerCase()));
  return matches ? { label: `Preferred quality (${preferredQuality})`, points: 20 } : null;
};

/** Lightly rewards higher-ranked qualities so e.g. 1080p beats 720p when everything else ties. */
export const qualityRankTieBreakRule: ScoringRule<RateableSource> = ({ item }) => {
  const best = (item.qualityKeys ?? []).reduce((max, key) => Math.max(max, getQualityRank(key)), 0);
  return best > 0 ? { label: "Quality rank", points: best / 100 } : null;
};

export const suspiciousReleaseRule: ScoringRule<RateableSource> = ({ item }) => {
  if (!item.suspiciousReason) return null;
  return { label: `Suspicious release (${item.suspiciousReason})`, points: -120 };
};

/** No-ops unless `sizeBonusPerGiB` is supplied via `ScoringOptions` and `item.size` is set. */
export const sizeBonusRule: ScoringRule<RateableSource> = ({ item, sizeBonusPerGiB }) => {
  if (!sizeBonusPerGiB || !item.size) return null;
  const points = (item.size / 1024 / 1024 / 1024) * sizeBonusPerGiB;
  return { label: "Size bonus", points };
};

export const DEFAULT_RULES: ScoringRule<RateableSource>[] = [
  trailerPenaltyRule,
  typeMismatchRule,
  seasonEpisodeMatchRule,
  yearMatchRule,
  languagePriorityRule,
  qualityPreferenceRule,
  qualityRankTieBreakRule,
  suspiciousReleaseRule,
  sizeBonusRule,
];
