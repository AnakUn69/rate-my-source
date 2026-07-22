# rate-my-source

Transparent, configurable scoring and ranking engine for picking the best media source. For every source you get back exactly what went in, what factors were scored and how, and the final score.

## Install

```sh
npm install rate-my-source
```

## Usage

```ts
import { rateSources } from "rate-my-source";

const results = rateSources(
  [
    { title: "The Matrix 1999 1080p BluRay", qualityKeys: ["1080"] },
    { title: "The Matrix Trailer 1999", qualityKeys: ["720"] },
    { title: "The Matrix 1999 2160p UHD", qualityKeys: ["2160p"] },
  ],
  { knownTitles: ["The Matrix"], type: "movie" }
);

console.log(results[0]);
// {
//   input: { title: "The Matrix 1999 2160p UHD", qualityKeys: ["2160p"] },
//   normalizedTitle: "the matrix 1999 2160p uhd",
//   breakdown: {
//     titleMatch: { score: 50, max: 50, matchedTitle: "the matrix" },
//     quality: { score: 50, max: 50, label: "4K" },
//     bonuses: [],
//     penalties: [],
//     total: 100,
//   },
//   score: 100,
// }
```

`scoreSource(item, options)` scores a single source. `rateSources(items, options)` scores a whole list and returns it sorted by descending score.

## How scoring works

Each source is scored on two weighted factors (50 points each by default), then adjusted by rules:

- **Title match** — how well `item.title` matches the `knownTitles` you provide, ignoring resolution/codec/language noise words.
- **Quality** — looked up from `item.qualityKeys` against a `qualityWeights` map (defaults: `2160`/`4k` → 50, `1080` → 35, `720` → 20, else → 5).
- **Rules** — pluggable functions that add bonuses or penalties with a human-readable `label`. Two are enabled by default:
  - trailer/teaser/sample detection (-30)
  - type mismatch between `options.type` ("movie" | "series") and whether the title looks episode-shaped (-50 / -35)

The final `score` is `max(0, titleMatch + quality + sum(bonuses/penalties))`.

## Custom rules

```ts
import { scoreSource, type ScoringRule, type RateableSource } from "rate-my-source";

const seederBonus: ScoringRule<RateableSource & { seeders?: number }> = ({ item }) =>
  (item.seeders ?? 0) > 100 ? { label: "Well-seeded", points: 10 } : null;

scoreSource(
  { title: "The Matrix 1999", seeders: 500 },
  { knownTitles: ["The Matrix"], rules: [seederBonus] }
);
```

Pass `disableDefaultRules: true` to run only your own rules. Any extra fields on your source object pass through untouched onto `result.input`.

## Ranking a scraped/noisy candidate list (season/episode, language, quality preference, size)

These are all opt-in — a call that doesn't pass them behaves exactly as shown above.
Useful when sources come from a search rather than a curated catalog, so titles can be
sloppy, mislabeled, or for a completely different item:

```ts
scoreSource(
  { title: "Dr. House S01E01 CZ SK Dabing 1080p", languages: ["cs"], size: 2 * 1024 ** 3 },
  {
    knownTitles: ["House", "Dr. House"], // aliases are just more knownTitles entries
    weights: { titleMatch: 80 },
    season: 1,
    episode: 1, // +100 if any season/episode notation matches (S01E01, 1x01, "Řada 1 Epizoda 1", ...)
    year: "2004", // +25 if the year appears in the title
    languagePriority: ["cs", "sk", "en"], // +50 for the top language; -10/-80 tradeoffs (see below)
    preferredQuality: "1080p", // +20 if qualityKeys matches
    sizeBonusPerGiB: 1, // + this many points per GiB of `size`
    strictTitleMatch: true, // a confident non-match scores a strong negative, not just 0
    allowNegativeTotal: true, // don't floor `.total` at 0 — needed for strictTitleMatch to matter
  }
);
```

- **Title matching** is tiered rather than a continuous ratio: a clean whole-title match
  scores the full `weights.titleMatch`; a single-word `knownTitles` entry (e.g. a bare
  "House") only counts as a match when at most one other real word sits next to it in the
  source title — otherwise a longer, unrelated title that happens to start the same way
  (e.g. "House of the Dragon") won't be mistaken for it.
- **`languagePriority`**: rewards a source whose `languages` includes the top preference;
  if that preference is `"cs"`, a subtitled-only release (`hasSubtitles`) is penalized
  slightly (a dub is usually preferred over subtitles); if the top preference is `"en"`
  but the source is dubbed in `"cs"`/`"sk"`, that's penalized more heavily.
- **`strictTitleMatch`** + **`allowNegativeTotal`** together let a confident non-match
  (e.g. a same-week, similarly-named but different show) rank below everything else even
  if it happens to also match season/episode and have a large `size` — rather than a
  merely-partial match losing to it once bonuses stack up.

Two more building blocks help construct these fields from a raw release filename before
scoring: `detectLanguages`/`detectHasSubtitles`/`detectSuspiciousReason` (audio language,
subtitle, and cam/screener detection) and `getQualityRank`/`inferQualityFromFilename` (a
fixed resolution-tier ranking, used internally by the quality-rank tie-break rule).

## API

- `scoreSource<T extends RateableSource>(item: T, options?: ScoringOptions<T>): ScoreResult<T>`
- `rateSources<T extends RateableSource>(items: T[], options?: ScoringOptions<T>): ScoreResult<T>[]`
- Types: `RateableSource`, `ScoreResult`, `ScoreBreakdown`, `ScoreReason`, `ScoringRule`, `ScoringRuleContext`, `ScoringOptions`
- Title/episode building blocks: `normalizeTitle`, `hasEpisodeMarker`, `hasSeasonEpisodeMatch`, `seasonEpisodeTokens`, `DEFAULT_IGNORED_WORDS_RE`
- Quality building blocks: `getQualityRank`, `formatQualityLabel`, `inferQualityFromFilename`, `isNativeQualityLabel`
- Filename heuristics: `detectLanguages`, `detectHasSubtitles`, `detectSuspiciousReason`, `normalizeLanguageCode`
- Default rules: `trailerPenaltyRule`, `typeMismatchRule`, `seasonEpisodeMatchRule`, `yearMatchRule`, `languagePriorityRule`, `qualityPreferenceRule`, `qualityRankTieBreakRule`, `suspiciousReleaseRule`, `sizeBonusRule`, `DEFAULT_RULES`

## License

MIT
