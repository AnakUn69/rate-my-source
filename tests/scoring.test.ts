import { describe, expect, it } from "vitest";
import { rateSources, scoreSource } from "../src/scoring.js";
import type { RateableSource } from "../src/types.js";

const knownTitles = ["The Matrix"];

describe("scoreSource — title match", () => {
  it("scores an exact title match at the full title-match weight", () => {
    const result = scoreSource({ title: "The Matrix 1999 1080p BluRay" }, { knownTitles });
    expect(result.breakdown.titleMatch.score).toBe(50);
    expect(result.breakdown.titleMatch.matchedTitle).toBe("the matrix");
  });

  it("scores a partial/unrelated title lower than an exact match", () => {
    const exact = scoreSource({ title: "The Matrix 1999" }, { knownTitles });
    const partial = scoreSource({ title: "Matrix Reloaded 2003" }, { knownTitles });
    expect(partial.breakdown.titleMatch.score).toBeLessThan(exact.breakdown.titleMatch.score);
  });

  it("echoes the exact input object back on the result", () => {
    const input: RateableSource = { title: "The Matrix 1999", size: 4321 };
    const result = scoreSource(input, { knownTitles });
    expect(result.input).toBe(input);
  });
});

describe("scoreSource — quality", () => {
  it.each([
    [["2160p"], 50, "4K"],
    [["4k"], 50, "4K"],
    [["1080"], 35, "1080p"],
    [["720"], 20, "720p"],
    [["mp4"], 5, "SD"],
    [[], 5, "SD"],
  ])("scores qualityKeys %j as %i points labeled %s", (qualityKeys, points, label) => {
    const result = scoreSource({ title: "x", qualityKeys });
    expect(result.breakdown.quality.score).toBe(points);
    expect(result.breakdown.quality.label).toBe(label);
  });

  it("supports custom quality weights and labels", () => {
    const result = scoreSource(
      { title: "x", qualityKeys: ["8k"] },
      { qualityWeights: { "8k": 80 }, qualityLabels: { "8k": "8K" } }
    );
    expect(result.breakdown.quality.score).toBe(80);
    expect(result.breakdown.quality.label).toBe("8K");
  });
});

describe("scoreSource — default rules", () => {
  it("penalizes trailers/teasers/samples", () => {
    const result = scoreSource({ title: "The Matrix Trailer 1999" }, { knownTitles });
    expect(result.breakdown.penalties).toContainEqual({ label: "Trailer / sample", points: -30 });
  });

  it("penalizes an episode-shaped source when searching for a movie", () => {
    const result = scoreSource({ title: "The Matrix S01E02" }, { knownTitles, type: "movie" });
    expect(result.breakdown.penalties.some((p) => p.points === -50)).toBe(true);
  });

  it("penalizes a non-episode-shaped source when searching for a series", () => {
    const result = scoreSource({ title: "The Matrix" }, { knownTitles, type: "series" });
    expect(result.breakdown.penalties.some((p) => p.points === -35)).toBe(true);
  });

  it("clamps the total score at 0 even under heavy penalties", () => {
    const result = scoreSource({ title: "Unrelated Trailer S01E02" }, { type: "movie", knownTitles });
    expect(result.score).toBe(0);
  });

  it("can disable default rules entirely", () => {
    const result = scoreSource(
      { title: "The Matrix Trailer" },
      { knownTitles, disableDefaultRules: true }
    );
    expect(result.breakdown.penalties).toEqual([]);
  });
});

describe("scoreSource — custom rules", () => {
  it("runs custom rules alongside the defaults and buckets by sign", () => {
    const seederBonus = ({ item }: { item: RateableSource }) =>
      typeof item.seeders === "number" && item.seeders > 100
        ? { label: "Well-seeded", points: 10 }
        : null;

    const result = scoreSource(
      { title: "The Matrix", seeders: 500 },
      { knownTitles, rules: [seederBonus] }
    );
    expect(result.breakdown.bonuses).toContainEqual({ label: "Well-seeded", points: 10 });
  });
});

describe("rateSources", () => {
  it("returns results sorted by descending score", () => {
    const items: RateableSource[] = [
      { title: "The Matrix Trailer 1999", qualityKeys: ["720"] },
      { title: "The Matrix 1999", qualityKeys: ["2160p"] },
      { title: "The Matrix 1999", qualityKeys: ["720"] },
    ];
    const results = rateSources(items, { knownTitles });
    const scores = results.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(results[0].input.qualityKeys).toEqual(["2160p"]);
  });
});

