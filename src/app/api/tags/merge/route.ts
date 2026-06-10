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
    if (sourceId === targetId) return jsonError("Cannot merge a tag into itself", 400);
    const [source, target] = await Promise.all([
      prisma.tag.findUnique({ where: { id: sourceId } }),
      prisma.tag.findUnique({ where: { id: targetId } }),
    ]);
    if (!source || !target) return jsonError("Tag not found", 404);
    await prisma.$transaction(async (tx) => {
      const links = await tx.candidateTag.findMany({ where: { tagId: sourceId }, select: { candidateId: true } });
      if (links.length) {
        await tx.candidateTag.createMany({
          data: links.map(({ candidateId }) => ({ candidateId, tagId: targetId })),
          skipDuplicates: true,
        });
      }
      await tx.tag.delete({ where: { id: sourceId } });
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
}

