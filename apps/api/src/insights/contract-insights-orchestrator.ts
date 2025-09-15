/**
 * Enhanced Contract Insights Data Flow System
 * Orchestrates multi-worker analysis and aggregates insights for comprehensive contract intelligence
 * Integrates with Unified Intelligence Storage for cross-functional data correlation
 */

import { EventEmitter } from 'events';
import { unifiedIntelligenceStorage, type UnifiedContractIntelligence, type ContractMetadata } from '../intelligence/unified-intelligence-storage';

export interface WorkerResult {
  workerId: string;
  documentId: string;
  tenantId: string;
  data: any;
  bestPractices?: any;
  confidence: number;
  processingTime: number;
  timestamp: Date;
  metadata?: any;
}

export interface ContractInsights {
  documentId: string;
  tenantId: string;
  overview: WorkerResult;
  financial: WorkerResult;
  clauses: WorkerResult;
  compliance: WorkerResult;
  risk: WorkerResult;
  rates: WorkerResult;
  template: WorkerResult;
  aggregatedInsights: AggregatedInsights;
  crossAnalysis: CrossAnalysisInsights;
  reportData: ContractReportData;
  lastUpdated: Date;
  completionStatus: WorkerCompletionStatus;
}

export interface AggregatedInsights {
  overallRiskScore: number;
  overallConfidence: number;
  criticalIssues: CriticalIssue[];
  opportunities: OpportunityInsight[];
  recommendationsPriority: RecommendationPriority[];
  complianceStatus: ComplianceStatus;
  financialSummary: FinancialSummary;
}

export interface CrossAnalysisInsights {
  riskFinancialCorrelation: RiskFinancialCorrelation;
  templateComplianceAlignment: TemplateComplianceAlignment;
  clauseRiskAssessment: ClauseRiskAssessment;
  performanceIndicators: PerformanceIndicator[];
  strategicRecommendations: StrategyRecommendation[];
}

export interface ContractReportData {
  executiveSummary: string;
  keyFindings: KeyFinding[];
  riskAssessment: RiskAssessmentSummary;
  recommendations: RecommendationSummary;
  complianceOverview: ComplianceOverview;
  financialAnalysis: FinancialAnalysisSummary;
  nextSteps: NextStep[];
  appendices: ReportAppendix[];
}

export interface CriticalIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'legal' | 'financial' | 'compliance' | 'operational';
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  sourceWorkers: string[];
}

export interface OpportunityInsight {
  id: string;
  title: string;
  description: string;
  type: string;
  impact: number;
  effort: number;
  timeline: string;
  confidence: number;
}

export interface RecommendationPriority {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  impact: number;
  effort: number;
  category: string;
}

export interface ComplianceStatus {
  overall: 'compliant' | 'non-compliant' | 'partial';
  violations: number;
  requirements: number;
  score: number;
}

export interface FinancialSummary {
  totalValue: number;
  currency: string;
  paymentTerms: number;
  budgetUtilization: number;
  savingsOpportunities: number;
}

export interface RiskFinancialCorrelation {
  correlation: number;
  significance: number;
  recommendations: string[];
}

export interface TemplateComplianceAlignment {
  alignmentScore: number;
  gaps: number;
  recommendations: string[];
}

export interface ClauseRiskAssessment {
  riskLevel: string;
  mitigations: string[];
  recommendations: string[];
}

export interface PerformanceIndicator {
  metric: string;
  value: number;
  target: number;
  status: string;
}

export interface StrategyRecommendation {
  id: string;
  strategy: string;
  impact: number;
  priority: string;
}

export interface KeyFinding {
  finding: string;
  importance: 'high' | 'medium' | 'low';
  source: string;
}

export interface RiskAssessmentSummary {
  overallRisk: number;
  riskCategories: {
    financial: number;
    legal: number;
    operational: number;
    strategic: number;
    reputational: number;
  };
  mitigations: number;
  recommendations: string[];
}

export interface RecommendationSummary {
  total: number;
  highPriority: number;
  categories: string[];
}

