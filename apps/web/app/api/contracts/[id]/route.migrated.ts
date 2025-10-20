/**
 * Contract Detail API
 * GET /api/contracts/[id] - Get contract details with artifacts
 * PUT /api/contracts/[id] - Update contract metadata
 * DELETE /api/contracts/[id] - Delete contract (soft delete)
 *
 * ✅ MIGRATED to data-orchestration service
 * - Uses centralized ContractService with automatic caching
 * - Automatic view tracking
 * - Type-safe with consistent error handling
 */

import { NextResponse } from "next/server";
import { contractService } from "@/lib/data-orchestration";

export const runtime = "nodejs";

// Get contract details and processing status
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const params = await context.params;

  try {
    const contractId = params.id;
    const tenantId = "demo"; // TODO: Get from auth session

    if (!contractId) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
    }

    // Use data-orchestration service (handles caching & view tracking automatically)
    const result = await contractService.getContract(contractId, tenantId);

    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Contract not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    const contract = result.data;
    const responseTime = Date.now() - startTime;

    // Transform contract data for UI compatibility
    const contractData = {
      id: contract.id,
      filename: contract.fileName,
      originalName: contract.originalName || contract.fileName,
      uploadDate: contract.uploadedAt.toISOString(),
      status: contract.status.toLowerCase(),
      tenantId: contract.tenantId,
      uploadedBy: contract.uploadedBy || "user",
      fileSize: Number(contract.fileSize),
      mimeType: contract.mimeType,

      // Contract metadata
      contractTitle: contract.contractTitle,
      description: contract.description,
      contractType: contract.contractType,
      category: contract.category,

      // Parties
      clientName: contract.clientName,
      supplierName: contract.supplierName,

      // Financial
      totalValue: contract.totalValue ? Number(contract.totalValue) : null,
      currency: contract.currency,

      // Dates
      startDate: contract.startDate,
      endDate: contract.endDate,
      effectiveDate: contract.effectiveDate,
      expirationDate: contract.expirationDate,
      jurisdiction: contract.jurisdiction,

      // Analytics
      viewCount: contract.viewCount,
      lastViewedAt: contract.lastViewedAt,
      lastViewedBy: contract.lastViewedBy,

      // Processing status
      processing: {
        jobId: contract.id,
        status: contract.status,
        currentStage:
          contract.status === "COMPLETED" ? "completed" : "processing",
        progress: contract.status === "COMPLETED" ? 100 : 50,
        startTime: contract.uploadedAt.toISOString(),
        completedAt: contract.processedAt?.toISOString(),
      },

      // Artifacts will be fetched separately via /api/contracts/[id]/artifacts
      // This keeps the response clean and allows for caching optimization

      // Metadata
      meta: {
        responseTime: `${responseTime}ms`,
        cached: responseTime < 50,
        dataSource: "data-orchestration",
      },
    };

    return NextResponse.json(contractData, {
      headers: {
        "X-Response-Time": `${responseTime}ms`,
        "X-Data-Source": "data-orchestration",
      },
    });
  } catch (error) {
    console.error("Error fetching contract:", error);
    return NextResponse.json(
      { error: "Failed to fetch contract details" },
      { status: 500 }
    );
  }
}

// Update contract metadata
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;

  try {
    const contractId = params.id;
    const tenantId = "demo"; // TODO: Get from auth session
    const updates = await req.json();

    if (!contractId) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
    }

    // Filter allowed updates (security)
    const allowedFields = [
      "contractTitle",
      "description",
      "category",
      "contractType",
      "clientName",
      "supplierName",
      "totalValue",
      "currency",
      "startDate",
      "endDate",
      "effectiveDate",
      "expirationDate",
      "jurisdiction",
      "tags",
    ];

    const filteredUpdates = Object.keys(updates)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        // Convert date strings to Date objects
        if (key.includes("Date") && updates[key]) {
          obj[key] = new Date(updates[key]);
        } else {
          obj[key] = updates[key];
        }
        return obj;
      }, {} as any);

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Use data-orchestration service (handles cache invalidation)
    const result = await contractService.updateContract(
      contractId,
      tenantId,
      filteredUpdates
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.code === "NOT_FOUND" ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error updating contract:", error);
    return NextResponse.json(
      { error: "Failed to update contract" },
      { status: 500 }
    );
  }
}

// Delete contract (soft delete)
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;

  try {
    const contractId = params.id;
    const tenantId = "demo"; // TODO: Get from auth session

    if (!contractId) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
    }

    // Use data-orchestration service (soft delete, cache invalidation)
    const result = await contractService.deleteContract(contractId, tenantId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: result.error.code === "NOT_FOUND" ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contract deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting contract:", error);
    return NextResponse.json(
      { error: "Failed to delete contract" },
      { status: 500 }
    );
  }
}
