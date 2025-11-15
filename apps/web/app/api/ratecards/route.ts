import { NextRequest, NextResponse } from "next/server";
import { rateCardManagementService } from "@/lib/data-orchestration";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const tenantId = "demo"; // TODO: Get from auth session

    // Get rate cards using real service
    const result = await rateCardManagementService.getRateCards(tenantId);

    // Check if result is an array or an object with success/data
    const rateCards = Array.isArray(result) ? result : (result as any).success && (result as any).data ? (result as any).data : [];

    if (!Array.isArray(rateCards)) {
      return NextResponse.json(
        { error: "Failed to fetch rate cards" },
        { status: 500 }
      );
    }

    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCards = rateCards.slice(startIndex, endIndex);

    return NextResponse.json({
      items: paginatedCards,
      total: rateCards.length,
      page,
      limit,
      totalPages: Math.ceil(rateCards.length / limit),
    });
  } catch (error) {
    console.error("Error fetching rate cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch rate cards" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = "demo"; // TODO: Get from auth session

    // Create rate card using real service
    const result = await rateCardManagementService.createRateCard({
      tenantId,
      supplierName: body.supplierName,
      effectiveDate: body.effectiveDate
        ? new Date(body.effectiveDate)
        : new Date(),
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      currency: body.currency || "CHF",
      roles: body.roles || [],
    });

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: "Failed to create rate card" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...result.data,
      status: "created",
    });
  } catch (error) {
    console.error("Error creating rate card:", error);
    return NextResponse.json(
      { error: "Failed to create rate card" },
      { status: 500 }
    );
  }
}
