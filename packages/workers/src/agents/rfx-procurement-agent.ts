/**
 * RFx Procurement Agent
 * 
 * Manages Request for Proposal (RFP), Request for Quote (RFQ), 
 * Request for Information (RFI), and auction-based sourcing events.
 * 
 * Capabilities:
 * - Create RFx events from contract requirements
 * - Generate vendor shortlists based on historical data
 * - Compare bids side-by-side with AI scoring
 * - Recommend award decisions with justification
 * - Negotiate with vendors using counter-offer suggestions
 * 
 * @version 1.0.0
 */

import { BaseAgent } from './base-agent';
import type { AgentInput, AgentOutput, AgentEvent } from './types';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type RFxType = 'RFP' | 'RFQ' | 'RFI' | 'Auction' | 'RFT';

export interface RFxEvent {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  type: RFxType;
  status: 'draft' | 'published' | 'open' | 'closed' | 'awarded' | 'cancelled';
  
  // Scope
  category?: string;
  contractType?: string;
  estimatedValue?: number;
  currency?: string;
  
  // Timeline
  publishDate?: Date;
  responseDeadline: Date;
  awardDate?: Date;
  contractStartDate?: Date;
  
  // Requirements
  requirements: RFxRequirement[];
  evaluationCriteria: EvaluationCriterion[];
  
  // Vendors
  invitedVendors: string[];
  responses: VendorResponse[];
  
  // Results
  winner?: string;
  awardJustification?: string;
  savingsAchieved?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RFxRequirement {
  id: string;
  category: 'technical' | 'commercial' | 'legal' | 'delivery' | 'quality';
  description: string;
  mandatory: boolean;
  weight: number;
  acceptanceCriteria?: string;
}

export interface EvaluationCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  scoringMethod: 'points' | 'pass_fail' | 'weighted';
  maxScore: number;
}

export interface VendorResponse {
  vendorId: string;
  vendorName: string;
  submittedAt: Date;
  status: 'draft' | 'submitted' | 'under_review' | 'shortlisted' | 'rejected';
  
  // Response data
  technicalResponse?: Record<string, unknown>;
  commercialResponse?: {
    totalPrice: number;
    breakdown: Array<{ item: string; quantity: number; unitPrice: number; total: number }>;
    paymentTerms?: string;
    deliverySchedule?: string;
  };
  
  // Evaluation
  scores?: Record<string, number>;
  totalScore?: number;
  ranking?: number;
  strengths?: string[];
  weaknesses?: string[];
  
  // Clarifications
  clarifications?: Array<{ question: string; answer: string; date: Date }>;
}

export interface VendorProfile {
  id: string;
  name: string;
  categories: string[];
  pastContracts: Array<{
    contractId: string;
    title: string;
    value: number;
    startDate: Date;
    endDate?: Date;
    performance: number; // 0-5 rating
  }>;
  riskScore: number;
  financialHealth: 'excellent' | 'good' | 'fair' | 'poor';
  certifications: string[];
  capacityScore: number;
}

export interface BidComparison {
  vendors: string[];
  criteria: string[];
  scores: Record<string, Record<string, number>>;
  totalScores: Record<string, number>;
  rankings: Array<{ vendor: string; score: number; rank: number }>;
  
  // Analysis
  priceAnalysis: {
    lowest: string;
    highest: string;
    average: number;
    spread: number;
  };
  
  // Recommendations
  recommendation: {
    winner: string;
    confidence: number;
    justification: string;
    alternatives: string[];
    risks: string[];
  };
}

// ============================================================================
// MAIN AGENT CLASS
// ============================================================================

export class RFxProcurementAgent extends BaseAgent {
  name = 'rfx-procurement-agent';
  version = '1.0.0';
  capabilities = [
    'rfx-creation',
    'vendor-shortlisting',
    'bid-comparison',
    'award-recommendation',
    'negotiation-support',
    'savings-analysis',
  ];

  private openai: OpenAI;

