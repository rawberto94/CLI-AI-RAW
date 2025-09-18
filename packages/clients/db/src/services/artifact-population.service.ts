import { PrismaClient, ArtifactType } from '@prisma/client';
import { ContractIndexationService } from './contract-indexation.service';

export interface ArtifactPopulationOptions {
  includeMetadata?: boolean;
  includeClauses?: boolean;
  includeTags?: boolean;
  includeMilestones?: boolean;
  includeAnalysis?: boolean;
  overwriteExisting?: boolean;
}

export interface ContractAnalysisResult {
  overview: {
    title: string;
    contractType: string;
    parties: {
      client: string;
      vendor: string;
    };
    financials: {
      totalValue: number;
      currency: string;
      paymentTerms: string;
    };
    timeline: {
      effectiveDate: string;
      expirationDate: string;
      term: string;
    };
  };
  riskAssessment: {
    overallScore: number;
    riskFactors: Array<{
      category: string;
      level: 'low' | 'medium' | 'high';
      description: string;
      impact: number;
    }>;
    recommendations: string[];
  };
  clauses: Array<{
    type: string;
    title: string;
    content: string;
    riskLevel: 'low' | 'medium' | 'high';
    compliance: 'compliant' | 'non-compliant' | 'needs-review';
    summary: string;
  }>;
  compliance: {
    score: number;
    standards: Array<{
      name: string;
      status: 'compliant' | 'non-compliant' | 'partial';
      details: string;
    }>;
  };
  keyTerms: Array<{
    term: string;
    definition: string;
    importance: 'high' | 'medium' | 'low';
  }>;
  milestones: Array<{
    type: string;
    name: string;
    dueDate: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  tags: Array<{
    name: string;
    category: 'system' | 'ai-generated' | 'user';
    confidence: number;
  }>;
}

export class ArtifactPopulationService {
  constructor(
    private prisma: PrismaClient,
    private indexationService: ContractIndexationService
  ) {}

