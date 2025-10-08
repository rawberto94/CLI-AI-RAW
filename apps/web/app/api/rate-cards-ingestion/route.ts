import { NextResponse } from "next/server";
import { mockRateCards } from "@/lib/mock-database";

export async function GET() {
  try {
    const rateCards = mockRateCards.map((card, index) => ({
      id: card.id,
      supplierName: card.supplier,
      effectiveDate: card.extractedAt.toISOString(),
      expiryDate: null,
      originalCurrency: "USD",
      status:
        card.confidence > 90
          ? "APPROVED"
          : index % 2 === 0
          ? "PENDING_APPROVAL"
          : "DRAFT",
      importedAt: card.extractedAt.toISOString(),
      importedBy: "demo.user@acme.com",
      _count: {
        roles: card.services.length,
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
