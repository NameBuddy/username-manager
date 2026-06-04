import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { jsonOk, readJson, toApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  url: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    await requireAdminApi();
    const items = await prisma.source.findMany({
      include: { _count: { select: { candidates: true, imports: true } } },
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
    const item = await prisma.source.upsert({
      where: { name: body.name },
      update: body,
      create: body,
    });
    return jsonOk({ item });
  } catch (error) {
    return toApiError(error);
  }
}

