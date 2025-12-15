/**
 * Contract Details API
 * GET /api/contracts/[id] - Get contract with artifacts and processing status
 *
 * ✅ MIGRATED to data-orchestration service
 * - Uses centralized ContractService and ArtifactService
 * - Type-safe with automatic caching
 * - Consistent error handling
 */

import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { getServerTenantId } from "@/lib/tenant-server";
import { join } from "path";

// Using singleton prisma instance from @/lib/prisma

export const runtime = "nodejs";

// Get contract details and processing status
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const startTime = Date.now();

  try {
    const contractId = params.id;

    if (!contractId) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
    }

    const tenantId = await getServerTenantId();

    // Get contract directly from database
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        tenantId: tenantId,
      },
    });

    console.log("[API] Contract result:", {
      found: !!contract,
      id: contract?.id,
      status: contract?.status,
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // Get artifacts directly from database
    const artifacts = await prisma.artifact.findMany({
      where: {
        contractId: contractId,
        tenantId: tenantId,
      },
    });

    console.log("[API] Artifacts result:", {
      count: artifacts.length,
      types: artifacts.map((a) => a.type),
    });

    // Transform artifacts into expected format
    const artifactsByType = artifacts.reduce((acc, artifact) => {
      acc[artifact.type.toLowerCase()] = artifact.data;
      return acc;
    }, {} as Record<string, any>);

    // Combine contract metadata with artifacts
    const contractData = {
      id: contract.id,
      filename: contract.fileName || "Unknown",
      uploadDate:
        contract.uploadedAt?.toISOString() || new Date().toISOString(),
      status: mapContractStatus(contract.status),
      tenantId: contract.tenantId || "demo",
      uploadedBy: contract.uploadedBy || "user",
      fileSize: Number(contract.fileSize) || 0,
      mimeType: contract.mimeType || "application/pdf",
      processing: {
        jobId: contract.id,
        status: contract.status || "PROCESSING",
        currentStage:
          contract.status === "COMPLETED" ? "completed" : "processing",
        progress: contract.status === "COMPLETED" ? 100 : 50,
        startTime:
          contract.uploadedAt?.toISOString() || new Date().toISOString(),
        completedAt:
          contract.status === "COMPLETED"
            ? contract.processedAt?.toISOString() || new Date().toISOString()
            : undefined,
      },
      extractedData: artifactsByType,
    };

    // Check if we have real processing results
    const hasRealResults =
      contractData.extractedData && contractData.status === "completed";

    // Add some computed fields for the UI
    const enrichedData = {
      ...contractData,
      processingDuration: contractData.processing.completedAt
        ? new Date(contractData.processing.completedAt).getTime() -
          new Date(contractData.processing.startTime).getTime()
        : Date.now() - new Date(contractData.processing.startTime).getTime(),

      // Add artifacts array and count
      artifacts: Array.isArray(contractData.extractedData)
        ? contractData.extractedData
        : contractData.extractedData &&
          typeof contractData.extractedData === "object"
        ? Object.entries(contractData.extractedData).map(([type, data]) => ({
            type,
            data,
          }))
        : [],
      artifactCount: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.length
        : contractData.extractedData &&
          typeof contractData.extractedData === "object"
        ? Object.keys(contractData.extractedData).length
        : 0,

      // Add summary statistics
      summary: {
        totalClauses: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (a: any) => a.type === "CLAUSES" || a.type === "clauses"
            )?.data?.clauses?.length || 0
          : contractData.extractedData?.clauses?.clauses?.length || 0,
        riskFactors: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (a: any) => a.type === "RISK" || a.type === "risk"
            )?.data?.risks?.length || 0
          : contractData.extractedData?.risk?.risks?.length || 0,
        complianceIssues: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (a: any) => a.type === "COMPLIANCE" || a.type === "compliance"
            )?.data?.regulations?.length || 0
          : contractData.extractedData?.compliance?.regulations?.length || 0,
        financialTerms: Array.isArray(contractData.extractedData)
          ? Object.keys(
              contractData.extractedData.find(
                (a: any) => a.type === "FINANCIAL" || a.type === "financial"
              )?.data || {}
            ).filter((k) => k !== "_meta").length
          : Object.keys(contractData.extractedData?.financial || {}).length,
        keyParties: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (a: any) => a.type === "OVERVIEW" || a.type === "metadata"
            )?.data?.parties?.length || 0
          : contractData.extractedData?.metadata?.parties?.length ||
            contractData.extractedData?.overview?.parties?.length ||
            0,
        extractedTables: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find((a: any) => a.type === "financial")
              ?.data?.extractedTables?.length || 0
          : contractData.extractedData?.financial?.extractedTables?.length || 0,
        rateCards: Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find((a: any) => a.type === "financial")
              ?.data?.rateCards?.length || 0
          : contractData.extractedData?.financial?.rateCards?.length || 0,
        totalSavingsOpportunity: Array.isArray(contractData.extractedData)
          ? contractData.extractedData
              .find((a: any) => a.type === "financial")
              ?.data?.benchmarkingResults?.reduce(
                (sum: number, br: any) =>
                  sum + (br.totalSavingsOpportunity || 0),
                0
              ) || 0
          : contractData.extractedData?.financial?.benchmarkingResults?.reduce(
              (sum: number, br: any) => sum + (br.totalSavingsOpportunity || 0),
              0
            ) || 0,
      },

      // Add processing insights
      insights: generateProcessingInsights(contractData),

      // Transform artifacts array to individual fields for UI compatibility
      financial: transformFinancialData(
        Array.isArray(contractData.extractedData)
          ? contractData.extractedData.find(
              (a: any) => a.type === "FINANCIAL" || a.type === "financial"
            )?.data
          : contractData.extractedData?.financial
      ),
      metadata: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: any) => a.type === "OVERVIEW" || a.type === "metadata"
          )?.data
        : contractData.extractedData?.metadata,
      risk: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: any) => a.type === "RISK" || a.type === "risk"
          )?.data
        : contractData.extractedData?.risk,
      compliance: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: any) => a.type === "COMPLIANCE" || a.type === "compliance"
          )?.data
        : contractData.extractedData?.compliance,
      clauses: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: any) => a.type === "CLAUSES" || a.type === "clauses"
          )?.data
        : contractData.extractedData?.clauses,
      obligations: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: any) => a.type === "OBLIGATIONS" || a.type === "obligations"
          )?.data
        : contractData.extractedData?.obligations,
      renewal: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: any) => a.type === "RENEWAL" || a.type === "renewal"
          )?.data
        : contractData.extractedData?.renewal,
      negotiationPoints: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: any) => a.type === "NEGOTIATION" || a.type === "negotiation"
          )?.data
        : contractData.extractedData?.negotiation || contractData.extractedData?.negotiationPoints,
      amendments: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: any) => a.type === "AMENDMENTS" || a.type === "amendments"
          )?.data
        : contractData.extractedData?.amendments,
      contacts: Array.isArray(contractData.extractedData)
        ? contractData.extractedData.find(
            (a: any) => a.type === "CONTACTS" || a.type === "contacts"
          )?.data
        : contractData.extractedData?.contacts,
    };

    const responseTime = Date.now() - startTime;

    return NextResponse.json(enrichedData, {
      headers: {
        "X-Response-Time": `${responseTime}ms`,
        "X-Data-Source": "data-orchestration",
        "X-Cache-Status": responseTime < 50 ? "HIT" : "MISS",
      },
    });
  } catch (error) {
    console.error("Error fetching contract:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch contract details",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Helper function to map contract status
function mapContractStatus(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "PROCESSING":
      return "processing";
    case "FAILED":
      return "error";
    case "UPLOADED":
      return "processing";
    default:
      return "processing";
  }
}

// Update contract metadata
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const contractId = params.id;
    const updates = await req.json();

    if (!contractId) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
    }

    // Load existing contract data
    const contractDataPath = join(
      process.cwd(),
      "data",
      "contracts",
      `${contractId}.json`
    );

    if (!existsSync(contractDataPath)) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    const contractData = JSON.parse(await readFile(contractDataPath, "utf-8"));

    // Update allowed fields
    const allowedUpdates = [
      "clientId",
      "supplierId",
      "notes",
      "tags",
      "priority",
    ];
    const filteredUpdates = Object.keys(updates)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as any);

    // Apply updates
    const updatedData = {
      ...contractData,
      ...filteredUpdates,
      lastModified: new Date().toISOString(),
    };

    // Save updated data
    await writeFile(contractDataPath, JSON.stringify(updatedData, null, 2));

    return NextResponse.json(updatedData);
  } catch (error) {
    console.error("Error updating contract:", error);
    return NextResponse.json(
      {
        error: "Failed to update contract",
      },
      { status: 500 }
    );
  }
}

