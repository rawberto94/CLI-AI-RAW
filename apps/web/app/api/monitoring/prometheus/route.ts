/**
 * Prometheus Metrics Endpoint
 * Exposes application metrics in Prometheus text format for scraping
 * 
 * @endpoint GET /api/monitoring/prometheus
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { monitoringService } from 'data-orchestration/services';

// Helper to format metric for Prometheus
function formatMetric(name: string, value: number, labels?: Record<string, string>): string {
  const labelStr = labels 
    ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')}}` 
    : '';
  return `${name}${labelStr} ${value}`;
}

// Helper to format metric with help and type
function formatMetricBlock(name: string, help: string, type: string, values: string[]): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${values.join('\n')}`;
}

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const startTime = Date.now();
  const metrics: string[] = [];

  try {
    // ============================================
    // Application Info
    // ============================================
    metrics.push(formatMetricBlock(
      'app_info',
      'Application information',
      'gauge',
      [formatMetric('app_info', 1, { 
        version: process.env.npm_package_version || '2.0.0',
        node_version: process.version,
        env: process.env.NODE_ENV || 'development'
      })]
    ));

    // ============================================
    // Database Metrics
    // ============================================
    let dbConnected = 0;
    let contractCount = 0;
    let userCount = 0;
    let tenantCount = 0;
    let rateCardCount = 0;

    try {
      // Check database connectivity
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = 1;

      // Get counts (with timeout)
      const [contracts, users, tenants, rateCards] = await Promise.all([
        prisma.contract.count().catch(() => 0),
        prisma.user.count().catch(() => 0),
        prisma.tenant.count().catch(() => 0),
        prisma.rateCard.count().catch(() => 0),
      ]);

      contractCount = contracts;
      userCount = users;
      tenantCount = tenants;
      rateCardCount = rateCards;
    } catch {
      dbConnected = 0;
    }

    metrics.push(formatMetricBlock(
      'database_connected',
      'Database connection status (1=connected, 0=disconnected)',
      'gauge',
      [formatMetric('database_connected', dbConnected)]
    ));

    metrics.push(formatMetricBlock(
      'database_records_total',
      'Total records by table',
      'gauge',
      [
        formatMetric('database_records_total', contractCount, { table: 'contracts' }),
        formatMetric('database_records_total', userCount, { table: 'users' }),
        formatMetric('database_records_total', tenantCount, { table: 'tenants' }),
        formatMetric('database_records_total', rateCardCount, { table: 'rate_cards' }),
      ]
    ));

    // ============================================
    // Process Metrics
    // ============================================
    const memoryUsage = process.memoryUsage();
    
    metrics.push(formatMetricBlock(
      'nodejs_memory_heap_used_bytes',
      'Node.js heap memory used',
      'gauge',
      [formatMetric('nodejs_memory_heap_used_bytes', memoryUsage.heapUsed)]
    ));

    metrics.push(formatMetricBlock(
      'nodejs_memory_heap_total_bytes',
      'Node.js heap memory total',
      'gauge',
      [formatMetric('nodejs_memory_heap_total_bytes', memoryUsage.heapTotal)]
    ));

    metrics.push(formatMetricBlock(
      'nodejs_memory_rss_bytes',
      'Node.js resident set size',
      'gauge',
      [formatMetric('nodejs_memory_rss_bytes', memoryUsage.rss)]
    ));

    metrics.push(formatMetricBlock(
      'nodejs_memory_external_bytes',
      'Node.js external memory',
      'gauge',
      [formatMetric('nodejs_memory_external_bytes', memoryUsage.external)]
    ));

    // ============================================
    // Uptime Metrics
    // ============================================
    metrics.push(formatMetricBlock(
      'process_uptime_seconds',
      'Process uptime in seconds',
      'gauge',
      [formatMetric('process_uptime_seconds', Math.floor(process.uptime()))]
    ));

    metrics.push(formatMetricBlock(
      'process_start_time_seconds',
      'Process start time in Unix timestamp',
      'gauge',
      [formatMetric('process_start_time_seconds', Math.floor(Date.now() / 1000 - process.uptime()))]
    ));

    // ============================================
    // Contract Processing Metrics
    // ============================================
    try {
      const [pendingContracts, processingContracts, completedContracts, failedContracts] = await Promise.all([
        prisma.contract.count({ where: { status: 'PENDING' } }).catch(() => 0),
        prisma.contract.count({ where: { status: 'PROCESSING' } }).catch(() => 0),
        prisma.contract.count({ where: { status: 'COMPLETED' } }).catch(() => 0),
        prisma.contract.count({ where: { status: 'FAILED' } }).catch(() => 0),
      ]);

      metrics.push(formatMetricBlock(
        'contracts_by_status',
        'Contracts grouped by processing status',
        'gauge',
        [
          formatMetric('contracts_by_status', pendingContracts, { status: 'pending' }),
          formatMetric('contracts_by_status', processingContracts, { status: 'processing' }),
          formatMetric('contracts_by_status', completedContracts, { status: 'completed' }),
          formatMetric('contracts_by_status', failedContracts, { status: 'failed' }),
        ]
      ));
    } catch {
      // Skip if query fails
    }

    // ============================================
    // Artifacts Metrics
    // ============================================
    try {
      const artifactCounts = await prisma.contractArtifact.groupBy({
        by: ['type'],
        _count: { id: true },
      }).catch(() => []);

      if (artifactCounts.length > 0) {
        metrics.push(formatMetricBlock(
          'artifacts_by_type',
          'Artifacts grouped by type',
          'gauge',
          artifactCounts.map((a: { type: string; _count: { id: number } }) => 
            formatMetric('artifacts_by_type', a._count.id, { type: a.type.toLowerCase() })
          )
        ));
      }
    } catch {
      // Skip if query fails
    }

    // ============================================
    // Rate Card Metrics
    // ============================================
    try {
      const rateCardEntryCount = await prisma.rateCardEntry.count().catch(() => 0);
      metrics.push(formatMetricBlock(
        'rate_card_entries_total',
        'Total rate card entries',
        'gauge',
        [formatMetric('rate_card_entries_total', rateCardEntryCount)]
      ));
    } catch {
      // Skip if query fails
    }

    // ============================================
    // API Response Time (this endpoint)
    // ============================================
    const responseTime = Date.now() - startTime;
    metrics.push(formatMetricBlock(
      'metrics_endpoint_duration_ms',
      'Time taken to generate metrics',
      'gauge',
      [formatMetric('metrics_endpoint_duration_ms', responseTime)]
    ));

    // ============================================
    // Health Check Summary
    // ============================================
    const isHealthy = dbConnected === 1 ? 1 : 0;
    metrics.push(formatMetricBlock(
      'app_healthy',
      'Overall application health (1=healthy, 0=unhealthy)',
      'gauge',
      [formatMetric('app_healthy', isHealthy)]
    ));

    // Return metrics in Prometheus format
    return new NextResponse(metrics.join('\n\n') + '\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    // Return error metric
    return new NextResponse(
      `# HELP metrics_error Metrics collection error\n# TYPE metrics_error gauge\nmetrics_error 1\n`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        },
      }
    );
  }
});
