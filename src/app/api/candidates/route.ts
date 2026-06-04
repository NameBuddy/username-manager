import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { jsonError, jsonOk, readJson, toApiError } from "@/lib/api";
import { inferCategoryWithDeepSeek } from "@/lib/category-inference";
import { getOrCreateCategory, getOrCreateLabels, getOrCreateSource, getOrCreateTags } from "@/lib/db-helpers";
import { candidateInclude, candidateOrderByFromParams, candidateWhereFromParams, paginationFromParams } from "@/lib/filters";
import { lookupMinecraftProfile } from "@/lib/mojang";
import { normalizeUsername, validateMinecraftUsername } from "@/lib/names";
import { prisma } from "@/lib/prisma";

const candidateSchema = z.object({
  nameOriginal: z.string().min(1),
  categoryId: z.string().uuid().optional().nullable(),
  categoryName: z.string().optional().nullable(),
  tagIds: z.array(z.string().uuid()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  labelIds: z.array(z.string().uuid()).optional().default([]),
  labels: z.array(z.string()).optional().default([]),
  autoCategorize: z.boolean().optional().default(true),
  sourceId: z.string().uuid().optional().nullable(),
  sourceName: z.string().optional().nullable(),
  candidateStatus: z.string().optional().default("active"),
  availabilityStatus: z.string().optional().default("unknown"),
  snipingStatus: z.string().optional().default("none"),
  notes: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    await requireAdminApi();
    const params = new URL(request.url).searchParams;
    const { page, pageSize, skip, take } = paginationFromParams(params);
    const where = candidateWhereFromParams(params);
    const [items, total] = await prisma.$transaction([
      prisma.candidate.findMany({
        where,
        include: candidateInclude(),
        orderBy: candidateOrderByFromParams(params),
        skip,
        take,
      }),
      prisma.candidate.count({ where }),
    ]);

    return jsonOk({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    return toApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminApi();
    const body = candidateSchema.parse(await readJson(request));
    const validation = validateMinecraftUsername(body.nameOriginal);
    if (!validation.valid) {
      return jsonError(validation.reason, 400);
    }
    const normalized = normalizeUsername(body.nameOriginal);
    const existing = await prisma.candidate.findUnique({ where: { nameNormalized: normalized } });
    if (existing) {
      return jsonError("Candidate already exists", 409);
    }

    const profile = await lookupMinecraftProfile(body.nameOriginal);
    if (!profile) {
      return jsonError("No Minecraft profile found", 400);
    }

    let categoryName = body.categoryName?.trim() || null;
    if (!body.categoryId && !categoryName && body.autoCategorize) {
      const categories = await prisma.category.findMany({ select: { name: true }, orderBy: { name: "asc" } });
      categoryName = await inferCategoryWithDeepSeek(
        body.nameOriginal,
        categories.map((category) => category.name),
      );
    }
    if (!body.categoryId && !categoryName) {
      return jsonError("Category is required", 400);
    }

    const created = await prisma.$transaction(async (tx) => {
      const category = body.categoryId
        ? await tx.category.findUnique({ where: { id: body.categoryId } })
        : await getOrCreateCategory(categoryName, tx);
      if (!category) {
        throw new Error("Category is required");
      }
      const source = body.sourceId
        ? await tx.source.findUnique({ where: { id: body.sourceId } })
        : await getOrCreateSource(body.sourceName, tx);
      const newTags = await getOrCreateTags(body.tags, tx);
      const newLabels = await getOrCreateLabels(body.labels, tx);
      const tagIds = [...body.tagIds, ...newTags.map((tag) => tag.id)];
      const labelIds = [...body.labelIds, ...newLabels.map((label) => label.id)];

      const candidate = await tx.candidate.create({
        data: {
          nameOriginal: body.nameOriginal.trim(),
          nameNormalized: normalized,
          length: normalized.length,
          categoryId: category.id,
          sourceId: source?.id,
          candidateStatus: body.candidateStatus,
          availabilityStatus: body.availabilityStatus,
          snipingStatus: body.snipingStatus,
          notes: body.notes,
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
          labels: { create: labelIds.map((labelId) => ({ labelId })) },
        },
        include: candidateInclude(),
      });

      await tx.candidateEvent.create({
        data: {
          candidateId: candidate.id,
          eventType: "created",
          newValue: candidate.nameOriginal,
          createdById: session.userId,
        },
      });

      return candidate;
    });

    return jsonOk({ item: created }, { status: 201 });
  } catch (error) {
    return toApiError(error);
  }
}
