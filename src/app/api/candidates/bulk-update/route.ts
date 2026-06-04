import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { jsonOk, readJson, toApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  categoryId: z.string().uuid().nullable().optional(),
  addTagIds: z.array(z.string().uuid()).optional(),
  removeTagIds: z.array(z.string().uuid()).optional(),
  addLabelIds: z.array(z.string().uuid()).optional(),
  removeLabelIds: z.array(z.string().uuid()).optional(),
  candidateStatus: z.string().optional(),
  availabilityStatus: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAdminApi();
    const body = schema.parse(await readJson(request));
    const data: Record<string, unknown> = {};

    if (body.categoryId !== undefined) data.categoryId = body.categoryId;
    if (body.candidateStatus) data.candidateStatus = body.candidateStatus;
    if (body.availabilityStatus) data.availabilityStatus = body.availabilityStatus;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) {
        await tx.candidate.updateMany({ where: { id: { in: body.ids } }, data });
      }
      if (body.addTagIds?.length) {
        await tx.candidateTag.createMany({
          data: body.ids.flatMap((candidateId) => body.addTagIds!.map((tagId) => ({ candidateId, tagId }))),
          skipDuplicates: true,
        });
      }
      if (body.removeTagIds?.length) {
        await tx.candidateTag.deleteMany({
          where: { candidateId: { in: body.ids }, tagId: { in: body.removeTagIds } },
        });
      }
      if (body.addLabelIds?.length) {
        await tx.candidateLabel.createMany({
          data: body.ids.flatMap((candidateId) => body.addLabelIds!.map((labelId) => ({ candidateId, labelId }))),
          skipDuplicates: true,
        });
      }
      if (body.removeLabelIds?.length) {
        await tx.candidateLabel.deleteMany({
          where: { candidateId: { in: body.ids }, labelId: { in: body.removeLabelIds } },
        });
      }
      await tx.candidateEvent.createMany({
        data: body.ids.map((candidateId) => ({
          candidateId,
          eventType: "bulk_updated",
          metadata: body,
          createdById: session.userId,
        })),
      });
    });

    return jsonOk({ count: body.ids.length });
  } catch (error) {
    return toApiError(error);
  }
}

