import { describe, expect, it } from "vitest";
import {
  buildFuzzyKey,
  normalizeUsername,
  slugify,
  validateMinecraftUsername,
} from "@/lib/names";

describe("username normalization", () => {
  it("trims, lowercases, normalizes unicode, and removes unsupported characters", () => {
    expect(normalizeUsername("  GÓJØ!!_99  ")).toBe("goj_99");
  });

  it("keeps exact duplicates stable after normalization", () => {
    expect(normalizeUsername(" GOJO ")).toBe(normalizeUsername("gojo"));
  });
});

describe("minecraft username validation", () => {
  it("accepts 3 to 16 character names with letters, numbers, and underscores", () => {
    expect(validateMinecraftUsername("Gojo_99")).toEqual({ valid: true });
  });

  it("rejects names that are too short, too long, blank, or contain unsupported characters", () => {
    expect(validateMinecraftUsername("ab")).toEqual({ valid: false, reason: "Too short" });
    expect(validateMinecraftUsername("abcdefghijklmnopq")).toEqual({
      valid: false,
      reason: "Too long",
    });
    expect(validateMinecraftUsername("   ")).toEqual({ valid: false, reason: "Name is blank" });
    expect(validateMinecraftUsername("Gojo Satoru")).toEqual({
      valid: false,
      reason: "Contains unsupported character",
    });
  });
});

describe("fuzzy keys", () => {
  it("ignores underscores and order-like separators for warning-level comparisons", () => {
    expect(buildFuzzyKey("Satoru_Gojo")).toBe("satorugojo");
    expect(buildFuzzyKey("SatoruGojo")).toBe("satorugojo");
  });
});

describe("slugify", () => {
  it("creates lowercase URL-safe slugs", () => {
    expect(slugify("Tech / AI / Crypto")).toBe("tech-ai-crypto");
  });
});
