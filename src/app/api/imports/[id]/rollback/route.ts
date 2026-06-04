import { requireAdminApi } from "@/lib/auth";
import { jsonOk, toApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminApi();
    const { id } = await context.params;
    const rows = await prisma.importRow.findMany({
      where: { importId: id, status: "imported", candidateId: { not: null } },
      select: { id: true, candidateId: true },
    });
    const candidateIds = rows.map((row) => row.candidateId).filter((candidateId): candidateId is string => Boolean(candidateId));

    await prisma.$transaction([
      prisma.candidateEvent.createMany({
        data: candidateIds.map((candidateId) => ({
          candidateId,
          eventType: "rollback_deleted",
          metadata: { importId: id },
          createdById: session.userId,
        })),
        skipDuplicates: true,
      }),
      prisma.candidate.deleteMany({ where: { id: { in: candidateIds } } }),
      prisma.importRow.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { status: "rolled_back" } }),
    ]);

    return jsonOk({ deletedCandidates: candidateIds.length });
  } catch (error) {
    return toApiError(error);
  }
}

