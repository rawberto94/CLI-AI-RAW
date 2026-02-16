import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// AI Governance API — Evaluation, Drift, Training, Policies
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';
    const { prisma } = await import('@/lib/prisma');

    if (type === 'datasets') {
      const items = await prisma.$queryRaw`SELECT * FROM evaluation_datasets WHERE tenant_id = ${ctx.tenantId} ORDER BY created_at DESC`;
      return createSuccessResponse(ctx, { datasets: items });
    }

    if (type === 'drift') {
      const days = parseInt(searchParams.get('days') || '30');
      const items = await prisma.$queryRaw`SELECT * FROM drift_metrics WHERE tenant_id = ${ctx.tenantId} AND measured_at > NOW() - ${days} * INTERVAL '1 day' ORDER BY measured_at DESC`;
      return createSuccessResponse(ctx, { driftMetrics: items });
    }

    if (type === 'exports') {
      const items = await prisma.$queryRaw`SELECT * FROM training_exports WHERE tenant_id = ${ctx.tenantId} ORDER BY created_at DESC`;
      return createSuccessResponse(ctx, { exports: items });
    }

    if (type === 'policy') {
      const policy = await prisma.$queryRaw`SELECT * FROM tenant_ai_policies WHERE tenant_id = ${ctx.tenantId}`;
      return createSuccessResponse(ctx, { policy: (policy as any[])[0] || null });
    }

    // Summary
    const [datasets, driftAlerts, exports, policy] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int as count, AVG(f1_score)::decimal(5,4) as avg_f1 FROM evaluation_datasets WHERE tenant_id = ${ctx.tenantId}`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count FROM drift_metrics WHERE tenant_id = ${ctx.tenantId} AND drift_detected = true AND measured_at > NOW() - INTERVAL '7 days'`,
      prisma.$queryRaw`SELECT COUNT(*)::int as count, MAX(completed_at) as last_export FROM training_exports WHERE tenant_id = ${ctx.tenantId}`,
      prisma.$queryRaw`SELECT * FROM tenant_ai_policies WHERE tenant_id = ${ctx.tenantId}`,
    ]);

    return createSuccessResponse(ctx, {
      datasets: (datasets as any[])[0],
      recentDriftAlerts: (driftAlerts as any[])[0]?.count || 0,
      exports: (exports as any[])[0],
      policy: (policy as any[])[0] || null,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch AI governance data. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { type, ...data } = body;

    if (type === 'dataset') {
      const result = await prisma.$queryRaw`INSERT INTO evaluation_datasets (id, tenant_id, name, description, dataset_type, items, total_items, created_by)
         VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${data.name}, ${data.description || null}, ${data.datasetType || 'EXTRACTION'}, ${JSON.stringify(data.items || [])}, ${(data.items || []).length}, ${ctx.userId}) RETURNING *`;
      return createSuccessResponse(ctx, { dataset: (result as any[])[0] });
    }

    if (type === 'drift-metric') {
      const result = await prisma.$queryRaw`INSERT INTO drift_metrics (id, tenant_id, metric_type, model_name, operation, score, baseline_score, sample_size, drift_detected, drift_severity, details)
         VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${data.metricType || 'ACCURACY'}, ${data.modelName}, ${data.operation}, ${data.score}, ${data.baselineScore || null}, ${data.sampleSize || 0}, ${data.driftDetected ?? false}, ${data.driftSeverity || null}, ${JSON.stringify(data.details || {})}) RETURNING *`;
      return createSuccessResponse(ctx, { metric: (result as any[])[0] });
    }

    if (type === 'policy') {
      const result = await prisma.$queryRaw`INSERT INTO tenant_ai_policies (id, tenant_id, allowed_models, max_tokens_per_request, enable_extraction, enable_generation, enable_chat, confidence_threshold, require_human_review, review_threshold, data_retention_days, pii_masking, audit_all_requests, custom_rules, updated_by)
         VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${JSON.stringify(data.allowedModels || ['gpt-4o', 'gpt-4o-mini'])}, ${data.maxTokensPerRequest || 4096}, ${data.enableExtraction ?? true}, ${data.enableGeneration ?? true}, ${data.enableChat ?? true}, ${data.confidenceThreshold || 0.7}, ${data.requireHumanReview ?? false}, ${data.reviewThreshold || 0.5}, ${data.dataRetentionDays || 90}, ${data.piiMasking ?? false}, ${data.auditAllRequests ?? true}, ${JSON.stringify(data.customRules || {})}, ${ctx.userId})
         ON CONFLICT (tenant_id) DO UPDATE SET
           allowed_models = ${JSON.stringify(data.allowedModels || ['gpt-4o', 'gpt-4o-mini'])}, max_tokens_per_request = ${data.maxTokensPerRequest || 4096}, enable_extraction = ${data.enableExtraction ?? true}, enable_generation = ${data.enableGeneration ?? true},
           enable_chat = ${data.enableChat ?? true}, confidence_threshold = ${data.confidenceThreshold || 0.7}, require_human_review = ${data.requireHumanReview ?? false}, review_threshold = ${data.reviewThreshold || 0.5},
           data_retention_days = ${data.dataRetentionDays || 90}, pii_masking = ${data.piiMasking ?? false}, audit_all_requests = ${data.auditAllRequests ?? true}, custom_rules = ${JSON.stringify(data.customRules || {})}, updated_by = ${ctx.userId}, updated_at = NOW()
         RETURNING *`;
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

      const result = await prisma.$queryRaw`INSERT INTO training_exports (id, tenant_id, export_type, model_target, total_records, file_format, status, started_at, completed_at, created_by)
         VALUES (gen_random_uuid()::text, ${ctx.tenantId}, 'CORRECTIONS', ${data.modelTarget || null}, ${records.length}, ${data.fileFormat || 'JSONL'}, 'COMPLETED', NOW(), NOW(), ${ctx.userId}) RETURNING *`;

      return createSuccessResponse(ctx, { export: (result as any[])[0], records });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid type', 400);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed in AI governance operation. Please try again.', 500);
  }
});
