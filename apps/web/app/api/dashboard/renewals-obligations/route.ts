/**
 * Unified Renewals & Obligations Dashboard API
 * GET /api/dashboard/renewals-obligations
 *
 * Returns expiring contracts, upcoming renewals, and pending obligations
 * in a single call for the executive dashboard.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [
    expiringContracts,
    urgentObligations,
    upcomingObligations,
    overdueObligations,
    completedObligations,
    totalValueAtRisk,
  ] = await Promise.all([
    // Contracts expiring in next 90 days
    prisma.contract.findMany({
      where: {
        tenantId,
        OR: [
          { endDate: { gte: now, lte: ninetyDaysFromNow } },
          { expirationDate: { gte: now, lte: ninetyDaysFromNow } },
        ],
        status: { in: ['COMPLETED', 'ACTIVE', 'PROCESSING'] },
        isDeleted: false,
      },
      select: {
        id: true,
        contractTitle: true,
        fileName: true,
        supplierName: true,
        clientName: true,
        endDate: true,
        expirationDate: true,
        totalValue: true,
        currency: true,
        contractType: true,
        status: true,
        paymentTerms: true,
        paymentFrequency: true,
      },
      orderBy: [{ endDate: 'asc' }, { expirationDate: 'asc' }],
      take: 50,
    }),

    // Urgent obligations (due within 30 days or overdue)
    prisma.obligation.findMany({
      where: {
        tenantId,
        OR: [
          { dueDate: { gte: now, lte: thirtyDaysFromNow } },
          { dueDate: { lt: now }, status: { not: 'COMPLETED' } },
        ],
      },
      include: {
        contract: {
          select: {
            id: true,
            contractTitle: true,
            supplierName: true,
            totalValue: true,
            currency: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 50,
    }),

    // All upcoming obligations (next 90 days)
    prisma.obligation.findMany({
      where: {
        tenantId,
        dueDate: { gte: now, lte: ninetyDaysFromNow },
      },
      include: {
        contract: {
          select: {
            id: true,
            contractTitle: true,
            supplierName: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 100,
    }),

    // Overdue obligations count
    prisma.obligation.count({
      where: {
        tenantId,
        dueDate: { lt: now },
        status: { not: 'COMPLETED' },
      },
    }),

    // Recently completed obligations
    prisma.obligation.count({
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),

    // Total contract value expiring in 90 days
    prisma.contract.aggregate({
      where: {
        tenantId,
        OR: [
          { endDate: { gte: now, lte: ninetyDaysFromNow } },
          { expirationDate: { gte: now, lte: ninetyDaysFromNow } },
        ],
        status: { in: ['COMPLETED', 'ACTIVE', 'PROCESSING'] },
        isDeleted: false,
      },
      _sum: { totalValue: true },
    }),
  ]);

  // Transform expiring contracts with computed fields
  const renewals = expiringContracts.map(contract => {
    const expiryDate = contract.endDate || contract.expirationDate;
    const daysUntil = expiryDate
      ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: contract.id,
      contractTitle: contract.contractTitle || contract.fileName,
      supplierName: contract.supplierName,
      clientName: contract.clientName,
      expiryDate: expiryDate?.toISOString() || null,
      daysUntil,
      totalValue: contract.totalValue ? Number(contract.totalValue) : null,
      currency: contract.currency,
      contractType: contract.contractType,
      status: contract.status,
      paymentTerms: contract.paymentTerms,
      paymentFrequency: contract.paymentFrequency,
      urgency: daysUntil !== null && daysUntil <= 0 ? 'expired' :
               daysUntil !== null && daysUntil <= 14 ? 'critical' :
               daysUntil !== null && daysUntil <= 30 ? 'urgent' :
               daysUntil !== null && daysUntil <= 60 ? 'high' : 'medium',
    };
  });

  // Sort by urgency
  renewals.sort((a, b) => {
    const urgencyOrder = { expired: 0, critical: 1, urgent: 2, high: 3, medium: 4 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  // Metrics
  const metrics = {
    renewals: {
      totalExpiring90d: renewals.length,
      expiring30d: renewals.filter(r => r.daysUntil !== null && r.daysUntil <= 30 && r.daysUntil > 0).length,
      expired: renewals.filter(r => r.daysUntil !== null && r.daysUntil <= 0).length,
      totalValueAtRisk: totalValueAtRisk._sum.totalValue ? Number(totalValueAtRisk._sum.totalValue) : 0,
    },
    obligations: {
      totalUpcoming90d: upcomingObligations.length,
      urgent30d: urgentObligations.length,
      overdue: overdueObligations,
      completed30d: completedObligations,
    },
  };

  return createSuccessResponse(ctx, {
    renewals,
    obligations: urgentObligations.map(o => ({
      id: o.id,
      title: o.title,
      description: o.description,
      type: o.type,
      priority: o.priority,
      status: o.status,
      dueDate: o.dueDate?.toISOString() || null,
      contract: o.contract,
    })),
    metrics,
    generatedAt: now.toISOString(),
  });
});
