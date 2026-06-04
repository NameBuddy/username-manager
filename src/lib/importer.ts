import Papa from "papaparse";
import { buildFuzzyKey, normalizeUsername, slugify, uniqueNonEmpty, validateMinecraftUsername } from "@/lib/names";

export type ImportFormat = "txt" | "csv" | "json";

export type ParsedImportRow = {
  name: string;
  category?: string;
  tags?: string[];
  labels?: string[];
  score?: number;
  source?: string;
  notes?: string;
  scoreReason?: string;
  candidateStatus?: string;
  availabilityStatus?: string;
};

export type ImportDefaults = {
  category?: string;
  tags?: string[];
  labels?: string[];
  source?: string;
  score?: number;
  notes?: string;
  candidateStatus?: string;
  availabilityStatus?: string;
};

export type ExistingCandidateForPreview = {
  id: string;
  nameNormalized: string;
  nameOriginal: string;
};

export type ImportPreviewRow = {
  rowNumber: number;
  nameOriginal: string;
  nameNormalized: string;
  length: number;
  category: string | null;
  tags: string[];
  labels: string[];
  source: string | null;
  score: number | null;
  notes: string | null;
  candidateStatus: string;
  availabilityStatus: string;
  status: "valid" | "invalid" | "duplicate";
  reason: string | null;
  duplicateCandidateId: string | null;
  fuzzyDuplicateNames: string[];
};

export type ImportPreview = {
  rows: ImportPreviewRow[];
  newCategories: string[];
  newTags: string[];
  newLabels: string[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    exactDuplicates: number;
    fuzzyDuplicates: number;
  };
};

type ParsePayloadInput = {
  type: ImportFormat;
  content: string;
  columnMap?: Partial<Record<"name" | "category" | "tags" | "labels" | "score" | "source" | "notes", string>>;
};

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueNonEmpty(value.map(String));
  }
  if (typeof value !== "string") {
    return [];
  }
  return uniqueNonEmpty(value.split(/[,;|]/g));
}

function scoreFrom(value: unknown): number | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function compactRow(row: ParsedImportRow): ParsedImportRow {
  const compact: ParsedImportRow = { name: row.name };

  if (row.category) compact.category = row.category;
  if (row.tags?.length) compact.tags = row.tags;
  if (row.labels?.length) compact.labels = row.labels;
  if (typeof row.score === "number") compact.score = row.score;
  if (row.source) compact.source = row.source;
  if (row.notes) compact.notes = row.notes;
  if (row.scoreReason) compact.scoreReason = row.scoreReason;
  if (row.candidateStatus) compact.candidateStatus = row.candidateStatus;
  if (row.availabilityStatus) compact.availabilityStatus = row.availabilityStatus;

  return compact;
}

function readMapped(row: Record<string, unknown>, key: keyof NonNullable<ParsePayloadInput["columnMap"]>) {
  return row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
}

export function parseImportPayload(input: ParsePayloadInput): ParsedImportRow[] {
  if (input.type === "txt") {
    return input.content
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  }

  if (input.type === "json") {
    const parsed = JSON.parse(input.content) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) {
      throw new Error("JSON import must be an array");
    }
    return parsed
      .map((row) => compactRow({
        name: String(row.name ?? row.username ?? "").trim(),
        category: typeof row.category === "string" ? row.category : undefined,
        tags: splitList(row.tags),
        labels: splitList(row.labels),
        score: scoreFrom(row.score),
        source: typeof row.source === "string" ? row.source : undefined,
        notes: typeof row.notes === "string" ? row.notes : undefined,
        scoreReason: typeof row.scoreReason === "string" ? row.scoreReason : undefined,
      }))
      .filter((row) => row.name);
  }

  const result = Papa.parse<Record<string, unknown>>(input.content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length) {
    throw new Error(result.errors[0]?.message ?? "CSV parse failed");
  }

  const map = input.columnMap ?? {};
  return result.data
    .map((row) => {
      const mappedRow = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.trim(), typeof value === "string" ? value.trim() : value]),
      );

      return compactRow({
        name: String(mappedRow[map.name ?? "name"] ?? mappedRow.username ?? mappedRow.candidate ?? "").trim(),
        category: String(mappedRow[map.category ?? "category"] ?? readMapped(mappedRow, "category") ?? "").trim() || undefined,
        tags: splitList(mappedRow[map.tags ?? "tags"] ?? readMapped(mappedRow, "tags")),
        labels: splitList(mappedRow[map.labels ?? "labels"] ?? readMapped(mappedRow, "labels")),
        score: scoreFrom(mappedRow[map.score ?? "score"] ?? readMapped(mappedRow, "score")),
        source: String(mappedRow[map.source ?? "source"] ?? readMapped(mappedRow, "source") ?? "").trim() || undefined,
        notes: String(mappedRow[map.notes ?? "notes"] ?? readMapped(mappedRow, "notes") ?? "").trim() || undefined,
      });
    })
    .filter((row) => row.name);
}

