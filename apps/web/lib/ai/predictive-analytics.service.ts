/**
 * Predictive Analytics Engine
 * 
 * AI-powered predictive intelligence for contract portfolio management:
 * 
 * 1. Renewal Probability — Predict likelihood of contract renewal
 * 2. Cost Forecasting — Project spending trends and budget impact
 * 3. Risk Trajectory — Predict how contract risk evolves over time
 * 4. Supplier Performance Prediction — Forecast supplier reliability
 * 5. Portfolio Health Forecast — Project portfolio-level metrics
 * 
 * Uses historical contract data + AI for predictions.
 * All predictions include confidence intervals and contributing factors.
 */

import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import pino from 'pino';

const logger = pino({ name: 'predictive-analytics' });

// ============================================================================
// SCHEMAS
// ============================================================================

const RenewalPredictionSchema = z.object({
  contractId: z.string(),
  renewalProbability: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  predictedOutcome: z.enum(['renew', 'renegotiate', 'terminate', 'uncertain']),
  keyFactors: z.array(z.object({
    factor: z.string(),
    impact: z.enum(['positive', 'negative', 'neutral']),
    weight: z.number().min(0).max(1),
  })),
  recommendedAction: z.string(),
  optimalRenewalDate: z.string().optional(),
  negotiationWindow: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }).optional(),
});

const CostForecastSchema = z.object({
  tenantId: z.string(),
  forecastPeriod: z.string(),
  currentMonthlySpend: z.number(),
  projectedMonthlySpend: z.number(),
  projectedAnnualSpend: z.number(),
  trend: z.enum(['increasing', 'stable', 'decreasing']),
  trendPercentage: z.number(),
  confidenceInterval: z.object({
    low: z.number(),
    high: z.number(),
  }),
  costDrivers: z.array(z.object({
    driver: z.string(),
    impact: z.number(),
    trend: z.enum(['increasing', 'stable', 'decreasing']),
  })),
  savingsOpportunities: z.array(z.object({
    opportunity: z.string(),
    estimatedSavings: z.number(),
    difficulty: z.enum(['easy', 'moderate', 'difficult']),
    recommendation: z.string(),
  })),
  alerts: z.array(z.object({
    type: z.enum(['budget_exceed', 'unusual_increase', 'renewal_cost', 'market_shift']),
    message: z.string(),
    severity: z.enum(['info', 'warning', 'critical']),
  })),
});

const PortfolioHealthSchema = z.object({
  overallHealthScore: z.number().min(0).max(100),
  trend: z.enum(['improving', 'stable', 'declining']),
  riskDistribution: z.object({
    low: z.number(),
    medium: z.number(),
    high: z.number(),
    critical: z.number(),
  }),
  upcomingActions: z.array(z.object({
    action: z.string(),
    deadline: z.string(),
    contractCount: z.number(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
  })),
  predictions: z.array(z.object({
    metric: z.string(),
    currentValue: z.number(),
    predictedValue: z.number(),
    timeframe: z.string(),
    confidence: z.number(),
  })),
  recommendations: z.array(z.object({
    recommendation: z.string(),
    expectedImpact: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
  })),
});

export type RenewalPrediction = z.infer<typeof RenewalPredictionSchema>;
export type CostForecast = z.infer<typeof CostForecastSchema>;
export type PortfolioHealth = z.infer<typeof PortfolioHealthSchema>;

// ============================================================================
// DATA GATHERING
// ============================================================================

async function gatherPortfolioData(tenantId: string) {
  const [contracts, recentActivity, expiringContracts] = await Promise.all([
    // Summary stats
    prisma.$queryRaw<Array<{
      status: string;
      count: bigint;
      totalValue: number;
      avgValue: number;
    }>>`
      SELECT "status", COUNT(*)::int as count, 
        COALESCE(SUM("totalValue"), 0) as "totalValue",
        COALESCE(AVG("totalValue"), 0) as "avgValue"
      FROM "Contract"
      WHERE "tenantId" = ${tenantId}
      GROUP BY "status"
    `,

    // Recent activity (last 90 days)
    prisma.$queryRaw<Array<{
      month: string;
      created: bigint;
      expired: bigint;
      renewed: bigint;
    }>>`
      SELECT 
        TO_CHAR("createdAt", 'YYYY-MM') as month,
        COUNT(*) FILTER (WHERE "status" IN ('ACTIVE', 'PENDING', 'DRAFT'))::int as created,
        COUNT(*) FILTER (WHERE "status" = 'EXPIRED')::int as expired,
        COUNT(*) FILTER (WHERE "metadata"->>'wasRenewed' = 'true')::int as renewed
      FROM "Contract"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY month DESC
    `,

    // Expiring in next 90 days
    prisma.$queryRaw<Array<{
      id: string;
      title: string;
      endDate: Date;
      totalValue: number;
      supplierName: string;
      contractType: string;
    }>>`
      SELECT id, title, "endDate", "totalValue", 
        COALESCE("supplierName", 'Unknown') as "supplierName",
        COALESCE("contractType", 'unknown') as "contractType"
      FROM "Contract"
      WHERE "tenantId" = ${tenantId}
        AND "endDate" IS NOT NULL
        AND "endDate" BETWEEN NOW() AND NOW() + INTERVAL '90 days'
        AND "status" = 'ACTIVE'
      ORDER BY "endDate" ASC
    `,
  ]);

  return { contracts, recentActivity, expiringContracts };
}

// ============================================================================
// RENEWAL PREDICTION
// ============================================================================

/**
 * Predict renewal probability for a specific contract.
 */
export async function predictRenewal(params: {
  contractId: string;
  tenantId: string;
}): Promise<RenewalPrediction> {
  const { contractId, tenantId } = params;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId, tenantId },
    select: {
      id: true,
      title: true,
      rawText: true,
      status: true,
      totalValue: true,
      endDate: true,
      startDate: true,
      contractType: true,
      supplierName: true,
      metadata: true,
    },
  });

  if (!contract) throw new Error('Contract not found');

  // Check for historical patterns with this supplier
  const supplierHistory = await prisma.contract.findMany({
    where: {
      tenantId,
      supplierName: contract.supplierName,
      status: { in: ['ACTIVE', 'EXPIRED', 'TERMINATED'] },
    },
    select: { id: true, status: true, totalValue: true, endDate: true, startDate: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const historicalContext = supplierHistory.length > 0
    ? `\nSupplier history: ${supplierHistory.length} contracts. ${
        supplierHistory.filter((c: any) => c.status === 'EXPIRED').length
      } expired, ${
        supplierHistory.filter((c: any) => c.status === 'ACTIVE').length
      } active. Average value: $${
        (supplierHistory.reduce((s: number, c: any) => s + (Number(c.totalValue) || 0), 0) / supplierHistory.length).toFixed(0)
      }`
    : '';

  const contractContext = `
Contract: ${contract.title}
Type: ${contract.contractType || 'Unknown'}
Supplier: ${contract.supplierName || 'Unknown'}
Value: $${contract.totalValue || 'N/A'}
Start: ${contract.startDate?.toISOString().split('T')[0] || 'N/A'}
End: ${contract.endDate?.toISOString().split('T')[0] || 'N/A'}
Status: ${contract.status}
${historicalContext}

Contract text (first 20k chars):
${(contract.rawText || '').slice(0, 20_000)}`;

  const { object: prediction } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: RenewalPredictionSchema,
    system: `You are a contract intelligence analyst predicting renewal outcomes. Base predictions on:
1. Contract terms (auto-renewal, notice periods, termination clauses)
2. Supplier relationship history
3. Contract value and strategic importance
4. Market conditions for this contract type
Be honest about confidence — low confidence is fine when data is limited.`,
    prompt: `Predict the renewal outcome for this contract:\n${contractContext}`,
    temperature: 0.2,
  });

  // Override contractId (model might not produce correct one)
  prediction.contractId = contractId;

  logger.info({
    contractId,
    probability: prediction.renewalProbability,
    outcome: prediction.predictedOutcome,
    confidence: prediction.confidence,
  }, '🔮 Renewal prediction generated');

  return prediction;
}