export interface ComplianceOverview {
  status: 'compliant' | 'non-compliant' | 'partial';
  violations: string[];
  requirements: string[];
}

export interface FinancialAnalysisSummary {
  totalValue: number;
  paymentTerms: string;
  risks: string[];
}

export interface NextStep {
  action: string;
  priority: 'immediate' | 'short-term' | 'long-term';
  owner: string;
  timeline: string;
}

export interface ReportAppendix {
  title: string;
  content: string;
  type: 'data' | 'analysis' | 'recommendations';
}

export interface WorkerCompletionStatus {
  overview: boolean;
  financial: boolean;
  clauses: boolean;
  compliance: boolean;
  risk: boolean;
  rates: boolean;
  template: boolean;
  completionPercentage: number;
  estimatedTimeRemaining: number;
}

/**
 * Enhanced Contract Insights Orchestrator with Unified Intelligence Integration
 */
export class ContractInsightsOrchestrator extends EventEmitter {
  private activeAnalyses: Map<string, Partial<ContractInsights>> = new Map();
  private workerResultsCache: Map<string, WorkerResult[]> = new Map();

  constructor() {
    super();
    this.setupUnifiedIntelligenceIntegration();
  }

  /**
   * Initialize contract analysis with unified intelligence storage
   */
  async initializeContractAnalysis(
    documentId: string,
    tenantId: string,
    content: string,
    contractMetadata: ContractMetadata
  ): Promise<string> {
    console.log(`🔄 Initializing enhanced contract analysis for document ${documentId}`);

    // Create unified intelligence record
    await unifiedIntelligenceStorage.createIntelligenceRecord(
      documentId,
      tenantId,
      contractMetadata
    );

    // Initialize analysis tracking
    const contractInsights: Partial<ContractInsights> = {
      documentId,
      tenantId,
      completionStatus: {
        overview: false,
        financial: false,
        clauses: false,
        compliance: false,
        risk: false,
        rates: false,
        template: false,
        completionPercentage: 0,
        estimatedTimeRemaining: 0
      },
      lastUpdated: new Date()
    };

    this.activeAnalyses.set(documentId, contractInsights);
    this.workerResultsCache.set(documentId, []);

    // Trigger all workers with enhanced coordination
    await this.triggerAllWorkersEnhanced(documentId, tenantId, content, contractMetadata);

    this.emit('analysisStarted', { documentId, tenantId });
    return documentId;
  }

  /**
   * Enhanced worker result processing with unified intelligence integration
   */
  async processWorkerResultEnhanced(
    documentId: string,
    workerId: string,
    workerResult: any,
    bestPractices?: any
  ): Promise<UnifiedContractIntelligence | null> {
    const { data } = workerResult;
    
    console.log(`📊 Processing enhanced ${workerId} result for document ${documentId}`);

    // Create structured worker result
    const structuredResult: WorkerResult = {
      workerId,
      documentId,
      tenantId: workerResult.tenantId || 'default',
      data,
      bestPractices,
      confidence: this.calculateWorkerConfidence(data),
      processingTime: Date.now() - (workerResult.startTime || Date.now()),
      timestamp: new Date(),
      metadata: workerResult.metadata || {}
    };

    // Store worker result
    const results = this.workerResultsCache.get(documentId) || [];
    results.push(structuredResult);
    this.workerResultsCache.set(documentId, results);

    // Update unified intelligence storage
    await unifiedIntelligenceStorage.updateWithWorkerResult(
      documentId,
      workerId,
      data,
      bestPractices
    );

    // Update local contract insights
    await this.updateContractInsights(documentId, structuredResult);

    // Check if analysis is complete
    const intelligence = unifiedIntelligenceStorage.getIntelligence(documentId);
    if (intelligence && this.isAnalysisComplete(results)) {
      await this.finalizeAnalysis(documentId, intelligence);
    }

    this.emit('workerResultProcessed', { 
      documentId, 
      workerId, 
      intelligence,
      structuredResult 
    });

    return intelligence;
  }