function mergeDefaults(row: ParsedImportRow, defaults: ImportDefaults) {
  return {
    name: row.name,
    category: row.category ?? defaults.category ?? null,
    tags: uniqueNonEmpty([...(defaults.tags ?? []), ...(row.tags ?? [])]),
    labels: uniqueNonEmpty([...(defaults.labels ?? []), ...(row.labels ?? [])]),
    source: row.source ?? defaults.source ?? null,
    score: row.score ?? defaults.score ?? null,
    notes: row.notes ?? defaults.notes ?? null,
    candidateStatus: row.candidateStatus ?? defaults.candidateStatus ?? "active",
    availabilityStatus: row.availabilityStatus ?? defaults.availabilityStatus ?? "unknown",
  };
}

export function buildImportPreview(input: {
  rows: ParsedImportRow[];
  defaults?: ImportDefaults;
  existingCandidates: ExistingCandidateForPreview[];
  existingCategories: string[];
  existingTags: string[];
  existingLabels: string[];
}): ImportPreview {
  const defaults = input.defaults ?? {};
  const existingByNormalized = new Map(input.existingCandidates.map((candidate) => [candidate.nameNormalized, candidate]));
  const existingByFuzzy = new Map<string, string[]>();

  for (const candidate of input.existingCandidates) {
    const key = buildFuzzyKey(candidate.nameOriginal);
    existingByFuzzy.set(key, [...(existingByFuzzy.get(key) ?? []), candidate.nameOriginal]);
  }

  const seenInImport = new Map<string, ImportPreviewRow>();
  const categorySet = new Set(input.existingCategories.map((name) => slugify(name)));
  const tagSet = new Set(input.existingTags.map((name) => slugify(name)));
  const labelSet = new Set(input.existingLabels.map((name) => slugify(name)));
  const newCategories = new Set<string>();
  const newTags = new Set<string>();
  const newLabels = new Set<string>();

  const rows = input.rows.map((rawRow, index): ImportPreviewRow => {
    const row = mergeDefaults(rawRow, defaults);
    const validation = validateMinecraftUsername(row.name);
    const normalized = normalizeUsername(row.name);
    const existing = existingByNormalized.get(normalized);
    const duplicateInImport = seenInImport.get(normalized);
    const fuzzyKey = buildFuzzyKey(row.name);
    const fuzzyDuplicateNames = (existingByFuzzy.get(fuzzyKey) ?? []).filter(
      (name) => normalizeUsername(name) !== normalized,
    );

    let status: ImportPreviewRow["status"] = "valid";
    let reason: string | null = null;
    let duplicateCandidateId: string | null = null;

    if (!validation.valid) {
      status = "invalid";
      reason = validation.reason;
    } else if (existing || duplicateInImport) {
      status = "duplicate";
      reason = existing ? "Exact duplicate already exists" : "Exact duplicate in import";
      duplicateCandidateId = existing?.id ?? null;
    }

    const previewRow: ImportPreviewRow = {
      rowNumber: index + 1,
      nameOriginal: row.name.trim(),
      nameNormalized: normalized,
      length: normalized.length,
      category: row.category,
      tags: row.tags,
      labels: row.labels,
      source: row.source,
      score: row.score,
      notes: row.notes,
      candidateStatus: row.candidateStatus,
      availabilityStatus: row.availabilityStatus,
      status,
      reason,
      duplicateCandidateId,
      fuzzyDuplicateNames,
    };

    if (status === "valid") {
      seenInImport.set(normalized, previewRow);
    }

    if (row.category && !categorySet.has(slugify(row.category))) {
      newCategories.add(row.category);
    }
    for (const tag of row.tags) {
      if (!tagSet.has(slugify(tag))) {
        newTags.add(tag);
      }
    }
    for (const label of row.labels) {
      if (!labelSet.has(slugify(label))) {
        newLabels.add(label);
      }
    }

    return previewRow;
  });

  return {
    rows,
    newCategories: [...newCategories],
    newTags: [...newTags],
    newLabels: [...newLabels],
    summary: {
      totalRows: rows.length,
      validRows: rows.filter((row) => row.status === "valid").length,
      invalidRows: rows.filter((row) => row.status === "invalid").length,
      exactDuplicates: rows.filter((row) => row.status === "duplicate").length,
      fuzzyDuplicates: rows.filter((row) => row.fuzzyDuplicateNames.length > 0).length,
    },
  };
}
