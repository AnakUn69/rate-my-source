/**
 * A fixed resolution-tier rank table, independent of `scoreSource`'s configurable
 * `qualityWeights`/`qualityLabels` — useful on its own (e.g. to infer/compare quality before
 * a source's `qualityKeys` are even built) and as the basis for `qualityRankTieBreakRule`.
 * Ported 1:1 from the Streamik addon's streams/quality.ts.
 */

const NATIVE_QUALITY_LABELS = new Set(["original", "native", "archive"]);

export function formatQualityLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (/^\d+$/.test(normalized) && normalized.length >= 3) {
    return `${normalized}p`;
  }
  if (normalized === "native" || normalized === "original") {
    return "Original";
  }
  return value.trim().toUpperCase();
}

export function getQualityRank(value: string): number {
  const normalized = value.trim().toLowerCase();
  // Checked before any numeric resolution so a compound label like "Original (1080p)" (the
  // raw, unconverted download, whose filename happens to also state a resolution) resolves
  // consistently either way. Deliberately valued the same as 1080p rather than as a
  // super-tier above 4K — an unconverted file isn't necessarily higher resolution than a
  // proper 4K release.
  if (normalized.includes("native") || normalized.includes("original")) return 1080;
  if (normalized.includes("2160") || normalized.includes("4k")) return 2160;
  if (normalized.includes("1440")) return 1440;
  if (normalized.includes("1080")) return 1080;
  if (normalized.includes("720")) return 720;
  if (normalized.includes("576")) return 576;
  if (normalized.includes("540")) return 540;
  if (normalized.includes("480")) return 480;
  if (normalized.includes("360")) return 360;
  return 0;
}

export function inferQualityFromFilename(filename: string | null | undefined): string {
  if (!filename) return "";
  const resMatch = /\b(2160|1080|720|576|540|480|360)\s*p?\b/i.exec(filename);
  if (resMatch) return `${resMatch[1]}p`;
  if (/\b4k\b/i.test(filename)) return "2160p";
  return "";
}

export function isNativeQualityLabel(value: string): boolean {
  return NATIVE_QUALITY_LABELS.has(value.trim().toLowerCase());
}
