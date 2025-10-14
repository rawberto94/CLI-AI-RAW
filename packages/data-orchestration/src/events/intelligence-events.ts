import { eventBus, Events, EventPayload } from "./event-bus";
import { dbAdaptor } from "../dal/database.adaptor";
import { cacheAdaptor } from "../dal/cache.adaptor";
import pino from "pino";

const logger = pino({ name: "intelligence-events" });

export interface IntelligencePattern {
  id: string;
  type: "financial" | "risk" | "compliance" | "performance" | "usage";
  pattern: string;
  description: string;
  confidence: number;
  impact: "high" | "medium" | "low";
  affectedContracts: string[];
  metadata: any;
  detectedAt: Date;
}

export interface IntelligenceInsight {
  id: string;
  type: "cost_optimization" | "risk_mitigation" | "compliance_improvement" | "process_optimization";
  title: string;
  description: string;
  recommendation: string;
  potentialSavings?: number;
  riskReduction?: number;
  confidence: number;
  impact: "high" | "medium" | "low";
  priority: number;
  metadata: any;
  generatedAt: Date;
}

export class IntelligenceEventProcessor {
  private static instance: IntelligenceEventProcessor;
  private patternCache = new Map<string, IntelligencePattern[]>();
  private insightCache = new Map<string, IntelligenceInsight[]>();

  private constructor() {
    this.setupEventHandlers();
  }

  static getInstance(): IntelligenceEventProcessor {
    if (!IntelligenceEventProcessor.instance) {
      IntelligenceEventProcessor.instance = new IntelligenceEventProcessor();
    }
    return IntelligenceEventProcessor.instance;
  }

  private setupEventHandlers(): void {
    // Contract events
    eventBus.subscribe(Events.CONTRACT_CREATED, this.handleContractCreated.bind(this));
    eventBus.subscribe(Events.CONTRACT_UPDATED, this.handleContractUpdated.bind(this));
    eventBus.subscribe(Events.ARTIFACT_CREATED, this.handleArtifactCreated.bind(this));
    eventBus.subscribe(Events.PROCESSING_COMPLETED, this.handleProcessingCompleted.bind(this));
    
    // Rate card events
    eventBus.subscribe(Events.RATE_CARD_IMPORTED, this.handleRateCardImported.bind(this));
    eventBus.subscribe(Events.BENCHMARK_COMPLETED, this.handleBenchmarkCompleted.bind(this));
  }

  /**
   * Handle contract creation - detect initial patterns
   */
  private async handleContractCreated(payload: EventPayload): Promise<void> {
    try {
      const { contractId, tenantId } = payload.data;
      
      // Analyze contract patterns
      await this.analyzeContractPatterns(contractId, tenantId);
      
      // Check for portfolio-level insights
      await this.generatePortfolioInsights(tenantId);
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle contract created event");
    }
  }

  /**
   * Handle contract updates - detect changes and trends
   */
  private async handleContractUpdated(payload: EventPayload): Promise<void> {
    try {
      const { contractId, tenantId, changes } = payload.data;
      
      // Detect significant changes
      if (changes.status === "COMPLETED") {
        await this.analyzeCompletedContract(contractId, tenantId);
      }
      
      if (changes.totalValue) {
        await this.detectFinancialAnomalies(contractId, tenantId);
      }
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle contract updated event");
    }
  }

  /**
   * Handle artifact creation - analyze content for patterns
   */
  private async handleArtifactCreated(payload: EventPayload): Promise<void> {
    try {
      const { artifactId, contractId, tenantId, type, data } = payload.data;
      
      switch (type) {
        case "FINANCIAL":
          await this.analyzeFinancialArtifact(contractId, tenantId, data);
          break;
        case "RISK":
          await this.analyzeRiskArtifact(contractId, tenantId, data);
          break;
        case "COMPLIANCE":
          await this.analyzeComplianceArtifact(contractId, tenantId, data);
          break;
      }
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle artifact created event");
    }
  }

