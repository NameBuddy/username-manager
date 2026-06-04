export type ExportFormat = "txt" | "csv" | "json";

export type ExportCandidate = {
  nameOriginal: string;
  nameNormalized: string;
  category: { name: string } | null;
  tags: { tag: { name: string } }[];
  labels: { label: { name: string } }[];
  candidateStatus: string;
  availabilityStatus: string;
  snipingStatus: string;
  source: { name: string } | null;
  notes: string | null;
  createdAt: Date;
  lastCheckedAt: Date | null;
};

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toExportObject(candidate: ExportCandidate) {
  return {
    name: candidate.nameOriginal,
    normalizedName: candidate.nameNormalized,
    category: candidate.category?.name ?? null,
    labels: candidate.labels.map(({ label }) => label.name),
    createdAt: candidate.createdAt.toISOString(),
    lastCheckedAt: candidate.lastCheckedAt?.toISOString() ?? null,
  };
}

export function serializeCandidates(candidates: ExportCandidate[], format: ExportFormat): string {
  if (format === "txt") {
    return candidates.map((candidate) => candidate.nameOriginal).join("\n") + (candidates.length ? "\n" : "");
  }

  if (format === "json") {
    return JSON.stringify(candidates.map(toExportObject), null, 2);
  }

  const header = [
    "name",
    "normalized_name",
    "category",
    "labels",
    "created_at",
    "last_checked_at",
  ];

  const rows = candidates.map((candidate) => [
    candidate.nameOriginal,
    candidate.nameNormalized,
    candidate.category?.name ?? "",
    candidate.labels.map(({ label }) => label.name).join(", "),
    candidate.createdAt.toISOString(),
    candidate.lastCheckedAt?.toISOString() ?? "",
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n") + "\n";
}

export function contentTypeForExport(format: ExportFormat): string {
  if (format === "json") {
    return "application/json; charset=utf-8";
  }
  if (format === "csv") {
    return "text/csv; charset=utf-8";
  }
  return "text/plain; charset=utf-8";
}
