import { dbAdaptor } from "../dal/database.adaptor";
import { cacheAdaptor } from "../dal/cache.adaptor";
import { eventBus, Events } from "../events/event-bus";
import pino from "pino";
import type { ServiceResponse } from "./contract.service";

const logger = pino({ name: "intelligence-service" });

export interface IntelligencePattern {
  id: string;
  type: "financial" | "risk" | "compliance" | "performance" | "supplier" | "temporal";
  category: string;
  description: string;
  confidence: number; // 0-1
  impact: "low" | "medium" | "high" | "critical";
  severity: number; // 1-10
  affectedContracts: string[];
  metadata: {
    detectedAt: Date;
    algorithm: string;
    parameters: Record<string, any>;
    evidence: any[];
    recommendations: string[];
  };
}

export interface IntelligenceInsight {
  id: string;
  type: "cost_optimization" | "risk_mitigation" | "compliance_improvement" | "process_optimization" | "supplier_management";
  title: string;
  description: string;
  recommendation: string;
  priority: 1 | 2 | 3 | 4 | 5; // 1 = highest
  confidence: number; // 0-1
  impact: "low" | "medium" | "high" | "critical";
  potentialSavings?: number;
  riskReduction?: number;
  timeToImplement?: number; // days
  effort: "low" | "medium" | "high";
  metadata: {
    generatedAt: Date;
    algorithm: string;
    dataPoints: number;
    relatedPatterns: string[];
    evidence: any[];
  };
}

export interface PortfolioAnalytics {
  overview: {
    totalContracts: number;
    totalValue: number;
    averageValue: number;
    activeContracts: number;
    expiringContracts: number; // Next 90 days
  };
  trends: {
    volumeTrend: "increasing" | "decreasing" | "stable";
    valueTrend: "increasing" | "decreasing" | "stable";
    riskTrend: "improving" | "deteriorating" | "stable";
    processingEfficiency: number; // 0-100
  };
  risks: {
    supplierConcentration: Array<{
      supplier: string;
      concentration: number;
      riskLevel: "low" | "medium" | "high";
    }>;
    complianceGaps: Array<{
      regulation: string;
      gapCount: number;
      severity: "low" | "medium" | "high";
    }>;
    financialExposure: {
      totalExposure: number;
      highRiskValue: number;
      currencyExposure: Record<string, number>;
    };
  };
  opportunities: {
    costOptimization: number;
    processImprovement: number;
    riskReduction: number;
    complianceEnhancement: number;
  };
}

export class IntelligenceService {
  private static instance: IntelligenceService;
  private patternCache = new Map<string, IntelligencePattern[]>();
  private insightCache = new Map<string, IntelligenceInsight[]>();

  private constructor() {}

  static getInstance(): IntelligenceService {
    if (!IntelligenceService.instance) {
      IntelligenceService.instance = new IntelligenceService();
    }
    return IntelligenceService.instance;
  }

