/**
 * Contracts List API
 * GET /api/contracts - List contracts with filtering, sorting, and pagination
 *
 * ⚠️  TEMPORARY: Using direct Prisma queries due to data-orchestration build issues
 * TODO: Migrate back to ContractService once package is fixed
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling, ValidationError } from "@/lib/api-error-handler";
import { applyRateLimit, EndpointRateLimits } from "@/lib/middleware/rate-limit.middleware";

export const dynamic = "force-dynamic";

async function handler(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await applyRateLimit(request, EndpointRateLimits.contracts);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const startTime = Date.now();

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
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as
    | "asc"
    | "desc";

  // Validate pagination parameters
  if (page < 1) {
    throw new ValidationError("Page must be greater than 0");
  }
  if (limit < 1 || limit > 100) {
    throw new ValidationError("Limit must be between 1 and 100");
  }

  // Build where clause
  const where: any = {
    tenantId,
  };

  if (search) {
    where.OR = [
      { fileName: { contains: search, mode: "insensitive" } },
      { originalName: { contains: search, mode: "insensitive" } },
    ];
  }

  if (statuses.length > 0) {
    where.status = { in: statuses };
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
        createdAt: true,
        status: true,
        contractType: true,
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
          fileSize: contract.fileSize.toString(),
          mimeType: contract.mimeType,
          uploadedAt: contract.createdAt.toISOString(),
          contractType: contract.contractType || "Unknown",
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
}

export const GET = withErrorHandling(handler);
