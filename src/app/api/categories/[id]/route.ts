import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { jsonOk, readJson, toApiError } from "@/lib/api";
import { slugify } from "@/lib/names";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await context.params;
    const body = schema.parse(await readJson(request));
    const item = await prisma.category.update({
      where: { id },
      data: { ...body, slug: body.name ? slugify(body.name) : undefined },
      include: { _count: { select: { candidates: true } } },
    });
    return jsonOk({ item });
  } catch (error) {
    return toApiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await context.params;
    await prisma.category.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
}

