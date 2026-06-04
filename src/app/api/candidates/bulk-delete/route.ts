import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { jsonOk, readJson, toApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1) });

export async function POST(request: Request) {
  try {
    const session = await requireAdminApi();
    const { ids } = schema.parse(await readJson(request));
    const result = await prisma.candidate.updateMany({
      where: { id: { in: ids } },
      data: { candidateStatus: "archived" },
    });
    await prisma.candidateEvent.createMany({
      data: ids.map((candidateId) => ({
        candidateId,
        eventType: "archived",
        createdById: session.userId,
      })),
      skipDuplicates: true,
    });
    return jsonOk({ count: result.count });
  } catch (error) {
    return toApiError(error);
  }
}

