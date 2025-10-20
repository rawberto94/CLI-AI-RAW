/**
 * Contract Metadata API
 * Manages contract metadata, tags, and custom fields
 */

import { NextRequest, NextResponse } from "next/server";
import { taxonomyService } from "@/lib/data-orchestration";

/**
 * GET /api/contracts/[id]/metadata - Get contract metadata
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = request.headers.get("x-tenant-id") || "demo";

    if (!contractId) {
      return NextResponse.json({
        success: false,
        error: "Contract ID is required"
      }, { status: 400 });
    }

    // Get contract metadata
    const metadataResult = await taxonomyService.getContractMetadata(contractId, tenantId);

    if (!metadataResult.success) {
      return NextResponse.json({
        success: false,
        error: metadataResult.error?.message || "Failed to get contract metadata"
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: metadataResult.data
    });

  } catch (error) {
    console.error("Get contract metadata error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to get contract metadata",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * PUT /api/contracts/[id]/metadata - Update contract metadata
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = request.headers.get("x-tenant-id") || "demo";
    const body = await request.json();

    if (!contractId) {
      return NextResponse.json({
        success: false,
        error: "Contract ID is required"
      }, { status: 400 });
    }

    // Update contract metadata
    const updateResult = await taxonomyService.updateContractMetadata(
      contractId,
      tenantId,
      body,
      "user" // In production, get from auth
    );

    if (!updateResult.success) {
      return NextResponse.json({
        success: false,
        error: updateResult.error?.message || "Failed to update contract metadata"
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updateResult.data,
      message: "Contract metadata updated successfully"
    });

  } catch (error) {
    console.error("Update contract metadata error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to update contract metadata",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
      "Access-Control-Max-Age": "86400"
    }
  });
}