  /**
   * Analyze contracts and detect patterns using ML algorithms
   */
  async analyzeContractPatterns(tenantId: string): Promise<ServiceResponse<IntelligencePattern[]>> {
    try {
      // Get all contracts for analysis
      const contracts = await dbAdaptor.prisma.contract.findMany({
        where: { 
          tenantId, 
          status: { not: "DELETED" } 
        },
        include: {
          artifacts: true,
        },
      });

      if (contracts.length < 2) {
        return {
          success: true,
          data: [],
        };
      }

      const patterns: IntelligencePattern[] = [];

      // Financial Pattern Detection
      const financialPatterns = await this.detectFinancialPatterns(contracts);
      patterns.push(...financialPatterns);

      // Supplier Risk Patterns
      const supplierPatterns = await this.detectSupplierRiskPatterns(contracts);
      patterns.push(...supplierPatterns);

      // Temporal Patterns
      const temporalPatterns = await this.detectTemporalPatterns(contracts);
      patterns.push(...temporalPatterns);

      // Compliance Patterns
      const compliancePatterns = await this.detectCompliancePatterns(contracts);
      patterns.push(...compliancePatterns);

      // Performance Patterns
      const performancePatterns = await this.detectPerformancePatterns(contracts);
      patterns.push(...performancePatterns);

      // Cache patterns
      await this.cachePatterns(tenantId, patterns);

      // Emit pattern detection events
      for (const pattern of patterns) {
        await eventBus.publish(Events.PATTERN_DETECTED, {
          tenantId,
          pattern,
        });
      }

      logger.info({ tenantId, patternCount: patterns.length }, "Patterns detected");

      return {
        success: true,
        data: patterns,
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to analyze contract patterns");
      return {
        success: false,
        error: {
          code: "PATTERN_ANALYSIS_FAILED",
          message: "Failed to analyze contract patterns",
          details: error,
        },
      };
    }
  }

  /**
   * Generate actionable insights from detected patterns
   */
  async generateInsights(tenantId: string): Promise<ServiceResponse<IntelligenceInsight[]>> {
    try {
      const patterns = await this.getPatterns(tenantId);
      const contracts = await dbAdaptor.prisma.contract.findMany({
        where: { tenantId, status: { not: "DELETED" } },
        include: { artifacts: true },
      });

      const insights: IntelligenceInsight[] = [];

      // Cost Optimization Insights
      const costInsights = await this.generateCostOptimizationInsights(patterns, contracts);
      insights.push(...costInsights);

      // Risk Mitigation Insights
      const riskInsights = await this.generateRiskMitigationInsights(patterns, contracts);
      insights.push(...riskInsights);

      // Process Optimization Insights
      const processInsights = await this.generateProcessOptimizationInsights(patterns, contracts);
      insights.push(...processInsights);

      // Compliance Improvement Insights
      const complianceInsights = await this.generateComplianceInsights(patterns, contracts);
      insights.push(...complianceInsights);

      // Supplier Management Insights
      const supplierInsights = await this.generateSupplierInsights(patterns, contracts);
      insights.push(...supplierInsights);

      // Sort by priority and confidence
      insights.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.confidence - a.confidence;
      });

      // Cache insights
      await this.cacheInsights(tenantId, insights);

      // Emit insight generation events
      for (const insight of insights) {
        await eventBus.publish(Events.INSIGHT_GENERATED, {
          tenantId,
          insight,
        });
      }

      logger.info({ tenantId, insightCount: insights.length }, "Insights generated");

      return {
        success: true,
        data: insights,
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to generate insights");
      return {
        success: false,
        error: {
          code: "INSIGHT_GENERATION_FAILED",
          message: "Failed to generate insights",
          details: error,
        },
      };
    }
  }

  /**
   * Get comprehensive portfolio analytics
   */
  async getPortfolioAnalytics(tenantId: string): Promise<ServiceResponse<PortfolioAnalytics>> {
    try {
      const cacheKey = `portfolio-analytics:${tenantId}`;
      const cached = await cacheAdaptor.get<PortfolioAnalytics>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const contracts = await dbAdaptor.prisma.contract.findMany({
        where: { tenantId, status: { not: "DELETED" } },
        include: { artifacts: true },
      });

      const analytics: PortfolioAnalytics = {
        overview: this.calculateOverviewMetrics(contracts),
        trends: await this.calculateTrends(contracts),
        risks: await this.calculateRisks(contracts),
        opportunities: await this.calculateOpportunities(contracts),
      };

      // Cache for 15 minutes
      await cacheAdaptor.set(cacheKey, analytics, 900);

      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to get portfolio analytics");
      return {
        success: false,
        error: {
          code: "ANALYTICS_FAILED",
          message: "Failed to get portfolio analytics",
          details: error,
        },
      };
    }
  }

  // =========================================================================
  // PATTERN DETECTION ALGORITHMS
  // =========================================================================

  private async detectFinancialPatterns(contracts: any[]): Promise<IntelligencePattern[]> {
    const patterns: IntelligencePattern[] = [];

    // Outlier Detection using Statistical Analysis
    const values = contracts.map(c => Number(c.totalValue)).filter(v => v > 0);
    if (values.length > 3) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length);
      
      const outliers = contracts.filter(c => {
        const value = Number(c.totalValue);
        return value > 0 && Math.abs(value - mean) > 2 * stdDev;
      });

