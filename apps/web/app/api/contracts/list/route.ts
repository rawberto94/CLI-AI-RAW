import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface QueryParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  startDate?: string;
  endDate?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const params: QueryParams = {
      page: parseInt(searchParams.get("page") || "1"),
      limit: Math.min(parseInt(searchParams.get("limit") || "50"), 100),
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || "uploadDate",
      sortDirection:
        (searchParams.get("sortDirection") as "asc" | "desc") || "desc",
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    };

    const offset = ((params.page || 1) - 1) * (params.limit || 50);

    // Build where clause for filtering
    const where: any = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.search) {
      where.OR = [
        { fileName: { contains: params.search, mode: "insensitive" } },
        { originalName: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.startDate || params.endDate) {
      where.uploadedAt = {};
      if (params.startDate) {
        where.uploadedAt.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.uploadedAt.lte = new Date(params.endDate);
      }
    }

    // Get contracts from database with pagination
    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          _count: {
            select: {
              artifacts: true,
            },
          },
        },
        orderBy: {
          [params.sortBy === "filename" ? "fileName" : "uploadedAt"]:
            params.sortDirection,
        },
        skip: offset,
        take: params.limit || 50,
      }),
      prisma.contract.count({ where }),
    ]);

    const formattedContracts = contracts.map((contract) => ({
      id: contract.id,
      filename: contract.fileName,
      originalName: contract.originalName || contract.fileName,
      status: contract.status,
      uploadDate: contract.uploadedAt,
      fileSize: Number(contract.fileSize),
      mimeType: contract.mimeType,
      extractedData: {},
      parties: [],
      clauseCount: 0,
      artifactCount: contract._count?.artifacts || 0,
      processing:
        contract.status === "PROCESSING"
          ? {
              currentStage: "Processing",
              progress: 50,
            }
          : undefined,
      error: contract.status === "FAILED" ? "Processing failed" : undefined,
    }));

    return NextResponse.json({
      success: true,
      contracts: formattedContracts,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / (params.limit || 50)),
        hasMore: offset + (params.limit || 50) < total,
      },
    });
  } catch (error) {
    console.error("Error fetching contracts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch contracts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
