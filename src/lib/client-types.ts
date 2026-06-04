export type TaxonomyItem = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  color?: string | null;
  _count?: { candidates?: number; imports?: number };
};

export type SourceItem = {
  id: string;
  name: string;
  type?: string | null;
  url?: string | null;
  notes?: string | null;
  _count?: { candidates?: number; imports?: number };
};

export type CandidateItem = {
  id: string;
  nameOriginal: string;
  nameNormalized: string;
  length: number;
  categoryId?: string | null;
  sourceId?: string | null;
  score?: number | null;
  scoreReason?: string | null;
  candidateStatus: string;
  availabilityStatus: string;
  snipingStatus: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string | null;
  category?: TaxonomyItem | null;
  source?: SourceItem | null;
  tags: { tag: TaxonomyItem }[];
  labels: { label: TaxonomyItem }[];
  importRows?: {
    id: string;
    status?: string | null;
    reason?: string | null;
    importId: string;
    createdAt: string;
  }[];
  events?: {
    id: string;
    eventType: string;
    oldValue?: string | null;
    newValue?: string | null;
    createdAt: string;
    createdBy?: { email: string } | null;
  }[];
};

export type ImportItem = {
  id: string;
  filename?: string | null;
  fileType?: string | null;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  updatedCount: number;
  createdAt: string;
  source?: SourceItem | null;
  defaultCategory?: TaxonomyItem | null;
  createdBy?: { email: string } | null;
  _count?: { rows: number };
  rows?: {
    id: string;
    rawValue?: string | null;
    normalizedValue?: string | null;
    status?: string | null;
    reason?: string | null;
    candidate?: { id: string; nameOriginal: string; nameNormalized: string } | null;
  }[];
};

export const candidateStatuses = ["active", "needs_review", "ignored", "archived"];
export const availabilityStatuses = ["unknown", "pending_check", "available", "unavailable", "rate_limited", "error"];
export const snipingStatuses = ["none", "queued", "sniping", "sniped", "failed", "cancelled"];
export const sortOptions = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["score_desc", "Score high to low"],
  ["score_asc", "Score low to high"],
  ["az", "A to Z"],
  ["length_asc", "Length shortest first"],
  ["length_desc", "Length longest first"],
  ["last_checked", "Last checked"],
] as const;

