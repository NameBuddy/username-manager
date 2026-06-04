import { requireAdminApi } from "@/lib/auth";
import { jsonError, jsonOk, toApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await context.params;
    const item = await prisma.import.findUnique({
      where: { id },
      include: {
        source: true,
        defaultCategory: true,
        createdBy: { select: { email: true } },
        rows: {
          include: { candidate: { select: { id: true, nameOriginal: true, nameNormalized: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!item) return jsonError("Import not found", 404);
    return jsonOk({ item });
  } catch (error) {
    return toApiError(error);
  }
}

