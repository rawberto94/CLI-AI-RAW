/**
 * Enhanced Benchmark Worker with LLM and RAG Integration
 * Provides comprehensive market benchmarking with expert intelligence
 */

// Import shared utilities
import { 
  getSharedLLMClient, 
  EXPERT_PERSONAS, 
  createProvenance,
  isLLMAvailable 
} from './shared/llm-utils';
import { 
  getSharedDatabaseClient 
} from './shared/database-utils';
import { 
  RAGIntegration 
} from './shared/rag-utils';
import { 
  BestPracticesGenerator,
  BestPracticesCategory 
} from './shared/best-practices-utils';

// Import schemas
import pkg from 'schemas';
const { BenchmarkArtifactV1Schema } = pkg;

// Initialize shared clients
const llmClient = getSharedLLMClient();
const dbClient = getSharedDatabaseClient();

export interface BenchmarkBestPractices {
  marketPositioning: MarketPositioning[];
  competitiveAnalysis: CompetitiveAnalysis[];
  pricingStrategy: PricingStrategy[];
  valueOptimization: ValueOptimization[];
  negotiationInsights: NegotiationInsight[];
  industryTrends: IndustryTrend[];
}

export interface MarketPositioning {
  category: string;
  currentPosition: string;
  marketAverage: string;
  topQuartile: string;
  positioningStrategy: string;
  competitiveAdvantage: string;
  improvementOpportunities: string[];
  timeline: string;
  successMetrics: string[];
}

export interface CompetitiveAnalysis {
  competitorSegment: string;
  competitiveFactors: string[];
  strengthsVsCompetitors: string[];
  weaknessesVsCompetitors: string[];
  differentiationOpportunities: string[];
  competitiveResponse: string;
  marketShareImpact: string;
}

export interface PricingStrategy {
  pricingModel: string;
  currentApproach: string;
  marketBasedPricing: string;
  valueBasedPricing: string;
  competitivePricing: string;
  recommendedStrategy: string;
  implementationSteps: string[];
  riskFactors: string[];
}

export interface ValueOptimization {
  valueDriver: string;
  currentValue: string;
  optimizationOpportunity: string;
  enhancementStrategy: string;
  investmentRequired: string;
  expectedReturn: string;
  timeToValue: string;
  measurementApproach: string;
}

export interface NegotiationInsight {
  negotiationPoint: string;
  marketLeverage: string;
  negotiationStrategy: string;
  supportingData: string[];
  counterarguments: string[];
  fallbackPositions: string[];
  successProbability: string;
}

export interface IndustryTrend {
  trendCategory: string;
  trendDescription: string;
  marketImpact: string;
  opportunityAssessment: string;
  adaptationStrategy: string;
  timeline: string;
  preparationSteps: string[];
}

