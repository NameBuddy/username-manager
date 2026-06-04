import type { ImportDefaults, ParsedImportRow } from "@/lib/importer";
import { normalizeUsername, slugify, uniqueNonEmpty } from "@/lib/names";

type CategoryInferer = (names: string[], existingCategories: string[]) => Promise<Map<string, string>>;

type AutoFillInput = {
  rows: ParsedImportRow[];
  defaults?: ImportDefaults;
  existingCategories: string[];
  enabled: boolean;
  infer?: CategoryInferer;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type DeepSeekCategoryJson = {
  assignments?: unknown;
};

function maxTokensFor(names: string[]) {
  return Math.max(600, Math.min(4000, 300 + names.length * 50));
}

function readText(value: unknown) {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

function buildCategoryMatcher(categories: string[]) {
  const bySlug = new Map<string, string>();
  for (const category of categories) {
    bySlug.set(slugify(category), category);
  }
  return (value: unknown) => {
    const text = readText(value);
    return text ? bySlug.get(slugify(text)) ?? null : null;
  };
}

function parseDeepSeekAssignments(content: string, categories: string[]) {
  const parsed = JSON.parse(content) as DeepSeekCategoryJson;
  const canonicalCategory = buildCategoryMatcher(categories);
  const assignments = Array.isArray(parsed.assignments) ? parsed.assignments : [];
  const result = new Map<string, string>();

  for (const assignment of assignments) {
    if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) {
      continue;
    }
    const row = assignment as Record<string, unknown>;
    const name = readText(row.name ?? row.username);
    const category = canonicalCategory(row.category);
    if (name && category) {
      result.set(normalizeUsername(name), category);
    }
  }

  return result;
}

export async function inferCategoriesWithDeepSeek(
  names: string[],
  existingCategories: string[],
  fetcher: typeof fetch = fetch,
) {
  const uniqueNames = uniqueNonEmpty(names);
  const categories = uniqueNonEmpty(existingCategories);

  if (!uniqueNames.length || !categories.length) {
    return new Map<string, string>();
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required to auto-fill import categories");
  }

  const systemPrompt = `You categorize Minecraft username candidates into existing categories.
Return only valid json. Do not use markdown.
Use exactly one category from the provided category list for every username.

EXAMPLE JSON OUTPUT:
{"assignments":[{"name":"Gojo","category":"Anime & Manga"}]}`;

  const userPrompt = `Available categories:
${categories.map((category) => `- ${category}`).join("\n")}

Candidate usernames:
${uniqueNames.map((name) => `- ${name}`).join("\n")}

Return json with this exact shape:
{"assignments":[{"name":"<same username>","category":"<one provided category>"}]}`;

  const response = await fetcher("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: maxTokensFor(uniqueNames),
      temperature: 0,
      stream: false,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`DeepSeek category inference failed (${response.status}): ${details.slice(0, 300)}`);
  }

  const body = (await response.json()) as DeepSeekResponse;
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("DeepSeek returned empty category json");
  }

  return parseDeepSeekAssignments(content, categories);
}

export async function autoFillMissingImportCategories({
  rows,
  defaults,
  existingCategories,
  enabled,
  infer = inferCategoriesWithDeepSeek,
}: AutoFillInput) {
  if (!enabled || defaults?.category?.trim()) {
    return rows;
  }

  const missingNames = uniqueNonEmpty(rows.filter((row) => !row.category?.trim()).map((row) => row.name));
  if (!missingNames.length || !existingCategories.length) {
    return rows;
  }

  const categoriesByName = await infer(missingNames, existingCategories);
  if (!categoriesByName.size) {
    return rows;
  }

  return rows.map((row) => {
    if (row.category?.trim()) {
      return row;
    }

    const category = categoriesByName.get(normalizeUsername(row.name));
    return category ? { ...row, category } : row;
  });
}

export const autoFillMissingCsvCategories = autoFillMissingImportCategories;
