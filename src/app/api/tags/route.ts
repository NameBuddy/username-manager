import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { jsonOk, readJson, toApiError } from "@/lib/api";
import { slugify } from "@/lib/names";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
});

export async function GET() {
  try {
    await requireAdminApi();
    const items = await prisma.tag.findMany({
      include: { _count: { select: { candidates: true } } },
      orderBy: { name: "asc" },
    });
    return jsonOk({ items });
  } catch (error) {
    return toApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    const body = schema.parse(await readJson(request));
    const item = await prisma.tag.create({
      data: { ...body, slug: slugify(body.name) },
      include: { _count: { select: { candidates: true } } },
    });
    return jsonOk({ item }, { status: 201 });
  } catch (error) {
    return toApiError(error);
  }
}

