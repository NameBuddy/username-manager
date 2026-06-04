import { describe, expect, it } from "vitest";
import { buildImportPreview, parseImportPayload } from "@/lib/importer";

const baseDefaults = {
  category: "Anime & Manga",
  tags: ["Jujutsu Kaisen"],
  labels: ["Pending Check"],
  source: "Manual Import",
  score: 80,
  candidateStatus: "active",
  availabilityStatus: "pending_check",
  notes: "",
};

describe("parseImportPayload", () => {
  it("parses pasted text, csv, and json rows into candidate inputs", () => {
    expect(parseImportPayload({ type: "txt", content: "Gojo\nSukuna" })).toHaveLength(2);
    expect(
      parseImportPayload({
        type: "csv",
        content:
          'username,type,group,workflow\nGojo,Anime & Manga,"Jujutsu Kaisen,Character","High Value"',
        columnMap: {
          name: "username",
          category: "type",
          tags: "group",
          labels: "workflow",
        },
      }),
    ).toEqual([
      {
        name: "Gojo",
        category: "Anime & Manga",
        tags: ["Jujutsu Kaisen", "Character"],
        labels: ["High Value"],
      },
    ]);
    expect(parseImportPayload({ type: "json", content: '[{"name":"Madara","tags":["Naruto"]}]' })).toEqual([
      { name: "Madara", tags: ["Naruto"] },
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
      existingLabels: ["Pending Check"],
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
    expect(preview.newTags).toEqual(["Jujutsu Kaisen"]);
    expect(preview.newCategories).toEqual([]);
  });
});

