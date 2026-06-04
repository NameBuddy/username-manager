import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { jsonError, jsonOk, readJson, toApiError } from "@/lib/api";
import { getOrCreateLabels } from "@/lib/db-helpers";
import { candidateDetailInclude } from "@/lib/filters";
import { normalizeUsername, validateMinecraftUsername } from "@/lib/names";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  nameOriginal: z.string().min(1).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  labels: z.array(z.string()).optional(),
  sourceId: z.string().uuid().nullable().optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  scoreReason: z.string().nullable().optional(),
  candidateStatus: z.string().optional(),
  availabilityStatus: z.string().optional(),
  snipingStatus: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await context.params;
    const item = await prisma.candidate.findUnique({ where: { id }, include: candidateDetailInclude() });
    if (!item) return jsonError("Candidate not found", 404);
    return jsonOk({ item });
  } catch (error) {
    return toApiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminApi();
    const { id } = await context.params;
    const body = patchSchema.parse(await readJson(request));

    const existing = await prisma.candidate.findUnique({ where: { id } });
    if (!existing) return jsonError("Candidate not found", 404);

    const data: Record<string, unknown> = {};
    if (body.nameOriginal !== undefined) {
      const validation = validateMinecraftUsername(body.nameOriginal);
      if (!validation.valid) return jsonError(validation.reason, 400);
      data.nameOriginal = body.nameOriginal.trim();
      data.nameNormalized = normalizeUsername(body.nameOriginal);
      data.length = normalizeUsername(body.nameOriginal).length;
    }
    if (body.categoryId !== undefined) data.categoryId = body.categoryId;
    if (body.sourceId !== undefined) data.sourceId = body.sourceId;
    if (body.score !== undefined) {
      data.score = body.score;
      data.scoreUpdatedAt = new Date();
    }
    if (body.scoreReason !== undefined) data.scoreReason = body.scoreReason;
    if (body.candidateStatus !== undefined) data.candidateStatus = body.candidateStatus;
    if (body.availabilityStatus !== undefined) data.availabilityStatus = body.availabilityStatus;
    if (body.snipingStatus !== undefined) data.snipingStatus = body.snipingStatus;
    if (body.notes !== undefined) data.notes = body.notes;

    const updated = await prisma.$transaction(async (tx) => {
      if (body.tagIds) {
        await tx.candidateTag.deleteMany({ where: { candidateId: id } });
        if (body.tagIds.length) {
          await tx.candidateTag.createMany({
            data: body.tagIds.map((tagId) => ({ candidateId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }
      if (body.labelIds !== undefined || body.labels !== undefined) {
        const newLabels = await getOrCreateLabels(body.labels ?? [], tx);
        const labelIds = [...(body.labelIds ?? []), ...newLabels.map((label) => label.id)];
        await tx.candidateLabel.deleteMany({ where: { candidateId: id } });
        if (labelIds.length) {
          await tx.candidateLabel.createMany({
            data: labelIds.map((labelId) => ({ candidateId: id, labelId })),
            skipDuplicates: true,
          });
        }
      }

      const candidate = await tx.candidate.update({
        where: { id },
        data,
        include: candidateDetailInclude(),
      });

      await tx.candidateEvent.create({
        data: {
          candidateId: id,
          eventType: "updated",
          oldValue: existing.nameOriginal,
          newValue: candidate.nameOriginal,
          metadata: body,
          createdById: session.userId,
        },
      });

      return candidate;
    });

    return jsonOk({ item: updated });
  } catch (error) {
    return toApiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminApi();
    const { id } = await context.params;
    const item = await prisma.candidate.update({
      where: { id },
      data: {
        candidateStatus: "archived",
        events: {
          create: {
            eventType: "archived",
            createdById: session.userId,
          },
        },
      },
      include: candidateDetailInclude(),
    });
    return jsonOk({ item });
  } catch (error) {
    return toApiError(error);
  }
}
