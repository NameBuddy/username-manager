import { describe, expect, it } from "vitest";
import { candidateWhereFromParams, paginationFromParams } from "@/lib/filters";

function params(query: Record<string, string>) {
  return new URLSearchParams(query);
}

describe("paginationFromParams", () => {
  it("falls back to defaults for non-numeric page and pageSize", () => {
    expect(paginationFromParams(params({ page: "abc", pageSize: "xyz" }))).toEqual({
      page: 1,
      pageSize: 50,
      skip: 0,
      take: 50,
    });
  });

  it("clamps page and pageSize into their allowed ranges", () => {
    expect(paginationFromParams(params({ page: "-3", pageSize: "9999" }))).toMatchObject({ page: 1, pageSize: 200 });
    expect(paginationFromParams(params({ page: "2.9", pageSize: "3" }))).toMatchObject({ page: 2, pageSize: 10 });
  });
});

describe("candidateWhereFromParams", () => {
  it("ignores non-numeric length bounds instead of producing NaN filters", () => {
    const where = candidateWhereFromParams(params({ lengthMin: "abc", lengthMax: "10" }));
    expect(where.length).toEqual({ lte: 10 });

    const nothing = candidateWhereFromParams(params({ lengthMin: "abc" }));
    expect(nothing.length).toBeUndefined();
  });

  it("ignores invalid dates instead of producing Invalid Date filters", () => {
    const where = candidateWhereFromParams(params({ createdFrom: "not-a-date", createdTo: "2026-01-02" }));
    expect(where.createdAt).toEqual({ lte: new Date("2026-01-02") });
  });

  it("keeps both the label filter and the duplicate warning filter when combined", () => {
    const where = candidateWhereFromParams(params({ labelId: "label-1", duplicateStatus: "warning" }));
    expect(where.AND).toEqual([
      { labels: { some: { labelId: "label-1" } } },
      { labels: { some: { label: { slug: "duplicate-warning" } } } },
    ]);
  });

  it("applies a lone label filter", () => {
    const where = candidateWhereFromParams(params({ labelId: "label-1" }));
    expect(where.AND).toEqual([{ labels: { some: { labelId: "label-1" } } }]);
  });
});
