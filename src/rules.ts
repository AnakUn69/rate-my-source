import { hasEpisodeMarker } from "./normalize.js";
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

export const DEFAULT_RULES: ScoringRule<RateableSource>[] = [trailerPenaltyRule, typeMismatchRule];
