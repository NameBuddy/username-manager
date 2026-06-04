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
    await prisma.$transaction([
      prisma.candidate.updateMany({ where: { categoryId: sourceId }, data: { categoryId: targetId } }),
      prisma.import.updateMany({ where: { defaultCategoryId: sourceId }, data: { defaultCategoryId: targetId } }),
      prisma.category.delete({ where: { id: sourceId } }),
    ]);
    return jsonOk({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
}

