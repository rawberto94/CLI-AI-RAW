/**
 * Processing Pipeline Coordinator
 * Orchestrates the complete contract processing workflow
 */

import { EventEmitter } from 'events';

import { textExtractionService, type ExtractionResult } from './text-extraction';
import { FinancialWorker, type ContractData, type FinancialAnalysisResult } from '../../workers/financial.worker';
import { RiskWorker, type RiskResult } from '../../workers/risk.worker';
import { ComplianceWorker, type ComplianceResult } from '../../workers/compliance.worker';
import { ClausesWorker, type ClausesResult } from '../../workers/clauses.worker';

export interface ProcessingStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  result?: any;
}

export interface ProcessingJob {
  id: string;
  contractId: string;
  filePath: string;
  mimeType: string;
  tenantId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  stages: ProcessingStage[];
  startTime: Date;
  endTime?: Date;
  totalProgress: number;
  metadata: {
    filename: string;
    fileSize: number;
    uploadedBy?: string;
  };
}

export class ProcessingPipeline extends EventEmitter {
  private jobs = new Map<string, ProcessingJob>();
  private activeJobs = new Set<string>();
  private maxConcurrentJobs = 5;
  private financialWorker: FinancialWorker;
  private riskWorker: RiskWorker;
  private complianceWorker: ComplianceWorker;
  private clausesWorker: ClausesWorker;

  constructor() {
    super();
    this.financialWorker = new FinancialWorker();
    this.riskWorker = new RiskWorker();
    this.complianceWorker = new ComplianceWorker();
    this.clausesWorker = new ClausesWorker();
  }

  /**
   * Start processing a contract
   */
  async processContract(
    contractId: string,
    filePath: string,
    mimeType: string,
    tenantId: string,
    metadata: { filename: string; fileSize: number; uploadedBy?: string; clientId?: string; supplierId?: string }
  ): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: ProcessingJob = {
      id: jobId,
      contractId,
      filePath,
      mimeType,
      tenantId,
      status: 'queued',
      stages: this.createProcessingStages(),
      startTime: new Date(),
      totalProgress: 0,
      metadata
    };

    this.jobs.set(jobId, job);
    this.emit('job:created', job);

    // Start processing if we have capacity
    if (this.activeJobs.size < this.maxConcurrentJobs) {
      this.startJobProcessing(jobId);
    }

