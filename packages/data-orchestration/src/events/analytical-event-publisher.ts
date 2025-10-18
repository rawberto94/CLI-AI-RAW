import { eventBus } from "./event-bus";
import { AnalyticalEvents } from "./analytical-events";
import pino from "pino";

const logger = pino({ name: "analytical-event-publisher" });

/**
 * Analytical Event Publisher
 * Provides convenient methods for publishing analytical intelligence events
 */
export class AnalyticalEventPublisher {
  private static instance: AnalyticalEventPublisher;

  private constructor() {}

  static getInstance(): AnalyticalEventPublisher {
    if (!AnalyticalEventPublisher.instance) {
      AnalyticalEventPublisher.instance = new AnalyticalEventPublisher();
    }
    return AnalyticalEventPublisher.instance;
  }

  // Rate Card Events
  async publishRateCardParsed(data: {
    tenantId: string;
    contractId: string;
    supplierId: string;
    rateCard: {
      id: string;
      totalRates: number;
      currency: string;
      region: string;
      deliveryModel: string;
    };
    cohort: {
      role: string;
      level: string;
      region: string;
      deliveryModel: string;
    };
  }): Promise<void> {
    try {
      await eventBus.publish(AnalyticalEvents.RATE_CARD_PARSED, {
        ...data,
        parsedAt: new Date()
      });
      logger.info({ contractId: data.contractId }, "Rate card parsed event published");
    } catch (error) {
      logger.error({ error, data }, "Failed to publish rate card parsed event");
      throw error;
    }
  }

  async publishBenchmarkUpdated(data: {
    tenantId: string;
    cohort: {
      role: string;
      level: string;
      region: string;
      deliveryModel: string;
    };
    statistics: {
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      sampleSize: number;
      confidence: number;
    };
  }): Promise<void> {
    try {
      await eventBus.publish(AnalyticalEvents.BENCHMARK_UPDATED, {
        ...data,
        updatedAt: new Date()
      });
      logger.info({ cohort: data.cohort }, "Benchmark updated event published");
    } catch (error) {
      logger.error({ error, data }, "Failed to publish benchmark updated event");
      throw error;
    }
  }

  async publishSavingsOpportunity(data: {
    tenantId: string;
    supplierId: string;
    contractId: string;
    opportunity: {
      category: string;
      currentRate: number;
      benchmarkRate: number;
      potentialSavings: number;
      confidence: number;
    };
  }): Promise<void> {
    try {
      await eventBus.publish(AnalyticalEvents.SAVINGS_OPPORTUNITY_IDENTIFIED, {
        ...data,
        identifiedAt: new Date()
      });
      logger.info({ supplierId: data.supplierId, savings: data.opportunity.potentialSavings }, "Savings opportunity event published");
    } catch (error) {
      logger.error({ error, data }, "Failed to publish savings opportunity event");
      throw error;
    }
  }

  // Renewal Events
  async publishRenewalAlert(data: {
    tenantId: string;
    contractId: string;
    alertType: 'renewal' | 'termination' | 'renegotiation';
    dueDate: Date;
    daysUntilDue: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
    supplier: string;
    contractValue: number;
  }): Promise<void> {
    try {
      await eventBus.publish(AnalyticalEvents.RENEWAL_ALERT_TRIGGERED, {
        ...data,
        triggeredAt: new Date()
      });
      logger.info({ contractId: data.contractId, priority: data.priority }, "Renewal alert event published");
    } catch (error) {
      logger.error({ error, data }, "Failed to publish renewal alert event");
      throw error;
    }
  }

  // Compliance Events
  async publishComplianceScored(data: {
    tenantId: string;
    contractId: string;
    supplierId: string;
    complianceScore: {
      overallScore: number;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      criticalIssues: number;
      clauseResults: Array<{
        clauseType: string;
        status: 'present' | 'weak' | 'missing';
        score: number;
      }>;
    };
  }): Promise<void> {
    try {
      await eventBus.publish(AnalyticalEvents.COMPLIANCE_SCORED, {
        ...data,
        scoredAt: new Date()
      });
      logger.info({ contractId: data.contractId, riskLevel: data.complianceScore.riskLevel }, "Compliance scored event published");
    } catch (error) {
      logger.error({ error, data }, "Failed to publish compliance scored event");
      throw error;
    }
  }

