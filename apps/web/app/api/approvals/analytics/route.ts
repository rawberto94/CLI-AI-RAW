/**
 * Approval Analytics API Route
 * 
 * Returns aggregated approval workflow metrics: totals, rates, 
 * avg processing time, top approvers, recent activity, bottleneck detection.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ── Aggregate counts from workflow executions ──
    const [totalExecs, pendingExecs, completedThisWeek, rejectedThisWeek, allCompleted] =
      await Promise.all([
        // Total executions for this tenant
        prisma.workflowExecution.count({
          where: { tenantId },
        }),
        // Currently pending / in-progress
        prisma.workflowExecution.count({
          where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        }),
        // Approved (completed) this week
        prisma.workflowExecution.count({
          where: {
            tenantId,
            status: 'COMPLETED',
            completedAt: { gte: weekAgo },
          },
        }),
        // Rejected this week
        prisma.workflowExecution.count({
          where: {
            tenantId,
            status: 'REJECTED',
            completedAt: { gte: weekAgo },
          },
        }),
        // All completed (for rate calculation)
        prisma.workflowExecution.findMany({
          where: {
            tenantId,
            status: { in: ['COMPLETED', 'REJECTED'] },
          },
          select: {
            status: true,
            createdAt: true,
            completedAt: true,
          },
          take: 500,
          orderBy: { completedAt: 'desc' },
        }),
      ]);

    // ── Approval rate ──
    const totalResolved = allCompleted.length;
    const totalApproved = allCompleted.filter(e => e.status === 'COMPLETED').length;
    const approvalRate = totalResolved > 0 ? Math.round((totalApproved / totalResolved) * 1000) / 10 : 0;

    // ── Average approval time (hours) ──
    const completionTimes = allCompleted
      .filter(e => e.completedAt)
      .map(e => (e.completedAt!.getTime() - e.createdAt.getTime()) / (1000 * 60 * 60));
    const avgApprovalTime =
      completionTimes.length > 0
        ? Math.round((completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) * 10) / 10
        : 0;

    // Previous week for change calculation
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const prevWeekTimes = allCompleted
      .filter(
        e => e.completedAt && e.completedAt >= twoWeeksAgo && e.completedAt < weekAgo
      )
      .map(e => (e.completedAt!.getTime() - e.createdAt.getTime()) / (1000 * 60 * 60));
    const prevAvg =
      prevWeekTimes.length > 0
        ? prevWeekTimes.reduce((a, b) => a + b, 0) / prevWeekTimes.length
        : avgApprovalTime;
    const avgApprovalTimeChange =
      prevAvg > 0 ? Math.round(((avgApprovalTime - prevAvg) / prevAvg) * 100) : 0;

    // ── Top approvers (by completed step executions) ──
    const stepExecs = await prisma.workflowStepExecution.groupBy({
      by: ['completedBy'],
      where: {
        status: 'COMPLETED',
        completedBy: { not: null },
        execution: { tenantId },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const topApprovers = stepExecs
      .filter(s => s.completedBy)
      .map(s => ({
        name: s.completedBy!,
        count: s._count.id,
      }));

    // ── Bottleneck detection (step with longest avg duration) ──
    const recentSteps = await prisma.workflowStepExecution.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null },
        execution: { tenantId },
      },
      select: {
        stepName: true,
        startedAt: true,
        completedAt: true,
      },
      take: 200,
      orderBy: { completedAt: 'desc' },
    });

    const stepDurations: Record<string, number[]> = {};
    for (const step of recentSteps) {
      if (!step.completedAt || !step.stepName) continue;
      const dur = (step.completedAt.getTime() - step.startedAt.getTime()) / (1000 * 60 * 60);
      if (!stepDurations[step.stepName]) stepDurations[step.stepName] = [];
      stepDurations[step.stepName].push(dur);
    }

    let bottleneckStep: string | undefined;
    let maxAvgDuration = 0;
    for (const [stepName, durations] of Object.entries(stepDurations)) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      if (avg > maxAvgDuration) {
        maxAvgDuration = avg;
        bottleneckStep = stepName;
      }
    }

    // ── Recent activity ──
    const recentExecs = await prisma.workflowExecution.findMany({
      where: {
        tenantId,
        status: { in: ['COMPLETED', 'REJECTED', 'IN_PROGRESS'] },
      },
      include: {
        contract: { select: { contractTitle: true, fileName: true } },
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    });

    const recentActivity = recentExecs.map(exec => {
      const contractName =
        exec.contract?.contractTitle || exec.contract?.fileName || 'Unknown';
      const action: 'approved' | 'rejected' | 'submitted' =
        exec.status === 'COMPLETED'
          ? 'approved'
          : exec.status === 'REJECTED'
            ? 'rejected'
            : 'submitted';

      const diffMs = now.getTime() - exec.updatedAt.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      const timestamp =
        days > 0 ? `${days}d ago` : hours > 0 ? `${hours}h ago` : 'Just now';

      return {
        id: exec.id,
        action,
        contractName,
        by: exec.initiatedBy || exec.startedBy || 'System',
        timestamp,
      };
    });

    return createSuccessResponse(ctx, {
      totalApprovals: totalExecs,
      pendingApprovals: pendingExecs,
      approvedThisWeek: completedThisWeek,
      rejectedThisWeek,
      avgApprovalTime,
      avgApprovalTimeChange,
      approvalRate,
      bottleneckStep,
      topApprovers,
      recentActivity,
    });
  } catch (error) {
    logger.error('[Approval Analytics GET]', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch approval analytics', 500);
  }
});
