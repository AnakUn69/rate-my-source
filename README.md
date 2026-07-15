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

## API

- `scoreSource<T extends RateableSource>(item: T, options?: ScoringOptions<T>): ScoreResult<T>`
- `rateSources<T extends RateableSource>(items: T[], options?: ScoringOptions<T>): ScoreResult<T>[]`
- Types: `RateableSource`, `ScoreResult`, `ScoreBreakdown`, `ScoreReason`, `ScoringRule`, `ScoringRuleContext`, `ScoringOptions`
- Building blocks: `normalizeTitle`, `hasEpisodeMarker`, `DEFAULT_IGNORED_WORDS_RE`, `trailerPenaltyRule`, `typeMismatchRule`, `DEFAULT_RULES`

## License

MIT
