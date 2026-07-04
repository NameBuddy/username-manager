import type { Prisma } from "@prisma/client";

export function candidateInclude() {
  return {
    category: true,
    source: true,
    tags: { include: { tag: true }, orderBy: { tag: { name: "asc" as const } } },
    labels: { include: { label: true }, orderBy: { label: { name: "asc" as const } } },
  };
}

export function candidateDetailInclude() {
  return {
    ...candidateInclude(),
    importRows: {
      include: { import: true },
      orderBy: { createdAt: "desc" as const },
      take: 10,
    },
    events: {
      include: { createdBy: { select: { email: true } } },
      orderBy: { createdAt: "desc" as const },
      take: 50,
    },
  };
}

function toFiniteNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toValidDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateRange(params: URLSearchParams, fromKey: string, toKey: string) {
  const from = toValidDate(params.get(fromKey));
  const to = toValidDate(params.get(toKey));
  const range: Prisma.DateTimeNullableFilter = {};

  if (from) range.gte = from;
  if (to) range.lte = to;
  return Object.keys(range).length ? range : undefined;
}

function intRange(params: URLSearchParams, minKey: string, maxKey: string) {
  const min = toFiniteNumber(params.get(minKey));
  const max = toFiniteNumber(params.get(maxKey));
  const range: Prisma.IntNullableFilter = {};

  if (min !== null) range.gte = min;
  if (max !== null) range.lte = max;
  return Object.keys(range).length ? range : undefined;
}

export function candidateWhereFromParams(params: URLSearchParams): Prisma.CandidateWhereInput {
  const where: Prisma.CandidateWhereInput = {};
  const search = params.get("search")?.trim();
  const categoryId = params.get("categoryId");
  const tagId = params.get("tagId");
  const labelId = params.get("labelId");
  const sourceId = params.get("sourceId");
  const candidateStatus = params.get("candidateStatus");
  const availabilityStatus = params.get("availabilityStatus");
  const source = params.get("source")?.trim();
  const duplicateStatus = params.get("duplicateStatus");
  const lengthRange = intRange(params, "lengthMin", "lengthMax") as Prisma.IntFilter | undefined;
  const createdRange = dateRange(params, "createdFrom", "createdTo") as Prisma.DateTimeFilter | undefined;
  const lastCheckedRange = dateRange(params, "lastCheckedFrom", "lastCheckedTo");

  if (search) {
    where.OR = [
      { nameOriginal: { contains: search, mode: "insensitive" } },
      { nameNormalized: { contains: search.toLowerCase(), mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ];
  }

  if (categoryId) where.categoryId = categoryId;
  if (sourceId) where.sourceId = sourceId;
  if (candidateStatus) where.candidateStatus = candidateStatus;
  if (availabilityStatus) where.availabilityStatus = availabilityStatus;
  if (source) where.source = { name: { contains: source, mode: "insensitive" } };
  if (tagId) where.tags = { some: { tagId } };
  if (lengthRange) where.length = lengthRange;
  if (createdRange) where.createdAt = createdRange;
  if (lastCheckedRange) where.lastCheckedAt = lastCheckedRange;

  const labelConditions: Prisma.CandidateWhereInput[] = [];
  if (labelId) labelConditions.push({ labels: { some: { labelId } } });
  if (duplicateStatus === "warning") {
    labelConditions.push({ labels: { some: { label: { slug: "duplicate-warning" } } } });
  }
  if (labelConditions.length) where.AND = labelConditions;

  return where;
}

export function candidateOrderByFromParams(params: URLSearchParams): Prisma.CandidateOrderByWithRelationInput {
  switch (params.get("sort")) {
    case "oldest":
      return { createdAt: "asc" };
    case "az":
      return { nameNormalized: "asc" };
    case "length_asc":
      return { length: "asc" };
    case "length_desc":
      return { length: "desc" };
    case "last_checked":
      return { lastCheckedAt: { sort: "desc", nulls: "last" } };
    default:
      return { createdAt: "desc" };
  }
}

export function paginationFromParams(params: URLSearchParams) {
  const page = Math.max(1, Math.trunc(toFiniteNumber(params.get("page")) ?? 1));
  const pageSize = Math.min(200, Math.max(10, Math.trunc(toFiniteNumber(params.get("pageSize")) ?? 50)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
