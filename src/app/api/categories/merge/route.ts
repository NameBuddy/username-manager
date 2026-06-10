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
    if (sourceId === targetId) return jsonError("Cannot merge a category into itself", 400);
    const [source, target] = await Promise.all([
      prisma.category.findUnique({ where: { id: sourceId } }),
      prisma.category.findUnique({ where: { id: targetId } }),
    ]);
    if (!source || !target) return jsonError("Category not found", 404);
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

