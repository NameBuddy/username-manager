import { requireAdminApi } from "@/lib/auth";
import { jsonOk, toApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdminApi();
    const items = await prisma.import.findMany({
      include: {
        source: true,
        defaultCategory: true,
        createdBy: { select: { email: true } },
        _count: { select: { rows: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk({ items });
  } catch (error) {
    return toApiError(error);
  }
}

