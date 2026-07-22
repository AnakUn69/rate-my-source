import { describe, expect, it } from "vitest";
import { formatQualityLabel, getQualityRank, inferQualityFromFilename, isNativeQualityLabel } from "../src/quality-rank.js";

describe("getQualityRank", () => {
  it("ranks resolutions from the label, highest first", () => {
    expect(getQualityRank("2160p")).toBe(2160);
    expect(getQualityRank("4K")).toBe(2160);
    expect(getQualityRank("1080p")).toBe(1080);
    expect(getQualityRank("720")).toBe(720);
    expect(getQualityRank("unknown")).toBe(0);
  });

  it("ranks native/original the same as 1080p, not as a super-tier above 4K", () => {
    expect(getQualityRank("original")).toBe(1080);
    expect(getQualityRank("native")).toBe(1080);
    expect(getQualityRank("original")).toBeLessThan(getQualityRank("2160p"));
  });

  it('ranks a compound "Original (<resolution>)" label as the native tier', () => {
    expect(getQualityRank("Original (1080p)")).toBe(1080);
    expect(getQualityRank("Original (2160p)")).toBe(1080);
  });
});

describe("formatQualityLabel", () => {
  it('appends "p" to bare resolution numbers', () => {
    expect(formatQualityLabel("1080")).toBe("1080p");
  });

  it('normalizes native/original to "Original"', () => {
    expect(formatQualityLabel("native")).toBe("Original");
    expect(formatQualityLabel("original")).toBe("Original");
  });

  it("uppercases anything else", () => {
    expect(formatQualityLabel("archive")).toBe("ARCHIVE");
  });
});

describe("inferQualityFromFilename", () => {
  it("extracts resolution tokens from a filename", () => {
    expect(inferQualityFromFilename("Andor.S01E02.2160p.CZ.mkv")).toBe("2160p");
    expect(inferQualityFromFilename("Movie.720p.mkv")).toBe("720p");
  });

  it("maps 4k to 2160p", () => {
    expect(inferQualityFromFilename("Movie.4K.HDR.mkv")).toBe("2160p");
  });

  it("returns empty string when nothing matches", () => {
    expect(inferQualityFromFilename("Movie.CZ.mkv")).toBe("");
    expect(inferQualityFromFilename(undefined)).toBe("");
  });
});

describe("isNativeQualityLabel", () => {
  it("recognizes native/original/archive labels", () => {
    expect(isNativeQualityLabel("Original")).toBe(true);
    expect(isNativeQualityLabel("archive")).toBe(true);
    expect(isNativeQualityLabel("1080")).toBe(false);
  });
});