  // Supplier Events
  async publishSupplierProfileUpdated(data: {
    tenantId: string;
    supplierId: string;
    updateType: 'financial' | 'performance' | 'risk' | 'compliance' | 'external_data';
    changes: Record<string, any>;
  }): Promise<void> {
    try {
      await eventBus.publish(AnalyticalEvents.SUPPLIER_PROFILE_UPDATED, {
        ...data,
        updatedAt: new Date()
      });
      logger.info({ supplierId: data.supplierId, updateType: data.updateType }, "Supplier profile updated event published");
    } catch (error) {
      logger.error({ error, data }, "Failed to publish supplier profile updated event");
      throw error;
    }
  }

  // Spend Events
  async publishSpendVariance(data: {
    tenantId: string;
    supplierId: string;
    period: string;
    variance: {
      contractedAmount: number;
      actualSpend: number;
      varianceAmount: number;
      variancePercentage: number;
      offContractSpend: number;
    };
  }): Promise<void> {
    try {
      await eventBus.publish(AnalyticalEvents.SPEND_VARIANCE_DETECTED, {
        ...data,
        detectedAt: new Date()
      });
      logger.info({ supplierId: data.supplierId, variancePercentage: data.variance.variancePercentage }, "Spend variance event published");
    } catch (error) {
      logger.error({ error, data }, "Failed to publish spend variance event");
      throw error;
    }
  }

  // Query Events
  async publishQueryProcessed(data: {
    tenantId: string;
    sessionId: string;
    userId?: string;
    query: string;
    response: {
      answer: string;
      confidence: number;
      evidenceCount: number;
      executionTime: number;
    };
  }): Promise<void> {
    try {
      await eventBus.publish(AnalyticalEvents.QUERY_PROCESSED, {
        ...data,
        processedAt: new Date()
      });
      logger.info({ sessionId: data.sessionId, confidence: data.response.confidence }, "Query processed event published");
    } catch (error) {
      logger.error({ error, data }, "Failed to publish query processed event");
      throw error;
    }
  }

  // Rate Card Management Events
  async publishRateCardBenchmark(data: {
    tenantId: string;
    benchmarkId: string;
    cohort: any;
    statistics: any;
  }): Promise<void> {
    try {
      await eventBus.publish(AnalyticalEvents.BENCHMARK_UPDATED, {
        ...data,
        updatedAt: new Date()
      });
      logger.info({ benchmarkId: data.benchmarkId }, "Rate card benchmark event published");
    } catch (error) {
      logger.error({ error, data }, "Failed to publish rate card benchmark event");
      throw error;
    }
  }

  async publishRateCardCreated(data: {
    tenantId: string;
    rateCardId: string;
    supplierId: string;
  }): Promise<void> {
    try {
      await eventBus.publish(AnalyticalEvents.RATE_CARD_PARSED, {
        ...data,
        createdAt: new Date()
      });
      logger.info({ rateCardId: data.rateCardId }, "Rate card created event published");
    } catch (error) {
      logger.error({ error, data }, "Failed to publish rate card created event");
      throw error;
    }
  }

  async publishBulkUploadCompleted(data: {
    tenantId: string;
    uploadId: string;
    results: any;
  }): Promise<void> {
    try {
      await eventBus.publish(AnalyticalEvents.RATE_CARD_PARSED, {
        ...data,
        completedAt: new Date()
      });
      logger.info({ uploadId: data.uploadId }, "Bulk upload completed event published");
    } catch (error) {
      logger.error({ error, data }, "Failed to publish bulk upload completed event");
      throw error;
    }
  }

  async publishDataStandardization(data: {
    tenantId: string;
    entityType: string;
    results: any;
  }): Promise<void> {
    try {
      await eventBus.publish(AnalyticalEvents.BENCHMARK_UPDATED, {
        ...data,
        processedAt: new Date()
      });
      logger.info({ entityType: data.entityType }, "Data standardization event published");
    } catch (error) {
      logger.error({ error, data }, "Failed to publish data standardization event");
      throw error;
    }
  }
}

export const analyticalEventPublisher = AnalyticalEventPublisher.getInstance();