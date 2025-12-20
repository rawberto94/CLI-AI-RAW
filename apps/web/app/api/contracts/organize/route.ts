/**
 * Contract Organization API
 * GET /api/contracts/organize - Get contracts organized by various criteria
 *
 * Supports grouping by:
 * - status
 * - contractType
 * - category
 * - clientName
 * - supplierName
 * - expirationMonth
 * - valueRange
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from "@/lib/tenant-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

type GroupBy = 
  | "status" 
  | "contractType" 
  | "category" 
  | "clientName" 
  | "supplierName" 
  | "expirationMonth"
  | "uploadMonth"
  | "valueRange";

interface OrganizedGroup {
  key: string;
  label: string;
  count: number;
  totalValue: number;
  contracts: Array<{
    id: string;
    title: string;
    status: string;
    totalValue: number | null;
    expirationDate: string | null;
  }>;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = request.nextUrl;

  try {
    const tenantId = getApiTenantId(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID is required" },
        { status: 400 }
      );
    }
    
    const groupBy = (searchParams.get("groupBy") || "status") as GroupBy;
    const includeContracts = searchParams.get("includeContracts") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

    // Determine the group field
    let groupField: string;
    let labelGenerator: (key: string | null) => string;
    
    switch (groupBy) {
      case "status":
        groupField = "status";
        labelGenerator = (key) => key?.toLowerCase() || "unknown";
        break;
      case "contractType":
        groupField = "contractType";
        labelGenerator = (key) => key || "Unspecified";
        break;
      case "category":
        groupField = "category";
        labelGenerator = (key) => key || "Uncategorized";
        break;
      case "clientName":
        groupField = "clientName";
        labelGenerator = (key) => key || "Unknown Client";
        break;
      case "supplierName":
        groupField = "supplierName";
        labelGenerator = (key) => key || "Unknown Supplier";
        break;
      case "expirationMonth":
      case "uploadMonth":
      case "valueRange":
        // These require custom grouping logic
        groupField = "custom";
        labelGenerator = (key) => key || "Unknown";
        break;
      default:
        groupField = "status";
        labelGenerator = (key) => key?.toLowerCase() || "unknown";
    }

    let groups: OrganizedGroup[] = [];

    if (groupBy === "expirationMonth") {
      // Group by expiration month
      const contracts = await prisma.contract.findMany({
        where: { tenantId, status: { not: "DELETED" } },
        select: {
          id: true,
          contractTitle: true,
          originalName: true,
          fileName: true,
          status: true,
          totalValue: true,
          expirationDate: true,
        },
        orderBy: { expirationDate: sortOrder },
        take: limit,
      });

      const monthGroups: Record<string, typeof contracts> = {};
      
      contracts.forEach((contract) => {
        let monthKey: string;
        if (!contract.expirationDate) {
          monthKey = "no-expiration";
        } else {
          const date = new Date(contract.expirationDate);
          monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        }
        
        if (!monthGroups[monthKey]) {
          monthGroups[monthKey] = [];
        }
        monthGroups[monthKey]!.push(contract);
      });

      groups = Object.entries(monthGroups)
        .sort((a, b) => sortOrder === "desc" ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0]))
        .map(([key, contracts]) => ({
          key,
          label: key === "no-expiration" 
            ? "No Expiration Date" 
            : new Date(key + "-01").toLocaleDateString("en-US", { year: "numeric", month: "long" }),
          count: contracts.length,
          totalValue: contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0),
          contracts: includeContracts 
            ? contracts.map((c) => ({
                id: c.id,
                title: c.contractTitle || c.originalName || c.fileName,
                status: c.status.toLowerCase(),
                totalValue: c.totalValue ? Number(c.totalValue) : null,
                expirationDate: c.expirationDate?.toISOString() || null,
              }))
            : [],
        }));

    } else if (groupBy === "uploadMonth") {
      // Group by upload month
      const contracts = await prisma.contract.findMany({
        where: { tenantId, status: { not: "DELETED" } },
        select: {
          id: true,
          contractTitle: true,
          originalName: true,
          fileName: true,
          status: true,
          totalValue: true,
          uploadedAt: true,
          expirationDate: true,
        },
        orderBy: { uploadedAt: sortOrder },
        take: limit,
      });

      const monthGroups: Record<string, typeof contracts> = {};
      
      contracts.forEach((contract) => {
        const date = contract.uploadedAt || new Date();
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        
        if (!monthGroups[monthKey]) {
          monthGroups[monthKey] = [];
        }
        monthGroups[monthKey].push(contract);
      });

      groups = Object.entries(monthGroups)
        .sort((a, b) => sortOrder === "desc" ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0]))
        .map(([key, contracts]) => ({
          key,
          label: new Date(key + "-01").toLocaleDateString("en-US", { year: "numeric", month: "long" }),
          count: contracts.length,
          totalValue: contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0),
          contracts: includeContracts 
            ? contracts.map((c) => ({
                id: c.id,
                title: c.contractTitle || c.originalName || c.fileName,
                status: c.status.toLowerCase(),
                totalValue: c.totalValue ? Number(c.totalValue) : null,
                expirationDate: c.expirationDate?.toISOString() || null,
              }))
            : [],
        }));

    } else if (groupBy === "valueRange") {
      // Group by value ranges
      const valueRanges = [
        { key: "under-10k", label: "Under $10,000", min: 0, max: 10000 },
        { key: "10k-50k", label: "$10,000 - $50,000", min: 10000, max: 50000 },
        { key: "50k-100k", label: "$50,000 - $100,000", min: 50000, max: 100000 },
        { key: "100k-500k", label: "$100,000 - $500,000", min: 100000, max: 500000 },
        { key: "over-500k", label: "Over $500,000", min: 500000, max: Infinity },
        { key: "no-value", label: "No Value Specified", min: null, max: null },
      ];

      groups = await Promise.all(
        valueRanges.map(async (range) => {
          const where: any = { tenantId, status: { not: "DELETED" } };
          
          if (range.min === null) {
            where.totalValue = null;
          } else if (range.max === Infinity) {
            where.totalValue = { gte: range.min };
          } else {
            where.totalValue = { gte: range.min, lt: range.max };
          }

          const [count, aggregate, contracts] = await Promise.all([
            prisma.contract.count({ where }),
            prisma.contract.aggregate({
              where,
              _sum: { totalValue: true },
            }),
            includeContracts
              ? prisma.contract.findMany({
                  where,
                  select: {
                    id: true,
                    contractTitle: true,
                    originalName: true,
                    fileName: true,
                    status: true,
                    totalValue: true,
                    expirationDate: true,
                  },
                  orderBy: { totalValue: sortOrder },
                  take: 20, // Limit contracts per group
                })
              : Promise.resolve([]),
          ]);

          return {
            key: range.key,
            label: range.label,
            count,
            totalValue: Number(aggregate._sum.totalValue) || 0,
            contracts: contracts.map((c) => ({
              id: c.id,
              title: c.contractTitle || c.originalName || c.fileName,
              status: c.status.toLowerCase(),
              totalValue: c.totalValue ? Number(c.totalValue) : null,
              expirationDate: c.expirationDate?.toISOString() || null,
            })),
          };
        })
      );

    } else {
      // Standard field grouping
      const grouped = await prisma.contract.groupBy({
        by: [groupField as any],
        where: { tenantId, status: { not: "DELETED" } },
        _count: { id: true },
        _sum: { totalValue: true },
        orderBy: { _count: { id: sortOrder } },
        take: limit,
      });

      if (includeContracts) {
        groups = await Promise.all(
          grouped.map(async (group) => {
            const key = (group as any)[groupField];
            const contracts = await prisma.contract.findMany({
              where: {
                tenantId,
                status: { not: "DELETED" },
                [groupField]: key,
              },
              select: {
                id: true,
                contractTitle: true,
                originalName: true,
                fileName: true,
                status: true,
                totalValue: true,
                expirationDate: true,
              },
              orderBy: { createdAt: "desc" },
              take: 20, // Limit contracts per group
            });

            return {
              key: key || "unspecified",
              label: labelGenerator(key),
              count: group._count.id,
              totalValue: Number(group._sum.totalValue) || 0,
              contracts: contracts.map((c) => ({
                id: c.id,
                title: c.contractTitle || c.originalName || c.fileName,
                status: c.status.toLowerCase(),
                totalValue: c.totalValue ? Number(c.totalValue) : null,
                expirationDate: c.expirationDate?.toISOString() || null,
              })),
            };
          })
        );
      } else {
        groups = grouped.map((group) => {
          const key = (group as any)[groupField];
          return {
            key: key || "unspecified",
            label: labelGenerator(key),
            count: group._count.id,
            totalValue: Number(group._sum.totalValue) || 0,
            contracts: [],
          };
        });
      }
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        data: {
          groupBy,
          groups,
          summary: {
            totalGroups: groups.length,
            totalContracts: groups.reduce((sum, g) => sum + g.count, 0),
            totalValue: groups.reduce((sum, g) => sum + g.totalValue, 0),
          },
        },
        meta: {
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          tenantId,
        },
      },
      {
        headers: {
          "X-Response-Time": `${responseTime}ms`,
          "Cache-Control": "private, max-age=60",
        },
      }
    );
  } catch (error) {
    console.error("Error organizing contracts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to organize contracts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
