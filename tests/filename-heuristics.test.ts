import { describe, expect, it } from "vitest";
import { detectHasSubtitles, detectLanguages, detectSuspiciousReason } from "../src/filename-heuristics.js";

describe("detectLanguages", () => {
  it("detects a genuine CZ dub", () => {
    expect(detectLanguages("Zelenáč S05E10 CZdab")).toEqual(["cs"]);
    expect(detectLanguages("Dr. House S01E01 CZ Dabing 1080p")).toEqual(["cs"]);
  });

  describe("CZ subtitles-only (not a dub)", () => {
    it('does not report "cs" for "CZ Titulky"', () => {
      expect(detectLanguages("Zelenáč S05E10 CZ Titulky")).toEqual([]);
    });

    it('does not report "cs" for the joined form "CZtitulky"', () => {
      expect(detectLanguages("Zelenáč S05E10 CZtitulky")).toEqual([]);
    });

    it('does not report "cs" for "CZ Sub"/"CZ Subs"', () => {
      expect(detectLanguages("Movie 2024 CZ Sub 1080p")).toEqual([]);
      expect(detectLanguages("Movie 2024 CZ Subs 1080p")).toEqual([]);
    });

    it('does not report "cs" for the bare abbreviation "CZ Tit"', () => {
      expect(detectLanguages("Rick and Morty S07E04 CZ Tit 1080p")).toEqual([]);
    });
  });

  it('still reports "cs" for a bare "CZ" with no dub or subtitle marker at all', () => {
    expect(detectLanguages("House.S01E01.Pilot.1080p.BluRay.x265 CZ")).toEqual(["cs"]);
  });

  it("reports \"cs\" when a dub marker is present even alongside a subtitle marker", () => {
    expect(detectLanguages("Show S01E01 CZ Dabing CZ Titulky")).toEqual(["cs"]);
  });

  it("applies the same subtitle-vs-dub distinction to SK", () => {
    expect(detectLanguages("Show S01E01 SK Titulky")).toEqual([]);
    expect(detectLanguages("Show S01E01 SKdab")).toEqual(["sk"]);
  });

  it('detects multiple dubbed languages together (e.g. "CZ SK Dabing")', () => {
    expect(detectLanguages("Dr. House S01E01 CZ SK Dabing 1080p")).toEqual(expect.arrayContaining(["cs", "sk"]));
  });

  it("detects English independently of the CZ/SK dub-vs-subtitle distinction", () => {
    expect(detectLanguages("Movie 2024 ENG 1080p")).toEqual(["en"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(detectLanguages("Show S01E01 1080p")).toEqual([]);
  });
});

describe("detectHasSubtitles", () => {
  it('detects "Titulky", "Sub"/"Subs", and "Subtitle"', () => {
    expect(detectHasSubtitles("Movie CZ Titulky")).toBe(true);
    expect(detectHasSubtitles("Movie CZ Sub")).toBe(true);
    expect(detectHasSubtitles("Movie CZ Subs")).toBe(true);
    expect(detectHasSubtitles("Movie EN Subtitle")).toBe(true);
    expect(detectHasSubtitles("Movie CZ Tit")).toBe(true);
  });

  it("returns false when there is no subtitle marker", () => {
    expect(detectHasSubtitles("Movie CZ Dabing 1080p")).toBe(false);
  });
});

describe("detectSuspiciousReason", () => {
  it("flags a cam/screener release and returns which marker matched", () => {
    expect(detectSuspiciousReason("Movie 2024 CAM")).toBe("CAM");
    expect(detectSuspiciousReason("Movie 2024 HDCAM")).toBe("HDCAM");
  });

  it("returns undefined for a clean release", () => {
    expect(detectSuspiciousReason("Movie 2024 BluRay 1080p")).toBeUndefined();
  });
});
