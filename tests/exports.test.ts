import { describe, expect, it } from "vitest";
import { serializeCandidates } from "@/lib/exports";

const candidates = [
  {
    nameOriginal: "Gojo",
    nameNormalized: "gojo",
    category: { name: "Anime & Manga" },
    tags: [{ tag: { name: "Jujutsu Kaisen" } }, { tag: { name: "Character" } }],
    labels: [{ label: { name: "High Value" } }],
    score: 95,
    candidateStatus: "active",
    availabilityStatus: "pending_check",
    snipingStatus: "none",
    source: { name: "Manual Import" },
    notes: "Main character",
    createdAt: new Date("2026-06-04T00:00:00.000Z"),
    lastCheckedAt: null,
  },
];

describe("serializeCandidates", () => {
  it("exports txt with one original name per line", () => {
    expect(serializeCandidates(candidates, "txt")).toBe("Gojo\n");
  });

  it("exports csv metadata with quoted collection fields", () => {
    expect(serializeCandidates(candidates, "csv")).toContain(
      'Gojo,gojo,Anime & Manga,"Jujutsu Kaisen, Character",High Value,95,active,pending_check,none,Manual Import,2026-06-04T00:00:00.000Z,,Main character',
    );
  });

  it("exports structured json", () => {
    expect(JSON.parse(serializeCandidates(candidates, "json"))).toEqual([
      {
        name: "Gojo",
        normalizedName: "gojo",
        category: "Anime & Manga",
        tags: ["Jujutsu Kaisen", "Character"],
        labels: ["High Value"],
        score: 95,
        candidateStatus: "active",
        availabilityStatus: "pending_check",
        snipingStatus: "none",
        source: "Manual Import",
        notes: "Main character",
        createdAt: "2026-06-04T00:00:00.000Z",
        lastCheckedAt: null,
      },
    ]);
  });
});

