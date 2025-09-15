/**
 * Unified Contract Intelligence Dashboard
 * Provides comprehensive contract analysis interface with all worker outputs,
 * best practices, validation results, and reporting capabilities
 */

import { EventEmitter } from 'events';
import { ContractInsightsOrchestrator } from '../insights/contract-insights-orchestrator';
import { HumanValidationSystem } from '../validation/human-validation-system';
import { ContractReportGenerator } from '../reports/contract-report-generator';

export interface DashboardData {
  documentId: string;
  tenantId: string;
  contractInfo: ContractInfo;
  analysisResults: AnalysisResults;
  validationStatus: ValidationStatus;
  availableReports: ReportSummary[];
  bestPracticesCount: BestPracticesCount;
  confidenceMetrics: ConfidenceMetrics;
  actionItems: ActionItem[];
  lastUpdated: Date;
}

export interface ContractInfo {
  title: string;
  parties: string[];
  contractType: string;
  status: 'draft' | 'under_review' | 'approved' | 'executed';
  uploadDate: Date;
  fileSize: number;
  fileName: string;
  metadata: Record<string, any>;
}

export interface AnalysisResults {
  overview: WorkerResult;
  financial: WorkerResult;
  clauses: WorkerResult;
  compliance: WorkerResult;
  risk: WorkerResult;
  rates: WorkerResult;
  template: WorkerResult;
  aggregatedInsights: AggregatedInsights;
  crossAnalysis: CrossAnalysisInsights;
}

export interface WorkerResult {
  status: 'pending' | 'processing' | 'completed' | 'error';
  startTime?: Date;
  endTime?: Date;
  confidence: number;
  findings: WorkerFinding[];
  bestPractices: WorkerBestPractice[];
  recommendations: Recommendation[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  keyMetrics: Record<string, any>;
  errorMessage?: string;
}

export interface WorkerFinding {
  id: string;
  category: string;
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  evidence: string[];
  confidence: number;
  impact: string;
  relatedSections: string[];
}

export interface WorkerBestPractice {
  id: string;
  category: string;
  type: 'optimization' | 'risk_mitigation' | 'compliance' | 'negotiation';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  implementation: string;
  expectedBenefit: string;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  prerequisites: string[];
}

export interface Recommendation {
  id: string;
  type: 'immediate' | 'short_term' | 'long_term';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  rationale: string;
  implementation: string;
  estimatedImpact: string;
  dependencies: string[];
  assignedTo?: string;
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
}

export interface AggregatedInsights {
  overallRiskScore: number;
  financialScore: number;
  complianceScore: number;
  contractHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  keyStrengths: string[];
  majorConcerns: string[];
  priorityActions: string[];
  overallConfidence: number;
}

export interface CrossAnalysisInsights {
  correlations: CorrelationInsight[];
  conflictingFindings: ConflictingFinding[];
  synergyOpportunities: SynergyOpportunity[];
  holisticRecommendations: Recommendation[];
}

export interface CorrelationInsight {
  workers: string[];
  correlation: number;
  description: string;
  implication: string;
}

export interface ConflictingFinding {
  workers: string[];
  findings: string[];
  resolution: string;
  confidence: number;
}

export interface SynergyOpportunity {
  workers: string[];
  opportunity: string;
  benefit: string;
  implementation: string;
}

export interface ValidationStatus {
  overallStatus: 'pending' | 'in_progress' | 'completed' | 'approved';
  validatedSections: number;
  totalSections: number;
  accuracy: number;
  pendingValidations: import('../validation/human-validation-system').ValidationRequest[];
  completedValidations: import('../validation/human-validation-system').ValidationResult[];
  validationMetrics: import('../validation/human-validation-system').ValidationMetrics;
}



export interface ReportSummary {
  id: string;
  type: 'executive' | 'detailed' | 'financial' | 'compliance' | 'risk';
  title: string;
  generatedAt: Date;
  status: 'generating' | 'ready' | 'error';
  downloadUrl?: string;
  size?: number;
}

export interface BestPracticesCount {
  total: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  implemented: number;
  pending: number;
}

export interface ConfidenceMetrics {
  overall: number;
  byWorker: Record<string, number>;
  bySection: Record<string, number>;
  trend: { timestamp: Date; confidence: number }[];
  lowConfidenceAreas: string[];
}

export interface ActionItem {
  id: string;
  type: 'validation' | 'review' | 'implementation' | 'follow_up';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  assignedTo?: string;
  dueDate?: Date;
  relatedTo: {
    workerId?: string;
    findingId?: string;
    recommendationId?: string;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  createdAt: Date;
  estimatedEffort: string;
}

export interface DashboardFilters {
  workers?: string[];
  riskLevels?: string[];
  priorities?: string[];
  status?: string[];
  dateRange?: { start: Date; end: Date };
  confidenceThreshold?: number;
}

export interface DashboardMetrics {
  totalContracts: number;
  activeAnalyses: number;
  completedAnalyses: number;
  avgProcessingTime: number;
  successRate: number;
  topRiskCategories: { category: string; count: number }[];
  recentActivity: ActivitySummary[];
}

export interface ActivitySummary {
  timestamp: Date;
  type: 'analysis_started' | 'analysis_completed' | 'validation_approved' | 'report_generated';
  documentId: string;
  description: string;
  userId?: string;
}

export class ContractIntelligenceDashboard extends EventEmitter {
  private orchestrator: ContractInsightsOrchestrator;
  private validationSystem: HumanValidationSystem;
  private reportGenerator: ContractReportGenerator;
  private dashboardData: Map<string, DashboardData> = new Map();
  private metrics: DashboardMetrics;

