import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { jsonError, jsonOk, readJson, toApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    const { sourceId, targetId } = schema.parse(await readJson(request));
    if (sourceId === targetId) return jsonError("Cannot merge a label into itself", 400);
    const [source, target] = await Promise.all([
      prisma.label.findUnique({ where: { id: sourceId } }),
      prisma.label.findUnique({ where: { id: targetId } }),
    ]);
    if (!source || !target) return jsonError("Label not found", 404);
    await prisma.$transaction(async (tx) => {
      const links = await tx.candidateLabel.findMany({ where: { labelId: sourceId }, select: { candidateId: true } });
      if (links.length) {
        await tx.candidateLabel.createMany({
          data: links.map(({ candidateId }) => ({ candidateId, labelId: targetId })),
          skipDuplicates: true,
        });
      }
      await tx.label.delete({ where: { id: sourceId } });
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
}