  /**
   * Get comprehensive contract intelligence with cross-functional insights
   */
  async getComprehensiveIntelligence(documentId: string): Promise<UnifiedContractIntelligence | null> {
    const intelligence = unifiedIntelligenceStorage.getIntelligence(documentId);
    
    if (!intelligence) {
      return null;
    }

    // Enhance with real-time correlation analysis
    await this.enhanceWithRealTimeCorrelations(intelligence);

    // Add portfolio context if available
    await this.addPortfolioContext(intelligence);

    return intelligence;
  }

  /**
   * Get cross-functional analysis for specific data points
   */
  async getCrossFunctionalAnalysis(
    documentId: string,
    sourceWorker: string,
    sourceField: string,
    targetWorker: string,
    targetField: string
  ): Promise<any> {
    const correlation = unifiedIntelligenceStorage.getCorrelation(
      documentId,
      sourceWorker,
      sourceField,
      targetWorker,
      targetField
    );

    if (!correlation) {
      // Calculate correlation on demand
      return await this.calculateOnDemandCorrelation(
        documentId,
        sourceWorker,
        sourceField,
        targetWorker,
        targetField
      );
    }

    return {
      correlation,
      insights: await this.generateCorrelationInsights(correlation),
      recommendations: await this.generateCorrelationRecommendations(correlation),
      confidence: correlation.confidence
    };
  }

  /**
   * Get portfolio-level intelligence across all contracts
   */
  async getPortfolioIntelligence(tenantId: string): Promise<any> {
    return await unifiedIntelligenceStorage.getPortfolioIntelligence(tenantId);
  }

  /**
   * Analyze contract with enhanced cross-functional capabilities
   */
  async analyzeContract(documentId: string): Promise<ContractInsights | null> {
    const intelligence = await this.getComprehensiveIntelligence(documentId);
    
    if (!intelligence) {
      console.log(`No intelligence found for contract ${documentId}`);
      return null;
    }

    // Convert unified intelligence to contract insights format
    const contractInsights = await this.convertToContractInsights(intelligence);

    // Enhance with cross-functional analysis
    await this.enhanceWithCrossFunctionalAnalysis(contractInsights, intelligence);

    return contractInsights;
  }

  /**
   * Get real-time intelligence updates
   */
  getRealTimeUpdates(documentId: string): any[] {
    const intelligence = unifiedIntelligenceStorage.getIntelligence(documentId);
    return intelligence?.analysisState.realTimeUpdates || [];
  }

  /**
   * Get intelligence graph for visualization
   */
  getIntelligenceGraph(documentId: string): any {
    return unifiedIntelligenceStorage.getIntelligenceGraph(documentId);
  }

  /**
   * Search intelligence across all contracts
   */
  async searchIntelligence(
    tenantId: string,
    query: string,
    filters?: any
  ): Promise<any[]> {
    // Implementation would search across all unified intelligence records
    const portfolioIntelligence = await this.getPortfolioIntelligence(tenantId);
    
    // Apply search logic here
    return this.performIntelligenceSearch(portfolioIntelligence, query, filters);
  }

  // Private enhanced methods

  private setupUnifiedIntelligenceIntegration(): void {
    // Listen to unified intelligence storage events
    unifiedIntelligenceStorage.on('intelligenceCreated', (data) => {
      this.emit('intelligenceCreated', data);
    });

    unifiedIntelligenceStorage.on('workerResultIntegrated', (data) => {
      this.emit('workerResultIntegrated', data);
    });

    console.log('✅ Unified Intelligence Integration setup complete');
  }

