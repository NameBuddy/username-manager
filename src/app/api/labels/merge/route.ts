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
    const links = await prisma.candidateLabel.findMany({ where: { labelId: sourceId }, select: { candidateId: true } });
    await prisma.$transaction([
      prisma.candidateLabel.createMany({
        data: links.map(({ candidateId }) => ({ candidateId, labelId: targetId })),
        skipDuplicates: true,
      }),
      prisma.label.delete({ where: { id: sourceId } }),
    ]);
    return jsonOk({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
}

