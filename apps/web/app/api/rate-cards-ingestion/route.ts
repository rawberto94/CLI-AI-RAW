import { NextResponse } from "next/server";
import { rateCardManagementService } from "@/lib/data-orchestration";
import { getServerTenantId } from "@/lib/tenant-server";

export async function GET() {
  try {
    const tenantId = await getServerTenantId();
    
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

    interface RateCardData {
      id: string;
      supplierName: string;
      effectiveDate: Date;
      expiryDate?: Date | null;
      originalCurrency: string;
      status: string;
      importedAt: Date;
      importedBy: string;
      roles?: unknown[];
    }

    const rateCards = result.map((card: RateCardData) => ({
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
