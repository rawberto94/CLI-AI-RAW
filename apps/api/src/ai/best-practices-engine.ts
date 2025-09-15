/**
 * Best Practices Engine
 * LLM-powered expert recommendations and industry best practices for contract analysis
 */

import { OpenAI } from 'openai';

export interface BestPracticesRecommendation {
  id: string;
  category: 'legal' | 'financial' | 'risk' | 'compliance' | 'negotiation' | 'industry' | 'operational';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  rationale: string;
  implementation: string;
  industryContext?: string;
  legalBasis?: string;
  riskMitigation?: string;
  benchmarkData?: any;
  estimatedImpact: 'high' | 'medium' | 'low';
  effort: 'minimal' | 'moderate' | 'significant';
  timeframe: 'immediate' | 'short-term' | 'long-term';
  sources?: string[];
}

export interface BestPracticesContext {
  contractType: string;
  industry?: string;
  jurisdiction?: string;
  contractValue?: number;
  parties?: {
    buyer?: string;
    seller?: string;
    contractor?: string;
  };
  riskProfile?: 'low' | 'medium' | 'high';
  complexity?: 'simple' | 'moderate' | 'complex';
}

export interface BestPracticesAnalysis {
  recommendations: BestPracticesRecommendation[];
  industryInsights: {
    marketTrends: string[];
    standardPractices: string[];
    emergingRisks: string[];
    benchmarks: any;
  };
  expertGuidance: {
    negotiationTips: string[];
    redFlags: string[];
    opportunitiesForImprovement: string[];
    strategicConsiderations: string[];
  };
  complianceGuidance: {
    regulations: string[];
    standards: string[];
    certifications: string[];
    auditRequirements: string[];
  };
  summary: {
    overallAssessment: string;
    keyPriorities: string[];
    nextSteps: string[];
  };
}

