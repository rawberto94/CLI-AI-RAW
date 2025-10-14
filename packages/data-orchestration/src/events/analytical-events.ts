import { eventBus } from "./event-bus";
import pino from "pino";

const logger = pino({ name: "analytical-events" });

// Analytical Event Types
export enum AnalyticalEvents {
  // Rate Card Events
  RATE_CARD_PARSED = 'rate_card_parsed',
  BENCHMARK_UPDATED = 'benchmark_updated',
  SAVINGS_OPPORTUNITY_IDENTIFIED = 'savings_opportunity_identified',
  
  // Renewal Events
  RENEWAL_ALERT_TRIGGERED = 'renewal_alert_triggered',
  RENEWAL_CALENDAR_UPDATED = 'renewal_calendar_updated',
  RFX_GENERATION_REQUESTED = 'rfx_generation_requested',
  
  // Compliance Events
  COMPLIANCE_SCORED = 'compliance_scored',
  COMPLIANCE_POLICY_UPDATED = 'compliance_policy_updated',
  REMEDIATION_PLAN_GENERATED = 'remediation_plan_generated',
  
  // Supplier Events
  SUPPLIER_PROFILE_UPDATED = 'supplier_profile_updated',
  SUPPLIER_RISK_CHANGED = 'supplier_risk_changed',
  EXTERNAL_DATA_INTEGRATED = 'external_data_integrated',
  
  // Spend Events
  SPEND_DATA_IMPORTED = 'spend_data_imported',
  SPEND_VARIANCE_DETECTED = 'spend_variance_detected',
  EFFICIENCY_METRICS_CALCULATED = 'efficiency_metrics_calculated',
  
  // Query Events
  QUERY_PROCESSED = 'query_processed',
  QUERY_CONTEXT_UPDATED = 'query_context_updated'
}

// Event Payload Interfaces
export interface RateCardParsedEvent {
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
  parsedAt: Date;
}

export interface BenchmarkUpdatedEvent {
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
  updatedAt: Date;
}

export interface SavingsOpportunityEvent {
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
  identifiedAt: Date;
}

export interface RenewalAlertEvent {
  tenantId: string;
  contractId: string;
  alertType: 'renewal' | 'termination' | 'renegotiation';
  dueDate: Date;
  daysUntilDue: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  supplier: string;
  contractValue: number;
  triggeredAt: Date;
}

export interface ComplianceScoredEvent {
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
  scoredAt: Date;
}

export interface SupplierProfileUpdatedEvent {
  tenantId: string;
  supplierId: string;
  updateType: 'financial' | 'performance' | 'risk' | 'compliance' | 'external_data';
  changes: Record<string, any>;
  updatedAt: Date;
}

export interface SpendVarianceEvent {
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
  detectedAt: Date;
}

export interface QueryProcessedEvent {
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
  processedAt: Date;
}

/**
 * Analytical Event Handler
 * Manages event processing for analytical intelligence workflows
 */
export class AnalyticalEventHandler {
  private static instance: AnalyticalEventHandler;

  private constructor() {
    this.setupEventHandlers();
  }

  static getInstance(): AnalyticalEventHandler {
    if (!AnalyticalEventHandler.instance) {
      AnalyticalEventHandler.instance = new AnalyticalEventHandler();
    }
    return AnalyticalEventHandler.instance;
  }

  private setupEventHandlers(): void {
    // Rate Card Event Handlers
    eventBus.subscribe(AnalyticalEvents.RATE_CARD_PARSED, this.handleRateCardParsed.bind(this));
    eventBus.subscribe(AnalyticalEvents.BENCHMARK_UPDATED, this.handleBenchmarkUpdated.bind(this));
    
    // Renewal Event Handlers
    eventBus.subscribe(AnalyticalEvents.RENEWAL_ALERT_TRIGGERED, this.handleRenewalAlert.bind(this));
    
    // Compliance Event Handlers
    eventBus.subscribe(AnalyticalEvents.COMPLIANCE_SCORED, this.handleComplianceScored.bind(this));
    
    // Supplier Event Handlers
    eventBus.subscribe(AnalyticalEvents.SUPPLIER_PROFILE_UPDATED, this.handleSupplierProfileUpdated.bind(this));
    
    // Spend Event Handlers
    eventBus.subscribe(AnalyticalEvents.SPEND_VARIANCE_DETECTED, this.handleSpendVariance.bind(this));
    
    // Query Event Handlers
    eventBus.subscribe(AnalyticalEvents.QUERY_PROCESSED, this.handleQueryProcessed.bind(this));

    logger.info("Analytical event handlers initialized");
  }

  private async handleRateCardParsed(payload: any): Promise<void> {
    try {
      const event = payload.data as RateCardParsedEvent;
      logger.info({ contractId: event.contractId, supplierId: event.supplierId }, "Processing rate card parsed event");
      
      // Trigger benchmark update
      await eventBus.publish(AnalyticalEvents.BENCHMARK_UPDATED, {
        tenantId: event.tenantId,
        cohort: event.cohort,
        statistics: {
          p25: 0, p50: 0, p75: 0, p90: 0, // Will be calculated by benchmark engine
          sampleSize: 1,
          confidence: 0.5
        },
        updatedAt: new Date()
      });
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle rate card parsed event");
    }
  }

  private async handleBenchmarkUpdated(payload: any): Promise<void> {
    try {
      const event = payload.data as BenchmarkUpdatedEvent;
      logger.info({ cohort: event.cohort }, "Processing benchmark updated event");
      // Additional processing can be added here
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle benchmark updated event");
    }
  }

  private async handleRenewalAlert(payload: any): Promise<void> {
    try {
      const event = payload.data as RenewalAlertEvent;
      logger.info({ contractId: event.contractId, priority: event.priority }, "Processing renewal alert event");
      // Additional processing can be added here
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle renewal alert event");
    }
  }

  private async handleComplianceScored(payload: any): Promise<void> {
    try {
      const event = payload.data as ComplianceScoredEvent;
      logger.info({ contractId: event.contractId, riskLevel: event.complianceScore.riskLevel }, "Processing compliance scored event");
      
      // Update supplier profile with compliance data
      await eventBus.publish(AnalyticalEvents.SUPPLIER_PROFILE_UPDATED, {
        tenantId: event.tenantId,
        supplierId: event.supplierId,
        updateType: 'compliance',
        changes: {
          complianceScore: event.complianceScore.overallScore,
          riskLevel: event.complianceScore.riskLevel,
          lastAssessment: event.scoredAt
        },
        updatedAt: new Date()
      });
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle compliance scored event");
    }
  }

  private async handleSupplierProfileUpdated(payload: any): Promise<void> {
    try {
      const event = payload.data as SupplierProfileUpdatedEvent;
      logger.info({ supplierId: event.supplierId, updateType: event.updateType }, "Processing supplier profile updated event");
      // Additional processing can be added here
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle supplier profile updated event");
    }
  }

  private async handleSpendVariance(payload: any): Promise<void> {
    try {
      const event = payload.data as SpendVarianceEvent;
      logger.info({ supplierId: event.supplierId, variancePercentage: event.variance.variancePercentage }, "Processing spend variance event");
      // Additional processing can be added here
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle spend variance event");
    }
  }

  private async handleQueryProcessed(payload: any): Promise<void> {
    try {
      const event = payload.data as QueryProcessedEvent;
      logger.info({ sessionId: event.sessionId, confidence: event.response.confidence }, "Processing query processed event");
      // Additional processing can be added here
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle query processed event");
    }
  }
}

// Initialize the event handler
export const analyticalEventHandler = AnalyticalEventHandler.getInstance();