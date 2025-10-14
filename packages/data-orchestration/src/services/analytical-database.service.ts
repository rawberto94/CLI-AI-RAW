import { dbAdaptor } from "../dal/database.adaptor";
import pino from "pino";
import type { ServiceResponse } from "./contract.service";

const logger = pino({ name: "analytical-database-service" });

/**
 * Analytical Database Service
 * Provides database operations for analytical intelligence data
 */
export class AnalyticalDatabaseService {
  private static instance: AnalyticalDatabaseService;

  private constructor() {}

  static getInstance(): AnalyticalDatabaseService {
    if (!AnalyticalDatabaseService.instance) {
      AnalyticalDatabaseService.instance = new AnalyticalDatabaseService();
    }
    return AnalyticalDatabaseService.instance;
  }

  // Rate Card Operations
  async createRateCard(data: {
    contractId: string;
    supplierId: string;
    tenantId: string;
    effectiveDate: Date;
    currency: string;
    region: string;
    deliveryModel: string;
  }): Promise<ServiceResponse<any>> {
    try {
      const result = await dbAdaptor.prisma.$executeRaw`
        INSERT INTO rate_cards (contract_id, supplier_id, tenant_id, effective_date, currency, region, delivery_model)
        VALUES (${data.contractId}, ${data.supplierId}, ${data.tenantId}, ${data.effectiveDate}, ${data.currency}, ${data.region}, ${data.deliveryModel})
      `;

      return { success: true, data: result };
    } catch (error) {
      logger.error({ error, data }, "Failed to create rate card");
      return {
        success: false,
        error: {
          code: "RATE_CARD_CREATE_FAILED",
          message: "Failed to create rate card",
          details: error
        }
      };
    }
  }

  async createRate(data: {
    rateCardId: string;
    role: string;
    level?: string;
    hourlyRate?: number;
    dailyRate?: number;
    monthlyRate?: number;
    billableHours?: number;
  }): Promise<ServiceResponse<any>> {
    try {
      const result = await dbAdaptor.prisma.$executeRaw`
        INSERT INTO rates (rate_card_id, role, level, hourly_rate, daily_rate, monthly_rate, billable_hours)
        VALUES (${data.rateCardId}, ${data.role}, ${data.level || null}, ${data.hourlyRate || null}, ${data.dailyRate || null}, ${data.monthlyRate || null}, ${data.billableHours || 8})
      `;

      return { success: true, data: result };
    } catch (error) {
      logger.error({ error, data }, "Failed to create rate");
      return {
        success: false,
        error: {
          code: "RATE_CREATE_FAILED",
          message: "Failed to create rate",
          details: error
        }
      };
    }
  }

  // Benchmark Operations
  async upsertBenchmark(data: {
    cohortHash: string;
    tenantId: string;
    role: string;
    level?: string;
    region: string;
    deliveryModel: string;
    category: string;
    statistics: {
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      mean: number;
      stdDev: number;
    };
    sampleSize: number;
    confidence: number;
  }): Promise<ServiceResponse<any>> {
    try {
      const result = await dbAdaptor.prisma.$executeRaw`
        INSERT OR REPLACE INTO benchmarks 
        (cohort_hash, tenant_id, role, level, region, delivery_model, category, p25, p50, p75, p90, mean, std_dev, sample_size, confidence)
        VALUES (${data.cohortHash}, ${data.tenantId}, ${data.role}, ${data.level || null}, ${data.region}, ${data.deliveryModel}, ${data.category}, 
                ${data.statistics.p25}, ${data.statistics.p50}, ${data.statistics.p75}, ${data.statistics.p90}, 
                ${data.statistics.mean}, ${data.statistics.stdDev}, ${data.sampleSize}, ${data.confidence})
      `;

      return { success: true, data: result };
    } catch (error) {
      logger.error({ error, data }, "Failed to upsert benchmark");
      return {
        success: false,
        error: {
          code: "BENCHMARK_UPSERT_FAILED",
          message: "Failed to upsert benchmark",
          details: error
        }
      };
    }
  }

