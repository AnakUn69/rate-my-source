/**
 * Filename heuristics for release names that encode audio language, subtitle availability
 * and suspicious-release markers directly in the title (common on Czech/Slovak source
 * sites). Use these to build `RateableSource.languages`/`hasSubtitles`/`suspiciousReason`
 * before calling `scoreSource`. Ported 1:1 from the Streamik addon's
 * streams/filename-heuristics.ts.
 */

// "TITULK" catches "Titulky"/"Titulek" as a substring; "\bTIT\b" separately catches the
// common bare abbreviation ("CZ Tit") which has no "TITULK" substring to match.
const SUBTITLE_MARKER = /TITULK|SUBTITLE|\bSUB\b|SUBS|\bTIT\b/;
const DUB_MARKER = /DAB(BING|ING)?\b/;

export function detectLanguages(filename: string): string[] {
  const upper = filename.toUpperCase();
  const languages = new Set<string>();

  // A bare "CZ"/"SK" with no dub marker anywhere in the name, but *with* a subtitle marker
  // ("CZ Titulky", "CZ Tit", "CZtitulky", ...), means subtitles in that language over the
  // original audio — not a dubbed audio track. A bare code with *neither* marker still
  // defaults to dub, by long-standing release-naming convention — uploaders only bother
  // spelling out "Titulky" when it's *not* the dubbed default.
  const hasDubMarker = DUB_MARKER.test(upper);
  const hasSubtitleMarker = SUBTITLE_MARKER.test(upper);
  const impliesDub = (codeRegex: RegExp) => codeRegex.test(upper) && (hasDubMarker || !hasSubtitleMarker);

  if (impliesDub(/CZDAB|\bCZ\b/)) languages.add("cs");
  if (impliesDub(/SKDAB|\bSK\b/)) languages.add("sk");
  if (/\bEN\b|ENG|ENGLISH|ORIGINAL/.test(upper)) languages.add("en");
  return [...languages];
}

export function detectHasSubtitles(filename: string): boolean {
  return SUBTITLE_MARKER.test(filename.toUpperCase());
}

const SUSPICIOUS_MARKERS = ["CAM", "R5", "SCREENER", "TS", "HDCAM"];

export function detectSuspiciousReason(filename: string): string | undefined {
  const upper = filename.toUpperCase();
  const match = SUSPICIOUS_MARKERS.find((marker) => new RegExp(`\\b${marker}\\b`).test(upper));
  return match;
}
