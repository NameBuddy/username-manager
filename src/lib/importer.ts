import Papa from "papaparse";
import { lookupMinecraftProfile, type MinecraftProfile } from "@/lib/mojang";
import { buildFuzzyKey, normalizeUsername, slugify, uniqueNonEmpty, validateMinecraftUsername } from "@/lib/names";

export type ImportFormat = "txt" | "csv" | "json";

export type ParsedImportRow = {
  name: string;
  category?: string;
  tags?: string[];
  labels?: string[];
  source?: string;
  notes?: string;
  candidateStatus?: string;
  availabilityStatus?: string;
};

export type ImportDefaults = {
  category?: string;
  tags?: string[];
  labels?: string[];
  source?: string;
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
  minecraftProfileId: string | null;
  minecraftProfileName: string | null;
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

function compactRow(row: ParsedImportRow): ParsedImportRow {
  const compact: ParsedImportRow = { name: row.name };

  if (row.category) compact.category = row.category;
  if (row.tags?.length) compact.tags = row.tags;
  if (row.labels?.length) compact.labels = row.labels;
  if (row.source) compact.source = row.source;
  if (row.notes) compact.notes = row.notes;
  if (row.candidateStatus) compact.candidateStatus = row.candidateStatus;
  if (row.availabilityStatus) compact.availabilityStatus = row.availabilityStatus;

  return compact;
}

function normalizeRecord(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim(), typeof value === "string" ? value.trim() : value]),
  );
}

function readField(row: Record<string, unknown>, field?: string) {
  const target = field?.trim().toLowerCase();
  if (!target) {
    return undefined;
  }

  for (const [key, value] of Object.entries(row)) {
    if (key.trim().toLowerCase() === target) {
      return value;
    }
  }

  return undefined;
}

function readMapped(
  row: Record<string, unknown>,
  key: keyof NonNullable<ParsePayloadInput["columnMap"]>,
  map: ParsePayloadInput["columnMap"] = {},
) {
  return readField(row, map[key]) ?? readField(row, key);
}

function textFrom(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  const text = String(value).trim();
  return text || undefined;
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
    const parsed = JSON.parse(input.content) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("JSON import must be an array");
    }
    const map = input.columnMap ?? {};
    return parsed
      .map((rawRow) => {
        if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) {
          return compactRow({ name: "" });
        }
        const row = normalizeRecord(rawRow as Record<string, unknown>);

        return compactRow({
          name: String(readMapped(row, "name", map) ?? readField(row, "username") ?? readField(row, "candidate") ?? "").trim(),
          category: textFrom(readMapped(row, "category", map)),
          labels: uniqueNonEmpty([
            ...splitList(readMapped(row, "labels", map)),
            ...splitList(readMapped(row, "notes", map)),
          ]),
        });
      })
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
      const mappedRow = normalizeRecord(row);

      return compactRow({
        name: String(readMapped(mappedRow, "name", map) ?? readField(mappedRow, "username") ?? readField(mappedRow, "candidate") ?? "").trim(),
        category: textFrom(readMapped(mappedRow, "category", map)),
        labels: uniqueNonEmpty([
          ...splitList(readMapped(mappedRow, "labels", map)),
          ...splitList(readMapped(mappedRow, "notes", map)),
        ]),
      });
    })
    .filter((row) => row.name);
}

function mergeDefaults(row: ParsedImportRow, defaults: ImportDefaults) {
  return {
    name: row.name,
    category: row.category ?? defaults.category ?? null,
    tags: [],
    labels: uniqueNonEmpty([...(defaults.labels ?? []), ...(row.labels ?? [])]),
    source: null,
    score: null,
    notes: null,
    candidateStatus: "active",
    availabilityStatus: "unknown",
  };
}

export async function lookupMinecraftProfilesForImportRows(rows: ParsedImportRow[]) {
  const namesByNormalized = new Map<string, string>();

  for (const row of rows) {
    if (!validateMinecraftUsername(row.name).valid) {
      continue;
    }
    namesByNormalized.set(normalizeUsername(row.name), row.name);
  }

  const entries = await Promise.all(
    [...namesByNormalized.entries()].map(async ([normalized, name]) => [
      normalized,
      await lookupMinecraftProfile(name),
    ] as const),
  );

  return new Map(entries);
}

export function buildImportPreview(input: {
  rows: ParsedImportRow[];
  defaults?: ImportDefaults;
  existingCandidates: ExistingCandidateForPreview[];
  existingCategories: string[];
  existingTags: string[];
  existingLabels: string[];
  minecraftProfiles?: Map<string, MinecraftProfile | null>;
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
    let minecraftProfileId: string | null = null;
    let minecraftProfileName: string | null = null;

    if (!validation.valid) {
      status = "invalid";
      reason = validation.reason;
    } else if (!row.category) {
      status = "invalid";
      reason = "Category is required";
    } else if (existing || duplicateInImport) {
      status = "duplicate";
      reason = existing ? "Exact duplicate already exists" : "Exact duplicate in import";
      duplicateCandidateId = existing?.id ?? null;
    } else if (input.minecraftProfiles) {
      const profile = input.minecraftProfiles.get(normalized);
      if (!profile) {
        status = "invalid";
        reason = "No Minecraft profile found";
      } else {
        minecraftProfileId = profile.id;
        minecraftProfileName = profile.name;
      }
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
      minecraftProfileId,
      minecraftProfileName,
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