  // Renewal Alert Operations
  async createRenewalAlert(data: {
    contractId: string;
    tenantId: string;
    alertType: string;
    dueDate: Date;
    daysUntilDue: number;
    priority: string;
  }): Promise<ServiceResponse<any>> {
    try {
      const result = await dbAdaptor.prisma.$executeRaw`
        INSERT INTO renewal_alerts (contract_id, tenant_id, alert_type, due_date, days_until_due, priority)
        VALUES (${data.contractId}, ${data.tenantId}, ${data.alertType}, ${data.dueDate}, ${data.daysUntilDue}, ${data.priority})
      `;

      return { success: true, data: result };
    } catch (error) {
      logger.error({ error, data }, "Failed to create renewal alert");
      return {
        success: false,
        error: {
          code: "RENEWAL_ALERT_CREATE_FAILED",
          message: "Failed to create renewal alert",
          details: error
        }
      };
    }
  }

  // Compliance Operations
  async createComplianceScore(data: {
    contractId: string;
    tenantId: string;
    overallScore: number;
    riskLevel: string;
    clauseScores: any;
    recommendations?: string[];
  }): Promise<ServiceResponse<any>> {
    try {
      const result = await dbAdaptor.prisma.$executeRaw`
        INSERT INTO compliance_scores (contract_id, tenant_id, overall_score, risk_level, clause_scores, recommendations)
        VALUES (${data.contractId}, ${data.tenantId}, ${data.overallScore}, ${data.riskLevel}, ${JSON.stringify(data.clauseScores)}, ${JSON.stringify(data.recommendations || [])})
      `;

      return { success: true, data: result };
    } catch (error) {
      logger.error({ error, data }, "Failed to create compliance score");
      return {
        success: false,
        error: {
          code: "COMPLIANCE_SCORE_CREATE_FAILED",
          message: "Failed to create compliance score",
          details: error
        }
      };
    }
  }

  // Supplier Intelligence Operations
  async upsertSupplierIntelligence(data: {
    supplierId: string;
    tenantId: string;
    financialHealth?: number;
    performanceScore?: number;
    riskScore?: number;
    complianceScore?: number;
    relationshipMetrics?: any;
    externalData?: any;
    aiSummary?: string;
  }): Promise<ServiceResponse<any>> {
    try {
      const result = await dbAdaptor.prisma.$executeRaw`
        INSERT OR REPLACE INTO supplier_intelligence 
        (supplier_id, tenant_id, financial_health, performance_score, risk_score, compliance_score, relationship_metrics, external_data, ai_summary)
        VALUES (${data.supplierId}, ${data.tenantId}, ${data.financialHealth || null}, ${data.performanceScore || null}, 
                ${data.riskScore || null}, ${data.complianceScore || null}, ${JSON.stringify(data.relationshipMetrics || {})}, 
                ${JSON.stringify(data.externalData || {})}, ${data.aiSummary || null})
      `;

      return { success: true, data: result };
    } catch (error) {
      logger.error({ error, data }, "Failed to upsert supplier intelligence");
      return {
        success: false,
        error: {
          code: "SUPPLIER_INTELLIGENCE_UPSERT_FAILED",
          message: "Failed to upsert supplier intelligence",
          details: error
        }
      };
    }
  }

  // Query History Operations
  async createQueryHistory(data: {
    sessionId: string;
    tenantId: string;
    userId?: string;
    query: string;
    response: any;
    confidence?: number;
    responseTime?: number;
  }): Promise<ServiceResponse<any>> {
    try {
      const result = await dbAdaptor.prisma.$executeRaw`
        INSERT INTO query_history (session_id, tenant_id, user_id, query, response, confidence, response_time)
        VALUES (${data.sessionId}, ${data.tenantId}, ${data.userId || null}, ${data.query}, ${JSON.stringify(data.response)}, ${data.confidence || null}, ${data.responseTime || null})
      `;

      return { success: true, data: result };
    } catch (error) {
      logger.error({ error, data }, "Failed to create query history");
      return {
        success: false,
        error: {
          code: "QUERY_HISTORY_CREATE_FAILED",
          message: "Failed to create query history",
          details: error
        }
      };
    }
  }

  // Health check
  async healthCheck(): Promise<ServiceResponse<boolean>> {
    try {
      // Test database connectivity by querying a simple table
      await dbAdaptor.prisma.$queryRaw`SELECT 1`;
      return { success: true, data: true };
    } catch (error) {
      logger.error({ error }, "Analytical database health check failed");
      return {
        success: false,
        error: {
          code: "DATABASE_HEALTH_CHECK_FAILED",
          message: "Database health check failed",
          details: error
        }
      };
    }
  }
}

export const analyticalDatabaseService = AnalyticalDatabaseService.getInstance();