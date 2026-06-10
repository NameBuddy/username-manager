import { requireAdminApi } from "@/lib/auth";
import { jsonError, toApiError } from "@/lib/api";
import { contentTypeForExport } from "@/lib/exports";
import { prisma } from "@/lib/prisma";

function csv(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await context.params;
    const item = await prisma.import.findUnique({
      where: { id },
      include: { rows: { include: { candidate: true }, orderBy: { createdAt: "asc" } } },
    });

    if (!item) {
      return jsonError("Import not found", 404);
    }

    const header = ["row", "raw_value", "normalized_value", "status", "reason", "candidate"];
    const rows = item.rows.map((row, index) => [
      index + 1,
      row.rawValue,
      row.normalizedValue,
      row.status,
      row.reason,
      row.candidate?.nameOriginal,
    ]);

    const body = [header, ...rows].map((row) => row.map(csv).join(",")).join("\n") + "\n";
    return new Response(body, {
      headers: {
        "Content-Type": contentTypeForExport("csv"),
        "Content-Disposition": `attachment; filename="import-${id}-report.csv"`,
      },
    });
  } catch (error) {
    return toApiError(error);
  }
}