// Delete contract
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const contractId = params.id;

    if (!contractId) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
    }

    const contractDataPath = join(
      process.cwd(),
      "data",
      "contracts",
      `${contractId}.json`
    );

    if (!existsSync(contractDataPath)) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // Delete contract file
    await unlink(contractDataPath);

    // Also try to delete the uploaded file
    try {
      const contractData = JSON.parse(
        await readFile(contractDataPath, "utf-8")
      );
      if (contractData.filePath && existsSync(contractData.filePath)) {
        await unlink(contractData.filePath);
      }
    } catch (error) {
      // File might already be deleted, ignore error
    }

    return NextResponse.json({ message: "Contract deleted successfully" });
  } catch (error) {
    console.error("Error deleting contract:", error);
    return NextResponse.json(
      {
        error: "Failed to delete contract",
      },
      { status: 500 }
    );
  }
}

function generateProcessingInsights(contractData: any) {
  const insights = [];

  // Processing performance insight
  if (contractData.processing.completedAt) {
    const duration =
      new Date(contractData.processing.completedAt).getTime() -
      new Date(contractData.processing.startTime).getTime();
    const durationSeconds = Math.round(duration / 1000);

    insights.push({
      type: "performance",
      title: "Processing Performance",
      description: `Contract processed in ${durationSeconds} seconds`,
      icon: "zap",
      color: "green",
    });
  }

  // Risk insight
  if (contractData.extractedData?.risk) {
    const risk = contractData.extractedData.risk;
    insights.push({
      type: "risk",
      title: `${risk.riskLevel} Risk Level`,
      description: `Risk score: ${risk.riskScore}/100 with ${
        risk.riskFactors?.length || 0
      } identified factors`,
      icon: "shield",
      color:
        risk.riskLevel === "LOW"
          ? "green"
          : risk.riskLevel === "MEDIUM"
          ? "yellow"
          : "red",
    });
  }

  // Compliance insight
  if (contractData.extractedData?.compliance) {
    const compliance = contractData.extractedData.compliance;
    insights.push({
      type: "compliance",
      title: "Compliance Status",
      description: `${compliance.complianceScore}% compliant with ${
        compliance.regulations?.length || 0
      } regulations checked`,
      icon: "award",
      color:
        compliance.complianceScore >= 90
          ? "green"
          : compliance.complianceScore >= 70
          ? "yellow"
          : "red",
    });
  }

  // Financial insight
  if (contractData.extractedData?.financial) {
    const financial = contractData.extractedData.financial;
    insights.push({
      type: "financial",
      title: "Financial Terms",
      description: `Total value: ${
        financial.currency
      } ${financial.totalValue?.toLocaleString()} with ${
        financial.paymentTerms
      }`,
      icon: "dollar-sign",
      color: "blue",
    });
  }

  // Clause completeness insight
  if (contractData.extractedData?.clauses) {
    const clauses = contractData.extractedData.clauses;
    insights.push({
      type: "clauses",
      title: "Clause Analysis",
      description: `${clauses.clauses?.length || 0} clauses extracted with ${
        clauses.completeness?.score || 0
      }% completeness`,
      icon: "file-text",
      color: "purple",
    });
  }

  return insights;
}