    return jobId;
  }

  /**
   * Get job status
   */
  getJob(jobId: string): ProcessingJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs for a tenant
   */
  getJobsByTenant(tenantId: string): ProcessingJob[] {
    return Array.from(this.jobs.values()).filter(job => job.tenantId === tenantId);
  }

  /**
   * Create the standard processing stages
   */
  private createProcessingStages(): ProcessingStage[] {
    return [
      {
        id: 'text_extraction',
        name: 'Text Extraction',
        status: 'pending',
        progress: 0
      },
      {
        id: 'metadata_extraction',
        name: 'Metadata Extraction',
        status: 'pending',
        progress: 0
      },
      {
        id: 'financial_analysis',
        name: 'Financial Analysis',
        status: 'pending',
        progress: 0
      },
      {
        id: 'risk_assessment',
        name: 'Risk Assessment',
        status: 'pending',
        progress: 0
      },
      {
        id: 'compliance_check',
        name: 'Compliance Check',
        status: 'pending',
        progress: 0
      },
      {
        id: 'clause_extraction',
        name: 'Clause Extraction',
        status: 'pending',
        progress: 0
      },
      {
        id: 'search_indexing',
        name: 'Search Indexing',
        status: 'pending',
        progress: 0
      },
      {
        id: 'finalization',
        name: 'Finalization',
        status: 'pending',
        progress: 0
      }
    ];
  }

  /**
   * Start processing a job
   */
  private async startJobProcessing(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    this.activeJobs.add(jobId);
    job.status = 'processing';
    this.emit('job:started', job);

    try {
      await this.executeProcessingStages(job);
      
      job.status = 'completed';
      job.endTime = new Date();
      job.totalProgress = 100;
      
      this.emit('job:completed', job);
    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      
      // Mark current stage as failed
      const currentStage = job.stages.find(s => s.status === 'running');
      if (currentStage) {
        currentStage.status = 'failed';
        currentStage.error = error.message;
        currentStage.endTime = new Date();
      }
      
      this.emit('job:failed', job, error);
    } finally {
      this.activeJobs.delete(jobId);
      
      // Start next queued job if any
      const nextJob = Array.from(this.jobs.values())
        .find(j => j.status === 'queued');
      if (nextJob) {
        this.startJobProcessing(nextJob.id);
      }
    }
  }

  /**
   * Execute all processing stages
   */
  private async executeProcessingStages(job: ProcessingJob): Promise<void> {
    const stageResults: Record<string, any> = {};

    for (let i = 0; i < job.stages.length; i++) {
      const stage = job.stages[i];
      
      stage.status = 'running';
      stage.startTime = new Date();
      stage.progress = 0;
      
      this.emit('stage:started', job, stage);

      try {
        const result = await this.executeStage(job, stage, stageResults);
        
        stage.status = 'completed';
        stage.progress = 100;
        stage.endTime = new Date();
        stage.result = result;
        
        stageResults[stage.id] = result;
        
        // Update total job progress
        job.totalProgress = Math.round(((i + 1) / job.stages.length) * 100);
        
        this.emit('stage:completed', job, stage);
        
      } catch (error) {
        stage.status = 'failed';
        stage.error = error.message;
        stage.endTime = new Date();
        
        this.emit('stage:failed', job, stage, error);
        throw error;
      }
    }
  }

  /**
   * Execute a specific processing stage
   */
  private async executeStage(
    job: ProcessingJob,
    stage: ProcessingStage,
    previousResults: Record<string, any>
  ): Promise<any> {
    switch (stage.id) {
      case 'text_extraction':
        return await this.executeTextExtraction(job, stage);
      
      case 'metadata_extraction':
        return await this.executeMetadataExtraction(job, stage, previousResults);
      
      case 'financial_analysis':
        return await this.executeFinancialAnalysis(job, stage, previousResults);
      
      case 'risk_assessment':
        return await this.executeRiskAssessment(job, stage, previousResults);
      
      case 'compliance_check':
        return await this.executeComplianceCheck(job, stage, previousResults);
      
      case 'clause_extraction':
        return await this.executeClauseExtraction(job, stage, previousResults);
      
      case 'search_indexing':
        return await this.executeSearchIndexing(job, stage, previousResults);
      
      case 'finalization':
        return await this.executeFinalization(job, stage, previousResults);
      
      default:
        throw new Error(`Unknown stage: ${stage.id}`);
    }
  }

  /**
   * Execute text extraction stage
   */
  private async executeTextExtraction(job: ProcessingJob, stage: ProcessingStage): Promise<ExtractionResult> {
    stage.progress = 10;
    this.emit('stage:progress', job, stage);

    const result = await textExtractionService.extractText(
      job.filePath,
      job.mimeType,
      {
        enableOCR: true,
        cleanText: true,
        preserveFormatting: false
      }
    );

    stage.progress = 100;
    this.emit('stage:progress', job, stage);

    return result;
  }

  /**
   * Execute metadata extraction stage
   */
  private async executeMetadataExtraction(
    job: ProcessingJob,
    stage: ProcessingStage,
    previousResults: Record<string, any>
  ): Promise<any> {
    const textResult = previousResults.text_extraction as ExtractionResult;
    
    stage.progress = 20;
    this.emit('stage:progress', job, stage);

    // Extract basic metadata from text
    const metadata = {
      parties: this.extractParties(textResult.text),
      contractType: this.identifyContractType(textResult.text),
      effectiveDate: this.extractDate(textResult.text, 'effective'),
      expirationDate: this.extractDate(textResult.text, 'expiration'),
      jurisdiction: this.extractJurisdiction(textResult.text),
      language: 'en' // Simplified
    };

    stage.progress = 100;
    this.emit('stage:progress', job, stage);

    return metadata;
  }

  /**
   * Execute enhanced financial analysis stage
   */
  private async executeFinancialAnalysis(
    job: ProcessingJob,
    stage: ProcessingStage,
    previousResults: Record<string, any>
  ): Promise<FinancialAnalysisResult> {
    const textResult = previousResults.text_extraction as ExtractionResult;
    
    stage.progress = 10;
    this.emit('stage:progress', job, stage);

    // Create contract data object for the enhanced financial worker
    const contractData: ContractData = {
      id: job.contractId,
      content: textResult.text,
      metadata: {
        filename: job.metadata.filename,
        fileSize: job.metadata.fileSize,
        mimeType: job.mimeType
      }
    };

    stage.progress = 30;
    this.emit('stage:progress', job, stage);

    // Use the enhanced financial worker for comprehensive analysis
    const financialResult = await this.financialWorker.process(contractData);

    stage.progress = 100;
    this.emit('stage:progress', job, stage);

    return financialResult;
  }

  /**
   * Execute risk assessment stage
   */
  private async executeRiskAssessment(
    job: ProcessingJob,
    stage: ProcessingStage,
    previousResults: Record<string, any>
  ): Promise<RiskResult> {
    const textResult = previousResults.text_extraction as ExtractionResult;
    
    stage.progress = 20;
    this.emit('stage:progress', job, stage);

    // Create contract data object for the risk worker
    const contractData: ContractData = {
      id: job.contractId,
      content: textResult.text,
      metadata: {
        filename: job.metadata.filename,
        fileSize: job.metadata.fileSize,
        mimeType: job.mimeType
      }
    };

    stage.progress = 50;
    this.emit('stage:progress', job, stage);

    // Use the risk worker for comprehensive analysis
    const riskResult = await this.riskWorker.process(contractData);

    stage.progress = 100;
    this.emit('stage:progress', job, stage);

    return riskResult;
  }

  /**
   * Execute compliance check stage
   */
  private async executeComplianceCheck(
    job: ProcessingJob,
    stage: ProcessingStage,
    previousResults: Record<string, any>
  ): Promise<ComplianceResult> {
    const textResult = previousResults.text_extraction as ExtractionResult;
    
    stage.progress = 20;
    this.emit('stage:progress', job, stage);

    // Create contract data object for the compliance worker
    const contractData: ContractData = {
      id: job.contractId,
      content: textResult.text,
      metadata: {
        filename: job.metadata.filename,
        fileSize: job.metadata.fileSize,
        mimeType: job.mimeType
      }
    };

    stage.progress = 50;
    this.emit('stage:progress', job, stage);

    // Use the compliance worker for comprehensive analysis
    const complianceResult = await this.complianceWorker.process(contractData);

    stage.progress = 100;
    this.emit('stage:progress', job, stage);

    return complianceResult;
  }

  /**
   * Execute clause extraction stage
   */
  private async executeClauseExtraction(
    job: ProcessingJob,
    stage: ProcessingStage,
    previousResults: Record<string, any>
  ): Promise<ClausesResult> {
    const textResult = previousResults.text_extraction as ExtractionResult;
    
    stage.progress = 20;
    this.emit('stage:progress', job, stage);

    // Create contract data object for the clauses worker
    const contractData: ContractData = {
      id: job.contractId,
      content: textResult.text,
      metadata: {
        filename: job.metadata.filename,
        fileSize: job.metadata.fileSize,
        mimeType: job.mimeType
      }
    };

    stage.progress = 60;
    this.emit('stage:progress', job, stage);

    // Use the clauses worker for comprehensive analysis
    const clausesResult = await this.clausesWorker.process(contractData);

    stage.progress = 100;
    this.emit('stage:progress', job, stage);

    return clausesResult;
  }

  /**
   * Execute search indexing stage
   */
  private async executeSearchIndexing(
    job: ProcessingJob,
    stage: ProcessingStage,
    previousResults: Record<string, any>
  ): Promise<any> {
    const textResult = previousResults.text_extraction as ExtractionResult;
    
    stage.progress = 70;
    this.emit('stage:progress', job, stage);

    const searchData = {
      searchableContent: this.createSearchableContent(textResult.text),
      keywords: this.extractKeywords(textResult.text),
      entities: this.extractEntities(textResult.text),
      embeddings: await this.generateEmbeddings(textResult.text)
    };

    stage.progress = 100;
    this.emit('stage:progress', job, stage);

    return searchData;
  }

  /**
   * Execute finalization stage
   */
  private async executeFinalization(
    job: ProcessingJob,
    stage: ProcessingStage,
    previousResults: Record<string, any>
  ): Promise<any> {
    stage.progress = 20;
    this.emit('stage:progress', job, stage);

    // Combine all results and save to database
    const finalResult = {
      contractId: job.contractId,
      tenantId: job.tenantId,
      processingJobId: job.id,
      extractedText: previousResults.text_extraction,
      metadata: previousResults.metadata_extraction,
      financial: previousResults.financial_analysis,
      risk: previousResults.risk_assessment,
      compliance: previousResults.compliance_check,
      clauses: previousResults.clause_extraction,
      search: previousResults.search_indexing,
      processedAt: new Date()
    };

    stage.progress = 60;
    this.emit('stage:progress', job, stage);

    // Save processing results to contract file
    await this.saveProcessingResults(job.contractId, finalResult);

    stage.progress = 100;
    this.emit('stage:progress', job, stage);

    return finalResult;
  }

  /**
   * Save processing results to contract file
   */
  private async saveProcessingResults(contractId: string, results: any): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const contractDataPath = path.join(process.cwd(), 'data', 'contracts', `${contractId}.json`);
      
      if (await this.fileExists(contractDataPath)) {
        const contractData = JSON.parse(await fs.readFile(contractDataPath, 'utf-8'));
        
        // Update contract with processing results
        contractData.extractedData = {
          text: results.extractedText?.text || '',
          metadata: results.metadata,
          financial: results.financial,
          risk: results.risk,
          compliance: results.compliance,
          clauses: results.clauses,
          search: results.search
        };
        
        contractData.status = 'completed';
        contractData.processing.status = 'completed';
        contractData.processing.completedAt = new Date().toISOString();
        contractData.processing.progress = 100;
        contractData.processing.currentStage = 'completed';
        
        await fs.writeFile(contractDataPath, JSON.stringify(contractData, null, 2));
      }
    } catch (error) {
      console.error('Error saving processing results:', error);
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Simplified extraction methods (in production, these would be more sophisticated)
  private extractParties(text: string): string[] {
    const parties: string[] = [];
    const patterns = [
      /(?:client|customer|buyer):\s*([^\n]+)/gi,
      /(?:provider|vendor|seller|contractor):\s*([^\n]+)/gi,
      /between\s+([^,\n]+)\s+and\s+([^,\n]+)/gi
    ];

    patterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) parties.push(match[1].trim());
        if (match[2]) parties.push(match[2].trim());
      }
    });

    return [...new Set(parties)];
  }

  private identifyContractType(text: string): string {
    const types = [
      { pattern: /service\s+agreement/i, type: 'Service Agreement' },
      { pattern: /purchase\s+order/i, type: 'Purchase Order' },
      { pattern: /employment\s+contract/i, type: 'Employment Contract' },
      { pattern: /lease\s+agreement/i, type: 'Lease Agreement' },
      { pattern: /nda|non.disclosure/i, type: 'Non-Disclosure Agreement' }
    ];

    for (const { pattern, type } of types) {
      if (pattern.test(text)) {
        return type;
      }
    }

    return 'Unknown';
  }

  private extractDate(text: string, type: 'effective' | 'expiration'): string | null {
    const patterns = type === 'effective' 
      ? [/effective\s+date:\s*([^\n]+)/i, /commenc\w+\s+on\s+([^\n]+)/i]
      : [/expir\w+\s+date:\s*([^\n]+)/i, /until\s+([^\n]+)/i];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractJurisdiction(text: string): string | null {
    const match = text.match(/governed\s+by\s+the\s+laws\s+of\s+([^\n,.]+)/i);
    return match ? match[1].trim() : null;
  }

  private extractTotalValue(text: string): number {
    const patterns = [
      /total\s+(?:contract\s+)?value:\s*\$?([\d,]+)/i,
      /\$\s*([\d,]+)/g
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1].replace(/,/g, ''));
      }
    }

    return 0;
  }

  private extractCurrency(text: string): string {
    if (text.includes('$') || /usd|dollar/i.test(text)) return 'USD';
    if (/eur|euro/i.test(text)) return 'EUR';
    if (/gbp|pound/i.test(text)) return 'GBP';
    return 'USD';
  }

  private extractPaymentTerms(text: string): string {
    const match = text.match(/payment\s+terms?:\s*([^\n]+)/i) ||
                  text.match(/net\s+(\d+)\s+days/i);
    return match ? match[1].trim() : 'Unknown';
  }

  private extractPaymentSchedule(text: string): any {
    const monthlyMatch = text.match(/monthly\s+payments?\s+of\s+\$?([\d,]+)/i);
    if (monthlyMatch) {
      return {
        frequency: 'Monthly',
        amount: parseInt(monthlyMatch[1].replace(/,/g, ''))
      };
    }
    return null;
  }

  private extractPenalties(text: string): string[] {
    const penalties: string[] = [];
    const patterns = [
      /late\s+payment\s+fee:\s*([^\n]+)/i,
      /penalty:\s*([^\n]+)/i,
      /liquidated\s+damages:\s*([^\n]+)/i
    ];

    patterns.forEach(pattern => {
      const match = text.match(pattern);
      if (match) {
        penalties.push(match[1].trim());
      }
    });

    return penalties;
  }

  private identifyRiskFactors(text: string, financial: any): any[] {
    const factors: any[] = [];

    // High value risk
    if (financial.totalValue > 1000000) {
      factors.push({
        type: 'HIGH_VALUE',
        severity: 'HIGH',
        description: 'High contract value increases financial risk'
      });
    }

    // Personnel dependency
    if (/key\s+personnel|dependency/i.test(text)) {
      factors.push({
        type: 'PERSONNEL_DEPENDENCY',
        severity: 'MEDIUM',
        description: 'Contract depends on specific personnel'
      });
    }

    return factors;
  }

  private calculateRiskScore(factors: any[]): number {
    let score = 0;
    factors.forEach(factor => {
      switch (factor.severity) {
        case 'HIGH': score += 30; break;
        case 'MEDIUM': score += 20; break;
        case 'LOW': score += 10; break;
      }
    });
    return Math.min(score, 100);
  }

  private getRiskLevel(score: number): string {
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  private generateRiskRecommendations(factors: any[]): string[] {
    return factors.map(factor => `Mitigate ${factor.type.toLowerCase().replace('_', ' ')} risk`);
  }

  private calculateComplianceScore(text: string): number {
    let score = 100;
    
    // Deduct points for missing standard clauses
    if (!/termination/i.test(text)) score -= 10;
    if (!/liability/i.test(text)) score -= 15;
    if (!/confidentiality/i.test(text)) score -= 10;
    
    return Math.max(score, 0);
  }

  private identifyRegulations(text: string): any[] {
    const regulations: any[] = [];
    
    if (/gdpr/i.test(text)) {
      regulations.push({ type: 'GDPR', compliance: 'COMPLIANT' });
    }
    
    if (/sox|sarbanes.oxley/i.test(text)) {
      regulations.push({ type: 'SOX', compliance: 'COMPLIANT' });
    }
    
    return regulations;
  }

  private identifyComplianceIssues(text: string): string[] {
    const issues: string[] = [];
    
    if (!/force\s+majeure/i.test(text)) {
      issues.push('Missing force majeure clause');
    }
    
    return issues;
  }

  private generateComplianceRecommendations(text: string): string[] {
    return ['Add standard compliance clauses', 'Review regulatory requirements'];
  }

  private extractClauses(text: string): any[] {
    const clauses: any[] = [];
    
    // Simple clause extraction
    const sections = text.split(/\n\s*\d+\.\s+/);
    sections.forEach((section, index) => {
      if (section.trim()) {
        clauses.push({
          id: `clause_${index}`,
          type: this.classifyClause(section),
          content: section.trim().substring(0, 200) + '...',
          position: index
        });
      }
    });
    
    return clauses;
  }

  private classifyClause(text: string): string {
    if (/payment|compensation/i.test(text)) return 'PAYMENT';
    if (/termination/i.test(text)) return 'TERMINATION';
    if (/liability|indemnif/i.test(text)) return 'LIABILITY';
    if (/intellectual\s+property/i.test(text)) return 'INTELLECTUAL_PROPERTY';
    if (/confidential/i.test(text)) return 'CONFIDENTIALITY';
    return 'GENERAL';
  }

  private assessClauseCompleteness(text: string): any {
    const requiredClauses = ['PAYMENT', 'TERMINATION', 'LIABILITY', 'CONFIDENTIALITY'];
    const foundClauses = this.extractClauses(text).map(c => c.type);
    const missing = requiredClauses.filter(req => !foundClauses.includes(req));
    
    return {
      score: Math.round(((requiredClauses.length - missing.length) / requiredClauses.length) * 100),
      missing
    };
  }

  private identifyStandardClauses(text: string): string[] {
    return ['Force Majeure', 'Governing Law', 'Entire Agreement'];
  }

  private identifyCustomClauses(text: string): string[] {
    return ['Custom Performance Metrics', 'Specialized Terms'];
  }

  private createSearchableContent(text: string): string {
    return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const frequency = new Map<string, number>();
    
    words.forEach(word => {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    });
    
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }

  private extractEntities(text: string): unknown {
    return {
      organizations: this.extractParties(text),
      dates: this.extractAllDates(text),
      amounts: this.extractAllAmounts(text)
    };
  }

  private extractAllDates(text: string): string[] {
    const datePattern = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b\w+\s+\d{1,2},?\s+\d{4}\b/g;
    return text.match(datePattern) || [];
  }

  private extractAllAmounts(text: string): string[] {
    const amountPattern = /\$[\d,]+(?:\.\d{2})?/g;
    return text.match(amountPattern) || [];
  }

  private async generateEmbeddings(text: string): Promise<number[]> {
    // Simplified embedding generation - in production, use a proper embedding service
    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    return words.map(word => word.charCodeAt(0) % 100 / 100);
  }
}

// Export singleton instance
export const processingPipeline = new ProcessingPipeline();