  private async triggerAllWorkersEnhanced(
    documentId: string,
    tenantId: string,
    content: string,
    metadata: ContractMetadata
  ): Promise<void> {
    // Enhanced worker triggering with metadata context
    const workerContext = {
      documentId,
      tenantId,
      content,
      metadata,
      intelligenceContext: await this.buildIntelligenceContext(documentId, tenantId)
    };

    // Trigger workers with enhanced context
    await this.triggerWorkerWithContext('ingestion', workerContext);
    
    // Sequential triggering for dependent workers
    setTimeout(() => this.triggerWorkerWithContext('overview', workerContext), 1000);
    setTimeout(() => this.triggerWorkerWithContext('financial', workerContext), 2000);
    setTimeout(() => this.triggerWorkerWithContext('clauses', workerContext), 3000);
    setTimeout(() => this.triggerWorkerWithContext('compliance', workerContext), 4000);
    setTimeout(() => this.triggerWorkerWithContext('risk', workerContext), 5000);
    setTimeout(() => this.triggerWorkerWithContext('rates', workerContext), 6000);
    setTimeout(() => this.triggerWorkerWithContext('template', workerContext), 7000);
  }

  private async buildIntelligenceContext(_documentId: string, tenantId: string): Promise<any> {
    // Build context from portfolio intelligence
    const portfolioIntelligence = await this.getPortfolioIntelligence(tenantId);
    
    return {
      portfolioRisk: portfolioIntelligence?.riskDistribution || {},
      industryBenchmarks: portfolioIntelligence?.benchmarkingResults || [],
      compliancePatterns: portfolioIntelligence?.complianceOverview || {},
      financialTrends: portfolioIntelligence?.performanceTrends || {}
    };
  }

  private async triggerWorkerWithContext(workerId: string, context: any): Promise<void> {
    // Implementation would trigger worker with enhanced context
    console.log(`🔄 Triggering ${workerId} worker with enhanced context for ${context.documentId}`);
    
    // This would integrate with your existing worker trigger mechanism
    // but pass the enhanced context including intelligence from other contracts
  }

  private calculateWorkerConfidence(data: any): number {
    // Enhanced confidence calculation based on data quality and completeness
    if (!data) return 0;
    
    const dataKeys = Object.keys(data);
    const nonEmptyValues = dataKeys.filter(key => 
      data[key] !== null && 
      data[key] !== undefined && 
      data[key] !== ''
    ).length;
    
    const baseConfidence = nonEmptyValues / dataKeys.length;
    
    // Adjust based on data richness
    const richness = this.calculateDataRichness(data);
    
    return Math.min(1, baseConfidence * 0.7 + richness * 0.3);
  }