  /**
   * Populate artifacts for a contract with comprehensive analysis
   */
  async populateContractArtifacts(
    contractId: string,
    tenantId: string,
    options: ArtifactPopulationOptions = {}
  ): Promise<void> {
    try {
      console.log(`🔄 Starting artifact population for contract ${contractId}`);

      // Get contract details
      const contract = await this.prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          artifacts: true,
        },
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      // Generate comprehensive analysis
      const analysisResult = await this.generateContractAnalysis(contract);

      // Create artifacts based on options
      if (options.includeMetadata !== false) {
        await this.createOverviewArtifact(contractId, tenantId, analysisResult, options.overwriteExisting);
      }

      if (options.includeAnalysis !== false) {
        await this.createAnalysisArtifacts(contractId, tenantId, analysisResult, options.overwriteExisting);
      }

      if (options.includeClauses !== false) {
        await this.createClauseArtifacts(contractId, tenantId, analysisResult, options.overwriteExisting);
      }

      if (options.includeTags !== false) {
        await this.createTagArtifacts(contractId, tenantId, analysisResult, options.overwriteExisting);
      }

      if (options.includeMilestones !== false) {
        await this.createMilestoneArtifacts(contractId, tenantId, analysisResult, options.overwriteExisting);
      }

      // Index contract metadata for enhanced search
      await this.indexContractMetadata(contractId, analysisResult);

      console.log(`✅ Artifact population completed for contract ${contractId}`);
    } catch (error) {
      console.error(`❌ Error populating artifacts for contract ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Generate comprehensive contract analysis (mock implementation)
   */
  private async generateContractAnalysis(contract: any): Promise<ContractAnalysisResult> {
    // In a real implementation, this would use AI services to analyze the contract
    // For now, we'll generate realistic mock data based on the contract filename and content

    const contractType = this.inferContractType(contract.filename);
    const mockAnalysis: ContractAnalysisResult = {
      overview: {
        title: this.generateContractTitle(contract.filename),
        contractType,
        parties: {
          client: this.generatePartyName('client', contractType),
          vendor: this.generatePartyName('vendor', contractType),
        },
        financials: {
          totalValue: this.generateContractValue(contractType),
          currency: 'USD',
          paymentTerms: this.generatePaymentTerms(contractType),
        },
        timeline: {
          effectiveDate: new Date().toISOString().split('T')[0],
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          term: '12 months',
        },
      },
      riskAssessment: {
        overallScore: Math.floor(Math.random() * 40) + 20, // 20-60 range
        riskFactors: this.generateRiskFactors(contractType),
        recommendations: this.generateRecommendations(contractType),
      },
      clauses: this.generateClauses(contractType),
      compliance: {
        score: Math.floor(Math.random() * 20) + 80, // 80-100 range
        standards: this.generateComplianceStandards(contractType),
      },
      keyTerms: this.generateKeyTerms(contractType),
      milestones: this.generateMilestones(contractType),
      tags: this.generateTags(contractType),
    };

    return mockAnalysis;
  }

  /**
   * Create overview artifact
   */
  private async createOverviewArtifact(
    contractId: string,
    tenantId: string,
    analysis: ContractAnalysisResult,
    overwrite = false
  ): Promise<void> {
    const overviewData = {
      title: analysis.overview.title,
      contractType: analysis.overview.contractType,
      parties: analysis.overview.parties,
      financials: analysis.overview.financials,
      timeline: analysis.overview.timeline,
      riskScore: analysis.riskAssessment.overallScore,
      complianceScore: analysis.compliance.score,
      keyMetrics: {
        totalClauses: analysis.clauses.length,
        highRiskClauses: analysis.clauses.filter(c => c.riskLevel === 'high').length,
        complianceIssues: analysis.compliance.standards.filter(s => s.status === 'non-compliant').length,
        upcomingMilestones: analysis.milestones.filter(m => new Date(m.dueDate) > new Date()).length,
      },
      summary: `${analysis.overview.contractType} between ${analysis.overview.parties.client} and ${analysis.overview.parties.vendor} with a total value of ${analysis.overview.financials.currency} ${analysis.overview.financials.totalValue.toLocaleString()}.`,
    };

    if (overwrite) {
      await this.prisma.artifact.deleteMany({
        where: { contractId, type: 'OVERVIEW' },
      });
    }

    await this.prisma.artifact.create({
      data: {
        contractId,
        tenantId,
        type: 'OVERVIEW',
        data: overviewData,
        schemaVersion: 'v2',
        confidence: 0.95,
        size: JSON.stringify(overviewData).length,
        hash: this.generateHash(overviewData),
      },
    });
  }

  /**
   * Create analysis artifacts
   */
  private async createAnalysisArtifacts(
    contractId: string,
    tenantId: string,
    analysis: ContractAnalysisResult,
    overwrite = false
  ): Promise<void> {
    const analysisData = {
      riskAssessment: analysis.riskAssessment,
      compliance: analysis.compliance,
      keyTerms: analysis.keyTerms,
      insights: {
        strengths: this.generateInsights('strengths', analysis),
        weaknesses: this.generateInsights('weaknesses', analysis),
        opportunities: this.generateInsights('opportunities', analysis),
        threats: this.generateInsights('threats', analysis),
      },
      recommendations: {
        immediate: analysis.riskAssessment.recommendations.slice(0, 3),
        longTerm: analysis.riskAssessment.recommendations.slice(3),
      },
    };

    if (overwrite) {
      await this.prisma.artifact.deleteMany({
        where: { contractId, type: 'RISK' },
      });
    }

    await this.prisma.artifact.create({
      data: {
        contractId,
        tenantId,
        type: 'RISK',
        data: analysisData,
        schemaVersion: 'v2',
        confidence: 0.88,
        size: JSON.stringify(analysisData).length,
        hash: this.generateHash(analysisData),
      },
    });
  }

  /**
   * Create clause artifacts
   */
  private async createClauseArtifacts(
    contractId: string,
    tenantId: string,
    analysis: ContractAnalysisResult,
    overwrite = false
  ): Promise<void> {
    if (overwrite) {
      await this.prisma.artifact.deleteMany({
        where: { contractId, type: 'CLAUSES' },
      });
    }

    await this.prisma.artifact.create({
      data: {
        contractId,
        tenantId,
        type: 'CLAUSES',
        data: { clauses: analysis.clauses },
        schemaVersion: 'v2',
        confidence: 0.92,
        size: JSON.stringify(analysis.clauses).length,
        hash: this.generateHash(analysis.clauses),
      },
    });

    // Index clauses for detailed search
    await this.indexationService.indexContractClauses(
      contractId,
      analysis.clauses.map((clause, index) => ({
        contractId,
        clauseType: clause.type,
        clauseTitle: clause.title,
        clauseText: clause.content,
        pageNumber: Math.floor(index / 3) + 1,
        sectionNumber: `${Math.floor(index / 3) + 1}.${(index % 3) + 1}`,
        riskLevel: clause.riskLevel,
        complianceStatus: clause.compliance,
        aiSummary: clause.summary,
      }))
    );
  }

  /**
   * Create tag artifacts
   */
  private async createTagArtifacts(
    contractId: string,
    tenantId: string,
    analysis: ContractAnalysisResult,
    overwrite = false
  ): Promise<void> {
    if (overwrite) {
      await this.prisma.artifact.deleteMany({
        where: { contractId, type: 'COMPLIANCE' },
      });
    }

    await this.prisma.artifact.create({
      data: {
        contractId,
        tenantId,
        type: 'COMPLIANCE',
        data: { tags: analysis.tags },
        schemaVersion: 'v2',
        confidence: 0.85,
        size: JSON.stringify(analysis.tags).length,
        hash: this.generateHash(analysis.tags),
      },
    });

    // Add tags to indexation service
    await this.indexationService.addContractTags(
      contractId,
      analysis.tags.map(tag => ({
        contractId,
        tagName: tag.name,
        tagCategory: tag.category,
        confidenceScore: tag.confidence,
      }))
    );
  }

  /**
   * Create milestone artifacts
   */
  private async createMilestoneArtifacts(
    contractId: string,
    tenantId: string,
    analysis: ContractAnalysisResult,
    overwrite = false
  ): Promise<void> {
    if (overwrite) {
      await this.prisma.artifact.deleteMany({
        where: { contractId, type: 'REPORT' },
      });
    }

    await this.prisma.artifact.create({
      data: {
        contractId,
        tenantId,
        type: 'REPORT',
        data: { milestones: analysis.milestones },
        schemaVersion: 'v2',
        confidence: 0.90,
        size: JSON.stringify(analysis.milestones).length,
        hash: this.generateHash(analysis.milestones),
      },
    });

    // Add milestones to indexation service
    await this.indexationService.addContractMilestones(
      contractId,
      analysis.milestones.map(milestone => ({
        contractId,
        milestoneType: milestone.type,
        milestoneName: milestone.name,
        dueDate: new Date(milestone.dueDate),
        status: 'pending',
        description: milestone.description,
        reminderDays: milestone.priority === 'high' ? 30 : 60,
      }))
    );
  }

  /**
   * Index contract metadata for enhanced search
   */
  private async indexContractMetadata(
    contractId: string,
    analysis: ContractAnalysisResult
  ): Promise<void> {
    await this.indexationService.indexContractMetadata({
      contractId,
      title: analysis.overview.title,
      contractType: analysis.overview.contractType,
      category: this.getCategoryFromType(analysis.overview.contractType),
      clientName: analysis.overview.parties.client,
      vendorName: analysis.overview.parties.vendor,
      totalValue: analysis.overview.financials.totalValue,
      currency: analysis.overview.financials.currency,
      paymentTerms: analysis.overview.financials.paymentTerms,
      effectiveDate: new Date(analysis.overview.timeline.effectiveDate),
      expirationDate: new Date(analysis.overview.timeline.expirationDate),
      riskScore: analysis.riskAssessment.overallScore,
      complianceScore: analysis.compliance.score,
      status: 'active',
      approvalStatus: 'approved',
      language: 'en',
      documentFormat: 'PDF',
      complexityScore: this.calculateComplexityScore(analysis),
      lastReviewedAt: new Date(),
    });
  }

  /**
   * Populate artifacts for multiple contracts
   */
  async populateMultipleContracts(
    contractIds: string[],
    tenantId: string,
    options: ArtifactPopulationOptions = {}
  ): Promise<void> {
    console.log(`🔄 Starting batch artifact population for ${contractIds.length} contracts`);

    for (const contractId of contractIds) {
      try {
        await this.populateContractArtifacts(contractId, tenantId, options);
        // Add small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to populate artifacts for contract ${contractId}:`, error);
        // Continue with other contracts
      }
    }

