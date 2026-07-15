/**
 * Words that carry no title-identifying signal (resolution/codec/release tags,
 * language codes, common filler words). Ported from hellspio's source scorer.
 */
export const DEFAULT_IGNORED_WORDS_RE =
  /^(s\d+e\d+|e\d+|\d{3,4}p|hdr|hdr10|dolby|vision|atmos|uhd|web|webdl|blu|ray|bluray|bdrip|brrip|rip|webrip|dvd|dvdrip|cam|ts|hdtv|hdrip|hdcam|scr|screener|x264|x265|h264|h265|h266|hevc|avc|aac|ac3|dts|eac3|flac|opus|mkv|mp4|avi|wmv|remux|repack|proper|internal|gossip|amzn|nf|netflix|dsnp|hmax|atvp|pcok|pmtp|ma|imax|\d{4}|\d+gb|\d+mb|cz|cs|en|sk|de|fr|it|es|pl|hu|ru|ja|ko|zh|czech|english|german|french|slovak|polish|hungarian|russian|japanese|korean|chinese|dabing|dabbing|dab|tit|titulky|titulk|cztitulky|czdab|czdabing|czedab|sub|subs|subtitle|subtitles|dubbed|dual|multi|audio|original|pvodni|pvodn|hd|sd|fullhd|fhd|4k|2k|8k|10bit|12bit|sdr|hlg|imax|extended|directors|cut|unrated|theatrical|complete|season|series|episode|novinka|novinky|new)$/;

const EPISODE_MARKER_RE =
  /\bs\d{1,2}e\d{1,3}\b|\b\d{1,2}x\d{1,3}\b|\bepizoda\b|\bepizody\b|\bepisode\b|\bep\d{1,3}\b|\bseason\b|\bserie\b/i;

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[._\-+]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripEpisodeMarker(normalized: string): string {
  return normalized.replace(/s\d+e\d+.*/i, "").trim();
}

export function hasEpisodeMarker(normalized: string): boolean {
  return EPISODE_MARKER_RE.test(normalized);
}
