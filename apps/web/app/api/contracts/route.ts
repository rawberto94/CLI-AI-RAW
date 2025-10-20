/**
 * Contracts List API
 * GET /api/contracts - List contracts with filtering, sorting, and pagination
 *
 * ⚠️  TEMPORARY: Using direct Prisma queries due to data-orchestration build issues
 * TODO: Migrate back to ContractService once package is fixed
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const tenantId = searchParams.get("tenantId") || "demo";
    const search = searchParams.get("search") || undefined;
    const statuses = searchParams.getAll("status");
    const clientNames = searchParams.getAll("clientName");
    const supplierNames = searchParams.getAll("supplierName");
    const categories = searchParams.getAll("category");
    const minValue = searchParams.get("minValue")
      ? Number(searchParams.get("minValue"))
      : undefined;
    const maxValue = searchParams.get("maxValue")
      ? Number(searchParams.get("maxValue"))
      : undefined;
    const page = searchParams.get("page")
      ? Number(searchParams.get("page"))
      : 1;
    const limit = searchParams.get("limit")
      ? Number(searchParams.get("limit"))
      : 20;
    const sortBy = searchParams.get("sortBy") || "uploadedAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as
      | "asc"
      | "desc";

    // Build where clause
    const where: any = {
      tenantId,
      deletedAt: null, // Only non-deleted contracts
    };

    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: "insensitive" } },
        { originalName: { contains: search, mode: "insensitive" } },
        { contractTitle: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (statuses.length > 0) {
      where.status = { in: statuses };
    }

    if (clientNames.length > 0) {
      where.clientName = { in: clientNames };
    }

    if (supplierNames.length > 0) {
      where.supplierName = { in: supplierNames };
    }

    if (categories.length > 0) {
      where.category = { in: categories };
    }

    if (minValue !== undefined || maxValue !== undefined) {
      where.totalValue = {};
      if (minValue !== undefined) where.totalValue.gte = minValue;
      if (maxValue !== undefined) where.totalValue.lte = maxValue;
    }

    // Build orderBy
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // Execute query with pagination
    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          tenantId: true,
          fileName: true,
          originalName: true,
          fileSize: true,
          mimeType: true,
          uploadedAt: true,
          status: true,
          contractType: true,
          contractTitle: true,
          description: true,
          category: true,
          totalValue: true,
          currency: true,
          startDate: true,
          endDate: true,
          clientName: true,
          supplierName: true,
          viewCount: true,
          lastViewedAt: true,
        },
      }),
      prisma.contract.count({ where }),
    ]);

    const responseTime = Date.now() - startTime;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json(
      {
        success: true,
        data: {
          contracts: contracts.map((contract) => ({
            id: contract.id,
            filename: contract.fileName,
            originalName: contract.originalName || contract.fileName,
            status: contract.status,
            processingStatus: contract.status,
            uploadDate: contract.uploadedAt,
            uploadedAt: contract.uploadedAt,
            fileSize: Number(contract.fileSize),
            mimeType: contract.mimeType,
            contractType: contract.contractType || "UNKNOWN",
            contractTitle: contract.contractTitle,
            description: contract.description,
            category: contract.category,
            totalValue: contract.totalValue
              ? Number(contract.totalValue)
              : null,
            currency: contract.currency,
            startDate: contract.startDate,
            endDate: contract.endDate,
            clientName: contract.clientName,
            supplierName: contract.supplierName,
            viewCount: contract.viewCount,
            lastViewedAt: contract.lastViewedAt,
          })),
          pagination: {
            total,
            limit,
            page,
            totalPages,
            hasMore: page < totalPages,
            hasPrevious: page > 1,
          },
          meta: {
            responseTime: `${responseTime}ms`,
            cached: false,
            source: "direct-prisma",
          },
        },
      },
      {
        status: 200,
        headers: {
          "X-Response-Time": `${responseTime}ms`,
          "X-Data-Source": "direct-prisma",
        },
      }
    );
  } catch (error) {
    console.error("Contract query error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to query contracts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