// The rules/options below were ported from the Streamik Stremio/Nuvio addon's own
// streams/score.ts, which ranks scraped Czech/Slovak release listings (title/season/
// episode/language/quality/suspicious-release all matter there). They're opt-in additions
// to the same scoreSource/rateSources API, not a second API — a caller who doesn't pass
// these options sees the exact behavior tested above, unchanged.
describe("scoreSource — season/episode, year, language, quality-preference and size rules", () => {
  it("rewards a season/episode match (any supported notation) via `season`/`episode`", () => {
    const withEpisode = scoreSource({ title: "Andor S01E02 1080p" }, { season: 1, episode: 2 });
    const withoutEpisode = scoreSource({ title: "Andor S02E05 1080p" }, { season: 1, episode: 2 });
    expect(withEpisode.breakdown.bonuses).toContainEqual({ label: "Season/episode match", points: 100 });
    expect(withoutEpisode.score).toBeLessThan(withEpisode.score);
  });

  it("does nothing when `season`/`episode` aren't supplied", () => {
    const result = scoreSource({ title: "Andor S01E02 1080p" });
    expect(result.breakdown.bonuses).toEqual([]);
  });

  it("rewards a year match via `year`", () => {
    const result = scoreSource({ title: "The Matrix 1999 1080p" }, { year: "1999" });
    expect(result.breakdown.bonuses).toContainEqual({ label: "Year match", points: 25 });
  });

  it("rewards the top `languagePriority` entry and penalizes the cs/en tradeoffs", () => {
    const cs = scoreSource({ title: "Andor S01E02", languages: ["cs"] }, { languagePriority: ["cs", "en"] });
    const en = scoreSource({ title: "Andor S01E02", languages: ["en"] }, { languagePriority: ["cs", "en"] });
    expect(cs.breakdown.bonuses).toContainEqual({ label: "Preferred language (cs)", points: 50 });
    expect(cs.score).toBeGreaterThan(en.score);

    const csSubtitled = scoreSource(
      { title: "Andor S01E02", languages: ["cs"], hasSubtitles: true },
      { languagePriority: ["cs"] }
    );
    expect(csSubtitled.breakdown.penalties).toContainEqual({ label: "Subtitles only, dub preferred", points: -10 });

    const enPreferredButCzDub = scoreSource(
      { title: "Andor S01E02", languages: ["cs"] },
      { languagePriority: ["en"] }
    );
    expect(enPreferredButCzDub.breakdown.penalties).toContainEqual({
      label: "Dubbed in cs/sk, English preferred",
      points: -80,
    });
  });

  it("rewards a source matching `preferredQuality`", () => {
    const result = scoreSource({ title: "x", qualityKeys: ["1080p"] }, { preferredQuality: "1080p" });
    expect(result.breakdown.bonuses).toContainEqual({ label: "Preferred quality (1080p)", points: 20 });
  });

  it("does nothing for `preferredQuality: 'best'`", () => {
    const result = scoreSource({ title: "x", qualityKeys: ["1080p"] }, { preferredQuality: "best" });
    expect(result.breakdown.bonuses.some((b) => b.label.startsWith("Preferred quality"))).toBe(false);
  });

  it("penalizes a suspicious release via `item.suspiciousReason`", () => {
    const result = scoreSource({ title: "Andor S01E02 CAM", suspiciousReason: "CAM" }, {});
    expect(result.breakdown.penalties).toContainEqual({ label: "Suspicious release (CAM)", points: -120 });
  });

  it("rewards larger files via `sizeBonusPerGiB`", () => {
    const big = scoreSource({ title: "Andor S01E02", size: 2 * 1024 ** 3 }, { sizeBonusPerGiB: 1 });
    const small = scoreSource({ title: "Andor S01E02", size: 500 * 1024 ** 2 }, { sizeBonusPerGiB: 1 });
    expect(big.score).toBeGreaterThan(small.score);
  });

  it("does nothing for size without `sizeBonusPerGiB`", () => {
    const result = scoreSource({ title: "Andor S01E02", size: 2 * 1024 ** 3 });
    expect(result.breakdown.bonuses.some((b) => b.label === "Size bonus")).toBe(false);
  });
});

describe("scoreSource — strictTitleMatch and single-word title false positives", () => {
  // Regression, ported from Streamik: a bare single-word title (e.g. metadata resolving
  // "House M.D." to just "House") must not score a full match against an unrelated show
  // that merely starts with the same word.
  it("does not treat a longer unrelated title as a clean match for a single-word knownTitle", () => {
    const falsePositive = scoreSource(
      { title: "House of the Dragon S01E01 2160p BluRay REMUX HEVC" },
      { knownTitles: ["House"], weights: { titleMatch: 80 } }
    );
    const realMatch = scoreSource(
      { title: "House S01E01 1080p BluRay x265" },
      { knownTitles: ["House"], weights: { titleMatch: 80 } }
    );
    expect(falsePositive.breakdown.titleMatch.score).toBeLessThan(realMatch.breakdown.titleMatch.score);
    expect(realMatch.breakdown.titleMatch.score).toBe(80);
  });

  // With `strictTitleMatch` + `allowNegativeTotal` (and `weights.titleMatch: 80`, matching
  // Streamik's own scale), the full regression Streamik hit live: a same-week "House of the
  // Dragon" S01E01 must not outrank the real "Dr. House" S01E01 even as a much larger file.
  it("ranks the real 'Dr. House' S01E01 above a same-week 'House of the Dragon' S01E01 even as a huge remux", () => {
    const options = {
      knownTitles: ["House", "Dr. House"],
      weights: { titleMatch: 80 },
      strictTitleMatch: true,
      allowNegativeTotal: true,
      season: 1,
      episode: 1,
      languagePriority: ["cs"],
      sizeBonusPerGiB: 1,
    };

    const realHouse = scoreSource(
      { title: "Dr. House S01E01 CZ SK Dabing 1080p", languages: ["cs"], size: 2 * 1024 ** 3 },
      options
    );
    const houseOfTheDragon = scoreSource(
      {
        title: "House of the Dragon S01E01 2160p BluRay REMUX HEVC CZ Dabing",
        languages: ["cs"],
        size: 60 * 1024 ** 3,
      },
      options
    );
    expect(realHouse.score).toBeGreaterThan(houseOfTheDragon.score);
  });

  it("gives a confident non-match a strong negative title score only when strictTitleMatch is set", () => {
    const lenient = scoreSource({ title: "Completely Unrelated" }, { knownTitles });
    const strict = scoreSource({ title: "Completely Unrelated" }, { knownTitles, strictTitleMatch: true });
    expect(lenient.breakdown.titleMatch.score).toBe(0);
    expect(strict.breakdown.titleMatch.score).toBeLessThan(0);
  });
});