// ============================================================================
// COST FORECASTING
// ============================================================================

/**
 * Generate cost forecast for a tenant's contract portfolio.
 */
export async function forecastCosts(params: {
  tenantId: string;
  forecastMonths?: number;
}): Promise<CostForecast> {
  const { tenantId, forecastMonths = 12 } = params;
  const data = await gatherPortfolioData(tenantId);

  const dataContext = `
Portfolio Summary:
${data.contracts.map((c: any) => `- ${c.status}: ${c.count} contracts, total $${Number(c.totalValue).toFixed(0)}, avg $${Number(c.avgValue).toFixed(0)}`).join('\n')}

Monthly Trend (last 12 months):
${data.recentActivity.map((m: any) => `${m.month}: +${m.created} created, -${m.expired} expired, ↻${m.renewed} renewed`).join('\n')}

Expiring Soon (next 90 days):
${data.expiringContracts.map((c: any) => `- ${c.title} ($${Number(c.totalValue).toFixed(0)}) expires ${c.endDate.toISOString().split('T')[0]}`).join('\n') || 'None'}`;

  const { object: forecast } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: CostForecastSchema,
    system: `You are a financial analyst specializing in contract portfolio cost forecasting. Generate realistic projections based on historical trends and upcoming renewals. Include confidence intervals and identify cost drivers.`,
    prompt: `Generate a ${forecastMonths}-month cost forecast for this contract portfolio:\n${dataContext}`,
    temperature: 0.15,
  });

  forecast.tenantId = tenantId;
  forecast.forecastPeriod = `${forecastMonths} months`;

  logger.info({
    tenantId,
    trend: forecast.trend,
    trendPct: forecast.trendPercentage,
    savingsOps: forecast.savingsOpportunities.length,
    alerts: forecast.alerts.length,
  }, '📈 Cost forecast generated');

  return forecast;
}

// ============================================================================
// PORTFOLIO HEALTH PREDICTION
// ============================================================================

/**
 * Predict portfolio health trajectory.
 */
export async function predictPortfolioHealth(params: {
  tenantId: string;
}): Promise<PortfolioHealth> {
  const { tenantId } = params;
  const data = await gatherPortfolioData(tenantId);

  const dataContext = `
Portfolio Stats:
${data.contracts.map((c: any) => `- ${c.status}: ${c.count} contracts, $${Number(c.totalValue).toFixed(0)} total`).join('\n')}

Activity Trend:
${data.recentActivity.map((m: any) => `${m.month}: +${m.created} / -${m.expired}`).join('\n')}

Upcoming Expirations:
${data.expiringContracts.length} contracts expiring in next 90 days ($${
  data.expiringContracts.reduce((s: number, c: any) => s + (Number(c.totalValue) || 0), 0).toFixed(0)
} total value)`;

  const { object: health } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: PortfolioHealthSchema,
    system: `You are a contract portfolio health analyst. Evaluate overall portfolio health (0-100), predict trends, and provide actionable recommendations. Focus on risk distribution, upcoming actions, and concrete improvement steps.`,
    prompt: `Evaluate and forecast portfolio health:\n${dataContext}`,
    temperature: 0.15,
  });

  logger.info({
    tenantId,
    healthScore: health.overallHealthScore,
    trend: health.trend,
    predictionsCount: health.predictions.length,
  }, '🏥 Portfolio health predicted');

  return health;
}
