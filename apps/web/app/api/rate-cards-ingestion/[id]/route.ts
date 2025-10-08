import { NextResponse } from "next/server";
import { mockRateCards } from "@/lib/mock-database";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const rateCard = mockRateCards.find((card) => card.id === params.id);

    if (!rateCard) {
      return NextResponse.json(
        { error: "Rate card not found" },
        { status: 404 }
      );
    }

    const mappedRateCard = {
      id: rateCard.id,
      supplierName: rateCard.supplier,
      supplierTier: rateCard.confidence > 92 ? "TIER_1" : "TIER_2",
      effectiveDate: rateCard.extractedAt.toISOString(),
      expiryDate: null as string | null,
      originalCurrency: "USD",
      baseCurrency: "USD",
      status: rateCard.confidence > 90 ? "APPROVED" : "PENDING_APPROVAL",
      importedAt: rateCard.extractedAt.toISOString(),
      importedBy: "demo.user@acme.com",
      source: "Mock Import",
    };

    const roles = rateCard.services.map((service, idx) => {
      const hourlyRate =
        service.unit === "/hour"
          ? service.currentRate
          : service.currentRate / 8;
      return {
        id: `${rateCard.id}-${idx}`,
        standardizedRole: service.name,
        originalRoleName: service.name,
        seniorityLevel: "Senior",
        serviceLine: service.category,
        country: "United States",
        city: null,
        dailyRate:
          service.unit === "/hour"
            ? service.currentRate * 8
            : service.currentRate,
        hourlyRate,
        monthlyRate: hourlyRate * 8 * 20,
        baseCurrency: "USD",
        confidence: rateCard.confidence,
        dataQuality: rateCard.confidence > 90 ? "HIGH" : "MEDIUM",
      };
    });

    return NextResponse.json({ rateCard: mappedRateCard, roles });
  } catch (error) {
    console.error("Error fetching rate card details:", error);
    return NextResponse.json(
      { error: "Failed to fetch rate card details" },
      { status: 500 }
    );
  }
}