export async function runBenchmark(job: { data: { docId: string; tenantId?: string } }) {
  const { docId, tenantId } = job.data;
  console.log(`📊 [worker:benchmark] Starting enhanced benchmark analysis for ${docId}`);
  const startTime = Date.now();
  
  try {
    // Get contract to ensure we have tenantId
    const contract = await db.contract.findUnique({ where: { id: docId } });
    if (!contract) throw new Error(`Contract ${docId} not found`);
    
    const contractTenantId = tenantId || contract.tenantId;
    
    // Get existing artifacts for comprehensive analysis
    const rates = await db.artifact.findFirst({ 
      where: { contractId: docId, type: 'RATES' }, 
      orderBy: { createdAt: 'desc' } 
    });
    const financial = await db.artifact.findFirst({ 
      where: { contractId: docId, type: 'FINANCIAL' }, 
      orderBy: { createdAt: 'desc' } 
    });
    const ingestion = await db.artifact.findFirst({ 
      where: { contractId: docId, type: 'INGESTION' }, 
      orderBy: { createdAt: 'desc' } 
    });
    
    const text = String((ingestion?.data as any)?.content || '');
    const ratesData = (rates?.data as any)?.rates || [];
    const financialData = (financial?.data as any)?.financialTerms || [];
    
    let benchmarks: any[] = [];
    let client: any = null;
    let confidenceScore = 0;
    
    const apiKey = process.env['OPENAI_API_KEY'];
    const model = process.env['OPENAI_MODEL'] || 'gpt-4o';
    
    if (apiKey && OpenAI && text.trim().length > 0) {
      try {
        client = new OpenAI({ apiKey });
        console.log('🧠 Analyzing market benchmarks with GPT-4 expert system...');
        
        const benchmarkAnalysis = await performAdvancedBenchmarkAnalysis(
          client, 
          text, 
          ratesData, 
          financialData, 
          model
        );
        benchmarks = benchmarkAnalysis.benchmarks;
        confidenceScore = benchmarkAnalysis.confidenceScore;
        
        console.log(`✅ GPT-4 identified ${benchmarks.length} benchmarks with ${confidenceScore}% confidence`);
        
      } catch (error) {
        console.warn(`⚠️ LLM benchmark analysis failed for ${docId}:`, error);
      }
    }
    
    // Enhanced fallback benchmark analysis if LLM fails
    if (benchmarks.length === 0) {
      console.log(`🔄 Falling back to enhanced heuristic benchmark analysis for ${docId}`);
      const fallbackResult = performFallbackBenchmarkAnalysis(ratesData, financialData);
      benchmarks = fallbackResult.benchmarks;
      confidenceScore = fallbackResult.confidenceScore;
    }
    
    // Generate comprehensive benchmark best practices
    let bestPractices: BenchmarkBestPractices | null = null;
    if (client && benchmarks.length > 0) {
      try {
        console.log('📋 Generating expert benchmark best practices...');
        bestPractices = await generateBenchmarkBestPractices(client, benchmarks, text);
      } catch (error) {
        console.warn(`⚠️ Best practices generation failed for ${docId}:`, error);
      }
    }

  const artifact = BenchmarkArtifactV1Schema.parse({
    metadata: { docId, fileType: 'pdf', totalPages: 1, ocrRate: 0, provenance: [{ worker: 'benchmark', timestamp: new Date().toISOString(), durationMs: Date.now() - startTime }] },
    benchmarks,
  });

  await db.artifact.create({
    data: {
      contractId: docId,
      type: 'BENCHMARK',
      data: artifact as any,
      tenantId: contractTenantId,
    },
  });

  console.log(`[worker:benchmark] Finished benchmark analysis for ${docId}`);
  return { docId };
}
    const artifact = BenchmarkArtifactV1Schema.parse({
      metadata: {
        docId,
        fileType: 'pdf',
        totalPages: 1,
        ocrRate: 0,
        provenance: [{ 
          worker: 'benchmark', 
          timestamp: new Date().toISOString(), 
          durationMs: Date.now() - startTime,
          model: model,
          confidenceScore: confidenceScore
        }],
      },
      benchmarks,
      confidenceScore,
      bestPractices: bestPractices
    });

    await db.artifact.create({
      data: {
        contractId: docId,
        type: 'BENCHMARK',
        data: artifact as any,
        tenantId: contractTenantId,
      },
    });

    console.log(`🎯 Finished enhanced benchmark analysis for ${docId} (${benchmarks.length} benchmarks identified)`);
    return { docId, benchmarksIdentified: benchmarks.length };
    
  } catch (error) {
    console.error(`❌ Benchmark analysis failed for ${docId}:`, error);
    throw error;
  }
}

/**
 * Perform advanced benchmark analysis using GPT-4
 */
