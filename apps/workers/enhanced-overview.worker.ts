/**
 * Enhanced Overview Worker with Best Practices
 * Provides strategic contract overview with expert recommendations
 */

import { Job } from 'bullmq';
import { OpenAI } from 'openai';

export interface OverviewBestPractices {
  strategicGuidance: string[];
  relationshipManagement: string[];
  performanceOptimization: string[];
  governanceRecommendations: string[];
  communicationProtocols: string[];
  riskMitigationStrategies: string[];
}

export interface EnhancedOverviewResult {
  summary: string;
  parties: string[];
  keyTerms: string[];
  contractType: string;
  insights: string[];
  riskFactors: string[];
  bestPractices: OverviewBestPractices;
  confidence: number;
  processingTime: number;
}

export class EnhancedOverviewWorker {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY']
    });
  }

  async process(job: Job): Promise<void> {
    const startTime = Date.now();
    const { documentId, tenantId, content, title } = job.data;

    try {
      console.log(`📋 Starting enhanced overview analysis for document ${documentId}`);

      // Extract basic overview information
      const basicOverview = await this.extractBasicOverview(content, title);
      await job.updateProgress(40);

      // Generate strategic insights
      const insights = await this.generateStrategicInsights(content, basicOverview);
      await job.updateProgress(60);

      // Generate best practices recommendations
      const bestPractices = await this.generateOverviewBestPractices(content, basicOverview, insights);
      await job.updateProgress(80);

      // Create enhanced result
      const result: EnhancedOverviewResult = {
        summary: basicOverview.summary || 'Contract overview not available',
        parties: basicOverview.parties || [],
        keyTerms: basicOverview.keyTerms || [],
        contractType: basicOverview.contractType || 'Unknown',
        riskFactors: basicOverview.riskFactors || [],
        confidence: basicOverview.confidence || 0.5,
        insights,
        bestPractices,
        processingTime: Date.now() - startTime
      };

      // Store results and create artifacts
      await this.storeOverviewResults(documentId, tenantId, result);
      await this.createOverviewArtifacts(documentId, tenantId, result);

      await job.updateProgress(100);
      console.log(`✅ Enhanced overview analysis completed for document ${documentId}`);

    } catch (error) {
      console.error(`❌ Enhanced overview analysis failed for document ${documentId}:`, error);
      throw error;
    }
  }

  private async extractBasicOverview(content: string, title?: string): Promise<Partial<EnhancedOverviewResult>> {
    const prompt = `As a senior contract manager, analyze this contract and provide a comprehensive overview:

Contract Title: ${title || 'Not specified'}
Contract Content: ${content.substring(0, 4000)}...

Extract and provide:
1. Executive summary (2-3 sentences)
2. Contracting parties
3. Contract type/category
4. Key terms and provisions
5. Overall confidence in analysis (0-1)

Return JSON format:
{
  "summary": "Executive summary",
  "parties": ["Party 1", "Party 2"],
  "contractType": "Service Agreement",
  "keyTerms": ["term1", "term2", "term3"],
  "confidence": 0.85
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a senior contract manager with 15+ years of experience in contract analysis and strategic business relationships.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0]?.message?.content || '{}');
  }

  private async generateStrategicInsights(content: string, overview: any): Promise<string[]> {
    const prompt = `As a strategic business consultant, provide high-level insights about this contract relationship:

Contract Overview: ${JSON.stringify(overview, null, 2)}
Contract Content: ${content.substring(0, 3000)}...

Provide 5-7 strategic insights that go beyond basic contract terms, focusing on:
- Business relationship dynamics
- Strategic opportunities
- Market positioning
- Partnership potential
- Operational considerations

Return as JSON array: ["insight1", "insight2", ...]`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a strategic business consultant specializing in contract relationships and partnership optimization.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{"insights": []}');
    return result.insights || [];
  }

  private async generateOverviewBestPractices(
    content: string,
    overview: any,
    insights: string[]
  ): Promise<OverviewBestPractices> {
    const prompt = `As a senior contract manager and relationship strategist, provide expert best practices for this contract:

OVERVIEW: ${JSON.stringify(overview, null, 2)}
INSIGHTS: ${insights.join(' | ')}
CONTRACT: ${content.substring(0, 2500)}...

Provide specific, actionable recommendations in these categories:

1. STRATEGIC GUIDANCE: High-level strategic recommendations for contract success
2. RELATIONSHIP MANAGEMENT: Best practices for managing the business relationship
3. PERFORMANCE OPTIMIZATION: Ways to optimize contract performance and outcomes
4. GOVERNANCE RECOMMENDATIONS: Governance structures and oversight mechanisms
5. COMMUNICATION PROTOCOLS: Communication strategies and protocols
6. RISK MITIGATION STRATEGIES: Proactive risk management approaches

Return JSON format:
{
  "strategicGuidance": ["guidance1", "guidance2", ...],
  "relationshipManagement": ["practice1", "practice2", ...],
  "performanceOptimization": ["optimization1", "optimization2", ...],
  "governanceRecommendations": ["governance1", "governance2", ...],
  "communicationProtocols": ["protocol1", "protocol2", ...],
  "riskMitigationStrategies": ["strategy1", "strategy2", ...]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a senior partner at a management consulting firm specializing in contract strategy, relationship management, and business partnership optimization with 20+ years of experience.'
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

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        strategicGuidance: result.strategicGuidance || [
          'Align contract objectives with broader business strategy',
          'Establish clear success metrics and KPIs for contract performance'
        ],
        relationshipManagement: result.relationshipManagement || [
          'Schedule regular relationship review meetings with key stakeholders',
          'Implement feedback mechanisms for continuous improvement'
        ],
        performanceOptimization: result.performanceOptimization || [
          'Establish baseline performance metrics for ongoing monitoring',
          'Consider performance-based incentives for enhanced outcomes'
        ],
        governanceRecommendations: result.governanceRecommendations || [
          'Implement formal contract governance committee structure',
          'Establish clear escalation procedures for contract issues'
        ],
        communicationProtocols: result.communicationProtocols || [
          'Define communication cadence and channels for all parties',
          'Implement standardized reporting and documentation procedures'
        ],
        riskMitigationStrategies: result.riskMitigationStrategies || [
          'Develop comprehensive risk monitoring and mitigation plan',
          'Establish contingency procedures for critical contract dependencies'
        ]
      };

    } catch (error) {
      console.error('Error generating overview best practices:', error);
      return this.getFallbackOverviewBestPractices();
    }
  }

  private getFallbackOverviewBestPractices(): OverviewBestPractices {
    return {
      strategicGuidance: [
        'Ensure contract aligns with long-term business objectives',
        'Consider strategic partnership opportunities beyond basic terms',
        'Evaluate contract contribution to competitive advantage'
      ],
      relationshipManagement: [
        'Establish regular stakeholder communication cadence',
        'Implement relationship health monitoring mechanisms',
        'Create feedback loops for continuous relationship improvement'
      ],
      performanceOptimization: [
        'Define clear performance metrics and success criteria',
        'Implement regular performance review processes',
        'Consider performance-based contract modifications'
      ],
      governanceRecommendations: [
        'Establish contract governance committee with clear roles',
        'Implement formal change management procedures',
        'Create escalation matrix for contract issues'
      ],
      communicationProtocols: [
        'Define communication standards and documentation requirements',
        'Establish regular reporting schedules and formats',
        'Implement conflict resolution communication procedures'
      ],
      riskMitigationStrategies: [
        'Develop comprehensive contract risk assessment framework',
        'Implement proactive risk monitoring and early warning systems',
        'Establish contingency plans for critical contract dependencies'
      ]
    };
  }

  private async storeOverviewResults(_documentId: string, _tenantId: string, _result: EnhancedOverviewResult): Promise<void> {
    // TODO: Implement database storage
  }

  private async createOverviewArtifacts(_documentId: string, _tenantId: string, _result: EnhancedOverviewResult): Promise<void> {
    // TODO: Implement artifact creation
  }
}

export const enhancedOverviewWorker = new EnhancedOverviewWorker();