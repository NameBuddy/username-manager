import { z } from "zod";
import { createSessionCookie, verifyPasswordLogin } from "@/lib/auth";
import { jsonError, jsonOk, readJson, toApiError } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await readJson(request));
    const user = await verifyPasswordLogin(body.email, body.password);

    if (!user) {
      return jsonError("Invalid email or password", 401);
    }

    await createSessionCookie(user);
    return jsonOk({ user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    return toApiError(error);
  }
}