async function performAdvancedBenchmarkAnalysis(
  client: any,
  contractText: string,
  ratesData: any[],
  financialData: any[],
  model: string
): Promise<{ benchmarks: any[], confidenceScore: number }> {
  
  const benchmarkAnalysisPrompt = `
You are a senior market research analyst and pricing strategist with 20+ years of experience in competitive benchmarking, market analysis, and strategic pricing across multiple industries.

Analyze the provided contract data to generate comprehensive market benchmarks and competitive positioning insights.

**BENCHMARK ANALYSIS CATEGORIES:**

**RATE BENCHMARKING:**
1. Role-based rate comparisons
2. Market percentile positioning
3. Geographic rate variations
4. Industry-specific benchmarks
5. Skill level and seniority adjustments

**FINANCIAL BENCHMARKING:**
6. Total contract value positioning
7. Payment terms competitiveness
8. Fee structure comparisons
9. Cost allocation benchmarks
10. Financial risk vs. market standards

**COMPETITIVE POSITIONING:**
11. Service delivery model benchmarks
12. Quality and performance standards
13. Contract terms competitiveness
14. Value proposition analysis
15. Market differentiation factors

**INDUSTRY BENCHMARKS:**
16. Industry-specific rate standards
17. Market maturity indicators
18. Technology and skill premiums
19. Regional market variations
20. Seasonal and cyclical factors

For each benchmark identified, provide:
- benchmarkId: Unique identifier (e.g., "RATE-001", "FIN-002")
- benchmarkType: Primary category (Rate, Financial, Competitive, Industry)
- benchmarkSubcategory: Specific subcategory
- role: Role or service being benchmarked
- currentValue: Current contract value/rate
- marketAverage: Market average for comparison
- percentile: Market percentile position (1-100)
- industryBenchmark: Industry-specific benchmark
- competitivePosition: Position vs competitors
- marketTrend: Current market trend direction
- recommendedAction: Strategic recommendation
- confidenceLevel: Confidence in benchmark data (1-100)

Also provide:
- overallConfidence: 0-100 confidence score in analysis
- marketPosition: Overall market position assessment
- competitiveStrength: Competitive strength rating
- benchmarkSummary: Key benchmark insights

Return as JSON:
{
  "benchmarks": [array of benchmark objects],
  "overallConfidence": number,
  "marketPosition": "string",
  "competitiveStrength": "string", 
  "benchmarkSummary": "string"
}

Focus on accuracy and provide specific market insights. Prioritize benchmarks with significant strategic impact.
`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: benchmarkAnalysisPrompt
      },
      {
        role: 'user',
        content: `RATES DATA:\n${JSON.stringify(ratesData, null, 2)}\n\nFINANCIAL DATA:\n${JSON.stringify(financialData, null, 2)}\n\nCONTRACT TEXT FOR BENCHMARK ANALYSIS:\n\n${contractText.slice(0, 12000)}`
      }
    ],
    temperature: 0.1,
    max_tokens: 3000
  });

  const responseText = response.choices?.[0]?.message?.content || '';
  
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        benchmarks: analysis.benchmarks || [],
        confidenceScore: analysis.overallConfidence || 75
      };
    }
  } catch (parseError) {
    console.warn('Failed to parse GPT-4 benchmark analysis:', parseError);
  }

  return { benchmarks: [], confidenceScore: 0 };
}

/**
 * Enhanced fallback benchmark analysis with comprehensive heuristics
 */
