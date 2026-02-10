import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// AI Governance API — Evaluation, Drift, Training, Policies
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';
    const { prisma } = await import('@/lib/prisma');

    if (type === 'datasets') {
      const items = await prisma.$queryRawUnsafe(
        `SELECT * FROM evaluation_datasets WHERE tenant_id = $1 ORDER BY created_at DESC`, ctx.tenantId
      );
      return createSuccessResponse(ctx, { datasets: items });
    }

    if (type === 'drift') {
      const days = parseInt(searchParams.get('days') || '30');
      const items = await prisma.$queryRawUnsafe(
        `SELECT * FROM drift_metrics WHERE tenant_id = $1 AND measured_at > NOW() - $2 * INTERVAL '1 day' ORDER BY measured_at DESC`,
        ctx.tenantId, days
      );
      return createSuccessResponse(ctx, { driftMetrics: items });
    }

    if (type === 'exports') {
      const items = await prisma.$queryRawUnsafe(
        `SELECT * FROM training_exports WHERE tenant_id = $1 ORDER BY created_at DESC`, ctx.tenantId
      );
      return createSuccessResponse(ctx, { exports: items });
    }

    if (type === 'policy') {
      const policy = await prisma.$queryRawUnsafe(
        `SELECT * FROM tenant_ai_policies WHERE tenant_id = $1`, ctx.tenantId
      );
      return createSuccessResponse(ctx, { policy: (policy as any[])[0] || null });
    }

    // Summary
    const [datasets, driftAlerts, exports, policy] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count, AVG(f1_score)::decimal(5,4) as avg_f1 FROM evaluation_datasets WHERE tenant_id = $1`, ctx.tenantId),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM drift_metrics WHERE tenant_id = $1 AND drift_detected = true AND measured_at > NOW() - INTERVAL '7 days'`, ctx.tenantId),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count, MAX(completed_at) as last_export FROM training_exports WHERE tenant_id = $1`, ctx.tenantId),
      prisma.$queryRawUnsafe(`SELECT * FROM tenant_ai_policies WHERE tenant_id = $1`, ctx.tenantId),
    ]);

    return createSuccessResponse(ctx, {
      datasets: (datasets as any[])[0],
      recentDriftAlerts: (driftAlerts as any[])[0]?.count || 0,
      exports: (exports as any[])[0],
      policy: (policy as any[])[0] || null,
    });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch AI governance data: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { type, ...data } = body;

    if (type === 'dataset') {
      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO evaluation_datasets (id, tenant_id, name, description, dataset_type, items, total_items, created_by)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        ctx.tenantId, data.name, data.description || null, data.datasetType || 'EXTRACTION',
        JSON.stringify(data.items || []), (data.items || []).length, ctx.userId
      );
      return createSuccessResponse(ctx, { dataset: (result as any[])[0] });
    }

    if (type === 'drift-metric') {
      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO drift_metrics (id, tenant_id, metric_type, model_name, operation, score, baseline_score, sample_size, drift_detected, drift_severity, details)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        ctx.tenantId, data.metricType || 'ACCURACY', data.modelName, data.operation,
        data.score, data.baselineScore || null, data.sampleSize || 0,
        data.driftDetected ?? false, data.driftSeverity || null,
        JSON.stringify(data.details || {})
      );
      return createSuccessResponse(ctx, { metric: (result as any[])[0] });
    }

    if (type === 'policy') {
      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO tenant_ai_policies (id, tenant_id, allowed_models, max_tokens_per_request, enable_extraction, enable_generation, enable_chat, confidence_threshold, require_human_review, review_threshold, data_retention_days, pii_masking, audit_all_requests, custom_rules, updated_by)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (tenant_id) DO UPDATE SET
           allowed_models = $2, max_tokens_per_request = $3, enable_extraction = $4, enable_generation = $5,
           enable_chat = $6, confidence_threshold = $7, require_human_review = $8, review_threshold = $9,
           data_retention_days = $10, pii_masking = $11, audit_all_requests = $12, custom_rules = $13, updated_by = $14, updated_at = NOW()
         RETURNING *`,
        ctx.tenantId, JSON.stringify(data.allowedModels || ['gpt-4o', 'gpt-4o-mini']),
        data.maxTokensPerRequest || 4096, data.enableExtraction ?? true,
        data.enableGeneration ?? true, data.enableChat ?? true,
        data.confidenceThreshold || 0.7, data.requireHumanReview ?? false,
        data.reviewThreshold || 0.5, data.dataRetentionDays || 90,
        data.piiMasking ?? false, data.auditAllRequests ?? true,
        JSON.stringify(data.customRules || {}), ctx.userId
      );
      return createSuccessResponse(ctx, { policy: (result as any[])[0] });
    }

    if (type === 'export') {
      const corrections = await prisma.extractionCorrection.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { createdAt: 'desc' },
        take: data.limit || 1000,
      });

      const records = corrections.map((c: any) => ({
        input: c.originalValue, output: c.correctedValue,
        field: c.field, contractId: c.contractId,
      }));

      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO training_exports (id, tenant_id, export_type, model_target, total_records, file_format, status, started_at, completed_at, created_by)
         VALUES (gen_random_uuid()::text, $1, 'CORRECTIONS', $2, $3, $4, 'COMPLETED', NOW(), NOW(), $5) RETURNING *`,
        ctx.tenantId, data.modelTarget || null, records.length, data.fileFormat || 'JSONL', ctx.userId
      );

      return createSuccessResponse(ctx, { export: (result as any[])[0], records });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid type', 400);
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed in AI governance operation: ${error.message}`, 500);
  }
});
