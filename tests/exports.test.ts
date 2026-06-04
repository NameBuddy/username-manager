import { describe, expect, it } from "vitest";
import { serializeCandidates } from "@/lib/exports";

const candidates = [
  {
    nameOriginal: "Gojo",
    nameNormalized: "gojo",
    category: { name: "Anime & Manga" },
    tags: [{ tag: { name: "Jujutsu Kaisen" } }, { tag: { name: "Character" } }],
    labels: [{ label: { name: "Watchlist" } }],
    score: null,
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
      "Gojo,gojo,Anime & Manga,Watchlist,2026-06-04T00:00:00.000Z,",
    );
  });

  it("exports structured json", () => {
    expect(JSON.parse(serializeCandidates(candidates, "json"))).toEqual([
      {
        name: "Gojo",
        normalizedName: "gojo",
        category: "Anime & Manga",
        labels: ["Watchlist"],
        createdAt: "2026-06-04T00:00:00.000Z",
        lastCheckedAt: null,
      },
    ]);
  });
});
