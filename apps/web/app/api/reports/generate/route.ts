import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

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
      data = await generateSupplierReport(fields, filters, ctx.tenantId);
      break;
    case "rate-card":
      data = await generateRateCardReport(fields, filters, ctx.tenantId);
      break;
    case "contract":
      data = await generateContractReport(fields, filters, ctx.tenantId);
      break;
    case "performance":
      data = await generatePerformanceReport(fields, filters, ctx.tenantId);
      break;
    case "financial":
      data = await generateFinancialReport(fields, filters, ctx.tenantId);
      break;
    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid report type', 400);
  }

  rows = data.length;

  return createSuccessResponse(ctx, { rows, data });
});

async function generateSupplierReport(
  fields: string[],
  _filters: Record<string, any>,
  tenantId: string,
): Promise<any[]> {
  const suppliers = await db.rateCardSupplier.findMany({
    where: { tenantId },
    select: {
      name: true,
      totalContracts: true,
      rateCards: {
        select: {
          dailyRate: true,
        },
      },
    },
    take: 500,
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
      result.avgPerformance = null; // Requires performance tracking integration

    return result;
  });
}

async function generateRateCardReport(
  fields: string[],
  _filters: Record<string, any>,
  tenantId: string,
): Promise<any[]> {
  const rateCards = await db.rateCardEntry.findMany({
    where: { tenantId },
    select: {
      roleOriginal: true,
      seniority: true,
      dailyRate: true,
    },
    take: 1000,
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
  _filters: Record<string, any>,
  tenantId: string,
): Promise<any[]> {
  const contracts = await db.contract.findMany({
    where: { tenantId },
    select: {
      contractTitle: true,
      fileName: true,
      totalValue: true,
      startDate: true,
      endDate: true,
    },
    take: 500,
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
  _filters: Record<string, any>,
  tenantId: string,
): Promise<any[]> {
  const suppliers = await db.rateCardSupplier.findMany({
    where: { tenantId },
    select: { name: true },
    take: 500,
  });

  return suppliers.map((supplier) => {
    const result: any = {};

    // Performance metrics not yet available - requires tracking integration
    if (fields.includes("on_time_delivery"))
      result.onTimeDelivery = null;
    if (fields.includes("quality_score"))
      result.qualityScore = null;
    if (fields.includes("cost_efficiency"))
      result.costEfficiency = null;
    if (fields.includes("responsiveness"))
      result.responsiveness = null;

    result.supplierName = supplier.name;

    return result;
  });
}

async function generateFinancialReport(
  fields: string[],
  _filters: Record<string, any>,
  tenantId: string,
): Promise<any[]> {
  const contracts = await db.contract.findMany({
    where: { tenantId },
    select: {
      startDate: true,
      totalValue: true,
    },
    take: 1000,
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
