import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { jsonOk, readJson, toApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1) });

export async function POST(request: Request) {
  try {
    const session = await requireAdminApi();
    const { ids } = schema.parse(await readJson(request));
    const existing = await prisma.candidate.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const [result] = await prisma.$transaction([
      prisma.candidate.updateMany({
        where: { id: { in: existing.map(({ id }) => id) } },
        data: { candidateStatus: "archived" },
      }),
      prisma.candidateEvent.createMany({
        data: existing.map(({ id }) => ({
          candidateId: id,
          eventType: "archived",
          createdById: session.userId,
        })),
      }),
    ]);
    return jsonOk({ count: result.count });
  } catch (error) {
    return toApiError(error);
  }
}

