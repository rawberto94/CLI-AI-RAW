/**
 * Contract Sources Metrics API
 * 
 * Returns aggregated sync statistics and health metrics for all contract sources.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subDays, subHours } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const now = new Date();
    const last24h = subHours(now, 24);
    const last7d = subDays(now, 7);

    // Get all sources for this tenant
    const sources = await prisma.contractSource.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        provider: true,
        status: true,
        lastSyncAt: true,
        isActive: true,
      },
    });

    // Get sync logs for the last 7 days
    const syncLogs = await prisma.sourceSync.findMany({
      where: {
        source: { tenantId },
        startedAt: { gte: last7d },
      },
      include: {
        source: {
          select: { id: true, name: true, provider: true },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    // Calculate metrics
    const totalSources = sources.length;
    const connectedSources = sources.filter((s) => s.status === "CONNECTED" && s.isActive).length;
    const errorSources = sources.filter((s) => s.status === "ERROR").length;

    // File counts
    const totalFilesSynced = await prisma.syncedFile.count({
      where: { source: { tenantId } },
    });

    const filesLast24h = await prisma.syncedFile.count({
      where: {
        source: { tenantId },
        lastSyncedAt: { gte: last24h },
      },
    });

    const filesLast7d = await prisma.syncedFile.count({
      where: {
        source: { tenantId },
        lastSyncedAt: { gte: last7d },
      },
    });

    // Sync stats
    const completedSyncs = syncLogs.filter((log) => log.status === "COMPLETED");
    const failedSyncs = syncLogs.filter((log) => log.status === "FAILED");
    const successRate =
      syncLogs.length > 0
        ? (completedSyncs.length / syncLogs.length) * 100
        : 100;

    // Average sync duration
    const durations = completedSyncs
      .filter((log) => log.completedAt)
      .map((log) => new Date(log.completedAt!).getTime() - new Date(log.startedAt).getTime());
    const avgSyncDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    // Recent syncs
    const recentSyncs = syncLogs.slice(0, 10).map((log) => ({
      id: log.id,
      sourceName: log.source.name,
      provider: log.source.provider,
      status: log.status,
      filesProcessed: log.filesProcessed,
      duration: log.completedAt
        ? new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()
        : 0,
      completedAt: log.completedAt?.toISOString() || log.startedAt.toISOString(),
    }));

    // Source health
    const sourceHealth = await Promise.all(
      sources.map(async (source) => {
        const sourceLogs = syncLogs.filter((l) => l.source.id === source.id);
        const sourceSuccess = sourceLogs.filter((l) => l.status === "COMPLETED").length;
        const sourceErrors = sourceLogs.filter((l) => l.status === "FAILED").length;

        return {
          id: source.id,
          name: source.name,
          provider: source.provider,
          status: source.status,
          lastSyncAt: source.lastSyncAt?.toISOString(),
          errorCount: sourceErrors,
          successRate: sourceLogs.length > 0
            ? (sourceSuccess / sourceLogs.length) * 100
            : 100,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        totalSources,
        connectedSources,
        errorSources,
        totalFilesSynced,
        filesLast24h,
        filesLast7d,
        avgSyncDuration,
        successRate,
        recentSyncs,
        sourceHealth,
      },
    });
  } catch (error) {
    console.error("[Contract Sources Metrics Error]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
