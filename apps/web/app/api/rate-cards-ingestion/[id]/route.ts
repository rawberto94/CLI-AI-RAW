import { NextResponse } from "next/server";
import { rateCardManagementService } from "@/lib/data-orchestration";
import { getServerTenantId } from "@/lib/tenant-server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const tenantId = await getServerTenantId();
    
    // Get rate card using real service
    const result = await rateCardManagementService.getRateCard(tenantId, params.id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: "Rate card not found" },
        { status: 404 }
      );
    }

    const rateCard = result.data;

    const mappedRateCard = {
      id: rateCard.id,
      supplierName: rateCard.supplierName,
      supplierTier: rateCard.supplierTier,
      effectiveDate: rateCard.effectiveDate.toISOString(),
      expiryDate: rateCard.expiryDate?.toISOString() || null,
      originalCurrency: rateCard.originalCurrency,
      baseCurrency: rateCard.baseCurrency,
      status: rateCard.status,
      importedAt: rateCard.importedAt.toISOString(),
      importedBy: rateCard.importedBy,
      source: rateCard.source,
    };

    interface Role {
      id: string;
      standardizedRole: string;
      originalRoleName: string;
      seniorityLevel: string;
      serviceLine: string;
      country: string;
      city: string;
      dailyRate: number | { toString(): string };
      hourlyRate: number | { toString(): string };
      monthlyRate: number | { toString(): string };
      baseCurrency: string;
      confidence: number | { toString(): string };
      dataQuality: string;
    }

    const roles = (rateCard.roles || []).map((role: Role) => ({
      id: role.id,
      standardizedRole: role.standardizedRole,
      originalRoleName: role.originalRoleName,
      seniorityLevel: role.seniorityLevel,
      serviceLine: role.serviceLine,
      country: role.country,
      city: role.city,
      dailyRate: Number(role.dailyRate),
      hourlyRate: Number(role.hourlyRate),
      monthlyRate: Number(role.monthlyRate),
      baseCurrency: role.baseCurrency,
      confidence: Number(role.confidence),
      dataQuality: role.dataQuality,
    }));

    return NextResponse.json({ rateCard: mappedRateCard, roles });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch rate card details" },
      { status: 500 }
    );
  }
}
