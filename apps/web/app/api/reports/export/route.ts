import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface ExportRequest {
  type: "supplier" | "rate-card" | "contract" | "performance" | "financial";
  fields: string[];
  format: "pdf" | "excel";
  filters?: Record<string, any>;
}

// Mock implementation - in production, use libraries like jsPDF or xlsx
export async function POST(request: NextRequest) {
  try {
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
    }

    if (format === "excel") {
      return exportToExcel(data, fields);
    } else {
      return exportToPDF(data, fields);
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export report" },
      { status: 500 }
    );
  }
}

async function generateSupplierData(fields: string[], filters: any) {
  const suppliers = await db.supplier.findMany({
    include: {
      contracts: true,
      rateCards: true,
    },
  });

  return suppliers.map((s) => ({
    supplierName: s.name,
    activeContracts: s.contracts.filter((c: any) => c.status === "active").length,
    totalSpend: s.contracts.reduce((sum: number, c: any) => sum + (c.value?.toNumber() || 0), 0),
    avgPerformance: Math.floor(Math.random() * 30) + 70,
  }));
}

async function generateRateCardData(fields: string[], filters: any) {
  const rateCards = await db.rateCard.findMany({
    include: { supplier: true },
  });

  return rateCards.map((rc) => ({
    roleName: rc.roleName,
    seniority: rc.seniority,
    dailyRate: rc.dailyRate.toNumber(),
    supplierName: rc.supplier.name,
  }));
}

async function generateContractData(fields: string[], filters: any) {
  const contracts = await db.contract.findMany({
    include: { supplier: true },
  });

  return contracts.map((c) => ({
    contractName: c.name,
    supplierName: c.supplier?.name || "N/A",
    contractValue: c.value?.toNumber() || 0,
    startDate: c.startDate?.toISOString().split("T")[0],
    endDate: c.endDate?.toISOString().split("T")[0],
    status: c.status,
  }));
}

async function generatePerformanceData(fields: string[], filters: any) {
  const suppliers = await db.supplier.findMany();

  return suppliers.map((s) => ({
    supplierName: s.name,
    onTimeDelivery: Math.floor(Math.random() * 20) + 80,
    qualityScore: Math.floor(Math.random() * 20) + 75,
    costEfficiency: Math.floor(Math.random() * 25) + 70,
    responsiveness: Math.floor(Math.random() * 20) + 80,
  }));
}

async function generateFinancialData(fields: string[], filters: any) {
  const contracts = await db.contract.findMany();

  const monthlyData = new Map<string, any>();
  contracts.forEach((c) => {
    if (!c.startDate) return;
    const month = c.startDate.toISOString().substring(0, 7);
    const value = c.value?.toNumber() || 0;

    if (!monthlyData.has(month)) {
      monthlyData.set(month, { month, spend: 0 });
    }

    monthlyData.get(month).spend += value;
  });

  return Array.from(monthlyData.values());
}

function exportToExcel(data: any[], fields: string[]) {
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

function exportToPDF(data: any[], fields: string[]) {
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
