import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { candidateInclude, candidateOrderByFromParams, candidateWhereFromParams } from "@/lib/filters";
import { contentTypeForExport, serializeCandidates } from "@/lib/exports";
import { readJson, toApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  format: z.enum(["txt", "csv", "json"]),
  ids: z.array(z.string().uuid()).optional(),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    const body = schema.parse(await readJson(request));
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body.filters ?? {})) {
      if (value !== "" && value != null) params.set(key, String(value));
    }

    const filterWhere = candidateWhereFromParams(params);
    const where = body.ids?.length ? { AND: [filterWhere, { id: { in: body.ids } }] } : filterWhere;
    const candidates = await prisma.candidate.findMany({
      where,
      include: candidateInclude(),
      orderBy: candidateOrderByFromParams(params),
      take: 100000,
    });
    const serialized = serializeCandidates(candidates, body.format);

    return new Response(serialized, {
      headers: {
        "Content-Type": contentTypeForExport(body.format),
        "Content-Disposition": `attachment; filename="namedb-export.${body.format}"`,
      },
    });
  } catch (error) {
    return toApiError(error);
  }
}

