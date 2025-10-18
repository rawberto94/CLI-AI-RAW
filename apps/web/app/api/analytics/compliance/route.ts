import { NextRequest, NextResponse } from "next/server";
import { analyticalIntelligenceService } from "@/lib/services/analytical-intelligence.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const contractId = searchParams.get("contractId");
    const tenantId = searchParams.get("tenantId") || "default";

    const complianceEngine =
      analyticalIntelligenceService.getComplianceEngine();

    switch (action) {
      case "scan":
        if (!contractId) {
          return NextResponse.json(
            { error: "Contract ID required" },
            { status: 400 }
          );
        }
        const scanResult = await complianceEngine.scanContract(contractId);
        return NextResponse.json(scanResult);

      case "report":
        const filters = {
          tenantId,
          supplierId: searchParams.get("supplierId") || undefined,
          riskLevel: searchParams.get("riskLevel") || undefined,
          clauseType: searchParams.get("clauseType") || undefined,
          dateRange:
            searchParams.get("startDate") && searchParams.get("endDate")
              ? {
                  start: new Date(searchParams.get("startDate")!),
                  end: new Date(searchParams.get("endDate")!),
                }
              : undefined,
        };
        const report = await complianceEngine.generateComplianceReport(filters);
        return NextResponse.json(report);

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Compliance API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, policies, complianceResult } = body;

    const complianceEngine =
      analyticalIntelligenceService.getComplianceEngine();

    switch (action) {
      case "update-policies":
        if (!policies) {
          return NextResponse.json(
            { error: "Policies required" },
            { status: 400 }
          );
        }
        await complianceEngine.updatePolicies(policies);
        return NextResponse.json({ success: true });

      case "recommend-remediation":
        if (!complianceResult) {
          return NextResponse.json(
            { error: "Compliance result required" },
            { status: 400 }
          );
        }
        const remediationPlan = await complianceEngine.recommendRemediation(
          complianceResult
        );
        return NextResponse.json(remediationPlan);

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Compliance API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
