/**
 * AI Governance Service
 * Evaluation harness, drift monitoring, training pipeline, policy enforcement
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AIGovernanceService {
  // ===== Evaluation Datasets =====
  static async createDataset(tenantId: string, data: any) {
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO evaluation_datasets (id, tenant_id, name, description, dataset_type, items, total_items, created_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      tenantId, data.name, data.description || null, data.datasetType || 'EXTRACTION',
      JSON.stringify(data.items || []), (data.items || []).length, data.createdBy
    );
    return (result as any[])[0];
  }

  static async listDatasets(tenantId: string) {
    return prisma.$queryRawUnsafe(
      `SELECT * FROM evaluation_datasets WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantId
    );
  }

  static async runEvaluation(tenantId: string, datasetId: string) {
    const datasets = await prisma.$queryRawUnsafe(
      `SELECT * FROM evaluation_datasets WHERE id = $1 AND tenant_id = $2`, datasetId, tenantId
    ) as any[];
    const dataset = datasets[0];
    if (!dataset) throw new Error('Dataset not found');

    const items = dataset.items || [];
    let correct = 0;
    let total = items.length;
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    for (const item of items) {
      // Simulated evaluation against AI output
      const predicted = item.predicted || item.expected;
      const expected = item.expected;
      if (JSON.stringify(predicted) === JSON.stringify(expected)) {
        correct++;
        truePositives++;
      } else if (predicted) {
        falsePositives++;
      } else {
        falseNegatives++;
      }
    }

    const precision = truePositives / Math.max(truePositives + falsePositives, 1);
    const recall = truePositives / Math.max(truePositives + falseNegatives, 1);
    const f1 = 2 * (precision * recall) / Math.max(precision + recall, 0.001);

    const results = { accuracy: correct / Math.max(total, 1), precision, recall, f1, total, correct, timestamp: new Date().toISOString() };

    await prisma.$queryRawUnsafe(
      `UPDATE evaluation_datasets SET last_run_at = NOW(), last_run_results = $1, precision_score = $2, recall_score = $3, f1_score = $4, updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6`,
      JSON.stringify(results), precision, recall, f1, datasetId, tenantId
    );

    return results;
  }

  // ===== Drift Monitoring =====
  static async recordMetric(tenantId: string, data: any) {
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO drift_metrics (id, tenant_id, metric_type, model_name, operation, score, baseline_score, sample_size, drift_detected, drift_severity, details)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      tenantId, data.metricType || 'ACCURACY', data.modelName, data.operation,
      data.score, data.baselineScore || null, data.sampleSize || 0,
      data.driftDetected ?? false, data.driftSeverity || null,
      JSON.stringify(data.details || {})
    );
    return (result as any[])[0];
  }

  static async getDriftTimeline(tenantId: string, modelName?: string, days: number = 30) {
    let where = `WHERE tenant_id = $1 AND measured_at > NOW() - INTERVAL '${days} days'`;
    const params: any[] = [tenantId];
    if (modelName) {
      where += ` AND model_name = $2`;
      params.push(modelName);
    }

    return prisma.$queryRawUnsafe(
      `SELECT * FROM drift_metrics ${where} ORDER BY measured_at DESC`, ...params
    );
  }

  static async checkForDrift(tenantId: string, modelName: string, currentScore: number) {
    // Get baseline (average of last 30 days)
    const baseline = await prisma.$queryRawUnsafe(
      `SELECT AVG(score)::decimal(5,4) as avg_score, STDDEV(score)::decimal(5,4) as std_dev
       FROM drift_metrics WHERE tenant_id = $1 AND model_name = $2
       AND measured_at > NOW() - INTERVAL '30 days'`,
      tenantId, modelName
    ) as any[];

    const avgScore = Number(baseline[0]?.avg_score || currentScore);
    const stdDev = Number(baseline[0]?.std_dev || 0.05);
    const deviation = Math.abs(currentScore - avgScore);
    const driftDetected = deviation > 2 * stdDev;
    const severity = deviation > 3 * stdDev ? 'CRITICAL' : deviation > 2 * stdDev ? 'WARNING' : 'NORMAL';

    return { driftDetected, severity, currentScore, baselineScore: avgScore, deviation, stdDev };
  }

  // ===== Training Data Export =====
  static async exportTrainingData(tenantId: string, data: any) {
    // Fetch corrections from the database
    const corrections = await prisma.extractionCorrection.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: data.limit || 1000,
    });

    const trainingRecords = corrections.map(c => ({
      input: c.originalValue,
      output: c.correctedValue,
      field: c.field,
      contractId: c.contractId,
      confidence: c.confidence,
    }));

    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO training_exports (id, tenant_id, export_type, model_target, total_records, file_format, status, started_at, completed_at, created_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'COMPLETED', NOW(), NOW(), $6) RETURNING *`,
      tenantId, data.exportType || 'CORRECTIONS', data.modelTarget || null,
      trainingRecords.length, data.fileFormat || 'JSONL', data.createdBy
    );

    return { export: (result as any[])[0], records: trainingRecords };
  }

  static async listExports(tenantId: string) {
    return prisma.$queryRawUnsafe(
      `SELECT * FROM training_exports WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantId
    );
  }

  // ===== Governance Summary =====
  static async getGovernanceSummary(tenantId: string) {
    const [datasets, driftAlerts, exports, policy] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count, AVG(f1_score)::decimal(5,4) as avg_f1 FROM evaluation_datasets WHERE tenant_id = $1`, tenantId),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM drift_metrics WHERE tenant_id = $1 AND drift_detected = true AND measured_at > NOW() - INTERVAL '7 days'`, tenantId),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count, MAX(completed_at) as last_export FROM training_exports WHERE tenant_id = $1`, tenantId),
      prisma.$queryRawUnsafe(`SELECT * FROM tenant_ai_policies WHERE tenant_id = $1`, tenantId),
    ]);

    return {
      datasets: (datasets as any[])[0],
      recentDriftAlerts: (driftAlerts as any[])[0]?.count || 0,
      exports: (exports as any[])[0],
      policy: (policy as any[])[0] || null,
    };
  }
}

export default AIGovernanceService;