      if (outliers.length > 0) {
        patterns.push({
          id: `financial-outliers-${Date.now()}`,
          type: "financial",
          category: "value_anomaly",
          description: `${outliers.length} contracts with unusual values detected (>2σ from mean)`,
          confidence: 0.85,
          impact: outliers.some(o => Number(o.totalValue) > mean + 3 * stdDev) ? "high" : "medium",
          severity: 7,
          affectedContracts: outliers.map(o => o.id),
          metadata: {
            detectedAt: new Date(),
            algorithm: "statistical_outlier_detection",
            parameters: { mean, stdDev, threshold: 2 },
            evidence: outliers.map(o => ({ id: o.id, value: o.totalValue, deviation: Math.abs(Number(o.totalValue) - mean) / stdDev })),
            recommendations: [
              "Review high-value contracts for accuracy",
              "Investigate pricing strategies for outliers",
              "Consider contract value approval thresholds"
            ],
          },
        });
      }
    }

    // Currency Concentration Risk
    const currencyGroups = contracts.reduce((acc, c) => {
      const currency = c.currency || "USD";
      if (!acc[currency]) acc[currency] = [];
      acc[currency].push(c);
      return acc;
    }, {} as Record<string, any[]>);

    const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
    Object.entries(currencyGroups).forEach(([currency, currencyContracts]) => {
      const currencyValue = currencyContracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
      const concentration = currencyValue / totalValue;

      if (concentration > 0.7 && currency !== "USD") { // >70% in non-USD
        patterns.push({
          id: `currency-concentration-${currency}-${Date.now()}`,
          type: "financial",
          category: "currency_risk",
          description: `High concentration (${(concentration * 100).toFixed(1)}%) in ${currency}`,
          confidence: 0.9,
          impact: "medium",
          severity: 6,
          affectedContracts: currencyContracts.map(c => c.id),
          metadata: {
            detectedAt: new Date(),
            algorithm: "currency_concentration_analysis",
            parameters: { threshold: 0.7 },
            evidence: [{ currency, concentration, value: currencyValue, contractCount: currencyContracts.length }],
            recommendations: [
              "Consider currency hedging strategies",
              "Diversify contract currencies",
              "Implement currency risk monitoring"
            ],
          },
        });
      }
    });

    return patterns;
  }

  private async detectSupplierRiskPatterns(contracts: any[]): Promise<IntelligencePattern[]> {
    const patterns: IntelligencePattern[] = [];

    // Supplier Concentration Risk
    const supplierGroups = contracts.reduce((acc, c) => {
      if (!c.supplierName) return acc;
      if (!acc[c.supplierName]) acc[c.supplierName] = [];
      acc[c.supplierName].push(c);
      return acc;
    }, {} as Record<string, any[]>);

    const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
    
    Object.entries(supplierGroups).forEach(([supplier, supplierContracts]) => {
      const supplierValue = supplierContracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
      const concentration = supplierValue / totalValue;
      
      if (concentration > 0.3) { // >30% concentration
        patterns.push({
          id: `supplier-concentration-${supplier.replace(/\s+/g, '-')}-${Date.now()}`,
          type: "risk",
          category: "supplier_concentration",
          description: `High dependency on ${supplier} (${(concentration * 100).toFixed(1)}% of portfolio value)`,
          confidence: 0.95,
          impact: concentration > 0.5 ? "critical" : concentration > 0.4 ? "high" : "medium",
          severity: Math.min(Math.floor(concentration * 10), 10),
          affectedContracts: supplierContracts.map(c => c.id),
          metadata: {
            detectedAt: new Date(),
            algorithm: "supplier_concentration_analysis",
            parameters: { threshold: 0.3 },
            evidence: [{ 
              supplier, 
              concentration, 
              value: supplierValue, 
              contractCount: supplierContracts.length,
              averageContractValue: supplierValue / supplierContracts.length
            }],
            recommendations: [
              "Diversify supplier base to reduce concentration risk",
              "Develop alternative suppliers for critical services",
              "Implement supplier risk monitoring",
              "Consider contract value limits per supplier"
            ],
          },
        });
      }
    });

    // Supplier Performance Patterns (based on processing success rates)
    const supplierPerformance = Object.entries(supplierGroups).map(([supplier, contracts]) => {
      const completedContracts = contracts.filter(c => c.status === "COMPLETED");
      const failedContracts = contracts.filter(c => c.status === "FAILED");
      const successRate = contracts.length > 0 ? completedContracts.length / contracts.length : 0;
      
      return { supplier, contracts, successRate, failedCount: failedContracts.length };
    }).filter(s => s.contracts.length >= 3); // Only analyze suppliers with 3+ contracts

    const poorPerformers = supplierPerformance.filter(s => s.successRate < 0.8 && s.failedCount > 1);
    
    if (poorPerformers.length > 0) {
      patterns.push({
        id: `supplier-performance-issues-${Date.now()}`,
        type: "performance",
        category: "supplier_performance",
        description: `${poorPerformers.length} suppliers with processing issues detected`,
        confidence: 0.8,
        impact: "medium",
        severity: 6,
        affectedContracts: poorPerformers.flatMap(s => s.contracts.map(c => c.id)),
        metadata: {
          detectedAt: new Date(),
          algorithm: "supplier_performance_analysis",
          parameters: { minContracts: 3, successThreshold: 0.8 },
          evidence: poorPerformers.map(s => ({
            supplier: s.supplier,
            successRate: s.successRate,
            failedCount: s.failedCount,
            totalContracts: s.contracts.length
          })),
          recommendations: [
            "Review contract templates for problematic suppliers",
            "Provide supplier onboarding guidance",
            "Implement supplier performance monitoring",
            "Consider supplier training programs"
          ],
        },
      });
    }

    return patterns;
  }

  private async detectTemporalPatterns(contracts: any[]): Promise<IntelligencePattern[]> {
    const patterns: IntelligencePattern[] = [];

    // Contract Expiration Clustering
    const now = new Date();
    const next90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringContracts = contracts.filter(c => 
      c.endDate && new Date(c.endDate) <= next90Days && new Date(c.endDate) > now
    );

    const criticalExpirations = expiringContracts.filter(c => 
      new Date(c.endDate) <= next30Days
    );

    if (expiringContracts.length > 0) {
      const totalExpiringValue = expiringContracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
      
      patterns.push({
        id: `contract-expirations-${Date.now()}`,
        type: "temporal",
        category: "expiration_risk",
        description: `${expiringContracts.length} contracts expiring in next 90 days (${criticalExpirations.length} critical)`,
        confidence: 1.0,
        impact: criticalExpirations.length > 5 ? "high" : "medium",
        severity: Math.min(Math.floor(criticalExpirations.length / 2) + 3, 10),
        affectedContracts: expiringContracts.map(c => c.id),
        metadata: {
          detectedAt: new Date(),
          algorithm: "temporal_expiration_analysis",
          parameters: { window90Days: 90, window30Days: 30 },
          evidence: [{
            totalExpiring: expiringContracts.length,
            criticalExpiring: criticalExpirations.length,
            totalValue: totalExpiringValue,
            averageValue: totalExpiringValue / expiringContracts.length
          }],
          recommendations: [
            "Prioritize renewal negotiations for critical contracts",
            "Implement automated renewal reminders",
            "Review contract terms for upcoming renewals",
            "Plan resource allocation for renewal activities"
          ],
        },
      });
    }

    return patterns;
  }

  private async detectCompliancePatterns(contracts: any[]): Promise<IntelligencePattern[]> {
    const patterns: IntelligencePattern[] = [];

    // Missing Critical Fields Pattern
    const criticalFields = ['clientName', 'supplierName', 'totalValue', 'startDate', 'endDate'];
    const incompleteContracts = contracts.filter(c => 
      criticalFields.some(field => !c[field])
    );

    if (incompleteContracts.length > contracts.length * 0.2) { // >20% incomplete
      const missingFieldStats = criticalFields.map(field => ({
        field,
        missingCount: contracts.filter(c => !c[field]).length,
        percentage: (contracts.filter(c => !c[field]).length / contracts.length) * 100
      })).filter(stat => stat.missingCount > 0);

      patterns.push({
        id: `compliance-incomplete-data-${Date.now()}`,
        type: "compliance",
        category: "data_completeness",
        description: `${incompleteContracts.length} contracts missing critical information`,
        confidence: 0.95,
        impact: "medium",
        severity: 5,
        affectedContracts: incompleteContracts.map(c => c.id),
        metadata: {
          detectedAt: new Date(),
          algorithm: "data_completeness_analysis",
          parameters: { criticalFields, threshold: 0.2 },
          evidence: missingFieldStats,
          recommendations: [
            "Implement mandatory field validation",
            "Review contract intake processes",
            "Provide data entry training",
            "Create contract template standards"
          ],
        },
      });
    }

    return patterns;
  }

  private async detectPerformancePatterns(contracts: any[]): Promise<IntelligencePattern[]> {
    const patterns: IntelligencePattern[] = [];

    // Processing Time Analysis
    const processedContracts = contracts.filter(c => 
      c.uploadedAt && c.processedAt && c.status === "COMPLETED"
    );

    if (processedContracts.length > 5) {
      const processingTimes = processedContracts.map(c => 
        new Date(c.processedAt).getTime() - new Date(c.uploadedAt).getTime()
      );

      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const slowContracts = processedContracts.filter((c, i) => 
        processingTimes[i] > avgProcessingTime * 2
      );

      if (slowContracts.length > 0) {
        patterns.push({
          id: `performance-slow-processing-${Date.now()}`,
          type: "performance",
          category: "processing_efficiency",
          description: `${slowContracts.length} contracts with slow processing times detected`,
          confidence: 0.8,
          impact: "medium",
          severity: 4,
          affectedContracts: slowContracts.map(c => c.id),
          metadata: {
            detectedAt: new Date(),
            algorithm: "processing_time_analysis",
            parameters: { threshold: 2.0 },
            evidence: [{
              averageProcessingTime: Math.round(avgProcessingTime / 1000 / 60), // minutes
              slowContractCount: slowContracts.length,
              totalProcessed: processedContracts.length
            }],
            recommendations: [
              "Investigate causes of slow processing",
              "Optimize processing pipeline",
              "Consider resource scaling",
              "Review contract complexity factors"
            ],
          },
        });
      }
    }

    return patterns;
  }

  // =========================================================================
  // INSIGHT GENERATION ALGORITHMS
  // =========================================================================

  private async generateCostOptimizationInsights(
    patterns: IntelligencePattern[], 
    contracts: any[]
  ): Promise<IntelligenceInsight[]> {
    const insights: IntelligenceInsight[] = [];

    // High-value contract optimization
    const financialPatterns = patterns.filter(p => p.type === "financial");
    for (const pattern of financialPatterns) {
      if (pattern.category === "value_anomaly") {
        const potentialSavings = pattern.affectedContracts.length * 50000; // Estimated
        
        insights.push({
          id: `cost-opt-${pattern.id}`,
          type: "cost_optimization",
          title: "High-Value Contract Review Opportunity",
          description: `${pattern.affectedContracts.length} contracts with unusual values may have optimization potential`,
          recommendation: "Review pricing strategies and negotiate better terms for high-value outlier contracts",
          priority: 2,
          confidence: 0.7,
          impact: "medium",
          potentialSavings,
          timeToImplement: 30,
          effort: "medium",
          metadata: {
            generatedAt: new Date(),
            algorithm: "cost_optimization_analysis",
            dataPoints: pattern.affectedContracts.length,
            relatedPatterns: [pattern.id],
            evidence: pattern.metadata.evidence,
          },
        });
      }
    }

    return insights;
  }

  private async generateRiskMitigationInsights(
    patterns: IntelligencePattern[], 
    contracts: any[]
  ): Promise<IntelligenceInsight[]> {
    const insights: IntelligenceInsight[] = [];

    // Supplier concentration risk mitigation
    const supplierRiskPatterns = patterns.filter(p => 
      p.type === "risk" && p.category === "supplier_concentration"
    );

    for (const pattern of supplierRiskPatterns) {
      const riskReduction = pattern.severity * 10; // Estimated percentage
      
      insights.push({
        id: `risk-mit-${pattern.id}`,
        type: "risk_mitigation",
        title: "Supplier Concentration Risk Mitigation",
        description: pattern.description,
        recommendation: "Diversify supplier base and develop alternative suppliers to reduce concentration risk",
        priority: pattern.impact === "critical" ? 1 : 2,
        confidence: 0.9,
        impact: pattern.impact,
        riskReduction,
        timeToImplement: 90,
        effort: "high",
        metadata: {
          generatedAt: new Date(),
          algorithm: "risk_mitigation_analysis",
          dataPoints: pattern.affectedContracts.length,
          relatedPatterns: [pattern.id],
          evidence: pattern.metadata.evidence,
        },
      });
    }

    return insights;
  }

  private async generateProcessOptimizationInsights(
    patterns: IntelligencePattern[], 
    contracts: any[]
  ): Promise<IntelligenceInsight[]> {
    const insights: IntelligenceInsight[] = [];

    // Processing efficiency improvements
    const performancePatterns = patterns.filter(p => p.type === "performance");
    
    for (const pattern of performancePatterns) {
      if (pattern.category === "processing_efficiency") {
        insights.push({
          id: `process-opt-${pattern.id}`,
          type: "process_optimization",
          title: "Processing Efficiency Improvement",
          description: pattern.description,
          recommendation: "Optimize processing pipeline and investigate bottlenecks causing slow processing",
          priority: 3,
          confidence: 0.8,
          impact: "medium",
          timeToImplement: 14,
          effort: "medium",
          metadata: {
            generatedAt: new Date(),
            algorithm: "process_optimization_analysis",
            dataPoints: pattern.affectedContracts.length,
            relatedPatterns: [pattern.id],
            evidence: pattern.metadata.evidence,
          },
        });
      }
    }

    return insights;
  }

  private async generateComplianceInsights(
    patterns: IntelligencePattern[], 
    contracts: any[]
  ): Promise<IntelligenceInsight[]> {
    const insights: IntelligenceInsight[] = [];

    // Data completeness improvements
    const compliancePatterns = patterns.filter(p => p.type === "compliance");
    
    for (const pattern of compliancePatterns) {
      if (pattern.category === "data_completeness") {
        insights.push({
          id: `compliance-${pattern.id}`,
          type: "compliance_improvement",
          title: "Data Completeness Enhancement",
          description: pattern.description,
          recommendation: "Implement mandatory field validation and improve contract intake processes",
          priority: 2,
          confidence: 0.95,
          impact: "medium",
          timeToImplement: 21,
          effort: "low",
          metadata: {
            generatedAt: new Date(),
            algorithm: "compliance_analysis",
            dataPoints: pattern.affectedContracts.length,
            relatedPatterns: [pattern.id],
            evidence: pattern.metadata.evidence,
          },
        });
      }
    }

    return insights;
  }

  private async generateSupplierInsights(
    patterns: IntelligencePattern[], 
    contracts: any[]
  ): Promise<IntelligenceInsight[]> {
    const insights: IntelligenceInsight[] = [];

    // Supplier performance improvements
    const supplierPerformancePatterns = patterns.filter(p => 
      p.type === "performance" && p.category === "supplier_performance"
    );

    for (const pattern of supplierPerformancePatterns) {
      insights.push({
        id: `supplier-mgmt-${pattern.id}`,
        type: "supplier_management",
        title: "Supplier Performance Enhancement",
        description: pattern.description,
        recommendation: "Implement supplier training programs and performance monitoring",
        priority: 3,
        confidence: 0.8,
        impact: "medium",
        timeToImplement: 45,
        effort: "medium",
        metadata: {
          generatedAt: new Date(),
          algorithm: "supplier_management_analysis",
          dataPoints: pattern.affectedContracts.length,
          relatedPatterns: [pattern.id],
          evidence: pattern.metadata.evidence,
        },
      });
    }

    return insights;
  }

  // =========================================================================
  // ANALYTICS CALCULATIONS
  // =========================================================================

  private calculateOverviewMetrics(contracts: any[]) {
    const now = new Date();
    const next90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    return {
      totalContracts: contracts.length,
      totalValue: contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0),
      averageValue: contracts.length > 0 
        ? contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0) / contracts.length 
        : 0,
      activeContracts: contracts.filter(c => 
        c.status === "COMPLETED" && 
        (!c.endDate || new Date(c.endDate) > now)
      ).length,
      expiringContracts: contracts.filter(c => 
        c.endDate && 
        new Date(c.endDate) <= next90Days && 
        new Date(c.endDate) > now
      ).length,
    };
  }

  private async calculateTrends(contracts: any[]) {
    // Simple trend calculation - can be enhanced with time series analysis
    const last30Days = contracts.filter(c => 
      new Date(c.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    const previous30Days = contracts.filter(c => {
      const date = new Date(c.createdAt);
      const now = Date.now();
      return date > new Date(now - 60 * 24 * 60 * 60 * 1000) && 
             date <= new Date(now - 30 * 24 * 60 * 60 * 1000);
    });

    const volumeChange = last30Days.length - previous30Days.length;
    const valueChange = 
      last30Days.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0) -
      previous30Days.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);

    return {
      volumeTrend: volumeChange > 5 ? "increasing" : volumeChange < -5 ? "decreasing" : "stable",
      valueTrend: valueChange > 100000 ? "increasing" : valueChange < -100000 ? "decreasing" : "stable",
      riskTrend: "stable", // Would need historical risk data
      processingEfficiency: contracts.filter(c => c.status === "COMPLETED").length / Math.max(contracts.length, 1) * 100,
    };
  }

  private async calculateRisks(contracts: any[]) {
    // Supplier concentration analysis
    const supplierGroups = contracts.reduce((acc, c) => {
      if (!c.supplierName) return acc;
      if (!acc[c.supplierName]) acc[c.supplierName] = [];
      acc[c.supplierName].push(c);
      return acc;
    }, {} as Record<string, any[]>);

    const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
    
    const supplierConcentration = Object.entries(supplierGroups).map(([supplier, supplierContracts]) => {
      const supplierValue = supplierContracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
      const concentration = supplierValue / totalValue;
      
      return {
        supplier,
        concentration,
        riskLevel: concentration > 0.5 ? "high" : concentration > 0.3 ? "medium" : "low",
      };
    }).sort((a, b) => b.concentration - a.concentration).slice(0, 10);

    // Currency exposure
    const currencyExposure = contracts.reduce((acc, c) => {
      const currency = c.currency || "USD";
      acc[currency] = (acc[currency] || 0) + (Number(c.totalValue) || 0);
      return acc;
    }, {} as Record<string, number>);

    return {
      supplierConcentration,
      complianceGaps: [], // Would need compliance analysis
      financialExposure: {
        totalExposure: totalValue,
        highRiskValue: supplierConcentration
          .filter(s => s.riskLevel === "high")
          .reduce((sum, s) => sum + (s.concentration * totalValue), 0),
        currencyExposure,
      },
    };
  }

  private async calculateOpportunities(contracts: any[]) {
    // Simplified opportunity calculation
    const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
    
    return {
      costOptimization: totalValue * 0.05, // 5% potential savings
      processImprovement: contracts.length * 100, // $100 per contract efficiency gain
      riskReduction: totalValue * 0.02, // 2% risk reduction value
      complianceEnhancement: contracts.length * 50, // $50 per contract compliance value
    };
  }

  // =========================================================================
  // CACHE MANAGEMENT
  // =========================================================================

  private async cachePatterns(tenantId: string, patterns: IntelligencePattern[]): Promise<void> {
    const cacheKey = `intelligence-patterns:${tenantId}`;
    this.patternCache.set(tenantId, patterns);
    await cacheAdaptor.set(cacheKey, patterns, 3600); // 1 hour TTL
  }

  private async cacheInsights(tenantId: string, insights: IntelligenceInsight[]): Promise<void> {
    const cacheKey = `intelligence-insights:${tenantId}`;
    this.insightCache.set(tenantId, insights);
    await cacheAdaptor.set(cacheKey, insights, 3600); // 1 hour TTL
  }

  async getPatterns(tenantId: string): Promise<IntelligencePattern[]> {
    const cacheKey = `intelligence-patterns:${tenantId}`;
    const cached = await cacheAdaptor.get<IntelligencePattern[]>(cacheKey);
    return cached || this.patternCache.get(tenantId) || [];
  }

  async getInsights(tenantId: string): Promise<IntelligenceInsight[]> {
    const cacheKey = `intelligence-insights:${tenantId}`;
    const cached = await cacheAdaptor.get<IntelligenceInsight[]>(cacheKey);
    return cached || this.insightCache.get(tenantId) || [];
  }

  /**
   * Trigger comprehensive intelligence analysis for a tenant
   */
  async runIntelligenceAnalysis(tenantId: string): Promise<ServiceResponse<{
    patterns: IntelligencePattern[];
    insights: IntelligenceInsight[];
    analytics: PortfolioAnalytics;
  }>> {
    try {
      const [patternsResult, insightsResult, analyticsResult] = await Promise.all([
        this.analyzeContractPatterns(tenantId),
        this.generateInsights(tenantId),
        this.getPortfolioAnalytics(tenantId),
      ]);

      if (!patternsResult.success || !insightsResult.success || !analyticsResult.success) {
        return {
          success: false,
          error: {
            code: "INTELLIGENCE_ANALYSIS_FAILED",
            message: "Failed to complete intelligence analysis",
          },
        };
      }

      return {
        success: true,
        data: {
          patterns: patternsResult.data,
          insights: insightsResult.data,
          analytics: analyticsResult.data,
        },
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to run intelligence analysis");
      return {
        success: false,
        error: {
          code: "INTELLIGENCE_ANALYSIS_ERROR",
          message: "Intelligence analysis encountered an error",
          details: error,
        },
      };
    }
  }
}

export const intelligenceService = IntelligenceService.getInstance();