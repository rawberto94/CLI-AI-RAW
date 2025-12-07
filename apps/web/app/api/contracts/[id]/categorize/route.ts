/**
 * AI-Powered Contract Categorization API
 * POST /api/contracts/[id]/categorize - Trigger AI categorization for a contract
 * 
 * Uses AI-extracted metadata (supplier, service description, deliverables, etc.)
 * to intelligently categorize contracts into the tenant's taxonomy.
 */

import { NextRequest, NextResponse } from "next/server";
import { categorizeContract } from "@/lib/categorization-service";
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from "@/lib/tenant-server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: contractId } = await params;
    const tenantId = request.headers.get("x-tenant-id") || "demo";

    // Get optional body parameters
    const body = await request.json().catch(() => ({}));
    const { forceRecategorize = true } = body;

    console.log(`🏷️ AI Categorization request for contract: ${contractId}`);

    // Check contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        contractTitle: true,
        category: true,
        supplierName: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: "Contract not found" },
        { status: 404 }
      );
    }

    // Run AI categorization
    const result = await categorizeContract({
      contractId,
      tenantId,
      forceRecategorize,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        contractId,
        previousCategory: contract.category,
        newCategory: result.category,
        categoryPath: result.categoryPath,
        confidence: result.confidence,
        method: result.method,
        reasoning: result.reasoning,
        alternativeCategories: result.alternativeCategories,
        message: `Contract categorized as "${result.category}" with ${result.confidence}% confidence`,
      });
    } else {
      return NextResponse.json({
        success: false,
        contractId,
        currentCategory: contract.category,
        error: result.error,
        message: "Could not categorize contract",
      }, { status: 400 });
    }
  } catch (error) {
    console.error("Categorization API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Categorization failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET - Get current category and suggestions
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: contractId } = await params;
    const tenantId = await getApiTenantId(request);

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        contractTitle: true,
        category: true,
        categoryL1: true,
        categoryL2: true,
        supplierName: true,
        contractType: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: "Contract not found" },
        { status: 404 }
      );
    }

    // Get available categories
    const categories = await prisma.taxonomyCategory.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        path: true,
        level: true,
        description: true,
      },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
    });

    return NextResponse.json({
      success: true,
      contractId,
      currentCategory: contract.category,
      categoryL1: contract.categoryL1,
      categoryL2: contract.categoryL2,
      contractInfo: {
        title: contract.contractTitle,
        supplier: contract.supplierName,
        type: contract.contractType,
      },
      availableCategories: categories,
    });
  } catch (error) {
    console.error("Get category error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get category" },
      { status: 500 }
    );
  }
}
