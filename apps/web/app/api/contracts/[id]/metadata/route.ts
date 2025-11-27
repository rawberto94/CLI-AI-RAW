/**
 * Contract Metadata API
 * Manages contract metadata, tags, and custom fields
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // Get contract with metadata fields
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        fileName: true,
        contractType: true,
        status: true,
        effectiveDate: true,
        expirationDate: true,
        totalValue: true,
        currency: true,
        supplierName: true,
        clientName: true,
        description: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: "Contract not found"
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: contract
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
    const metadata = body.metadata || body;

    if (!contractId) {
      return NextResponse.json({
        success: false,
        error: "Contract ID is required"
      }, { status: 400 });
    }

    // Update contract metadata
    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        ...(metadata.contractType && { contractType: metadata.contractType }),
        ...(metadata.status && { status: metadata.status }),
        ...(metadata.effectiveDate && { effectiveDate: new Date(metadata.effectiveDate) }),
        ...(metadata.expirationDate && { expirationDate: new Date(metadata.expirationDate) }),
        ...(metadata.totalValue !== undefined && { totalValue: metadata.totalValue }),
        ...(metadata.currency && { currency: metadata.currency }),
        ...(metadata.supplierName && { supplierName: metadata.supplierName }),
        ...(metadata.clientName && { clientName: metadata.clientName }),
        ...(metadata.description && { description: metadata.description }),
        ...(metadata.tags && { tags: metadata.tags }),
        updatedAt: new Date(),
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedContract,
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