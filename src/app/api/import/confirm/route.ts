import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireAdminApi } from "@/lib/auth";
import { jsonOk, readJson, toApiError } from "@/lib/api";
import { autoFillMissingImportCategories } from "@/lib/category-inference";
import { getOrCreateCategory, getOrCreateLabels, getOrCreateSource, getOrCreateTags } from "@/lib/db-helpers";
import {
  buildImportPreview,
  lookupMinecraftProfilesForImportRows,
  parseImportPayload,
  type ImportPreviewRow,
} from "@/lib/importer";
import { slugify } from "@/lib/names";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  type: z.enum(["txt", "csv", "json"]),
  content: z.string(),
  filename: z.string().optional(),
  columnMap: z.record(z.string(), z.string()).optional(),
  defaults: z
    .object({
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      labels: z.array(z.string()).optional(),
      source: z.string().optional(),
      notes: z.string().optional(),
      candidateStatus: z.string().optional(),
      availabilityStatus: z.string().optional(),
    })
    .optional(),
  options: z
    .object({
      createMissing: z.boolean().optional(),
      updateExisting: z.boolean().optional(),
      mergeTagsLabels: z.boolean().optional(),
      autoCategorizeMissingCategories: z.boolean().optional(),
      autoCategorizeCsvMissingCategories: z.boolean().optional(),
    })
    .optional(),
});

async function resolveCategory(name: string | null, createMissing: boolean, tx: Prisma.TransactionClient) {
  if (!name) return null;
  if (createMissing) return getOrCreateCategory(name, tx);
  return tx.category.findUnique({ where: { slug: slugify(name) } });
}

async function resolveTags(names: string[], createMissing: boolean, tx: Prisma.TransactionClient) {
  if (createMissing) return getOrCreateTags(names, tx);
  return tx.tag.findMany({ where: { slug: { in: names.map(slugify) } } });
}

