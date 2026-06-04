import { requireAdminApi } from "@/lib/auth";
import { jsonOk, toApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdminApi();
    const [
      totalCandidates,
      duplicateRows,
      totalCategories,
      totalTags,
      totalLabels,
      recentImports,
      recentCandidates,
      categories,
      statusGroups,
      availabilityGroups,
    ] = await Promise.all([
      prisma.candidate.count(),
      prisma.import.aggregate({ _sum: { duplicateCount: true } }),
      prisma.category.count(),
      prisma.tag.count(),
      prisma.label.count(),
      prisma.import.findMany({
        include: { source: true, defaultCategory: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.candidate.findMany({
        include: { category: true, source: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.category.findMany({
        include: { _count: { select: { candidates: true } } },
        orderBy: { candidates: { _count: "desc" } },
        take: 10,
      }),
      prisma.candidate.groupBy({ by: ["candidateStatus"], _count: true }),
      prisma.candidate.groupBy({ by: ["availabilityStatus"], _count: true }),
    ]);

    return jsonOk({
      stats: {
        totalCandidates,
        totalUniqueCandidates: totalCandidates,
        totalDuplicatesBlocked: duplicateRows._sum.duplicateCount ?? 0,
        totalCategories,
        totalTags,
        totalLabels,
      },
      recentImports,
      recentCandidates,
      candidatesByCategory: categories.map((category) => ({
        id: category.id,
        name: category.name,
        color: category.color,
        count: category._count.candidates,
      })),
      candidatesByStatus: statusGroups.map((group) => ({ status: group.candidateStatus, count: group._count })),
      candidatesByAvailability: availabilityGroups.map((group) => ({ status: group.availabilityStatus, count: group._count })),
    });
  } catch (error) {
    return toApiError(error);
  }
}

