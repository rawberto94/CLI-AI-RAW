import { NextResponse } from "next/server";
import { mockRateCards } from "@/lib/mock-database";

const mockImportHistory = mockRateCards
  .map((card, index) => {
    const successfulRecords = Math.round(
      card.services.length * (card.confidence / 100)
    );

    return {
      id: `job-${index + 1}`,
      fileName: `${card.supplier
        .replace(/\s+/g, "-")
        .toLowerCase()}-rate-card.xlsx`,
      status: card.confidence > 90 ? "COMPLETED" : "PARTIAL_SUCCESS",
      createdAt: card.extractedAt.toISOString(),
      completedAt: card.extractedAt.toISOString(),
      totalRecords: card.services.length,
      successfulRecords,
      failedRecords: Math.max(0, card.services.length - successfulRecords),
      notes:
        card.confidence > 90
          ? "Import completed successfully."
          : "Some records required manual review.",
    };
  })
  .sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

export async function GET() {
  try {
    return NextResponse.json(mockImportHistory);
  } catch (error) {
    console.error("Error fetching import history:", error);
    return NextResponse.json(
      { error: "Failed to fetch import history" },
      { status: 500 }
    );
  }
}
