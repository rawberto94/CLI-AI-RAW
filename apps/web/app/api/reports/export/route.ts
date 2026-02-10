import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuthApiHandler, createErrorResponse, getApiContext} from '@/lib/api-middleware';

interface ExportRequest {
  type: "supplier" | "rate-card" | "contract" | "performance" | "financial";
  fields: string[];
  format: "pdf" | "excel";
  filters?: Record<string, any>;
}

// Mock implementation - in production, use libraries like jsPDF or xlsx
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body: ExportRequest = await request.json();
  const { type, fields, format, filters = {} } = body;

  // Generate data
  let data: any[] = [];
  switch (type) {
    case "supplier":
      data = await generateSupplierData(fields, filters);
      break;
    case "rate-card":
      data = await generateRateCardData(fields, filters);
      break;
    case "contract":
      data = await generateContractData(fields, filters);
      break;
    case "performance":
      data = await generatePerformanceData(fields, filters);
      break;
    case "financial":
      data = await generateFinancialData(fields, filters);
      break;
    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid export type', 400);
  }

  if (format === "excel") {
    return exportToExcel(data, fields);
  } else {
    return exportToPDF(data, fields);
  }
});

async function generateSupplierData(_fields: string[], _filters: any) {
  const suppliers = await db.rateCardSupplier.findMany({
    include: {
      rateCards: true,
    },
  });

  return suppliers.map((s) => ({
    supplierName: s.name,
    activeRateCards: s.rateCards.length,
    totalRateCards: s.totalRateCards,
    avgRate: s.averageRate?.toNumber() || 0,
    tier: s.tier,
  }));
}

async function generateRateCardData(_fields: string[], _filters: any) {
  const rateCards = await db.rateCardEntry.findMany({
    include: { supplier: true },
  });

  return rateCards.map((rc) => ({
    roleName: rc.roleOriginal,
    seniority: rc.seniority,
    dailyRate: Number(rc.dailyRate),
    supplierName: rc.supplierName,
  }));
}

async function generateContractData(_fields: string[], _filters: any) {
  const contracts = await db.contract.findMany({
    include: { supplier: true },
  });

  return contracts.map((c) => ({
    contractName: c.contractTitle || c.fileName,
    supplierName: c.supplier?.name || c.supplierName || "N/A",
    contractValue: c.totalValue?.toNumber() || 0,
    startDate: c.startDate?.toISOString().split("T")[0],
    endDate: c.endDate?.toISOString().split("T")[0],
    status: c.status,
  }));
}

async function generatePerformanceData(_fields: string[], _filters: any) {
  const suppliers = await db.rateCardSupplier.findMany();

  return suppliers.map((s) => ({
    supplierName: s.name,
    onTimeDelivery: Math.floor(Math.random() * 20) + 80,
    qualityScore: Math.floor(Math.random() * 20) + 75,
    costEfficiency: Math.floor(Math.random() * 25) + 70,
    responsiveness: Math.floor(Math.random() * 20) + 80,
  }));
}

async function generateFinancialData(_fields: string[], _filters: any) {
  const contracts = await db.contract.findMany();

  const monthlyData = new Map<string, any>();
  contracts.forEach((c) => {
    if (!c.startDate) return;
    const month = c.startDate.toISOString().substring(0, 7);
    const value = c.totalValue?.toNumber() || 0;

    if (!monthlyData.has(month)) {
      monthlyData.set(month, { month, spend: 0 });
    }

    monthlyData.get(month).spend += value;
  });

  return Array.from(monthlyData.values());
}

function exportToExcel(data: any[], _fields: string[]) {
  // Mock CSV export (use xlsx library in production)
  const headers = Object.keys(data[0] || {}).join(",");
  const rows = data.map((row) => Object.values(row).join(",")).join("\n");
  const csv = `${headers}\n${rows}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=report-${Date.now()}.xlsx`,
    },
  });
}

function exportToPDF(data: any[], _fields: string[]) {
  // Mock PDF export (use jsPDF or react-pdf in production)
  const pdfContent = `
    REPORT EXPORT
    Generated: ${new Date().toISOString()}
    
    Records: ${data.length}
    
    ${JSON.stringify(data, null, 2)}
  `;

  return new NextResponse(pdfContent, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=report-${Date.now()}.pdf`,
    },
  });
}
