/**
 * Words that carry no title-identifying signal (resolution/codec/release tags, season/
 * episode notation, language codes, common filler words) — release-naming conventions
 * across English and Czech/Slovak sources. Ported from hellspio's source scorer, extended
 * with the Streamik addon's broader token list (`1x01`-style season/episode notation,
 * spelled-out Czech "Řada"/"Sezóna"/"Epizoda", `skdab`, four-digit years). Used both by
 * `typeMismatchRule`'s neighbor `hasEpisodeMarker` check and by the title-match "clean
 * match" heuristic in `scoring.ts` — customize via `ScoringOptions.ignoredWords`.
 */
export const DEFAULT_IGNORED_WORDS_RE =
  /^(s\d{1,2}e\d{1,3}|e\d{1,3}|\d{1,2}x\d{1,3}|(19|20)\d{2}|\d{3,4}p?|hdr|hdr10|dolby|vision|atmos|uhd|web|webdl|webrip|blu|ray|bluray|bdrip|brrip|rip|dvd|dvdrip|cam|ts|hdtv|hdrip|hdcam|scr|screener|x264|x265|h264|h265|h266|hevc|avc|aac|ac3|dts|eac3|flac|opus|mkv|mp4|avi|wmv|remux|repack|proper|internal|gossip|amzn|nf|netflix|dsnp|hmax|atvp|pcok|pmtp|ma|imax|\d{4}|\d+gb|\d+mb|cz|cs|en|sk|de|fr|it|es|pl|hu|ru|ja|ko|zh|czech|english|german|french|slovak|polish|hungarian|russian|japanese|korean|chinese|dabing|dabbing|dab|czdab|czdabing|czedab|skdab|tit|titulky|titulk|cztitulky|sub|subs|subtitle|subtitles|dubbed|dual|multi|audio|original|pvodni|pvodn|hd|sd|fullhd|fhd|4k|2k|8k|10bit|12bit|sdr|hlg|extended|directors|cut|unrated|theatrical|complete|season|series|episode|rada|sezona|epizoda|novinka|novinky|new)$/;

const EPISODE_MARKER_RE =
  /\bs\d{1,2}e\d{1,3}\b|\b\d{1,2}x\d{1,3}\b|\bepizoda\b|\bepizody\b|\bepisode\b|\bep\d{1,3}\b|\bseason\b|\bserie\b/i;

/** Lowercases, strips diacritics (NFD decomposition + drop combining marks) and collapses
 *  punctuation/whitespace — so e.g. "Sedmilhářky" normalizes to "sedmilharky" rather than
 *  losing its accented letters' base characters entirely. */
export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[._\-+]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasEpisodeMarker(normalized: string): boolean {
  return EPISODE_MARKER_RE.test(normalized);
}

/**
 * Every season/episode notation seen across a wide sample of real-world release names: the
 * Western "S01E01" convention, both zero-padded and not ("S5E14" is common, not just
 * "S05E14"); the "1x01"/"1x1" convention, same padding variance; and the Czech spelled-out
 * "Řada N - Epizoda M" / "Sezóna N - Epizoda M" convention. A source using any one of these
 * is just as real a match as one using the first format tried.
 */
export function seasonEpisodeTokens(season: number, episode: number): string[] {
  const paddedSeason = String(season).padStart(2, "0");
  const paddedEpisode = String(episode).padStart(2, "0");
  return [
    `s${paddedSeason}e${paddedEpisode}`,
    `s${season}e${episode}`,
    `${season}x${paddedEpisode}`,
    `${season}x${episode}`,
    `rada ${season} epizoda ${episode}`,
    `sezona ${season} epizoda ${episode}`,
  ];
}

/** True if `normalizedTitle` contains the target season/episode in any recognized notation. */
export function hasSeasonEpisodeMatch(normalizedTitle: string, season: number, episode: number): boolean {
  return seasonEpisodeTokens(season, episode).some((token) => new RegExp(`\\b${token}\\b`).test(normalizedTitle));
}