  /**
   * Handle processing completion - generate comprehensive insights
   */
  private async handleProcessingCompleted(payload: EventPayload): Promise<void> {
    try {
      const { contractId, tenantId } = payload.data;
      
      // Generate comprehensive contract insights
      await this.generateContractInsights(contractId, tenantId);
      
      // Update portfolio-level patterns
      await this.updatePortfolioPatterns(tenantId);
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle processing completed event");
    }
  }

  /**
   * Handle rate card import - detect pricing patterns
   */
  private async handleRateCardImported(payload: EventPayload): Promise<void> {
    try {
      const { rateCardId, tenantId } = payload.data;
      
      await this.analyzePricingPatterns(rateCardId, tenantId);
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle rate card imported event");
    }
  }

  /**
   * Handle benchmark completion - generate cost optimization insights
   */
  private async handleBenchmarkCompleted(payload: EventPayload): Promise<void> {
    try {
      const { contractId, tenantId, benchmarkResults } = payload.data;
      
      await this.generateCostOptimizationInsights(contractId, tenantId, benchmarkResults);
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle benchmark completed event");
    }
  }

  /**
   * Analyze contract patterns for intelligence
   */
  private async analyzeContractPatterns(contractId: string, tenantId: string): Promise<void> {
    try {
      // Get contract details
      const contract = await dbAdaptor.getContract(contractId, tenantId);
      if (!contract) return;

      const patterns: IntelligencePattern[] = [];

      // Pattern 1: Contract value patterns
      if (contract.totalValue) {
        const similarContracts = await this.findSimilarValueContracts(
          contract.totalValue,
          tenantId
        );
        
        if (similarContracts.length > 3) {
          patterns.push({
            id: `pattern_${Date.now()}_value`,
            type: "financial",
            pattern: "similar_contract_values",
            description: `Found ${similarContracts.length} contracts with similar values (±20%)`,
            confidence: 0.8,
            impact: "medium",
            affectedContracts: [contractId, ...similarContracts.map(c => c.id)],
            metadata: {
              averageValue: contract.totalValue,
              contractCount: similarContracts.length + 1,
            },
            detectedAt: new Date(),
          });
        }
      }

      // Pattern 2: Supplier patterns
      if (contract.supplierName) {
        const supplierContracts = await this.getSupplierContracts(
          contract.supplierName,
          tenantId
        );
        
        if (supplierContracts.length > 1) {
          patterns.push({
            id: `pattern_${Date.now()}_supplier`,
            type: "performance",
            pattern: "supplier_relationship",
            description: `${contract.supplierName} has ${supplierContracts.length} contracts`,
            confidence: 0.9,
            impact: "high",
            affectedContracts: supplierContracts.map(c => c.id),
            metadata: {
              supplierName: contract.supplierName,
              contractCount: supplierContracts.length,
              totalValue: supplierContracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0),
            },
            detectedAt: new Date(),
          });
        }
      }

      // Store patterns
      if (patterns.length > 0) {
        await this.storePatterns(tenantId, patterns);
        
        // Emit pattern detection events
        for (const pattern of patterns) {
          await eventBus.publish(Events.PATTERN_DETECTED, {
            patternId: pattern.id,
            tenantId,
            contractId,
            pattern,
          });
        }
      }

    } catch (error) {
      logger.error({ error, contractId, tenantId }, "Failed to analyze contract patterns");
    }
  }

  /**
   * Generate portfolio-level insights
   */
  private async generatePortfolioInsights(tenantId: string): Promise<void> {
    try {
      const insights: IntelligenceInsight[] = [];

      // Get all contracts for analysis
      const contracts = await dbAdaptor.prisma.contract.findMany({
        where: { tenantId, status: { not: "DELETED" } },
        include: { artifacts: true },
      });

      if (contracts.length < 2) return; // Need at least 2 contracts for insights

      // Insight 1: Contract volume trends
      const monthlyVolume = this.analyzeMonthlyVolume(contracts);
      if (monthlyVolume.trend !== "stable") {
        insights.push({
          id: `insight_${Date.now()}_volume`,
          type: "process_optimization",
          title: `Contract Volume ${monthlyVolume.trend === "increasing" ? "Increase" : "Decrease"} Detected`,
          description: `Contract volume has ${monthlyVolume.trend} by ${monthlyVolume.changePercent}% over the last 3 months`,
          recommendation: monthlyVolume.trend === "increasing" 
            ? "Consider scaling processing capacity and review approval workflows"
            : "Review contract pipeline and business development activities",
          confidence: 0.85,
          impact: monthlyVolume.changePercent > 50 ? "high" : "medium",
          priority: monthlyVolume.changePercent > 50 ? 1 : 2,
          metadata: monthlyVolume,
          generatedAt: new Date(),
        });
      }

      // Insight 2: Financial optimization opportunities
      const financialInsights = await this.analyzeFinancialOptimization(contracts);
      insights.push(...financialInsights);

      // Insight 3: Risk concentration analysis
      const riskInsights = await this.analyzeRiskConcentration(contracts);
      insights.push(...riskInsights);

      // Store insights
      if (insights.length > 0) {
        await this.storeInsights(tenantId, insights);
        
        // Emit insight generation events
        for (const insight of insights) {
          await eventBus.publish(Events.INSIGHT_GENERATED, {
            insightId: insight.id,
            tenantId,
            insight,
          });
        }
      }

    } catch (error) {
      logger.error({ error, tenantId }, "Failed to generate portfolio insights");
    }
  }

  /**
   * Analyze financial artifacts for cost optimization
   */
  private async analyzeFinancialArtifact(contractId: string, tenantId: string, data: any): Promise<void> {
    try {
      const insights: IntelligenceInsight[] = [];

      // Check for high-cost rate cards
      if (data.rateCards && Array.isArray(data.rateCards)) {
        for (const rateCard of data.rateCards) {
          if (rateCard.insights?.averageVariance && parseFloat(rateCard.insights.averageVariance) > 20) {
            insights.push({
              id: `insight_${Date.now()}_highcost`,
              type: "cost_optimization",
              title: "High-Cost Rate Card Detected",
              description: `Rate card shows ${rateCard.insights.averageVariance} above market rates`,
              recommendation: "Negotiate better rates or consider alternative suppliers",
              potentialSavings: rateCard.insights.totalAnnualSavings ? 
                parseFloat(rateCard.insights.totalAnnualSavings.replace(/[^0-9.-]/g, '')) : 0,
              confidence: 0.8,
              impact: "high",
              priority: 1,
              metadata: {
                contractId,
                rateCardId: rateCard.id,
                variance: rateCard.insights.averageVariance,
              },
              generatedAt: new Date(),
            });
          }
        }
      }

      // Store insights
      if (insights.length > 0) {
        await this.storeInsights(tenantId, insights);
      }

    } catch (error) {
      logger.error({ error, contractId }, "Failed to analyze financial artifact");
    }
  }

  /**
   * Helper methods for pattern analysis
   */
  private async findSimilarValueContracts(value: number, tenantId: string): Promise<any[]> {
    const range = value * 0.2; // ±20%
    return dbAdaptor.prisma.contract.findMany({
      where: {
        tenantId,
        totalValue: {
          gte: value - range,
          lte: value + range,
        },
        status: { not: "DELETED" },
      },
      take: 10,
    });
  }

  private async getSupplierContracts(supplierName: string, tenantId: string): Promise<any[]> {
    return dbAdaptor.prisma.contract.findMany({
      where: {
        tenantId,
        supplierName,
        status: { not: "DELETED" },
      },
    });
  }

  private analyzeMonthlyVolume(contracts: any[]): {
    trend: "increasing" | "decreasing" | "stable";
    changePercent: number;
    monthlyData: any[];
  } {
    // Group contracts by month
    const monthlyData = contracts.reduce((acc, contract) => {
      const month = new Date(contract.createdAt).toISOString().slice(0, 7);
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const months = Object.keys(monthlyData).sort();
    if (months.length < 2) {
      return { trend: "stable", changePercent: 0, monthlyData: [] };
    }

    const recent = monthlyData[months[months.length - 1]];
    const previous = monthlyData[months[months.length - 2]];
    const changePercent = Math.round(((recent - previous) / previous) * 100);

    return {
      trend: changePercent > 10 ? "increasing" : changePercent < -10 ? "decreasing" : "stable",
      changePercent: Math.abs(changePercent),
      monthlyData: months.map(month => ({ month, count: monthlyData[month] })),
    };
  }

  private async analyzeFinancialOptimization(contracts: any[]): Promise<IntelligenceInsight[]> {
    // Placeholder for financial optimization analysis
    return [];
  }

  private async analyzeRiskConcentration(contracts: any[]): Promise<IntelligenceInsight[]> {
    // Placeholder for risk concentration analysis
    return [];
  }

  private async analyzeCompletedContract(contractId: string, tenantId: string): Promise<void> {
    // Placeholder for completed contract analysis
  }

  private async detectFinancialAnomalies(contractId: string, tenantId: string): Promise<void> {
    // Placeholder for financial anomaly detection
  }

  private async analyzeRiskArtifact(contractId: string, tenantId: string, data: any): Promise<void> {
    // Placeholder for risk artifact analysis
  }

  private async analyzeComplianceArtifact(contractId: string, tenantId: string, data: any): Promise<void> {
    // Placeholder for compliance artifact analysis
  }

  private async generateContractInsights(contractId: string, tenantId: string): Promise<void> {
    // Placeholder for contract insights generation
  }

  private async updatePortfolioPatterns(tenantId: string): Promise<void> {
    // Placeholder for portfolio pattern updates
  }

  private async analyzePricingPatterns(rateCardId: string, tenantId: string): Promise<void> {
    // Placeholder for pricing pattern analysis
  }

  private async generateCostOptimizationInsights(contractId: string, tenantId: string, benchmarkResults: any): Promise<void> {
    // Placeholder for cost optimization insights
  }

  /**
   * Store patterns in cache and optionally in database
   */
  private async storePatterns(tenantId: string, patterns: IntelligencePattern[]): Promise<void> {
    const cacheKey = `patterns:${tenantId}`;
    const existing = this.patternCache.get(tenantId) || [];
    const updated = [...existing, ...patterns];
    
    this.patternCache.set(tenantId, updated);
    await cacheAdaptor.set(cacheKey, updated, 3600); // 1 hour TTL
  }

  /**
   * Store insights in cache and optionally in database
   */
  private async storeInsights(tenantId: string, insights: IntelligenceInsight[]): Promise<void> {
    const cacheKey = `insights:${tenantId}`;
    const existing = this.insightCache.get(tenantId) || [];
    const updated = [...existing, ...insights];
    
    this.insightCache.set(tenantId, updated);
    await cacheAdaptor.set(cacheKey, updated, 3600); // 1 hour TTL
  }

  /**
   * Get patterns for a tenant
   */
  async getPatterns(tenantId: string): Promise<IntelligencePattern[]> {
    const cacheKey = `patterns:${tenantId}`;
    const cached = await cacheAdaptor.get<IntelligencePattern[]>(cacheKey);
    return cached || this.patternCache.get(tenantId) || [];
  }

  /**
   * Get insights for a tenant
   */
  async getInsights(tenantId: string): Promise<IntelligenceInsight[]> {
    const cacheKey = `insights:${tenantId}`;
    const cached = await cacheAdaptor.get<IntelligenceInsight[]>(cacheKey);
    return cached || this.insightCache.get(tenantId) || [];
  }
}

// Singleton instance
export const intelligenceProcessor = IntelligenceEventProcessor.getInstance();