  constructor(
    orchestrator: ContractInsightsOrchestrator,
    validationSystem: HumanValidationSystem,
    reportGenerator: ContractReportGenerator
  ) {
    super();
    this.orchestrator = orchestrator;
    this.validationSystem = validationSystem;
    this.reportGenerator = reportGenerator;
    this.metrics = this.initializeMetrics();
    this.setupEventListeners();
  }

  /**
   * Get comprehensive dashboard data for a contract
   */
  async getDashboardData(documentId: string, tenantId: string): Promise<DashboardData> {
    console.log(`📊 Loading dashboard data for document ${documentId}`);

    const cacheKey = `${tenantId}:${documentId}`;
    let dashboardData = this.dashboardData.get(cacheKey);

    if (!dashboardData || this.isDataStale(dashboardData)) {
      dashboardData = await this.buildDashboardData(documentId, tenantId);
      this.dashboardData.set(cacheKey, dashboardData);
    }

    return dashboardData;
  }

  /**
   * Get filtered analysis results
   */
  async getFilteredResults(
    documentId: string,
    tenantId: string,
    filters: DashboardFilters
  ): Promise<Partial<AnalysisResults>> {
    const dashboardData = await this.getDashboardData(documentId, tenantId);
    return this.applyFilters(dashboardData.analysisResults, filters);
  }

