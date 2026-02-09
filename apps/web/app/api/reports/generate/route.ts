import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

interface ReportGenerationRequest {
  type: "supplier" | "rate-card" | "contract" | "performance" | "financial";
  fields: string[];
  filters?: Record<string, any>;
  groupBy?: string;
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body: ReportGenerationRequest = await request.json();
  const { type, fields, filters = {}, groupBy: _groupBy } = body;

  let data: any[] = [];
  let rows = 0;

  switch (type) {
    case "supplier":
      data = await generateSupplierReport(fields, filters);
      break;
    case "rate-card":
      data = await generateRateCardReport(fields, filters);
      break;
    case "contract":
      data = await generateContractReport(fields, filters);
      break;
    case "performance":
      data = await generatePerformanceReport(fields, filters);
      break;
    case "financial":
      data = await generateFinancialReport(fields, filters);
      break;
    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid report type', 400);
  }

  rows = data.length;

  return createSuccessResponse(ctx, { rows, data });
});

async function generateSupplierReport(
  fields: string[],
  _filters: Record<string, any>
): Promise<any[]> {
  const suppliers = await db.rateCardSupplier.findMany({
    include: {
      rateCards: true,
    },
  });

  return suppliers.map((supplier) => {
    const result: any = {};

    if (fields.includes("supplier_name")) result.supplierName = supplier.name;
    if (fields.includes("supplier_count")) result.supplierCount = 1;
    if (fields.includes("active_contracts"))
      result.activeContracts = supplier.totalContracts;
    if (fields.includes("total_spend"))
      result.totalSpend = supplier.rateCards.reduce(
        (sum: number, rc: any) => sum + Number(rc.dailyRate || 0),
        0
      );
    if (fields.includes("avg_performance"))
      result.avgPerformance = Math.floor(Math.random() * 30) + 70; // Mock data

    return result;
  });
}

async function generateRateCardReport(
  fields: string[],
  _filters: Record<string, any>
): Promise<any[]> {
  const rateCards = await db.rateCardEntry.findMany({
    include: {
      supplier: true,
    },
  });

  return rateCards.map((card) => {
    const result: any = {};

    if (fields.includes("role_name")) result.roleName = card.roleOriginal;
    if (fields.includes("seniority")) result.seniority = card.seniority;
    if (fields.includes("daily_rate"))
      result.dailyRate = Number(card.dailyRate);
    if (fields.includes("avg_rate"))
      result.avgRate = Number(card.dailyRate);
    if (fields.includes("rate_count")) result.rateCount = 1;

    return result;
  });
}

async function generateContractReport(
  fields: string[],
  _filters: Record<string, any>
): Promise<any[]> {
  const contracts = await db.contract.findMany({
    include: {
      supplier: true,
    },
  });

  return contracts.map((contract) => {
    const result: any = {};

    if (fields.includes("contract_name")) result.contractName = contract.contractTitle || contract.fileName;
    if (fields.includes("contract_value"))
      result.contractValue = contract.totalValue?.toNumber() || 0;
    if (fields.includes("start_date"))
      result.startDate = contract.startDate?.toISOString();
    if (fields.includes("end_date"))
      result.endDate = contract.endDate?.toISOString();
    if (fields.includes("days_to_renewal")) {
      const daysToRenewal = contract.endDate
        ? Math.floor(
            (contract.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        : null;
      result.daysToRenewal = daysToRenewal;
    }

    return result;
  });
}

async function generatePerformanceReport(
  fields: string[],
  _filters: Record<string, any>
): Promise<any[]> {
  const suppliers = await db.rateCardSupplier.findMany();

  return suppliers.map((supplier) => {
    const result: any = {};

    // Mock performance data - in production, this would come from a performance tracking system
    if (fields.includes("on_time_delivery"))
      result.onTimeDelivery = Math.floor(Math.random() * 20) + 80;
    if (fields.includes("quality_score"))
      result.qualityScore = Math.floor(Math.random() * 20) + 75;
    if (fields.includes("cost_efficiency"))
      result.costEfficiency = Math.floor(Math.random() * 25) + 70;
    if (fields.includes("responsiveness"))
      result.responsiveness = Math.floor(Math.random() * 20) + 80;

    result.supplierName = supplier.name;

    return result;
  });
}

async function generateFinancialReport(
  fields: string[],
  _filters: Record<string, any>
): Promise<any[]> {
  const contracts = await db.contract.findMany({
    include: {
      supplier: true,
    },
  });

  // Group by month
  const monthlyData = new Map<string, any>();

  contracts.forEach((contract) => {
    if (!contract.startDate) return;

    const month = contract.startDate.toISOString().substring(0, 7);
    const value = contract.totalValue?.toNumber() || 0;

    if (!monthlyData.has(month)) {
      monthlyData.set(month, {
        month,
        monthlySpend: 0,
        quarterlySpend: 0,
        costSavings: 0,
      });
    }

    const data = monthlyData.get(month);
    if (fields.includes("monthly_spend")) data.monthlySpend += value;
    if (fields.includes("quarterly_spend")) data.quarterlySpend += value;
    if (fields.includes("cost_savings"))
      data.costSavings += Math.floor(value * 0.1); // Mock 10% savings
  });

  return Array.from(monthlyData.values());
}
