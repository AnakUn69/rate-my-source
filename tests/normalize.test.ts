import { describe, expect, it } from "vitest";
import { hasSeasonEpisodeMatch, normalizeTitle } from "../src/normalize.js";

describe("normalizeTitle", () => {
  it("lowercases, strips diacritics and punctuation", () => {
    expect(normalizeTitle("Sedmilhářky_2160p.CZ")).toBe("sedmilharky 2160p cz");
  });

  it("collapses punctuation to spaces without dropping ASCII letters", () => {
    expect(normalizeTitle("The Matrix: Reloaded (2003)")).toBe("the matrix reloaded 2003");
  });
});

// Every notation below was seen on real release listings across a broad sample of shows
// (Dr. House, Breaking Bad, Star Trek: Picard, 9-1-1, ...).
describe("hasSeasonEpisodeMatch", () => {
  it('matches the zero-padded "S01E01" convention', () => {
    expect(hasSeasonEpisodeMatch("dr house s01e01 cz dab 1080p", 1, 1)).toBe(true);
  });

  it('matches unpadded "S5E14" for a real double-digit episode (e.g. Breaking Bad)', () => {
    expect(hasSeasonEpisodeMatch("breaking bad s5e14 ozymandias cs", 5, 14)).toBe(true);
  });

  it('matches the fully unpadded "1x1" convention', () => {
    expect(hasSeasonEpisodeMatch("dr house 1x1 pilotni dil 1080p", 1, 1)).toBe(true);
  });

  it('matches the Czech spelled-out "Řada N - Epizoda M" convention', () => {
    expect(hasSeasonEpisodeMatch("9 1 1 texas rada 3 epizoda 1", 3, 1)).toBe(true);
  });

  it("does not match a different season/episode in the same title", () => {
    expect(hasSeasonEpisodeMatch("dr house s02e01 cz dab", 1, 1)).toBe(false);
  });

  it("does not false-positive-match a larger number containing the token as a substring", () => {
    expect(hasSeasonEpisodeMatch("show 11x12 1080p", 1, 1)).toBe(false);
  });

  it("does not false-positive-match a resolution string", () => {
    expect(hasSeasonEpisodeMatch("movie 2024 3840x2160 hdr", 1, 1)).toBe(false);
  });
});
