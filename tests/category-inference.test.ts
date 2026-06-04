import { afterEach, describe, expect, it, vi } from "vitest";
import {
  autoFillMissingImportCategories,
  inferCategoriesWithDeepSeek,
} from "@/lib/category-inference";

describe("autoFillMissingImportCategories", () => {
  it("fills only rows missing categories when no default category is set", async () => {
    const infer = vi.fn(async () => new Map([["gojo", "Anime & Manga"]]));

    const rows = await autoFillMissingImportCategories({
      rows: [{ name: "Gojo" }, { name: "Mario", category: "Game Characters" }],
      defaults: {},
      existingCategories: ["Anime & Manga", "Game Characters"],
      enabled: true,
      infer,
    });

    expect(infer).toHaveBeenCalledWith(["Gojo"], ["Anime & Manga", "Game Characters"]);
    expect(rows).toEqual([
      { name: "Gojo", category: "Anime & Manga" },
      { name: "Mario", category: "Game Characters" },
    ]);
  });

  it("does not call deepseek when disabled or a default category exists", async () => {
    const infer = vi.fn(async () => new Map<string, string>());

    await expect(
      autoFillMissingImportCategories({
        rows: [{ name: "Gojo" }],
        defaults: {},
        existingCategories: ["Anime & Manga"],
        enabled: false,
        infer,
      }),
    ).resolves.toEqual([{ name: "Gojo" }]);

    await expect(
      autoFillMissingImportCategories({
        rows: [{ name: "Gojo" }],
        defaults: { category: "Anime & Manga" },
        existingCategories: ["Anime & Manga"],
        enabled: true,
        infer,
      }),
    ).resolves.toEqual([{ name: "Gojo" }]);

    expect(infer).not.toHaveBeenCalled();
  });
});

describe("inferCategoriesWithDeepSeek", () => {
  const originalApiKey = process.env.DEEPSEEK_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = originalApiKey;
    }
  });

  it("requests strict json category assignments from deepseek-v4-flash", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      void url;
      void init;
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                assignments: [{ name: "Gojo", category: "Anime & Manga" }],
              }),
            },
          },
        ],
      });
    });

    await expect(
      inferCategoriesWithDeepSeek(["Gojo"], ["Anime & Manga", "Game Characters"], fetcher),
    ).resolves.toEqual(new Map([["gojo", "Anime & Manga"]]));

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "deepseek-v4-flash",
      response_format: { type: "json_object" },
      stream: false,
    });
    expect(body.messages[0].content).toContain("json");
  });

  it("requires DEEPSEEK_API_KEY", async () => {
    delete process.env.DEEPSEEK_API_KEY;

    await expect(inferCategoriesWithDeepSeek(["Gojo"], ["Anime & Manga"])).rejects.toThrow(
      "DEEPSEEK_API_KEY is required",
    );
  });
});
