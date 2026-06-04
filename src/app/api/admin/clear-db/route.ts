import { z } from "zod";
import { CLEAR_DATABASE_CONFIRMATION, clearApplicationData } from "@/lib/admin-clear";
import { jsonOk, readJson, toApiError } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  confirm: z.literal(CLEAR_DATABASE_CONFIRMATION),
});

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    schema.parse(await readJson(request));

    const counts = await clearApplicationData(prisma);

    return jsonOk({ counts });
  } catch (error) {
    return toApiError(error);
  }
}
