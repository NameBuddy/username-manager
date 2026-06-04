import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { jsonOk, readJson, toApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    const { sourceId, targetId } = schema.parse(await readJson(request));
    const links = await prisma.candidateTag.findMany({ where: { tagId: sourceId }, select: { candidateId: true } });
    await prisma.$transaction([
      prisma.candidateTag.createMany({
        data: links.map(({ candidateId }) => ({ candidateId, tagId: targetId })),
        skipDuplicates: true,
      }),
      prisma.tag.delete({ where: { id: sourceId } }),
    ]);
    return jsonOk({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
}