async function resolveLabels(names: string[], createMissing: boolean, tx: Prisma.TransactionClient) {
  if (createMissing) return getOrCreateLabels(names, tx);
  return tx.label.findMany({ where: { slug: { in: names.map(slugify) } } });
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminApi();
    const body = schema.parse(await readJson(request));
    const createMissing = body.options?.createMissing ?? true;
    const updateExisting = body.options?.updateExisting ?? false;
    const mergeTagsLabels = body.options?.mergeTagsLabels ?? true;
    const parsedRows = parseImportPayload(body);
    const [existingCandidates, categories, tags, labels] = await Promise.all([
      prisma.candidate.findMany({ select: { id: true, nameNormalized: true, nameOriginal: true } }),
      prisma.category.findMany({ select: { name: true } }),
      prisma.tag.findMany({ select: { name: true } }),
      prisma.label.findMany({ select: { name: true } }),
    ]);
    const rows = await autoFillMissingImportCategories({
      rows: parsedRows,
      defaults: body.defaults,
      existingCategories: categories.map((item) => item.name),
      enabled: body.options?.autoCategorizeMissingCategories ?? body.options?.autoCategorizeCsvMissingCategories ?? true,
    });
    const minecraftProfiles = await lookupMinecraftProfilesForImportRows(rows);
    const preview = buildImportPreview({
      rows,
      defaults: body.defaults,
      existingCandidates,
      existingCategories: categories.map((item) => item.name),
      existingTags: tags.map((item) => item.name),
      existingLabels: labels.map((item) => item.name),
      minecraftProfiles,
    });

    const result = await prisma.$transaction(async (tx) => {
      const source = await getOrCreateSource(body.defaults?.source, tx);
      const defaultCategory = await resolveCategory(body.defaults?.category ?? null, createMissing, tx);
      const importBatch = await tx.import.create({
        data: {
          filename: body.filename,
          fileType: body.type,
          sourceId: source?.id,
          defaultCategoryId: defaultCategory?.id,
          totalRows: preview.summary.totalRows,
          createdById: session.userId,
        },
      });

      let importedCount = 0;
      let duplicateCount = 0;
      let invalidCount = 0;
      let updatedCount = 0;
      const createdCategories = new Set<string>();
      const createdTags = new Set<string>();
      const createdLabels = new Set<string>();

      async function writeImportRow(row: ImportPreviewRow, status: string, reason: string | null, candidateId?: string | null) {
        await tx.importRow.create({
          data: {
            importId: importBatch.id,
            rawValue: row.nameOriginal,
            normalizedValue: row.nameNormalized,
            status,
            reason,
            candidateId,
          },
        });
      }

      for (const row of preview.rows) {
        if (row.status === "invalid") {
          invalidCount += 1;
          await writeImportRow(row, "invalid", row.reason);
          continue;
        }

        const duplicate = await tx.candidate.findUnique({
          where: { nameNormalized: row.nameNormalized },
          include: { tags: true, labels: true },
        });

        if (duplicate) {
          if (updateExisting || mergeTagsLabels) {
            const category = updateExisting ? await resolveCategory(row.category, createMissing, tx) : null;
            if (updateExisting && !category) {
              invalidCount += 1;
              await writeImportRow(row, "invalid", "Category is required");
              continue;
            }
            const tagIds = (await resolveTags(row.tags, createMissing, tx)).map((tag) => tag.id);
            const labelIds = (await resolveLabels(row.labels, createMissing, tx)).map((label) => label.id);

            await tx.candidate.update({
              where: { id: duplicate.id },
              data: updateExisting
                ? {
                    categoryId: category?.id,
                    sourceId: source?.id,
                    score: row.score,
                    notes: row.notes,
                    candidateStatus: row.candidateStatus,
                    availabilityStatus: row.availabilityStatus,
                    lastSeenAt: new Date(),
                  }
                : { lastSeenAt: new Date() },
            });
            if (mergeTagsLabels) {
              await tx.candidateTag.createMany({
                data: tagIds.map((tagId) => ({ candidateId: duplicate.id, tagId })),
                skipDuplicates: true,
              });
              await tx.candidateLabel.createMany({
                data: labelIds.map((labelId) => ({ candidateId: duplicate.id, labelId })),
                skipDuplicates: true,
              });
            }
            await tx.candidateEvent.create({
              data: {
                candidateId: duplicate.id,
                eventType: "updated_from_import",
                metadata: { importId: importBatch.id },
                createdById: session.userId,
              },
            });
            updatedCount += 1;
            await writeImportRow(row, "updated", "Merged into existing candidate", duplicate.id);
          } else {
            duplicateCount += 1;
            await writeImportRow(row, "duplicate", "Exact duplicate already exists", duplicate.id);
          }
          continue;
        }

        if (row.status === "duplicate") {
          duplicateCount += 1;
          await writeImportRow(row, "duplicate", row.reason);
          continue;
        }

        const category = await resolveCategory(row.category, createMissing, tx);
        if (!category) {
          invalidCount += 1;
          await writeImportRow(row, "invalid", "Category is required");
          continue;
        }
        const tagsForRow = await resolveTags(row.tags, createMissing, tx);
        const labelsForRow = await resolveLabels(
          row.fuzzyDuplicateNames.length ? [...row.labels, "Duplicate Warning"] : row.labels,
          createMissing,
          tx,
        );

        if (category && preview.newCategories.includes(category.name)) createdCategories.add(category.name);
        for (const tag of tagsForRow) if (preview.newTags.includes(tag.name)) createdTags.add(tag.name);
        for (const label of labelsForRow) if (preview.newLabels.includes(label.name) || label.name === "Duplicate Warning") createdLabels.add(label.name);

        const candidate = await tx.candidate.create({
          data: {
            nameOriginal: row.nameOriginal,
            nameNormalized: row.nameNormalized,
            length: row.length,
            categoryId: category.id,
            sourceId: source?.id,
            score: row.score,
            scoreUpdatedAt: typeof row.score === "number" ? new Date() : null,
            candidateStatus: row.candidateStatus,
            availabilityStatus: row.availabilityStatus,
            snipingStatus: "none",
            notes: row.notes,
            tags: { create: [...new Set(tagsForRow.map((tag) => tag.id))].map((tagId) => ({ tagId })) },
            labels: { create: [...new Set(labelsForRow.map((label) => label.id))].map((labelId) => ({ labelId })) },
            events: {
              create: {
                eventType: "imported",
                metadata: { importId: importBatch.id, fuzzyDuplicateNames: row.fuzzyDuplicateNames },
                createdById: session.userId,
              },
            },
          },
        });

        importedCount += 1;
        await writeImportRow(row, "imported", row.fuzzyDuplicateNames.length ? "Imported with fuzzy duplicate warning" : null, candidate.id);
      }

      const updatedBatch = await tx.import.update({
        where: { id: importBatch.id },
        data: { importedCount, duplicateCount, invalidCount, updatedCount },
      });

      return {
        import: updatedBatch,
        summary: {
          importedCount,
          skippedDuplicates: duplicateCount,
          updatedExistingRecords: updatedCount,
          invalidRows: invalidCount,
          createdCategories: [...createdCategories],
          createdTags: [...createdTags],
          createdLabels: [...createdLabels],
          importBatchId: importBatch.id,
        },
      };
    });

    return jsonOk({ result, preview });
  } catch (error) {
    return toApiError(error);
  }
}
