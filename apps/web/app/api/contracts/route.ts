/**
 * Contracts List API
 * GET /api/contracts - List contracts with filtering, sorting, and pagination
 *
 * ✅ MIGRATED to data-orchestration service
 * - Uses centralized ContractService with automatic caching
 * - Type-safe with Zod validation
 * - Consistent error handling
 */

import { NextRequest, NextResponse } from "next/server";
import { contractService, ContractQuerySchema } from "data-orchestration";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Build query object from search params
    const queryData = {
      tenantId: searchParams.get("tenantId") || "demo", // TODO: Get from auth session
      search: searchParams.get("search") || undefined,
      status:
        searchParams.getAll("status").length > 0
          ? searchParams.getAll("status")
          : undefined,
      clientName:
        searchParams.getAll("clientName").length > 0
          ? searchParams.getAll("clientName")
          : undefined,
      supplierName:
        searchParams.getAll("supplierName").length > 0
          ? searchParams.getAll("supplierName")
          : undefined,
      category:
        searchParams.getAll("category").length > 0
          ? searchParams.getAll("category")
          : undefined,
      minValue: searchParams.get("minValue")
        ? Number(searchParams.get("minValue"))
        : undefined,
      maxValue: searchParams.get("maxValue")
        ? Number(searchParams.get("maxValue"))
        : undefined,
      startDateFrom: searchParams.get("startDateFrom")
        ? new Date(searchParams.get("startDateFrom")!)
        : undefined,
      startDateTo: searchParams.get("startDateTo")
        ? new Date(searchParams.get("startDateTo")!)
        : undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 20,
      sortBy: (searchParams.get("sortBy") as any) || "createdAt",
      sortOrder: (searchParams.get("sortOrder") as any) || "desc",
    };

    // Validate query with Zod schema
    const query = ContractQuerySchema.parse(queryData);

    // Use data-orchestration service (handles caching automatically)
    const result = await contractService.queryContracts(query);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        data: {
          contracts: result.data.contracts.map((contract) => ({
            id: contract.id,
            filename: contract.fileName,
            originalName: contract.originalName || contract.fileName,
            status: contract.status,
            processingStatus: contract.status,
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
            total: result.data.total,
            limit: result.data.limit,
            page: result.data.page,
            totalPages: result.data.totalPages,
            hasMore: result.data.page < result.data.totalPages,
            hasPrevious: result.data.page > 1,
          },
          meta: {
            responseTime: `${responseTime}ms`,
            cached: responseTime < 50, // Likely from cache if very fast
          },
        },
      },
      {
        status: 200,
        headers: {
          "X-Response-Time": `${responseTime}ms`,
          "X-Data-Source": "data-orchestration",
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
