export const CLEAR_DATABASE_CONFIRMATION = "CLEAR_NAMEBUDDY_DB";

export const clearDatabaseDeleteOrder = [
  "candidateEvent",
  "candidateTag",
  "candidateLabel",
  "importRow",
  "candidate",
  "import",
  "tag",
  "label",
  "source",
  "category",
] as const;

type DeleteResult = { count: number };
type DeleteModel = { deleteMany: () => Promise<DeleteResult> };
type ClearTransaction = Record<(typeof clearDatabaseDeleteOrder)[number], DeleteModel>;
type ClearDatabaseClient = {
  $transaction<T>(
    operation: (tx: ClearTransaction) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T>;
};

export type ClearDatabaseCounts = {
  candidateEvents: number;
  candidateTags: number;
  candidateLabels: number;
  importRows: number;
  candidates: number;
  imports: number;
  tags: number;
  labels: number;
  sources: number;
  categories: number;
};

export async function clearApplicationData(db: ClearDatabaseClient): Promise<ClearDatabaseCounts> {
  return db.$transaction(
    async (tx) => ({
      candidateEvents: (await tx.candidateEvent.deleteMany()).count,
      candidateTags: (await tx.candidateTag.deleteMany()).count,
      candidateLabels: (await tx.candidateLabel.deleteMany()).count,
      importRows: (await tx.importRow.deleteMany()).count,
      candidates: (await tx.candidate.deleteMany()).count,
      imports: (await tx.import.deleteMany()).count,
      tags: (await tx.tag.deleteMany()).count,
      labels: (await tx.label.deleteMany()).count,
      sources: (await tx.source.deleteMany()).count,
      categories: (await tx.category.deleteMany()).count,
    }),
    { maxWait: 10000, timeout: 60000 },
  );
}
