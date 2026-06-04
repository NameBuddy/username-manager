import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { jsonOk, readJson, toApiError } from "@/lib/api";
import { buildImportPreview, lookupMinecraftProfilesForImportRows, parseImportPayload } from "@/lib/importer";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  type: z.enum(["txt", "csv", "json"]),
  content: z.string(),
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
});

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    const body = schema.parse(await readJson(request));
    const rows = parseImportPayload(body);
    const minecraftProfiles = await lookupMinecraftProfilesForImportRows(rows);
    const [existingCandidates, categories, tags, labels] = await Promise.all([
      prisma.candidate.findMany({ select: { id: true, nameNormalized: true, nameOriginal: true } }),
      prisma.category.findMany({ select: { name: true } }),
      prisma.tag.findMany({ select: { name: true } }),
      prisma.label.findMany({ select: { name: true } }),
    ]);

    const preview = buildImportPreview({
      rows,
      defaults: body.defaults,
      existingCandidates,
      existingCategories: categories.map((item) => item.name),
      existingTags: tags.map((item) => item.name),
      existingLabels: labels.map((item) => item.name),
      minecraftProfiles,
    });

    return jsonOk({ preview });
  } catch (error) {
    return toApiError(error);
  }
}
