/**
 * Adaptive Learning Context
 * 
 * Bridges the feedback learner's stored patterns into LLM prompts.
 * This is the "getting smarter over time" mechanism:
 * 
 * 1. Queries `learning_records` for field-level correction patterns
 * 2. Queries `quality_thresholds` for adjusted thresholds (if available)
 * 3. Queries `agent_goals` for historical success/failure patterns
 * 4. Injects these as context into the orchestrator's LLM planning and analysis calls
 * 
 * The learning context is cached per-tenant for 5 minutes to avoid excessive DB queries.
 */

import OpenAI from 'openai';

// Lazy-init Prisma
let _prisma: any = null;
async function getPrisma(): Promise<any> {
  if (!_prisma) {
    try {
      // @ts-ignore
      const clientsDb = await import('clients-db');
      const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
      _prisma = typeof getClient === 'function' ? getClient() : getClient;
    } catch {
      try {
        const { PrismaClient } = await import('@prisma/client');
        _prisma = new PrismaClient();
      } catch {
        return null;
      }
    }
  }
  return _prisma;
}

export interface LearningInsight {
  field: string;
  correctionPattern: string;
  confidence: number;
  sampleSize: number;
}

export interface HistoricalPattern {
  goalType: string;
  successRate: number;
  avgDuration: number;
  commonFailures: string[];
  recommendations: string[];
}

export interface TenantLearningContext {
  tenantId: string;
  /** Field-level correction patterns from `learning_records` */
  correctionPatterns: LearningInsight[];
  /** Historical goal success/failure patterns */
  historicalPatterns: HistoricalPattern[];
  /** Quality thresholds adjusted by feedback learner */
  qualityThresholds: Record<string, { overall: number; completeness: number; accuracy: number }>;
  /** Timestamp of when this context was built */
  builtAt: Date;
}

// Cache: tenantId → context
const contextCache = new Map<string, TenantLearningContext>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Build or retrieve cached learning context for a tenant.
 */
export async function getLearningContext(tenantId: string): Promise<TenantLearningContext> {
  // Check cache
  const cached = contextCache.get(tenantId);
  if (cached && Date.now() - cached.builtAt.getTime() < CACHE_TTL_MS) {
    return cached;
  }

  const context = await buildLearningContext(tenantId);
  contextCache.set(tenantId, context);
  return context;
}

/**
 * Build learning context from database queries.
 */
async function buildLearningContext(tenantId: string): Promise<TenantLearningContext> {
  const prisma = await getPrisma();
  const context: TenantLearningContext = {
    tenantId,
    correctionPatterns: [],
    historicalPatterns: [],
    qualityThresholds: {},
    builtAt: new Date(),
  };

  if (!prisma) return context;

  // 1. Query learning_records for frequently corrected fields
  try {
    const corrections = await prisma.$queryRaw<any[]>`
      SELECT 
        field,
        COUNT(*) as sample_size,
        AVG(confidence) as avg_confidence,
        STRING_AGG(DISTINCT correction_type, ', ') as correction_types
      FROM learning_records
      WHERE tenant_id = ${tenantId}
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY field
      HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `;

    context.correctionPatterns = corrections.map((c: any) => ({
      field: c.field,
      correctionPattern: `Field "${c.field}" is frequently corrected (${c.correction_types || 'manual edit'})`,
      confidence: parseFloat(c.avg_confidence) || 0.5,
      sampleSize: parseInt(c.sample_size) || 0,
    }));
  } catch {
    // learning_records table may not exist or may be empty
  }

  // 2. Query historical goal patterns
  try {
    const goals = await prisma.$queryRaw<any[]>`
      SELECT 
        type as goal_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
        COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE completed_at IS NOT NULL AND started_at IS NOT NULL) as avg_duration_s,
        ARRAY_AGG(DISTINCT error) FILTER (WHERE error IS NOT NULL) as errors
      FROM agent_goals
      WHERE tenant_id = ${tenantId}
        AND created_at > NOW() - INTERVAL '90 days'
      GROUP BY type
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `;

    context.historicalPatterns = goals.map((g: any) => {
      const total = parseInt(g.total) || 1;
      const completed = parseInt(g.completed) || 0;
      const failed = parseInt(g.failed) || 0;
      const errors = (g.errors || []).filter((e: any) => e != null).slice(0, 3);

      return {
        goalType: g.goal_type,
        successRate: completed / total,
        avgDuration: parseFloat(g.avg_duration_s) || 0,
        commonFailures: errors,
        recommendations: failed > completed 
          ? [`Goal type "${g.goal_type}" has ${Math.round((failed / total) * 100)}% failure rate — add extra validation`]
          : [],
      };
    });
  } catch {
    // agent_goals table may not have enough data
  }

  // 3. Query quality thresholds
  try {
    const thresholds = await prisma.$queryRaw<any[]>`
      SELECT artifact_type, thresholds
      FROM quality_thresholds
      WHERE tenant_id = ${tenantId}
      ORDER BY updated_at DESC
    `;

    for (const t of thresholds) {
      if (t.thresholds && t.artifact_type) {
        context.qualityThresholds[t.artifact_type] = t.thresholds;
      }
    }
  } catch {
    // quality_thresholds table may not exist
  }

  return context;
}

/**
 * Format learning context as a prompt injection for LLM calls.
 * This is the key innovation — accumulated knowledge gets fed back into every LLM call.
 */
export function formatLearningContextForPrompt(context: TenantLearningContext): string {
  const sections: string[] = [];

  // Correction patterns
  if (context.correctionPatterns.length > 0) {
    sections.push(`LEARNED PATTERNS (from ${context.correctionPatterns.reduce((s, p) => s + p.sampleSize, 0)} past corrections):`);
    for (const pattern of context.correctionPatterns.slice(0, 10)) {
      sections.push(`  - ${pattern.correctionPattern} (confidence: ${(pattern.confidence * 100).toFixed(0)}%, n=${pattern.sampleSize})`);
    }
  }

  // Historical goal patterns
  if (context.historicalPatterns.length > 0) {
    sections.push('\nHISTORICAL PERFORMANCE:');
    for (const pattern of context.historicalPatterns.slice(0, 5)) {
      const successPct = (pattern.successRate * 100).toFixed(0);
      sections.push(`  - ${pattern.goalType}: ${successPct}% success rate, avg ${Math.round(pattern.avgDuration)}s`);
      if (pattern.commonFailures.length > 0) {
        sections.push(`    Common failures: ${pattern.commonFailures.join('; ')}`);
      }
      for (const rec of pattern.recommendations) {
        sections.push(`    → ${rec}`);
      }
    }
  }

  // Quality thresholds
  const thresholdEntries = Object.entries(context.qualityThresholds);
  if (thresholdEntries.length > 0) {
    sections.push('\nQUALITY THRESHOLDS (learned from user feedback):');
    for (const [artifactType, thresholds] of thresholdEntries.slice(0, 5)) {
      sections.push(`  - ${artifactType}: overall≥${thresholds.overall.toFixed(2)}, completeness≥${thresholds.completeness.toFixed(2)}, accuracy≥${thresholds.accuracy.toFixed(2)}`);
    }
  }

  return sections.length > 0 ? sections.join('\n') : '';
}

/**
 * Invalidate the learning context cache for a tenant (call after new feedback is processed).
 */
export function invalidateLearningContext(tenantId: string): void {
  contextCache.delete(tenantId);
}