export class BestPracticesEngine {
  private openai: OpenAI;
  private industryKnowledge: Map<string, any> = new Map();
  private contractTypeTemplates: Map<string, any> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY']
    });
    
    this.initializeKnowledgeBase();
  }

  /**
   * Generate comprehensive best practices analysis
   */
  async generateBestPractices(
    documentContent: string,
    workerType: string,
    context: BestPracticesContext,
    analysisResults?: any
  ): Promise<BestPracticesAnalysis> {
    
    // Generate recommendations based on worker type
    const recommendations = await this.generateRecommendations(
      documentContent,
      workerType,
      context,
      analysisResults
    );

    // Get industry insights
    const industryInsights = await this.generateIndustryInsights(
      documentContent,
      context
    );

    // Generate expert guidance
    const expertGuidance = await this.generateExpertGuidance(
      documentContent,
      context,
      analysisResults
    );

    // Get compliance guidance
    const complianceGuidance = await this.generateComplianceGuidance(
      documentContent,
      context
    );

    // Create summary
    const summary = await this.generateSummary(
      recommendations,
      industryInsights,
      expertGuidance,
      complianceGuidance
    );

    return {
      recommendations,
      industryInsights,
      expertGuidance,
      complianceGuidance,
      summary
    };
  }

  /**
   * Generate worker-specific recommendations
   */
  private async generateRecommendations(
    content: string,
    workerType: string,
    context: BestPracticesContext,
    analysisResults?: any
  ): Promise<BestPracticesRecommendation[]> {
    
    const prompt = this.buildRecommendationPrompt(content, workerType, context, analysisResults);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        {
          role: 'system',
          content: this.getSystemPromptForWorker(workerType)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{"recommendations": []}');
    
    return result.recommendations.map((rec: any, index: number) => ({
      id: `${workerType}_rec_${Date.now()}_${index}`,
      ...rec
    }));
  }

  /**
   * Generate industry-specific insights
   */
  private async generateIndustryInsights(
    content: string,
    context: BestPracticesContext
  ): Promise<any> {
    
    const prompt = `As an industry expert in ${context.industry || 'general business'}, analyze this ${context.contractType} contract and provide insights on:

1. Current market trends affecting this type of contract
2. Standard industry practices that should be considered
3. Emerging risks specific to this industry
4. Relevant benchmarks and market data

Contract content: ${content.substring(0, 3000)}...

Provide detailed insights that go beyond the document content, focusing on industry knowledge and market intelligence.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a senior industry analyst with deep expertise in contract trends and market intelligence.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0]?.message?.content || '{}');
  }

  /**
   * Generate expert guidance and strategic advice
   */
  private async generateExpertGuidance(
    content: string,
    context: BestPracticesContext,
    analysisResults?: any
  ): Promise<any> {
    
    const prompt = `As a senior contract attorney with 20+ years of experience, provide expert guidance for this ${context.contractType} contract:

Contract Analysis Results: ${JSON.stringify(analysisResults, null, 2)}

Contract Content: ${content.substring(0, 2000)}...

Provide strategic guidance on:
1. Key negotiation strategies and tactics
2. Critical red flags to watch for
3. Opportunities for contract improvement
4. Strategic considerations for both parties

Focus on actionable advice that adds value beyond basic contract analysis.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a senior partner at a top-tier law firm specializing in commercial contracts with extensive negotiation experience.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0]?.message?.content || '{}');
  }

  /**
   * Generate compliance and regulatory guidance
   */
  private async generateComplianceGuidance(
    content: string,
    context: BestPracticesContext
  ): Promise<any> {
    
    const prompt = `As a compliance and regulatory expert, analyze this ${context.contractType} contract for ${context.industry || 'general business'} industry:

Contract: ${content.substring(0, 2000)}...
Jurisdiction: ${context.jurisdiction || 'General'}

Identify:
1. Relevant regulations and compliance requirements
2. Industry standards that apply
3. Required certifications or qualifications
4. Audit and reporting requirements

Provide specific, actionable compliance guidance.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a compliance officer and regulatory expert with deep knowledge of industry standards and legal requirements.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0]?.message?.content || '{}');
  }

  /**
   * Generate executive summary of all recommendations
   */
  private async generateSummary(
    recommendations: BestPracticesRecommendation[],
    industryInsights: any,
    expertGuidance: any,
    complianceGuidance: any
  ): Promise<any> {
    
    const criticalRecs = recommendations.filter(r => r.priority === 'critical');
    const highRecs = recommendations.filter(r => r.priority === 'high');

    return {
      overallAssessment: this.generateOverallAssessment(recommendations, industryInsights),
      keyPriorities: [
        ...criticalRecs.map(r => r.title),
        ...highRecs.slice(0, 3).map(r => r.title)
      ],
      nextSteps: [
        'Review critical recommendations first',
        'Validate industry insights with internal stakeholders',
        'Develop implementation timeline for high-priority items',
        'Consider compliance requirements in contract modifications'
      ]
    };
  }

  /**
   * Build worker-specific recommendation prompt
   */
  private buildRecommendationPrompt(
    content: string,
    workerType: string,
    context: BestPracticesContext,
    analysisResults?: any
  ): string {
    
    const basePrompt = `Analyze this ${context.contractType} contract and provide expert ${workerType} recommendations:

Contract Content: ${content.substring(0, 2500)}...

Analysis Results: ${JSON.stringify(analysisResults, null, 2)}

Context:
- Industry: ${context.industry || 'General'}
- Contract Value: ${context.contractValue ? `$${context.contractValue.toLocaleString()}` : 'Unknown'}
- Risk Profile: ${context.riskProfile || 'Medium'}
- Complexity: ${context.complexity || 'Moderate'}

Provide specific, actionable recommendations that add value beyond the basic analysis.`;

    const workerSpecificGuidance = this.getWorkerSpecificGuidance(workerType);
    
    return `${basePrompt}\n\n${workerSpecificGuidance}\n\nReturn recommendations in JSON format with the BestPracticesRecommendation structure.`;
  }

  /**
   * Get system prompt for specific worker type
   */
  private getSystemPromptForWorker(workerType: string): string {
    const prompts = {
      financial: 'You are a senior financial analyst and contract specialist with expertise in optimizing payment terms, cost structures, and financial risk management.',
      
      overview: 'You are a senior contract manager with extensive experience in contract strategy, structure optimization, and business relationship management.',
      
      clauses: 'You are a senior contract attorney specializing in clause drafting, legal risk assessment, and contractual language optimization.',
      
      compliance: 'You are a compliance expert with deep knowledge of regulatory requirements, industry standards, and legal compliance frameworks.',
      
      risk: 'You are a risk management specialist with expertise in identifying, assessing, and mitigating contractual risks across various industries.',
      
      rates: 'You are a pricing strategist and market analyst with expertise in rate optimization, benchmarking, and competitive pricing strategies.',
      
      template: 'You are a contract standardization expert with experience in template development, document automation, and process optimization.'
    };

    return prompts[workerType as keyof typeof prompts] || 'You are a senior contract expert with broad experience across all aspects of contract management.';
  }

  /**
   * Get worker-specific guidance for recommendations
   */
  private getWorkerSpecificGuidance(workerType: string): string {
    const guidance = {
      financial: `Focus on:
- Payment term optimization strategies
- Cost structure improvements
- Currency and inflation protection
- Financial risk mitigation
- Industry payment benchmarks
- Cash flow optimization
- Invoice and billing best practices`,

      overview: `Focus on:
- Contract structure optimization
- Relationship management strategies
- Performance measurement frameworks
- Communication protocols
- Governance structures
- Strategic alignment opportunities
- Partnership development`,

      clauses: `Focus on:
- Clause optimization and standardization
- Legal risk reduction strategies
- Industry-standard language recommendations
- Missing critical clauses
- Ambiguous terms clarification
- Enforceability improvements
- Dispute prevention mechanisms`,

      compliance: `Focus on:
- Regulatory compliance requirements
- Industry standard adherence
- Certification and audit needs
- Documentation requirements
- Reporting obligations
- Privacy and data protection
- Environmental and social governance`,

      risk: `Focus on:
- Risk identification and assessment
- Mitigation strategy recommendations
- Insurance and indemnification
- Contingency planning
- Performance guarantees
- Exit strategies
- Crisis management protocols`,

      rates: `Focus on:
- Market rate benchmarking
- Pricing model optimization
- Rate escalation strategies
- Volume discount opportunities
- Performance-based pricing
- Competitive positioning
- Value-based pricing recommendations`,

      template: `Focus on:
- Template standardization opportunities
- Process automation recommendations
- Document consistency improvements
- Version control strategies
- Approval workflow optimization
- Training and adoption strategies
- Efficiency enhancement opportunities`
    };

    return guidance[workerType as keyof typeof guidance] || 'Focus on general contract optimization and best practices.';
  }

  /**
   * Initialize knowledge base with industry and contract type data
   */
  private initializeKnowledgeBase(): void {
    // Initialize industry-specific knowledge
    this.industryKnowledge.set('technology', {
      commonRisks: ['IP infringement', 'data breaches', 'technology obsolescence'],
      standardClauses: ['IP ownership', 'data protection', 'SLA requirements'],
      benchmarks: { paymentTerms: 'Net 30', warrantyPeriod: '12 months' }
    });

    this.industryKnowledge.set('healthcare', {
      commonRisks: ['regulatory compliance', 'patient privacy', 'liability'],
      standardClauses: ['HIPAA compliance', 'FDA regulations', 'medical liability'],
      benchmarks: { paymentTerms: 'Net 45', warrantyPeriod: '24 months' }
    });

    // Initialize contract type templates
    this.contractTypeTemplates.set('service-agreement', {
      criticalClauses: ['scope of work', 'payment terms', 'termination', 'IP ownership'],
      commonIssues: ['unclear deliverables', 'missing SLAs', 'inadequate termination clauses']
    });
  }

  /**
   * Generate overall assessment based on all recommendations
   */
  private generateOverallAssessment(
    recommendations: BestPracticesRecommendation[],
    industryInsights: any
  ): string {
    const criticalCount = recommendations.filter(r => r.priority === 'critical').length;
    const highCount = recommendations.filter(r => r.priority === 'high').length;

    if (criticalCount > 0) {
      return `Contract requires immediate attention with ${criticalCount} critical issue(s) identified. Priority should be given to addressing fundamental risks and compliance requirements.`;
    } else if (highCount > 3) {
      return `Contract shows good foundation but has ${highCount} high-priority improvement opportunities. Focus on optimization and risk mitigation.`;
    } else {
      return `Contract demonstrates solid structure with manageable improvement opportunities. Consider implementing suggested enhancements for optimal performance.`;
    }
  }
}

export const bestPracticesEngine = new BestPracticesEngine();