    console.log(`✅ Batch artifact population completed`);
  }

  // Helper methods for generating mock data
  private inferContractType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('service') || lower.includes('msa')) return 'MSA';
    if (lower.includes('license') || lower.includes('software')) return 'SLA';
    if (lower.includes('nda') || lower.includes('confidential')) return 'NDA';
    if (lower.includes('data') || lower.includes('processing')) return 'DPA';
    if (lower.includes('employment') || lower.includes('work')) return 'Employment';
    return 'SOW';
  }

  private generateContractTitle(filename: string): string {
    const type = this.inferContractType(filename);
    const titles: Record<string, string> = {
      'MSA': 'Master Service Agreement - Technology Services',
      'SLA': 'Software License Agreement - Enterprise Platform',
      'NDA': 'Non-Disclosure Agreement - Confidential Information',
      'DPA': 'Data Processing Agreement - Analytics Platform',
      'Employment': 'Employment Agreement - Senior Developer',
      'SOW': 'Statement of Work - Mobile Application Development',
    };
    return titles[type] || `${type} - ${filename.replace(/\.[^/.]+$/, '')}`;
  }

  private generatePartyName(type: 'client' | 'vendor', contractType: string): string {
    const clients = ['TechCorp Inc.', 'DataSystems LLC', 'InnovateNow Corp', 'GlobalTech Solutions', 'StartupCo'];
    const vendors = ['ServiceProvider LLC', 'DevStudio Inc.', 'CloudSolutions Corp', 'AnalyticsPro', 'TechVendor Ltd'];
    
    const names = type === 'client' ? clients : vendors;
    return names[Math.floor(Math.random() * names.length)];
  }

  private generateContractValue(contractType: string): number {
    const ranges: Record<string, [number, number]> = {
      'MSA': [500000, 5000000],
      'SLA': [100000, 2000000],
      'NDA': [0, 0],
      'DPA': [200000, 1500000],
      'Employment': [80000, 200000],
      'SOW': [50000, 1000000],
    };
    
    const [min, max] = ranges[contractType] || [10000, 500000];
    return Math.floor(Math.random() * (max - min) + min);
  }

  private generatePaymentTerms(contractType: string): string {
    const terms = ['Net 30', 'Net 45', 'Net 60', 'Monthly', 'Quarterly', 'Upon delivery'];
    return terms[Math.floor(Math.random() * terms.length)];
  }

  private generateRiskFactors(contractType: string): Array<{
    category: string;
    level: 'low' | 'medium' | 'high';
    description: string;
    impact: number;
  }> {
    const factors = [
      { category: 'Financial', level: 'low' as const, description: 'Payment terms are favorable', impact: 2 },
      { category: 'Legal', level: 'medium' as const, description: 'Liability cap may be insufficient', impact: 5 },
      { category: 'Operational', level: 'low' as const, description: 'Service levels are clearly defined', impact: 3 },
      { category: 'Compliance', level: 'high' as const, description: 'GDPR compliance requirements unclear', impact: 8 },
    ];
    
    return factors.slice(0, Math.floor(Math.random() * 3) + 2);
  }

  private generateRecommendations(contractType: string): string[] {
    const recommendations = [
      'Review and strengthen liability limitation clauses',
      'Add force majeure provisions for unforeseen circumstances',
      'Clarify intellectual property ownership rights',
      'Include specific performance metrics and SLAs',
      'Add termination clauses with appropriate notice periods',
      'Ensure compliance with relevant data protection regulations',
    ];
    
    return recommendations.slice(0, Math.floor(Math.random() * 4) + 2);
  }

  private generateClauses(contractType: string): Array<{
    type: string;
    title: string;
    content: string;
    riskLevel: 'low' | 'medium' | 'high';
    compliance: 'compliant' | 'non-compliant' | 'needs-review';
    summary: string;
  }> {
    const clauseTypes = ['payment', 'termination', 'liability', 'confidentiality', 'intellectual_property'];
    
    return clauseTypes.map(type => ({
      type,
      title: `${type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Clause`,
      content: `This clause governs the ${type.replace('_', ' ')} aspects of the agreement...`,
      riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
      compliance: ['compliant', 'needs-review'][Math.floor(Math.random() * 2)] as any,
      summary: `Standard ${type.replace('_', ' ')} provisions with typical terms.`,
    }));
  }

  private generateComplianceStandards(contractType: string): Array<{
    name: string;
    status: 'compliant' | 'non-compliant' | 'partial';
    details: string;
  }> {
    const standards = [
      { name: 'GDPR', status: 'compliant' as const, details: 'Data processing terms meet GDPR requirements' },
      { name: 'SOX', status: 'partial' as const, details: 'Some financial controls need strengthening' },
      { name: 'ISO 27001', status: 'compliant' as const, details: 'Security requirements are adequate' },
    ];
    
    return standards.slice(0, Math.floor(Math.random() * 2) + 1);
  }

  private generateKeyTerms(contractType: string): Array<{
    term: string;
    definition: string;
    importance: 'high' | 'medium' | 'low';
  }> {
    const terms = [
      { term: 'Service Level Agreement', definition: 'Minimum performance standards', importance: 'high' as const },
      { term: 'Intellectual Property', definition: 'Rights to created works', importance: 'high' as const },
      { term: 'Confidential Information', definition: 'Protected proprietary data', importance: 'medium' as const },
    ];
    
    return terms;
  }

  private generateMilestones(contractType: string): Array<{
    type: string;
    name: string;
    dueDate: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const milestones = [
      {
        type: 'renewal',
        name: 'Contract Renewal Review',
        dueDate: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: 'Review contract terms for renewal',
        priority: 'high' as const,
      },
      {
        type: 'payment',
        name: 'Quarterly Payment Due',
        dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: 'Quarterly payment milestone',
        priority: 'medium' as const,
      },
    ];
    
    return milestones;
  }

  private generateTags(contractType: string): Array<{
    name: string;
    category: 'system' | 'ai-generated' | 'user';
    confidence: number;
  }> {
    const baseTags = [contractType.toLowerCase(), 'active', 'commercial'];
    const additionalTags = ['high-value', 'technology', 'enterprise', 'multi-year'];
    
    const selectedTags = [...baseTags, ...additionalTags.slice(0, Math.floor(Math.random() * 3) + 1)];
    
    return selectedTags.map(tag => ({
      name: tag,
      category: 'ai-generated' as const,
      confidence: Math.random() * 0.3 + 0.7, // 0.7 - 1.0
    }));
  }

  private generateInsights(type: string, analysis: ContractAnalysisResult): string[] {
    const insights: Record<string, string[]> = {
      strengths: [
        'Clear payment terms and conditions',
        'Well-defined scope of work',
        'Strong intellectual property protections',
      ],
      weaknesses: [
        'Limited liability protection',
        'Vague termination clauses',
        'Insufficient data protection measures',
      ],
      opportunities: [
        'Potential for contract extension',
        'Additional service offerings',
        'Performance bonus opportunities',
      ],
      threats: [
        'Regulatory compliance risks',
        'Market volatility impact',
        'Vendor dependency concerns',
      ],
    };
    
    return insights[type] || [];
  }

  private getCategoryFromType(contractType: string): string {
    const categories: Record<string, string> = {
      'MSA': 'Technology',
      'SLA': 'Software',
      'NDA': 'Legal',
      'DPA': 'Data',
      'Employment': 'HR',
      'SOW': 'Professional Services',
    };
    
    return categories[contractType] || 'General';
  }

  private calculateComplexityScore(analysis: ContractAnalysisResult): number {
    let score = 1;
    
    // Increase complexity based on various factors
    if (analysis.clauses.length > 10) score += 2;
    if (analysis.riskAssessment.riskFactors.some(f => f.level === 'high')) score += 2;
    if (analysis.overview.financials.totalValue > 1000000) score += 1;
    if (analysis.milestones.length > 5) score += 1;
    
    return Math.min(score, 10);
  }

  private generateHash(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}