  constructor() {
    super();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // ============================================================================
  // CORE EXECUTION
  // ============================================================================

  async execute(input: AgentInput): Promise<AgentOutput> {
    const action = input.context?.action as 'create_rfx' | 'shortlist_vendors' | 'compare_bids' | 'recommend_award' | 'generate_negotiation';
    const data = (input.context?.data || {}) as Record<string, unknown>;
    
    logger.info({ action, tenantId: input.tenantId }, 'RFx Agent executing');

    try {
      let result: { success: boolean; data?: unknown; error?: string; recommendations?: string[] };
      
      switch (action) {
        case 'create_rfx':
          result = await this.createRFxEvent(input.tenantId, data);
          break;
        
        case 'shortlist_vendors':
          result = await this.shortlistVendors(input.tenantId, data);
          break;
        
        case 'compare_bids':
          result = await this.compareBids(input.tenantId, data);
          break;
        
        case 'recommend_award':
          result = await this.recommendAward(input.tenantId, data);
          break;
        
        case 'generate_negotiation':
          result = await this.generateNegotiationStrategy(input.tenantId, data);
          break;
        
        default:
          result = { success: false, error: `Unknown action: ${action}` };
      }

      return {
        success: result.success,
        confidence: result.success ? 0.85 : 0,
        data: result.data,
        reasoning: result.success ? 'RFx operation completed successfully' : (result.error || 'Operation failed'),
      };
    } catch (error) {
      logger.error({ error, action }, 'RFx Agent error');
      return {
        success: false,
        confidence: 0,
        reasoning: `RFx Agent execution failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ============================================================================
  // ACTION 1: CREATE RFX EVENT
  // ============================================================================

  private async createRFxEvent(
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; data?: RFxEvent; error?: string }> {
    const {
      title,
      description,
      type = 'RFP',
      category,
      estimatedValue,
      contractType,
      requirements: userRequirements,
      responseDeadline,
    } = data;

    if (!title || !responseDeadline) {
      return { success: false, error: 'Title and response deadline are required' };
    }

    // Generate comprehensive requirements using AI
    const aiRequirements = await this.generateRequirements(
      title as string,
      description as string,
      category as string,
      contractType as string
    );

    // Merge user requirements with AI-generated ones
    const allRequirements: RFxRequirement[] = [
      ...(userRequirements as RFxRequirement[] || []),
      ...aiRequirements,
    ];

    // Generate evaluation criteria
    const evaluationCriteria = this.generateEvaluationCriteria(type as RFxType);

    // Suggest vendors based on category
    const suggestedVendors = await this.suggestVendors(tenantId, category as string);

    const rfxEvent: RFxEvent = {
      id: uuidv4(),
      tenantId,
      title: title as string,
      description: (description as string) || '',
      type: type as RFxType,
      status: 'draft',
      category: category as string,
      contractType: contractType as string,
      estimatedValue: estimatedValue as number,
      currency: 'USD',
      responseDeadline: new Date(responseDeadline as string),
      requirements: allRequirements,
      evaluationCriteria,
      invitedVendors: suggestedVendors.map(v => v.id),
      responses: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Persist to database
    await this.persistRFxEvent(rfxEvent);

    return {
      success: true,
      data: rfxEvent,
    };
  }

  private async generateRequirements(
    title: string,
    description: string,
    category?: string,
    contractType?: string
  ): Promise<RFxRequirement[]> {
    const prompt = `Generate comprehensive RFx requirements for:
Title: ${title}
Description: ${description}
Category: ${category || 'General'}
Contract Type: ${contractType || 'Unknown'}

Generate 8-12 requirements covering:
- Technical capabilities
- Commercial terms
- Legal/compliance
- Delivery/timeline
- Quality standards

Format as JSON array:
[{
  "category": "technical|commercial|legal|delivery|quality",
  "description": "requirement text",
  "mandatory": true/false,
  "weight": 1-10,
  "acceptanceCriteria": "how to evaluate"
}]`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const parsed = JSON.parse(content);
      return (parsed.requirements || []).map((r: any) => ({
        id: uuidv4(),
        ...r,
      }));
    } catch (error) {
      logger.warn({ error }, 'Failed to generate AI requirements');
      return this.getDefaultRequirements();
    }
  }

  private getDefaultRequirements(): RFxRequirement[] {
    return [
      {
        id: uuidv4(),
        category: 'technical',
        description: 'Vendor must demonstrate relevant technical expertise and capabilities',
        mandatory: true,
        weight: 8,
        acceptanceCriteria: 'Provide case studies or references from similar projects',
      },
      {
        id: uuidv4(),
        category: 'commercial',
        description: 'Pricing must be competitive and within budget constraints',
        mandatory: true,
        weight: 7,
        acceptanceCriteria: 'Total cost must not exceed 110% of estimated budget',
      },
      {
        id: uuidv4(),
        category: 'legal',
        description: 'Vendor must accept standard contractual terms and conditions',
        mandatory: true,
        weight: 6,
        acceptanceCriteria: 'Signed acceptance of terms or documented exceptions',
      },
      {
        id: uuidv4(),
        category: 'delivery',
        description: 'Vendor must meet required delivery timeline',
        mandatory: true,
        weight: 7,
        acceptanceCriteria: 'Confirmed delivery schedule within required timeframe',
      },
    ];
  }

  private generateEvaluationCriteria(type: RFxType): EvaluationCriterion[] {
    const baseCriteria = [
      { name: 'Technical Capability', weight: 30, scoringMethod: 'points' as const, maxScore: 100 },
      { name: 'Commercial Terms', weight: 25, scoringMethod: 'points' as const, maxScore: 100 },
      { name: 'Delivery Schedule', weight: 20, scoringMethod: 'points' as const, maxScore: 100 },
      { name: 'Quality Assurance', weight: 15, scoringMethod: 'points' as const, maxScore: 100 },
      { name: 'Risk Profile', weight: 10, scoringMethod: 'points' as const, maxScore: 100 },
    ];

    // Adjust weights based on RFx type
    if (type === 'RFQ') {
      baseCriteria[1]!.weight = 40; // Commercial more important for quotes
      baseCriteria[0]!.weight = 20;
    } else if (type === 'RFI') {
      baseCriteria[0]!.weight = 50; // Technical more important for information
    }

    return baseCriteria.map(c => ({
      id: uuidv4(),
      name: c.name,
      description: `Evaluate vendor ${c.name.toLowerCase()}`,
      weight: c.weight,
      scoringMethod: c.scoringMethod,
      maxScore: c.maxScore,
    }));
  }

  // ============================================================================
  // ACTION 2: VENDOR SHORTLISTING
  // ============================================================================

  private async shortlistVendors(
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; data?: VendorProfile[]; error?: string }> {
    const { category, requiredCapabilities, minPerformance, excludeCurrent } = data;

    // Build exclusion list from current vendor names
    const excludeList = excludeCurrent && Array.isArray(excludeCurrent)
      ? (excludeCurrent as string[])
      : [];

    // Get vendors from contract history
    const vendorContracts = await prisma.contract.groupBy({
      by: ['supplierName'],
      where: {
        tenantId,
        supplierName: { not: null },
        ...(excludeList.length > 0 ? { supplierName: { notIn: excludeList } } : {}),
      },
      _count: { id: true },
      _sum: { totalValue: true },
    }) as Array<{ supplierName: string; _count: { id: number }; _sum: { totalValue: number | null } }>;

    // Build vendor profiles
    const vendors: VendorProfile[] = await Promise.all(
      vendorContracts.map(async (vc) => {
        const contracts = await prisma.contract.findMany({
          where: {
            tenantId,
            supplierName: vc.supplierName,
          },
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            totalValue: true,
            effectiveDate: true,
            expirationDate: true,
            riskScore: true,
          },
          take: 10,
        });

        // Derive categories from contract types
        const categories = [...new Set(
          contracts
            .map((c: any) => c.contractType)
            .filter(Boolean)
        )] as string[];

        // Compute average risk score from actual contract data when available
        const riskScores = contracts.map((c: any) => c.riskScore).filter((s: any) => typeof s === 'number');
        const avgRisk = riskScores.length > 0
          ? riskScores.reduce((sum: number, s: number) => sum + s, 0) / riskScores.length
          : 0.3;

        return {
          id: uuidv4(),
          name: vc.supplierName,
          categories,
          pastContracts: contracts.map((c: { id: string; contractTitle: string | null; totalValue: number | null; effectiveDate: Date | null; expirationDate: Date | null }) => ({
            contractId: c.id,
            title: c.contractTitle || '',
            value: Number(c.totalValue) || 0,
            startDate: c.effectiveDate || new Date(),
            endDate: c.expirationDate || undefined,
            performance: 4.0, // Default, would come from actual ratings
          })),
          riskScore: avgRisk,
          financialHealth: avgRisk < 0.3 ? 'excellent' : avgRisk < 0.5 ? 'good' : avgRisk < 0.7 ? 'fair' : 'poor',
          certifications: [],
          capacityScore: Math.min(1, vc._count.id / 10), // Capacity based on historical contract count
        };
      })
    );

    // Filter and rank
    const ranked = vendors
      .filter(v => {
        if (minPerformance && v.pastContracts.length > 0) {
          const avgPerformance = v.pastContracts.reduce((sum, c) => sum + c.performance, 0) / v.pastContracts.length;
          return avgPerformance >= (minPerformance as number);
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by total contract value (proxy for vendor size/experience)
        const aValue = a.pastContracts.reduce((sum, c) => sum + c.value, 0);
        const bValue = b.pastContracts.reduce((sum, c) => sum + c.value, 0);
        return bValue - aValue;
      })
      .slice(0, 10);

    return { success: true, data: ranked };
  }

  private async suggestVendors(tenantId: string, category?: string): Promise<VendorProfile[]> {
    const result = await this.shortlistVendors(tenantId, { category });
    return result.data || [];
  }

  // ============================================================================
  // ACTION 3: BID COMPARISON
  // ============================================================================

  private async compareBids(
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; data?: BidComparison; error?: string }> {
    const { rfxId, responses } = data;

    if (!responses || !Array.isArray(responses) || responses.length < 2) {
      return { success: false, error: 'At least 2 vendor responses required for comparison' };
    }

    const vendorResponses = responses as VendorResponse[];
    const vendors = vendorResponses.map(r => r.vendorName);

    // Calculate scores for each vendor across criteria
    const scores: Record<string, Record<string, number>> = {};
    const totalScores: Record<string, number> = {};

    for (const response of vendorResponses) {
      scores[response.vendorName] = response.scores || {};
      totalScores[response.vendorName] = response.totalScore || 0;
    }

    // Rank vendors
    const rankings = Object.entries(totalScores)
      .sort(([, a], [, b]) => b - a)
      .map(([vendor, score], index) => ({
        vendor,
        score,
        rank: index + 1,
      }));

    // Price analysis
    const prices = vendorResponses
      .filter(r => r.commercialResponse?.totalPrice !== undefined)
      .map(r => ({ vendor: r.vendorName, price: r.commercialResponse!.totalPrice }));

    const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
    const priceValues = prices.map(p => p.price);
    const lowestPrice = sortedPrices[0];
    const highestPrice = sortedPrices[sortedPrices.length - 1];
    const priceAnalysis = {
      lowest: lowestPrice?.vendor ?? '',
      highest: highestPrice?.vendor ?? '',
      average: prices.length > 0 ? prices.reduce((sum, p) => sum + p.price, 0) / prices.length : 0,
      spread: prices.length > 0 ? Math.max(...priceValues) - Math.min(...priceValues) : 0,
    };

    // Generate AI recommendation
    const recommendation = await this.generateAwardRecommendation(
      vendorResponses,
      rankings,
      priceAnalysis
    );

    const firstVendor = vendors[0];
    const comparison: BidComparison = {
      vendors,
      criteria: firstVendor ? Object.keys(scores[firstVendor] || {}) : [],
      scores,
      totalScores,
      rankings,
      priceAnalysis,
      recommendation,
    };

    return { success: true, data: comparison };
  }

  private async generateAwardRecommendation(
    responses: VendorResponse[],
    rankings: Array<{ vendor: string; score: number; rank: number }>,
    priceAnalysis: { lowest: string; highest: string; average: number; spread: number }
  ): Promise<BidComparison['recommendation']> {
    const prompt = `As a procurement expert, recommend the winning vendor for this RFx:

Vendor Rankings:
${rankings.map(r => `- ${r.vendor}: Score ${r.score.toFixed(2)}, Rank #${r.rank}`).join('\n')}

Price Analysis:
- Lowest: ${priceAnalysis.lowest}
- Highest: ${priceAnalysis.highest}
- Average: $${priceAnalysis.average.toFixed(2)}
- Spread: $${priceAnalysis.spread.toFixed(2)}

Vendor Details:
${responses.map(r => `- ${r.vendorName}: ${r.strengths?.join(', ') || 'N/A'}`).join('\n')}

Provide recommendation as JSON:
{
  "winner": "vendor name",
  "confidence": 0-1,
  "justification": "detailed explanation",
  "alternatives": ["alternative vendor"],
  "risks": ["potential risk 1", "potential risk 2"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      return JSON.parse(content) as BidComparison['recommendation'];
    } catch (error) {
      logger.warn({ error }, 'Failed to generate AI recommendation');
      
      // Fallback: recommend highest scorer
      const winner = rankings[0];
      if (!winner) {
        return {
          winner: '',
          confidence: 0,
          justification: 'No valid rankings available for recommendation',
          alternatives: [],
          risks: ['Unable to determine winner - manual review required'],
        };
      }
      return {
        winner: winner.vendor,
        confidence: 0.7,
        justification: `Recommended based on highest overall score (${winner.score.toFixed(2)})`,
        alternatives: rankings.slice(1, 3).map(r => r.vendor),
        risks: ['Recommendation based on scoring only - manual review advised'],
      };
    }
  }

  // ============================================================================
  // ACTION 4: AWARD RECOMMENDATION
  // ============================================================================

  private async recommendAward(
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    // This is essentially the same as compare_bids but with more detailed output
    const comparisonResult = await this.compareBids(tenantId, data);
    
    if (!comparisonResult.success) {
      return comparisonResult;
    }

    const comparison = comparisonResult.data!;

    // Generate award justification document
    const awardDocument = await this.generateAwardJustification(comparison);

    return {
      success: true,
      data: {
        comparison,
        awardDocument,
        nextSteps: [
          'Review award justification with legal team',
          'Notify winning vendor',
          'Prepare contract draft',
          'Send regret letters to other vendors',
          'Archive RFx documentation',
        ],
      },
    };
  }

  private async generateAwardJustification(comparison: BidComparison): Promise<string> {
    const prompt = `Generate a professional award justification document:

Winner: ${comparison.recommendation.winner}
Confidence: ${(comparison.recommendation.confidence * 100).toFixed(0)}%

Rankings:
${comparison.rankings.map(r => `${r.rank}. ${r.vendor}: ${r.score.toFixed(2)} points`).join('\n')}

Price Analysis:
- Lowest bidder: ${comparison.priceAnalysis.lowest}
- Average bid: $${comparison.priceAnalysis.average.toFixed(2)}
- Price spread: $${comparison.priceAnalysis.spread.toFixed(2)}

Justification: ${comparison.recommendation.justification}

Risks: ${comparison.recommendation.risks.join(', ')}

Generate a formal 2-3 paragraph award justification suitable for procurement records.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0]?.message?.content || 'Award justification pending.';
  }

  // ============================================================================
  // ACTION 5: NEGOTIATION SUPPORT
  // ============================================================================

  private async generateNegotiationStrategy(
    tenantId: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const { vendorName, currentBid, targetPrice, rfxRequirements } = data;

    const prompt = `As a negotiation expert, provide strategy for this procurement negotiation:

Vendor: ${vendorName}
Current Bid: $${Number(currentBid).toFixed(2)}
Target Price: $${Number(targetPrice).toFixed(2)}
Gap: ${((1 - Number(targetPrice) / Number(currentBid)) * 100).toFixed(1)}%

Requirements:
${(rfxRequirements as string[] || []).map(r => `- ${r}`).join('\n')}

Provide:
1. Opening position
2. Key negotiation levers
3. Concession strategy
4. Walk-away price
5. Counter-offer suggestions

Format as JSON:
{
  "openingPosition": "...",
  "keyLevers": ["..."],
  "concessionStrategy": "...",
  "walkAwayPrice": number,
  "counterOffers": [{"amount": number, "justification": "..."}]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response');

      const strategy = JSON.parse(content);

      return {
        success: true,
        data: {
          strategy,
          estimatedSavings: Number(currentBid) - strategy.walkAwayPrice,
          negotiationPoints: strategy.keyLevers,
          suggestedTimeline: '2-3 rounds of negotiation over 1-2 weeks',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate negotiation strategy: ${error}`,
      };
    }
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  private async persistRFxEvent(event: RFxEvent): Promise<void> {
    try {
      // Store in database using Prisma typed API (avoids raw SQL fragility)
      await prisma.rFxEvent.upsert({
        where: { id: event.id },
        create: {
          id: event.id,
          tenantId: event.tenantId,
          title: event.title,
          description: event.description,
          type: event.type,
          status: event.status,
          category: event.category || null,
          contractType: event.contractType || null,
          estimatedValue: event.estimatedValue || null,
          currency: event.currency,
          responseDeadline: event.responseDeadline,
          requirements: event.requirements as any,
          evaluationCriteria: event.evaluationCriteria as any,
          invitedVendors: event.invitedVendors,
          responses: event.responses as any,
        },
        update: {
          status: event.status,
          responses: event.responses as any,
          winner: event.winner || undefined,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      // If table doesn't exist, just log - the event is returned to caller
      logger.warn({ error }, 'Failed to persist RFx event - model may not be available');
    }
  }

  // ============================================================================
  // EVENT EMITTERS
  // ============================================================================

  protected getEventType(): AgentEvent['eventType'] {
    return 'rfx_processed' as AgentEvent['eventType'];
  }
}

// Export singleton
export const rfxProcurementAgent = new RFxProcurementAgent();
