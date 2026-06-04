import { getSession } from "@/lib/auth";
import { jsonError, jsonOk, toApiError } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return jsonError("Authentication required", 401);
    }
    return jsonOk({ user: { id: session.userId, email: session.email, role: session.role } });
  } catch (error) {
    return toApiError(error);
  }
}