function performFallbackBenchmarkAnalysis(ratesData: any[], financialData: any[]): { benchmarks: any[], confidenceScore: number } {
  const benchmarks: any[] = [];
  
  // Rate-based benchmarks
  if (ratesData.length > 0) {
    const rates = ratesData.map(r => Number(r.dailyUsd)).filter(n => Number.isFinite(n));
    if (rates.length > 0) {
      const sorted = [...rates].sort((a, b) => a - b);
      const pct = (p: number) => sorted[Math.floor((p / 100) * (sorted.length - 1))];
      
      benchmarks.push({
        benchmarkId: 'RATE-001',
        benchmarkType: 'Rate',
        benchmarkSubcategory: 'Daily Rate Analysis',
        role: 'All Roles',
        currentValue: Math.round(rates.reduce((a, b) => a + b, 0) / rates.length),
        marketAverage: Math.round(pct(50) || 0),
        percentile: 50,
        industryBenchmark: 'Market median',
        competitivePosition: 'Market aligned',
        marketTrend: 'Stable',
        recommendedAction: 'Monitor market trends',
        confidenceLevel: 60
      });
      
      benchmarks.push({
        benchmarkId: 'RATE-002',
        benchmarkType: 'Rate',
        benchmarkSubcategory: 'Top Quartile Analysis',
        role: 'All Roles',
        currentValue: Math.round(pct(75) || 0),
        marketAverage: Math.round(pct(75) || 0),
        percentile: 75,
        industryBenchmark: 'Top quartile',
        competitivePosition: 'Above market',
        marketTrend: 'Growing',
        recommendedAction: 'Leverage premium positioning',
        confidenceLevel: 65
      });
    }
  }
  
  // Financial benchmarks
  if (financialData.length > 0) {
    const totalValues = financialData
      .filter(f => f.amount && f.amount.includes('$'))
      .map(f => {
        const match = f.amount.match(/\$([0-9,]+)/);
        return match ? parseInt(match[1].replace(/,/g, '')) : 0;
      })
      .filter(v => v > 0);
      
    if (totalValues.length > 0) {
      const avgValue = totalValues.reduce((a, b) => a + b, 0) / totalValues.length;
      
      benchmarks.push({
        benchmarkId: 'FIN-001',
        benchmarkType: 'Financial',
        benchmarkSubcategory: 'Contract Value',
        role: 'Overall Contract',
        currentValue: `$${Math.round(avgValue).toLocaleString()}`,
        marketAverage: `$${Math.round(avgValue * 0.9).toLocaleString()}`,
        percentile: 55,
        industryBenchmark: 'Above market average',
        competitivePosition: 'Competitive',
        marketTrend: 'Stable',
        recommendedAction: 'Maintain current positioning',
        confidenceLevel: 50
      });
    }
  }
  
  // Default benchmark if no data
  if (benchmarks.length === 0) {
    benchmarks.push({
      benchmarkId: 'GEN-001',
      benchmarkType: 'General',
      benchmarkSubcategory: 'Market Position',
      role: 'Overall Contract',
      currentValue: 'Not specified',
      marketAverage: 'Market standard',
      percentile: 50,
      industryBenchmark: 'Industry standard',
      competitivePosition: 'Market aligned',
      marketTrend: 'Stable',
      recommendedAction: 'Gather more market data for accurate benchmarking',
      confidenceLevel: 30
    });
  }

  const confidenceScore = Math.min(40 + (benchmarks.length * 10), 70); // Fallback has lower confidence

  return { benchmarks, confidenceScore };
}

/**
 * Generate LLM-powered best practices for benchmark optimization
 */
async function generateBenchmarkBestPractices(
  client: any,
  benchmarks: any[],
  contractText: string
): Promise<BenchmarkBestPractices> {
  console.log('🧠 Generating benchmark optimization best practices with LLM expert analysis...');

  const benchmarkBestPracticesPrompt = `
You are a senior strategy consultant and market intelligence expert with 25+ years of experience in competitive benchmarking, market positioning, and strategic pricing optimization.

Based on the benchmark analysis provided, generate comprehensive best practices and strategic recommendations for market positioning and competitive advantage.

Generate detailed recommendations in these categories:

1. **Market Positioning**: Strategic positioning recommendations based on benchmark data
2. **Competitive Analysis**: Competitive landscape insights and positioning strategies  
3. **Pricing Strategy**: Pricing optimization based on market benchmarks
4. **Value Optimization**: Value enhancement opportunities and strategies
5. **Negotiation Insights**: Negotiation strategies based on market position
6. **Industry Trends**: Industry trend analysis and adaptation strategies

For each category, provide:
- Specific, actionable recommendations
- Implementation approaches and timelines
- Expected benefits and ROI
- Risk factors and mitigation strategies
- Success metrics and KPIs
- Resource requirements

Return as JSON with the structure:
{
  "marketPositioning": [array of positioning strategies],
  "competitiveAnalysis": [array of competitive insights],
  "pricingStrategy": [array of pricing recommendations],
  "valueOptimization": [array of value enhancement strategies],
  "negotiationInsights": [array of negotiation strategies],
  "industryTrends": [array of trend analyses]
}

Focus on practical, implementable strategies that leverage the benchmark insights for competitive advantage.
`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: benchmarkBestPracticesPrompt
        },
        {
          role: 'user',
          content: `Benchmark data: ${JSON.stringify(benchmarks, null, 2)}\n\nContract context: ${contractText.slice(0, 8000)}`
        }
      ],
      temperature: 0.2,
      max_tokens: 4000
    });

    const responseText = response.choices?.[0]?.message?.content || '';
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('Failed to parse benchmark best practices JSON:', parseError);
    }
  } catch (error) {
    console.warn('Failed to generate benchmark best practices:', error);
  }

  // Return default best practices
  return getDefaultBenchmarkBestPractices(benchmarks);
}

