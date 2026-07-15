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
