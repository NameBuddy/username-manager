import { deleteSessionCookie } from "@/lib/auth";
import { jsonOk, toApiError } from "@/lib/api";

export async function POST() {
  try {
    await deleteSessionCookie();
    return jsonOk({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
}

