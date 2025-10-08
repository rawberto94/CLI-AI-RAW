/**
 * Contracts List API
 * GET /api/contracts - List contracts with filtering, sorting, and pagination
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mockDatabase } from "@/lib/mock-database";

// Query parameter schema
const querySchema = z.object({
  // Filters
  status: z.string().optional(),
  contractType: z.string().optional(),
  clientId: z.string().optional(),
  supplierId: z.string().optional(),
  startDateFrom: z.string().datetime().optional(),
  startDateTo: z.string().datetime().optional(),
  endDateFrom: z.string().datetime().optional(),
  endDateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  
  // Sorting
  sortBy: z.string().optional().default("uploadedAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  
  // Pagination
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  offset: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 0)),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  
  // Includes
  include: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    
    // Validate query parameters
    const validated = querySchema.parse(params);

    const filters = {
      status: validated.status,
      contractType: validated.contractType,
    };

    const contracts = await mockDatabase.searchContracts(validated.search ?? "", filters);

    const filtered = contracts.filter((contract) => {
      const matchesClient = validated.clientId ? contract.parties?.includes(validated.clientId) : true;
      const matchesSupplier = validated.supplierId ? contract.parties?.includes(validated.supplierId) : true;

      const contractStart = contract.uploadDate instanceof Date ? contract.uploadDate : new Date(contract.uploadDate ?? Date.now());
      const matchesStartFrom = validated.startDateFrom ? contractStart >= new Date(validated.startDateFrom) : true;
      const matchesStartTo = validated.startDateTo ? contractStart <= new Date(validated.startDateTo) : true;

      return matchesClient && matchesSupplier && matchesStartFrom && matchesStartTo;
    });

    const sorted = [...filtered].sort((a, b) => {
      const field = validated.sortBy as keyof typeof a;
      const aVal = a[field] as any;
      const bVal = b[field] as any;

      if (aVal === bVal) return 0;
      if (aVal == null) return validated.sortOrder === "asc" ? -1 : 1;
      if (bVal == null) return validated.sortOrder === "asc" ? 1 : -1;

      if (aVal > bVal) return validated.sortOrder === "asc" ? 1 : -1;
      return validated.sortOrder === "asc" ? -1 : 1;
    });

    const limit = validated.limit ?? 20;
    const offset = validated.page ? (validated.page - 1) * limit : validated.offset ?? 0;
    const paginated = sorted.slice(offset, offset + limit);
    const total = sorted.length;

    const responseContracts = paginated.map((contract) => ({
      id: contract.id,
      filename: contract.name,
      originalName: contract.name,
      status: contract.status ?? "COMPLETED",
      processingStatus: contract.status ?? "COMPLETED",
      uploadedAt: contract.uploadDate ?? new Date(),
      fileSize: 0,
      mimeType: "application/pdf",
      contractType: contract.contractType ?? "UNKNOWN",
      totalValue: contract.totalValue ?? 0,
      currency: "USD",
      startDate: contract.uploadDate ?? new Date(),
      endDate: contract.uploadDate ?? new Date(),
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          contracts: responseContracts,
          pagination: {
            total,
            limit,
            offset,
            page: validated.page ?? Math.floor(offset / limit) + 1,
            totalPages: Math.ceil(total / limit),
            hasMore: offset + limit < total,
            hasPrevious: offset > 0,
          },
        },
      },
      { status: 200 }
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
