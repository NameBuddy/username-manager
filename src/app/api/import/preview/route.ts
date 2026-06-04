import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { jsonOk, readJson, toApiError } from "@/lib/api";
import { autoFillMissingImportCategories } from "@/lib/category-inference";
import { buildImportPreview, lookupMinecraftProfilesForImportRows, parseImportPayload } from "@/lib/importer";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  type: z.enum(["txt", "csv", "json"]),
  content: z.string(),
  columnMap: z.record(z.string(), z.string()).optional(),
  defaults: z
    .object({
      category: z.string().optional(),
      labels: z.array(z.string()).optional(),
    })
    .optional(),
  options: z
    .object({
      autoCategorizeMissingCategories: z.boolean().optional(),
      autoCategorizeCsvMissingCategories: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    const body = schema.parse(await readJson(request));
    const parsedRows = parseImportPayload(body);
    const [existingCandidates, categories, labels] = await Promise.all([
      prisma.candidate.findMany({ select: { id: true, nameNormalized: true, nameOriginal: true } }),
      prisma.category.findMany({ select: { name: true } }),
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
      existingTags: [],
      existingLabels: labels.map((item) => item.name),
      minecraftProfiles,
    });

    return jsonOk({ preview });
  } catch (error) {
    return toApiError(error);
  }
}
