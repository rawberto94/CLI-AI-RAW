import { NextResponse } from "next/server";
import { rateCardManagementService } from "@/lib/data-orchestration";

export async function GET() {
  try {
    const tenantId = "demo"; // TODO: Get from auth session
    
    // Get rate cards using real service
    const result = await rateCardManagementService.getRateCards(tenantId);
    
    // Handle empty result or stub
    if (!result || !Array.isArray(result)) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0
      });
    }

    const rateCards = result.map((card: any) => ({
      id: card.id,
      supplierName: card.supplierName,
      effectiveDate: card.effectiveDate.toISOString(),
      expiryDate: card.expiryDate?.toISOString() || null,
      originalCurrency: card.originalCurrency,
      status: card.status,
      importedAt: card.importedAt.toISOString(),
      importedBy: card.importedBy,
      _count: {
        roles: card.roles?.length || 0,
      },
    }));

    return NextResponse.json(rateCards);
  } catch (error) {
    console.error("Error fetching rate cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch rate cards" },
      { status: 500 }
    );
  }
}
