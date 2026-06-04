import { describe, expect, it, vi } from "vitest";
import {
  buildImportPreview,
  lookupMinecraftProfilesForImportRows,
  normalizeImportContent,
  parseImportPayload,
} from "@/lib/importer";
import type { MinecraftProfile } from "@/lib/mojang";

const baseDefaults = {
  category: "Anime & Manga",
  labels: [],
  candidateStatus: "active",
  availabilityStatus: "pending_check",
  notes: "",
};

describe("parseImportPayload", () => {
  it("normalizes uploaded file line endings before parsing", () => {
    expect(normalizeImportContent("name,category\r\nCrown,English Words\r\n")).toBe("name,category\nCrown,English Words");
  });

  it("parses pasted text, csv, and json rows into candidate inputs", () => {
    expect(parseImportPayload({ type: "txt", content: "Gojo\nSukuna" })).toHaveLength(2);
    expect(
      parseImportPayload({
        type: "csv",
        content:
          'username,type,workflow,notes,score\nGojo,Anime & Manga,"Watchlist","Clean",99',
        columnMap: {
          name: "username",
          category: "type",
          labels: "workflow",
        },
      }),
    ).toEqual([
      {
        name: "Gojo",
        category: "Anime & Manga",
        labels: ["Watchlist", "Clean"],
      },
    ]);
    expect(parseImportPayload({ type: "json", content: '[{"name":"Madara","labels":["Naruto"]}]' })).toEqual([
      { name: "Madara", labels: ["Naruto"] },
    ]);
  });

  it("uses field mapping for json imports", () => {
    expect(
      parseImportPayload({
        type: "json",
        content: '[{"username":"Gojo","type":"Anime & Manga","group":["Jujutsu Kaisen"],"origin":"Manual"}]',
        columnMap: {
          name: "username",
          category: "type",
          labels: "group",
        },
      }),
    ).toEqual([
      {
        name: "Gojo",
        category: "Anime & Manga",
        labels: ["Jujutsu Kaisen"],
      },
    ]);
  });

  it("parses single-column csv imports without treating delimiter warnings as fatal", () => {
    expect(parseImportPayload({ type: "csv", content: "name\nCrown\nRoyal\nPenis" })).toEqual([
      { name: "Crown" },
      { name: "Royal" },
      { name: "Penis" },
    ]);
  });
});

describe("buildImportPreview", () => {
  it("classifies valid, invalid, exact duplicate, and fuzzy duplicate rows", () => {
    const preview = buildImportPreview({
      rows: [
        { name: "Gojo" },
        { name: " gojo " },
        { name: "Satoru_Gojo" },
        { name: "ab" },
      ],
      defaults: baseDefaults,
      existingCandidates: [{ id: "existing-1", nameNormalized: "satorugojo", nameOriginal: "SatoruGojo" }],
      existingCategories: ["Anime & Manga"],
      existingTags: [],
      existingLabels: ["Watchlist"],
      minecraftProfiles: new Map([
        ["gojo", { id: "d8d5a9237b2043d8883b1150148d6955", name: "Gojo" }],
        ["satoru_gojo", { id: "11111111111111111111111111111111", name: "Satoru_Gojo" }],
      ]),
    });

    expect(preview.summary).toMatchObject({
      totalRows: 4,
      validRows: 2,
      invalidRows: 1,
      exactDuplicates: 1,
      fuzzyDuplicates: 1,
    });
    expect(preview.rows.map((row) => row.status)).toEqual([
      "valid",
      "duplicate",
      "valid",
      "invalid",
    ]);
    expect(preview.newTags).toEqual([]);
    expect(preview.newCategories).toEqual([]);
  });

  it("requires a category for every import row", () => {
    const preview = buildImportPreview({
      rows: [{ name: "Test" }],
      defaults: {},
      existingCandidates: [],
      existingCategories: [],
      existingTags: [],
      existingLabels: [],
      minecraftProfiles: new Map([["test", { id: "d8d5a9237b2043d8883b1150148d6955", name: "Test" }]]),
    });

    expect(preview.summary.invalidRows).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      status: "invalid",
      reason: "Category is required",
    });
  });

  it("filters out locally valid names that do not resolve to a Mojang profile UUID", () => {
    const preview = buildImportPreview({
      rows: [{ name: "Test" }, { name: "penis" }],
      defaults: baseDefaults,
      existingCandidates: [],
      existingCategories: ["Anime & Manga"],
      existingTags: [],
      existingLabels: [],
      minecraftProfiles: new Map([["test", { id: "d8d5a9237b2043d8883b1150148d6955", name: "Test" }]]),
    });

    expect(preview.summary).toMatchObject({
      validRows: 1,
      invalidRows: 1,
    });
    expect(preview.rows[0]).toMatchObject({
      status: "valid",
      minecraftProfileId: "d8d5a9237b2043d8883b1150148d6955",
    });
    expect(preview.rows[1]).toMatchObject({
      status: "invalid",
      reason: "No Minecraft profile found",
    });
  });
});

describe("lookupMinecraftProfilesForImportRows", () => {
  it("limits concurrent Mojang profile lookups", async () => {
    let activeLookups = 0;
    let maxActiveLookups = 0;
    const releaseLookup: Array<() => void> = [];

    const lookup = vi.fn(
      (name: string) =>
        new Promise<MinecraftProfile>((resolve) => {
          activeLookups += 1;
          maxActiveLookups = Math.max(maxActiveLookups, activeLookups);
          releaseLookup.push(() => {
            activeLookups -= 1;
            resolve({ id: "d8d5a9237b2043d8883b1150148d6955", name });
          });
        }),
    );

    const result = lookupMinecraftProfilesForImportRows(
      [{ name: "Crown" }, { name: "Royal" }, { name: "Noble" }],
      { lookup, concurrency: 2 },
    );

    await vi.waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
    releaseLookup.shift()?.();
    await vi.waitFor(() => expect(lookup).toHaveBeenCalledTimes(3));
    while (releaseLookup.length) releaseLookup.shift()?.();

    await expect(result).resolves.toHaveProperty("size", 3);
    expect(maxActiveLookups).toBe(2);
  });
});