  /**
   * Get action items for a contract
   */
  async getActionItems(
    documentId: string,
    tenantId: string,
    filters?: DashboardFilters
  ): Promise<ActionItem[]> {
    const dashboardData = await this.getDashboardData(documentId, tenantId);
    let actionItems = dashboardData.actionItems;

    if (filters) {
      actionItems = this.filterActionItems(actionItems, filters);
    }

    return actionItems.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Generate executive summary
   */
  async getExecutiveSummary(documentId: string, tenantId: string): Promise<ExecutiveSummary> {
    const dashboardData = await this.getDashboardData(documentId, tenantId);
    
    return {
      contractTitle: dashboardData.contractInfo.title,
      overallHealth: dashboardData.analysisResults.aggregatedInsights.contractHealth,
      riskScore: dashboardData.analysisResults.aggregatedInsights.overallRiskScore,
      confidence: dashboardData.confidenceMetrics.overall,
      keyFindings: this.extractKeyFindings(dashboardData),
      criticalActions: this.getCriticalActions(dashboardData),
      financialHighlights: this.getFinancialHighlights(dashboardData),
      complianceStatus: this.getComplianceStatus(dashboardData),
      nextSteps: this.getNextSteps(dashboardData)
    };
  }

  /**
   * Update action item status
   */
  async updateActionItem(
    documentId: string,
    tenantId: string,
    actionItemId: string,
    updates: Partial<ActionItem>
  ): Promise<ActionItem> {
    const dashboardData = await this.getDashboardData(documentId, tenantId);
    const actionItem = dashboardData.actionItems.find(item => item.id === actionItemId);

    if (!actionItem) {
      throw new Error(`Action item ${actionItemId} not found`);
    }

    Object.assign(actionItem, updates);
    
    this.emit('actionItemUpdated', { documentId, tenantId, actionItem });
    
    return actionItem;
  }

  /**
   * Trigger report generation
   */
  async generateReport(
    documentId: string,
    tenantId: string,
    reportType: ReportSummary['type']
  ): Promise<ReportSummary> {
    const dashboardData = await this.getDashboardData(documentId, tenantId);
    
    const report = await this.reportGenerator.generateReport(
      documentId,
      tenantId,
      reportType,
      dashboardData.analysisResults
    );

    const reportSummary: ReportSummary = {
      id: report.id,
      type: reportType,
      title: report.title,
      generatedAt: report.generatedAt,
      status: report.status
    };

    dashboardData.availableReports.push(reportSummary);
    
    this.emit('reportGenerated', { documentId, tenantId, reportSummary });
    
    return reportSummary;
  }

  /**
   * Get dashboard metrics
   */
  getDashboardMetrics(): DashboardMetrics {
    return this.metrics;
  }

  /**
   * Build comprehensive dashboard data
   */
  private async buildDashboardData(documentId: string, tenantId: string): Promise<DashboardData> {
    console.log(`🔧 Building dashboard data for document ${documentId}`);

    // Get contract insights from orchestrator
    const contractInsights = await this.orchestrator.analyzeContract(documentId);
    
    // Get validation status
    const validationStatus = await this.buildValidationStatus(documentId, tenantId);
    
    // Get available reports
    const availableReports = this.reportGenerator.getReportsForDocument(documentId)
      .map(report => ({
        id: report.id,
        type: report.reportType,
        title: report.title,
        generatedAt: report.generatedAt,
        status: report.status
      }));

    // Build analysis results
    const analysisResults = this.buildAnalysisResults(contractInsights);
    
    // Generate action items
    const actionItems = this.generateActionItems(analysisResults, validationStatus);
    
    return {
      documentId,
      tenantId,
      contractInfo: this.buildContractInfo(contractInsights),
      analysisResults,
      validationStatus,
      availableReports,
      bestPracticesCount: this.countBestPractices(analysisResults),
      confidenceMetrics: this.buildConfidenceMetrics(analysisResults),
      actionItems,
      lastUpdated: new Date()
    };
  }

  private buildAnalysisResults(contractInsights: any): AnalysisResults {
    return {
      overview: this.buildWorkerResult(contractInsights.overview, 'overview'),
      financial: this.buildWorkerResult(contractInsights.financial, 'financial'),
      clauses: this.buildWorkerResult(contractInsights.clauses, 'clauses'),
      compliance: this.buildWorkerResult(contractInsights.compliance, 'compliance'),
      risk: this.buildWorkerResult(contractInsights.risk, 'risk'),
      rates: this.buildWorkerResult(contractInsights.rates, 'rates'),
      template: this.buildWorkerResult(contractInsights.template, 'template'),
      aggregatedInsights: contractInsights.aggregatedInsights || this.buildDefaultAggregatedInsights(),
      crossAnalysis: contractInsights.crossAnalysis || this.buildDefaultCrossAnalysis()
    };
  }

  private buildWorkerResult(workerData: any, workerType: string): WorkerResult {
    if (!workerData) {
      return {
        status: 'pending',
        confidence: 0,
        findings: [],
        bestPractices: [],
        recommendations: [],
        riskLevel: 'medium',
        keyMetrics: {}
      };
    }

    return {
      status: workerData.status || 'completed',
      startTime: workerData.startTime ? new Date(workerData.startTime) : undefined,
      endTime: workerData.endTime ? new Date(workerData.endTime) : undefined,
      confidence: workerData.confidence || 0.8,
      findings: this.convertToWorkerFindings(workerData.findings || []),
      bestPractices: this.convertToWorkerBestPractices(workerData.bestPractices || []),
      recommendations: this.convertToRecommendations(workerData.recommendations || []),
      riskLevel: workerData.riskLevel || 'medium',
      keyMetrics: workerData.keyMetrics || {}
    };
  }

  private convertToWorkerFindings(findings: any[]): WorkerFinding[] {
    return findings.map((finding, index) => ({
      id: finding.id || `finding_${index}`,
      category: finding.category || 'general',
      type: finding.type || 'neutral',
      severity: finding.severity || 'medium',
      title: finding.title || 'Finding',
      description: finding.description || '',
      evidence: finding.evidence || [],
      confidence: finding.confidence || 0.8,
      impact: finding.impact || '',
      relatedSections: finding.relatedSections || []
    }));
  }

  private convertToWorkerBestPractices(bestPractices: any[]): WorkerBestPractice[] {
    return bestPractices.map((bp, index) => ({
      id: bp.id || `bp_${index}`,
      category: bp.category || 'general',
      type: bp.type || 'optimization',
      priority: bp.priority || 'medium',
      title: bp.title || 'Best Practice',
      description: bp.description || '',
      implementation: bp.implementation || '',
      expectedBenefit: bp.expectedBenefit || '',
      effort: bp.effort || 'medium',
      timeline: bp.timeline || '',
      prerequisites: bp.prerequisites || []
    }));
  }

  private convertToRecommendations(recommendations: any[]): Recommendation[] {
    return recommendations.map((rec, index) => ({
      id: rec.id || `rec_${index}`,
      type: rec.type || 'short_term',
      priority: rec.priority || 'medium',
      category: rec.category || 'general',
      title: rec.title || 'Recommendation',
      description: rec.description || '',
      rationale: rec.rationale || '',
      implementation: rec.implementation || '',
      estimatedImpact: rec.estimatedImpact || '',
      dependencies: rec.dependencies || [],
      status: rec.status || 'pending'
    }));
  }

  private async buildValidationStatus(documentId: string, tenantId: string): Promise<ValidationStatus> {
    const pendingValidations = await this.validationSystem.getPendingValidations(documentId, tenantId);
    const completedValidations = await this.validationSystem.getCompletedValidations(documentId, tenantId);
    const metrics = await this.validationSystem.getValidationMetrics(documentId, tenantId);

    return {
      overallStatus: pendingValidations.length > 0 ? 'in_progress' : 'completed',
      validatedSections: completedValidations.length,
      totalSections: pendingValidations.length + completedValidations.length,
      accuracy: metrics.overallAccuracy,
      pendingValidations,
      completedValidations,
      validationMetrics: metrics
    };
  }

  private buildContractInfo(contractInsights: any): ContractInfo {
    return {
      title: contractInsights?.overview?.title || 'Contract Analysis',
      parties: contractInsights?.overview?.parties || [],
      contractType: contractInsights?.overview?.contractType || 'Unknown',
      status: 'under_review',
      uploadDate: new Date(),
      fileSize: 0,
      fileName: 'contract.pdf',
      metadata: {}
    };
  }

  private countBestPractices(analysisResults: AnalysisResults): BestPracticesCount {
    const allBestPractices = [
      ...analysisResults.overview.bestPractices,
      ...analysisResults.financial.bestPractices,
      ...analysisResults.clauses.bestPractices,
      ...analysisResults.compliance.bestPractices,
      ...analysisResults.risk.bestPractices,
      ...analysisResults.rates.bestPractices,
      ...analysisResults.template.bestPractices
    ];

    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    allBestPractices.forEach(bp => {
      byCategory[bp.category] = (byCategory[bp.category] || 0) + 1;
      byPriority[bp.priority] = (byPriority[bp.priority] || 0) + 1;
    });

    return {
      total: allBestPractices.length,
      byCategory,
      byPriority,
      implemented: 0,
      pending: allBestPractices.length
    };
  }

  private buildConfidenceMetrics(analysisResults: AnalysisResults): ConfidenceMetrics {
    const workerConfidences = {
      overview: analysisResults.overview.confidence,
      financial: analysisResults.financial.confidence,
      clauses: analysisResults.clauses.confidence,
      compliance: analysisResults.compliance.confidence,
      risk: analysisResults.risk.confidence,
      rates: analysisResults.rates.confidence,
      template: analysisResults.template.confidence
    };

    const overall = Object.values(workerConfidences).reduce((sum, conf) => sum + conf, 0) / 7;

    return {
      overall,
      byWorker: workerConfidences,
      bySection: {},
      trend: [{ timestamp: new Date(), confidence: overall }],
      lowConfidenceAreas: Object.entries(workerConfidences)
        .filter(([, confidence]) => confidence < 0.7)
        .map(([worker]) => worker)
    };
  }

  private generateActionItems(analysisResults: AnalysisResults, validationStatus: ValidationStatus): ActionItem[] {
    const actionItems: ActionItem[] = [];

    // Add validation action items
    validationStatus.pendingValidations.forEach((validation, index) => {
      actionItems.push({
        id: `validation_${validation.id}`,
        type: 'validation',
        priority: validation.priority,
        title: `Validate data from ${validation.workerId}`,
        description: `Review extracted data from worker ${validation.workerId}`,
        relatedTo: { workerId: validation.workerId },
        status: 'pending',
        createdAt: validation.createdAt,
        estimatedEffort: '5-10 minutes'
      });
    });

    // Add high-priority recommendations as action items
    Object.values(analysisResults).forEach(result => {
      if (result.recommendations) {
        result.recommendations
          .filter((rec: { priority: string; }) => rec.priority === 'high' || rec.priority === 'critical')
          .forEach((rec: any) => {
            actionItems.push({
              id: `recommendation_${rec.id}`,
              type: 'implementation',
              priority: rec.priority,
              title: rec.title,
              description: rec.description,
              relatedTo: { recommendationId: rec.id },
              status: 'pending',
              createdAt: new Date(),
              estimatedEffort: this.estimateEffortFromRecommendation(rec)
            });
          });
      }
    });

    return actionItems;
  }

  private estimateEffortFromRecommendation(recommendation: Recommendation): string {
    const effortMap = {
      immediate: '1-2 hours',
      short_term: '1-2 days',
      long_term: '1-2 weeks'
    };
    return effortMap[recommendation.type] || '1 day';
  }

  // Placeholder methods for executive summary
  private extractKeyFindings(dashboardData: DashboardData): string[] {
    return ['Key finding 1', 'Key finding 2', 'Key finding 3'];
  }

  private getCriticalActions(dashboardData: DashboardData): string[] {
    return dashboardData.actionItems
      .filter(item => item.priority === 'critical')
      .map(item => item.title);
  }

  private getFinancialHighlights(dashboardData: DashboardData): any {
    return { totalValue: 0, paymentTerms: 'N/A', currency: 'USD' };
  }

  private getComplianceStatus(dashboardData: DashboardData): any {
    return { status: 'compliant', issues: 0 };
  }

  private getNextSteps(dashboardData: DashboardData): string[] {
    return dashboardData.actionItems
      .filter(item => item.priority === 'high')
      .slice(0, 3)
      .map(item => item.title);
  }

  // Helper methods
  private isDataStale(data: DashboardData): boolean {
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    return Date.now() - data.lastUpdated.getTime() > staleThreshold;
  }

  private applyFilters(results: AnalysisResults, filters: DashboardFilters): Partial<AnalysisResults> {
    // Implementation for filtering results
    return results;
  }

  private filterActionItems(actionItems: ActionItem[], filters: DashboardFilters): ActionItem[] {
    // Implementation for filtering action items
    return actionItems;
  }

  private initializeMetrics(): DashboardMetrics {
    return {
      totalContracts: 0,
      activeAnalyses: 0,
      completedAnalyses: 0,
      avgProcessingTime: 0,
      successRate: 0.95,
      topRiskCategories: [],
      recentActivity: []
    };
  }

  private setupEventListeners(): void {
    this.orchestrator.on('analysisCompleted', (data) => {
      this.metrics.completedAnalyses++;
      this.emit('dashboardUpdated', data);
    });

    this.validationSystem.on('validationCompleted', (data) => {
      this.emit('dashboardUpdated', data);
    });

    this.reportGenerator.on('reportGenerated', (data) => {
      this.emit('dashboardUpdated', data);
    });
  }

  private buildDefaultAggregatedInsights(): AggregatedInsights {
    return {
      overallRiskScore: 0.5,
      financialScore: 0.8,
      complianceScore: 0.9,
      contractHealth: 'good',
      keyStrengths: [],
      majorConcerns: [],
      priorityActions: [],
      overallConfidence: 0.8
    };
  }

  private buildDefaultCrossAnalysis(): CrossAnalysisInsights {
    return {
      correlations: [],
      conflictingFindings: [],
      synergyOpportunities: [],
      holisticRecommendations: []
    };
  }
}

export interface ExecutiveSummary {
  contractTitle: string;
  overallHealth: string;
  riskScore: number;
  confidence: number;
  keyFindings: string[];
  criticalActions: string[];
  financialHighlights: any;
  complianceStatus: any;
  nextSteps: string[];
}

export const createDashboard = (
  orchestrator: ContractInsightsOrchestrator,
  validationSystem: HumanValidationSystem,
  reportGenerator: ContractReportGenerator
): ContractIntelligenceDashboard => {
  return new ContractIntelligenceDashboard(orchestrator, validationSystem, reportGenerator);
};