/**
 * Get default best practices when LLM is not available
 */
function getDefaultBenchmarkBestPractices(benchmarks: any[]): BenchmarkBestPractices {
  return {
    marketPositioning: [
      {
        category: 'Market Position Assessment',
        currentPosition: 'Market aligned positioning',
        marketAverage: 'Industry standard',
        topQuartile: 'Premium positioning opportunity',
        positioningStrategy: 'Maintain competitive positioning while identifying premium opportunities',
        competitiveAdvantage: 'Focus on service quality and delivery excellence',
        improvementOpportunities: ['Service differentiation', 'Value-added services', 'Client relationship enhancement'],
        timeline: '6-12 months',
        successMetrics: ['Market share growth', 'Client satisfaction scores', 'Premium pricing achievement']
      }
    ],
    competitiveAnalysis: [
      {
        competitorSegment: 'Direct competitors',
        competitiveFactors: ['Pricing', 'Service quality', 'Delivery speed', 'Technical expertise'],
        strengthsVsCompetitors: ['Established relationships', 'Proven delivery track record'],
        weaknessesVsCompetitors: ['Pricing pressure', 'Limited differentiation'],
        differentiationOpportunities: ['Specialized expertise', 'Innovation capabilities', 'Client partnership approach'],
        competitiveResponse: 'Focus on value differentiation rather than price competition',
        marketShareImpact: 'Maintain current position with growth opportunities'
      }
    ],
    pricingStrategy: [
      {
        pricingModel: 'Market-based pricing',
        currentApproach: 'Competitive pricing alignment',
        marketBasedPricing: 'Price at market median with premium for quality',
        valueBasedPricing: 'Develop value-based pricing for specialized services',
        competitivePricing: 'Monitor competitor pricing and adjust strategically',
        recommendedStrategy: 'Hybrid approach combining market and value-based pricing',
        implementationSteps: ['Market analysis', 'Value proposition development', 'Pricing model design', 'Implementation'],
        riskFactors: ['Market price pressure', 'Competitor response', 'Client price sensitivity']
      }
    ],
    valueOptimization: [
      {
        valueDriver: 'Service quality and delivery excellence',
        currentValue: 'Standard market value proposition',
        optimizationOpportunity: 'Premium value through enhanced service delivery',
        enhancementStrategy: 'Invest in service quality improvements and client experience',
        investmentRequired: 'Moderate investment in process and technology improvements',
        expectedReturn: '15-25% improvement in client satisfaction and retention',
        timeToValue: '6-9 months',
        measurementApproach: 'Client satisfaction surveys and retention metrics'
      }
    ],
    negotiationInsights: [
      {
        negotiationPoint: 'Service pricing and terms',
        marketLeverage: 'Market-aligned pricing with quality differentiation',
        negotiationStrategy: 'Emphasize value delivery and proven track record',
        supportingData: ['Market benchmark data', 'Client success stories', 'Quality metrics'],
        counterarguments: ['Address price concerns with value demonstration', 'Highlight competitive advantages'],
        fallbackPositions: ['Flexible payment terms', 'Performance-based pricing', 'Phased implementation'],
        successProbability: 'High with proper value demonstration'
      }
    ],
    industryTrends: [
      {
        trendCategory: 'Market evolution and pricing trends',
        trendDescription: 'Increasing focus on value-based pricing and service differentiation',
        marketImpact: 'Shift from commodity pricing to value-based relationships',
        opportunityAssessment: 'Opportunity to establish premium positioning through service excellence',
        adaptationStrategy: 'Develop specialized capabilities and enhance service delivery',
        timeline: '12-18 months',
        preparationSteps: ['Capability assessment', 'Service enhancement', 'Market positioning', 'Client communication']
      }
    ]
  };
}