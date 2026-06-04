import { z } from "zod";
import { createSessionCookie, getAccessUser, isAccessPasswordConfigured, verifyAccessPassword } from "@/lib/auth";
import { jsonError, jsonOk, readJson, toApiError } from "@/lib/api";

const loginSchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await readJson(request));

    if (!isAccessPasswordConfigured()) {
      return jsonError("Access password is not configured", 500);
    }

    if (!verifyAccessPassword(body.password)) {
      return jsonError("Invalid access password", 401);
    }

    const user = await getAccessUser();
    await createSessionCookie(user);
    return jsonOk({ user: { id: user.id, role: user.role } });
  } catch (error) {
    return toApiError(error);
  }
}
