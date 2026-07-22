/**
 * Sources are inconsistent about which language-code standard they use — some report both
 * two-letter ISO 639-1 ("cs") and three-letter ISO 639-2/B ("cze") for the same language
 * across different results. Normalize to ISO 639-1 so `RateableSource.languages` stays
 * consistent regardless of source quirks. Ported 1:1 from the Streamik addon's
 * streams/language-codes.ts.
 */
const THREE_LETTER_TO_TWO_LETTER: Record<string, string> = {
  cze: "cs",
  ces: "cs",
  slo: "sk",
  slk: "sk",
  eng: "en",
};

export function normalizeLanguageCode(code: string): string {
  const normalized = code.trim().toLowerCase();
  if (normalized.length === 2) return normalized;
  return THREE_LETTER_TO_TWO_LETTER[normalized] ?? normalized;
}