  private calculateDataRichness(data: any): number {
    // Calculate richness based on nested data structures and arrays
    let richness = 0;
    
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && value.length > 0) {
        richness += 0.2;
      } else if (typeof value === 'object' && value !== null) {
        richness += 0.1;
      }
    }
    
    return Math.min(1, richness);
  }

  private async updateContractInsights(
    documentId: string,
    workerResult: WorkerResult
  ): Promise<void> {
    const insights = this.activeAnalyses.get(documentId);
    if (!insights) return;

    // Update completion status
    if (insights.completionStatus) {
      (insights.completionStatus as any)[workerResult.workerId] = true;
      
      // Calculate completion percentage
      const completed = Object.values(insights.completionStatus)
        .filter(status => typeof status === 'boolean' && status).length;
      insights.completionStatus.completionPercentage = (completed / 7) * 100;
    }

    // Update worker result
    (insights as any)[workerResult.workerId] = workerResult;
    insights.lastUpdated = new Date();

    this.activeAnalyses.set(documentId, insights);
  }

  private isAnalysisComplete(results: WorkerResult[]): boolean {
    const requiredWorkers = ['overview', 'financial', 'clauses', 'compliance', 'risk', 'rates', 'template'];
    const completedWorkers = results.map(r => r.workerId);
    
    return requiredWorkers.every(worker => completedWorkers.includes(worker));
  }

  private async finalizeAnalysis(
    documentId: string,
    intelligence: UnifiedContractIntelligence
  ): Promise<void> {
    console.log(`🎯 Finalizing analysis for contract ${documentId}`);

    // Generate final aggregated insights
    const aggregatedInsights = await this.generateAggregatedInsights(intelligence);
    
    // Generate cross-functional recommendations
    const crossFunctionalRecommendations = await this.generateCrossFunctionalRecommendations(intelligence);

    // Create comprehensive report data
    const reportData = await this.generateComprehensiveReport(intelligence);

    this.emit('analysisCompleted', {
      documentId,
      intelligence,
      aggregatedInsights,
      crossFunctionalRecommendations,
      reportData
    });
  }

  private async enhanceWithRealTimeCorrelations(_intelligence: UnifiedContractIntelligence): Promise<void> {
    // Enhance intelligence with real-time correlation analysis
    // This would calculate correlations on-the-fly if needed
  }

  private async addPortfolioContext(intelligence: UnifiedContractIntelligence): Promise<void> {
    // Add portfolio context to intelligence
    const portfolioInsights = await this.getPortfolioIntelligence(intelligence.tenantId);
    
    if (portfolioInsights) {
      intelligence.crossFunctionalInsights.portfolioInsights = {
        contractPortfolioRisk: portfolioInsights.riskDistribution || {},
        portfolioOptimization: portfolioInsights.optimizationOpportunities || [],
        benchmarkingResults: portfolioInsights.benchmarkingResults || [],
        portfolioTrends: portfolioInsights.performanceTrends || [],
      };
    }
  }

  private async calculateOnDemandCorrelation(
    documentId: string,
    _sourceWorker: string,
    _sourceField: string,
    _targetWorker: string,
    _targetField: string
  ): Promise<any> {
    // Calculate correlation on demand
    const intelligence = unifiedIntelligenceStorage.getIntelligence(documentId);
    if (!intelligence) return null;

    // Implement correlation calculation logic
    return {
      correlationStrength: 0.75, // Placeholder
      confidence: 0.85,
      dataPoints: 10,
      significanceLevel: 0.05
    };
  }

  private async generateCorrelationInsights(correlation: any): Promise<string[]> {
    // Generate insights from correlation data
    const insights = [];
    
    if (correlation.correlationStrength > 0.7) {
      insights.push("Strong positive correlation detected - changes in one area significantly impact the other");
    }
    
    if (correlation.confidence > 0.8) {
      insights.push("High confidence in correlation analysis - reliable for decision making");
    }
    
    return insights;
  }

  private async generateCorrelationRecommendations(correlation: any): Promise<string[]> {
    // Generate recommendations based on correlation
    const recommendations = [];
    
    if (correlation.correlationStrength > 0.7) {
      recommendations.push("Monitor both areas closely as changes in one will likely affect the other");
      recommendations.push("Consider joint optimization strategies for both areas");
    }
    
    return recommendations;
  }

  private async convertToContractInsights(intelligence: UnifiedContractIntelligence): Promise<ContractInsights> {
    // Convert unified intelligence to contract insights format
    return {
      documentId: intelligence.documentId,
      tenantId: intelligence.tenantId,
      overview: this.createWorkerResultFromIntelligence(intelligence, 'overview'),
      financial: this.createWorkerResultFromIntelligence(intelligence, 'financial'),
      clauses: this.createWorkerResultFromIntelligence(intelligence, 'clauses'),
      compliance: this.createWorkerResultFromIntelligence(intelligence, 'compliance'),
      risk: this.createWorkerResultFromIntelligence(intelligence, 'risk'),
      rates: this.createWorkerResultFromIntelligence(intelligence, 'rates'),
      template: this.createWorkerResultFromIntelligence(intelligence, 'template'),
      aggregatedInsights: await this.generateAggregatedInsights(intelligence),
      crossAnalysis: this.convertCrossFunctionalInsights(intelligence.crossFunctionalInsights),
      reportData: await this.generateComprehensiveReport(intelligence),
      lastUpdated: intelligence.lastUpdated,
      completionStatus: this.calculateCompletionStatus(intelligence)
    };
  }

  private createWorkerResultFromIntelligence(
    intelligence: UnifiedContractIntelligence,
    workerId: string
  ): WorkerResult {
    const workerData = intelligence.workerResults[workerId as keyof typeof intelligence.workerResults];
    
    return {
      workerId,
      documentId: intelligence.documentId,
      tenantId: intelligence.tenantId,
      data: workerData,
      confidence: intelligence.qualityMetrics.workerQuality[workerId]?.confidence || 0.8,
      processingTime: 1000, // Placeholder
      timestamp: intelligence.lastUpdated,
      metadata: {}
    };
  }

  private async enhanceWithCrossFunctionalAnalysis(
    contractInsights: ContractInsights,
    intelligence: UnifiedContractIntelligence
  ): Promise<void> {
    // Enhance contract insights with cross-functional analysis
    contractInsights.crossAnalysis = this.convertCrossFunctionalInsights(intelligence.crossFunctionalInsights);
  }

  private convertCrossFunctionalInsights(crossFunctionalInsights: any): CrossAnalysisInsights {
    // Convert unified cross-functional insights to contract insights format
    return {
      riskFinancialCorrelation: {
        correlation: crossFunctionalInsights.financialLegalAlignment?.liabilityValueCorrelation?.correlationStrength || 0,
        significance: crossFunctionalInsights.financialLegalAlignment?.liabilityValueCorrelation?.significance || 0,
        recommendations: crossFunctionalInsights.financialLegalAlignment?.paymentRiskAlignment?.recommendations || []
      },
      templateComplianceAlignment: {
        alignmentScore: crossFunctionalInsights.complianceTemplateAlignment?.templateComplianceScore?.overallScore || 0,
        gaps: crossFunctionalInsights.complianceTemplateAlignment?.standardComplianceGaps?.totalGaps || 0,
        recommendations: crossFunctionalInsights.complianceTemplateAlignment?.regulatoryTemplateAlignment?.recommendations || []
      },
      clauseRiskAssessment: {
        riskLevel: 'medium', // Placeholder
        mitigations: crossFunctionalInsights.riskOperationalAlignment?.mitigationOperationalFeasibility?.recommendations || [],
        recommendations: []
      },
      performanceIndicators: [],
      strategicRecommendations: crossFunctionalInsights.strategicAlignment?.valueCreationOpportunities || []
    };
  }

  private calculateCompletionStatus(intelligence: UnifiedContractIntelligence): WorkerCompletionStatus {
    const workers = ['overview', 'financial', 'clauses', 'compliance', 'risk', 'rates', 'template'];
    const completed = workers.filter(worker => 
      intelligence.workerResults[worker as keyof typeof intelligence.workerResults] !== null
    );

    return {
      overview: !!intelligence.workerResults.overview,
      financial: !!intelligence.workerResults.financial,
      clauses: !!intelligence.workerResults.clauses,
      compliance: !!intelligence.workerResults.compliance,
      risk: !!intelligence.workerResults.risk,
      rates: !!intelligence.workerResults.rates,
      template: !!intelligence.workerResults.template,
      completionPercentage: (completed.length / workers.length) * 100,
      estimatedTimeRemaining: Math.max(0, (workers.length - completed.length) * 30000) // 30s per worker
    };
  }

  private async generateAggregatedInsights(intelligence: UnifiedContractIntelligence): Promise<AggregatedInsights> {
    return {
      overallRiskScore: intelligence.structuredData.risk.riskProfile.overallRiskScore,
      overallConfidence: intelligence.qualityMetrics.overallQuality / 100,
      criticalIssues: this.extractCriticalIssues(intelligence),
      opportunities: this.extractOpportunities(intelligence),
      recommendationsPriority: this.extractPriorityRecommendations(intelligence),
      complianceStatus: this.extractComplianceStatus(intelligence),
      financialSummary: this.extractFinancialSummary(intelligence)
    };
  }

  private async generateCrossFunctionalRecommendations(intelligence: UnifiedContractIntelligence): Promise<any[]> {
    const recommendations = [];
    
    // Extract recommendations from cross-functional insights
    const cfi = intelligence.crossFunctionalInsights;
    
    if (cfi.financialLegalAlignment.paymentRiskAlignment.recommendations) {
      recommendations.push(...cfi.financialLegalAlignment.paymentRiskAlignment.recommendations);
    }
    
    if (cfi.strategicAlignment.valueCreationOpportunities) {
      recommendations.push(...cfi.strategicAlignment.valueCreationOpportunities);
    }
    
    return recommendations;
  }

  private async generateComprehensiveReport(intelligence: UnifiedContractIntelligence): Promise<ContractReportData> {
    return {
      executiveSummary: this.generateExecutiveSummaryFromIntelligence(intelligence),
      keyFindings: this.extractKeyFindings(intelligence),
      riskAssessment: this.extractRiskAssessment(intelligence),
      recommendations: this.extractRecommendationSummary(intelligence),
      complianceOverview: this.extractComplianceOverviewFromIntelligence(intelligence),
      financialAnalysis: this.extractFinancialAnalysis(intelligence),
      nextSteps: this.generateNextSteps(intelligence),
      appendices: this.generateAppendices(intelligence)
    };
  }

  private performIntelligenceSearch(_portfolioIntelligence: any, _query: string, _filters?: any): any[] {
    // Implement intelligent search across portfolio
    // This would use semantic search, keyword matching, and filters
    return [];
  }

  // Helper methods for data extraction

  private extractCriticalIssues(intelligence: UnifiedContractIntelligence): CriticalIssue[] {
    const issues: CriticalIssue[] = [];
    
    // Extract from risk data
    intelligence.structuredData.risk.riskFactors.forEach((risk, index) => {
      if (risk.impact > 0.8 || risk.probability > 0.8) {
        issues.push({
          id: `risk_${index}`,
          severity: 'high',
          category: 'legal',
          title: risk.category,
          description: risk.description,
          impact: `High impact: ${risk.impact}`,
          recommendation: 'Immediate mitigation required',
          sourceWorkers: ['risk']
        });
      }
    });
    
    return issues;
  }

  private extractOpportunities(intelligence: UnifiedContractIntelligence): OpportunityInsight[] {
    return intelligence.structuredData.financial.costOptimizationOpportunities.map(opt => ({
      id: opt.id,
      title: opt.description,
      description: opt.description,
      type: 'cost_optimization',
      impact: opt.potentialSavings,
      effort: opt.implementationCost,
      timeline: opt.timeframe,
      confidence: opt.feasibility
    }));
  }

  private extractPriorityRecommendations(intelligence: UnifiedContractIntelligence): RecommendationPriority[] {
    const recommendations: RecommendationPriority[] = [];
    
    intelligence.structuredData.template.templateRecommendations.forEach(rec => {
      recommendations.push({
        id: rec.id,
        title: rec.recommendation,
        priority: rec.impact > 3 ? 'high' : rec.impact > 1 ? 'medium' : 'low',
        impact: rec.impact,
        effort: rec.effort,
        category: 'template'
      });
    });
    
    return recommendations;
  }

  private extractComplianceStatus(intelligence: UnifiedContractIntelligence): ComplianceStatus {
    const requirements = intelligence.structuredData.legal.complianceRequirements;
    const compliant = requirements.filter(req => req.complianceStatus === 'compliant').length;
    
    return {
      overall: compliant === requirements.length ? 'compliant' : 'non-compliant',
      violations: requirements.filter(req => req.complianceStatus === 'non-compliant').length,
      requirements: requirements.length,
      score: requirements.length > 0 ? compliant / requirements.length : 0
    };
  }

  private extractFinancialSummary(intelligence: UnifiedContractIntelligence): FinancialSummary {
    const financial = intelligence.structuredData.financial;
    
    return {
      totalValue: financial.totalValue,
      currency: financial.currency,
      paymentTerms: financial.paymentTerms.length,
      budgetUtilization: financial.budgetAnalysis.budgetUtilization,
      savingsOpportunities: financial.costOptimizationOpportunities.length
    };
  }

  private generateExecutiveSummaryFromIntelligence(intelligence: UnifiedContractIntelligence): string {
    const contractValue = intelligence.structuredData.financial.totalValue;
    const riskScore = intelligence.structuredData.risk.riskProfile.overallRiskScore;
    const complianceReqs = intelligence.structuredData.legal.complianceRequirements.length;
    
    return `Contract analysis completed for ${intelligence.metadata.contractName}. ` +
           `Total value: ${contractValue} ${intelligence.structuredData.financial.currency}. ` +
           `Overall risk score: ${riskScore}/10. ` +
           `${complianceReqs} compliance requirements identified.`;
  }

  private extractKeyFindings(intelligence: UnifiedContractIntelligence): KeyFinding[] {
    return [
      {
        finding: `Total contract value: ${intelligence.structuredData.financial.totalValue} ${intelligence.structuredData.financial.currency}`,
        importance: 'high',
        source: 'financial'
      },
      {
        finding: `Overall risk score: ${intelligence.structuredData.risk.riskProfile.overallRiskScore}/10`,
        importance: 'high',
        source: 'risk'
      }
    ];
  }

  private extractRiskAssessment(intelligence: UnifiedContractIntelligence): RiskAssessmentSummary {
    const riskProfile = intelligence.structuredData.risk.riskProfile;
    
    return {
      overallRisk: riskProfile.overallRiskScore,
      riskCategories: riskProfile.riskCategories,
      mitigations: intelligence.structuredData.risk.mitigationStrategies.length,
      recommendations: intelligence.structuredData.risk.mitigationStrategies.map(m => m.strategy)
    };
  }

  private extractRecommendationSummary(intelligence: UnifiedContractIntelligence): RecommendationSummary {
    return {
      total: intelligence.structuredData.template.templateRecommendations.length,
      highPriority: intelligence.structuredData.template.templateRecommendations.filter(r => r.impact > 3).length,
      categories: ['template', 'financial', 'risk', 'compliance']
    };
  }

  private extractComplianceOverviewFromIntelligence(intelligence: UnifiedContractIntelligence): ComplianceOverview {
    const requirements = intelligence.structuredData.legal.complianceRequirements;
    const nonCompliant = requirements.filter(req => req.complianceStatus === 'non-compliant');
    
    return {
      status: nonCompliant.length === 0 ? 'compliant' : 'non-compliant',
      violations: nonCompliant.map(req => req.requirement),
      requirements: requirements.map(req => req.requirement)
    };
  }

  private extractFinancialAnalysis(intelligence: UnifiedContractIntelligence): FinancialAnalysisSummary {
    const financial = intelligence.structuredData.financial;
    
    return {
      totalValue: financial.totalValue,
      paymentTerms: financial.paymentTerms.map(pt => pt.termType).join(', '),
      risks: intelligence.structuredData.risk.riskFactors
        .filter(rf => rf.category.toLowerCase().includes('financial'))
        .map(rf => rf.description)
    };
  }

  private generateNextSteps(intelligence: UnifiedContractIntelligence): NextStep[] {
    const steps: NextStep[] = [];
    
    // Add steps based on risk factors
    intelligence.structuredData.risk.riskFactors.forEach(risk => {
      if (risk.impact > 0.7) {
        steps.push({
          action: `Mitigate ${risk.category} risk: ${risk.description}`,
          priority: 'immediate',
          owner: 'Risk Manager',
          timeline: '1 week'
        });
      }
    });
    
    return steps;
  }

  private generateAppendices(intelligence: UnifiedContractIntelligence): ReportAppendix[] {
    return [
      {
        title: 'Financial Analysis Details',
        content: JSON.stringify(intelligence.structuredData.financial, null, 2),
        type: 'data'
      },
      {
        title: 'Risk Assessment Details',
        content: JSON.stringify(intelligence.structuredData.risk, null, 2),
        type: 'analysis'
      }
    ];
  }
}

export const contractInsightsOrchestrator = new ContractInsightsOrchestrator();