import { describe, expect, it } from "vitest";
import { normalizeLanguageCode } from "../src/language-codes.js";

describe("normalizeLanguageCode", () => {
  it("passes through already-two-letter codes unchanged (lowercased)", () => {
    expect(normalizeLanguageCode("cs")).toBe("cs");
    expect(normalizeLanguageCode("EN")).toBe("en");
  });

  it("maps common ISO 639-2/B three-letter codes to ISO 639-1", () => {
    expect(normalizeLanguageCode("cze")).toBe("cs");
    expect(normalizeLanguageCode("ces")).toBe("cs");
    expect(normalizeLanguageCode("slo")).toBe("sk");
    expect(normalizeLanguageCode("slk")).toBe("sk");
    expect(normalizeLanguageCode("eng")).toBe("en");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(normalizeLanguageCode(" CZE ")).toBe("cs");
  });

  it("passes through unrecognized codes lowercased", () => {
    expect(normalizeLanguageCode("FRA")).toBe("fra");
  });
});