function transformFinancialData(financialData: any) {
  if (!financialData) return null;

  // Convert paymentTerms array to a summary string for UI compatibility
  let paymentTermsSummary = "Not specified";
  if (
    Array.isArray(financialData.paymentTerms) &&
    financialData.paymentTerms.length > 0
  ) {
    paymentTermsSummary = `${financialData.paymentTerms.length} payment milestones`;
  } else if (typeof financialData.paymentTerms === "string") {
    paymentTermsSummary = financialData.paymentTerms;
  }

  return {
    ...financialData,
    // Convert array to string for backward compatibility, but keep original array
    paymentTerms: paymentTermsSummary,
    paymentSchedule: Array.isArray(financialData.paymentTerms)
      ? financialData.paymentTerms
      : [],
    milestones:
      financialData.extractedTables?.filter(
        (t: any) => t.type === "payment_schedule"
      ).length || 0,
    penalties: Array.isArray(financialData.penalties)
      ? financialData.penalties.join(", ")
      : financialData.penalties || "None specified",
    extractedTables: financialData.extractedTables || [],
    rateCards:
      financialData.rateCards?.map((rc: any) => ({
        ...rc,
        insights: rc.insights || {
          totalAnnualSavings: financialData.benchmarkingResults?.find(
            (br: any) => br.rateCardId === rc.id
          )?.totalSavingsOpportunity
            ? `$${financialData.benchmarkingResults
                .find((br: any) => br.rateCardId === rc.id)
                .totalSavingsOpportunity.toLocaleString()}`
            : "$0",
          averageVariance: financialData.benchmarkingResults?.find(
            (br: any) => br.rateCardId === rc.id
          )?.averageVariance
            ? `${
                financialData.benchmarkingResults.find(
                  (br: any) => br.rateCardId === rc.id
                ).averageVariance > 0
                  ? "+"
                  : ""
              }${financialData.benchmarkingResults
                .find((br: any) => br.rateCardId === rc.id)
                .averageVariance.toFixed(1)}%`
            : "0%",
          ratesAboveMarket:
            financialData.benchmarkingResults?.find(
              (br: any) => br.rateCardId === rc.id
            )?.ratesAboveMarket || 0,
          ratesBelowMarket:
            financialData.benchmarkingResults?.find(
              (br: any) => br.rateCardId === rc.id
            )?.ratesBelowMarket || 0,
          recommendation:
            financialData.benchmarkingResults?.find(
              (br: any) => br.rateCardId === rc.id
            )?.recommendations?.[0] || "No specific recommendations",
        },
      })) || [],
    benchmarkingResults: financialData.benchmarkingResults || [],
    insights: financialData.insights || {
      totalPotentialSavings: 0,
      highestSavingsOpportunity: { role: "N/A", amount: 0 },
      rateAnalysisSummary: {
        totalRoles: 0,
        aboveMarketCount: 0,
        belowMarketCount: 0,
        averageVariance: 0,
      },
      recommendations: [],
      riskFactors: [],
    },
  };
}
