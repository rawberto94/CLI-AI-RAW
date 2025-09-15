// Prefer workspace import, fallback to relative if needed
let RatesArtifactV1Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RatesArtifactV1Schema = require('schemas').RatesArtifactV1Schema;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RatesArtifactV1Schema = require('../../packages/schemas/src').RatesArtifactV1Schema;
}

/**
 * Enhanced Rates Worker with LLM-Powered Best Practices
 * Provides expert recommendations for contract rates and pricing optimization
 */

export interface RatesBestPractices {
  pricingOptimization: PricingOptimization[];
  marketBenchmarking: MarketBenchmarking[];
  rateNegotiation: RateNegotiation[];
  valueEngineering: ValueEngineering[];
  costManagement: CostManagement[];
  performanceIncentives: PerformanceIncentive[];
}

export interface PricingOptimization {
  rateCategory: string;
  currentPricing: string;
  optimizationOpportunity: string;
  pricingStrategy: string;
  valueProposition: string;
  competitivePosition: string;
  implementationApproach: string;
  expectedSavings: string;
  timeline: string;
  riskFactors: string[];
}

export interface MarketBenchmarking {
  serviceCategory: string;
  currentRate: string;
  marketAverage: string;
  industryBest: string;
  benchmarkSource: string;
  positionAnalysis: string;
  gapAssessment: string;
  recommendedAction: string;
  negotiationLeverage: string;
}

export interface RateNegotiation {
  negotiationPoint: string;
  currentPosition: string;
  targetPosition: string;
  justification: string;
  negotiationStrategy: string;
  fallbackOptions: string[];
  valueCreation: string;
  riskMitigation: string;
  timeline: string;
}

export interface ValueEngineering {
  serviceArea: string;
  currentApproach: string;
  alternativeApproach: string;
  valueImprovement: string;
  costImplication: string;
  qualityImpact: string;
  implementationRequirements: string[];
  stakeholderBuyIn: string;
  success_metrics: string[];
}

export interface CostManagement {
  costCategory: string;
  currentCost: string;
  costDrivers: string[];
  optimizationStrategy: string;
  controlMechanisms: string[];
  monitoringApproach: string;
  escalationTriggers: string[];
  governanceProcess: string;
}

export interface PerformanceIncentive {
  performanceArea: string;
  currentStructure: string;
  proposedIncentive: string;
  performanceMetrics: string[];
  incentiveAlignment: string;
  behaviorChange: string;
  measurement: string;
  payoutMechanism: string;
}

let db: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('clients-db');
  db = mod.default || mod;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../../packages/clients/db');
  db = mod.default || mod;
}

// Optional OpenAI client
let OpenAIClient: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  OpenAIClient = require('clients-openai').OpenAIClient;
} catch {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    OpenAIClient = require('../../packages/clients/openai').OpenAIClient;
  } catch {
    OpenAIClient = null;
  }
}

// Utilities (normalize and mapping) from workspace utils
let utils: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  utils = require('utils');
} catch {
  utils = require('../../packages/utils');
}

export async function runRates(job: { data: { docId: string } }) {
  const { docId } = job.data;
  console.log(`[worker:rates] Starting rate extraction for ${docId}`);
  const startTime = Date.now();

  // Read ingestion text from DB
  const ingestion = await db.artifact.findFirst({ where: { contractId: docId, type: 'INGESTION' }, orderBy: { createdAt: 'desc' } });
  const textContent: string = (ingestion?.data as any)?.content || '';

  // Check for financial analysis data to enhance rate extraction
  const rates: any[] = [];
  let client: any = null;
  const apiKey = process.env['OPENAI_API_KEY'];
  const model = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
  const USE_LLM = (process.env['ANALYSIS_USE_LLM_RATES'] || process.env['ANALYSIS_USE_LLM']) === 'true';

  const unitToUom = (u: string): 'Hour' | 'Day' | 'Month' | 'Year' => {
    const x = (u || '').toLowerCase();
  if (/(hour|hr|h|hourly|per\s*hour)/i.test(x)) return 'Hour';
  if (/(day|daily|per\s*day)/i.test(x)) return 'Day';
  if (/(month|mo|monthly|per\s*month)/i.test(x)) return 'Month';
  if (/(year|yr|annum|annual|yearly|per\s*year)/i.test(x)) return 'Year';
    return 'Day';
  };

  // Table-aware pass: detect Rate Card section and parse table-like rows.
  if (textContent) {
    try {
      const sectionStart = /\bRate\s*Card\b|Resource-?Based\s*Pricing/i;
      if (sectionStart.test(textContent)) {
        const lines = textContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const startIdx = lines.findIndex(l => sectionStart.test(l));
        const windowLines = startIdx >= 0 ? lines.slice(startIdx, startIdx + 80) : lines.slice(0, 120);
        const headerIdx = windowLines.findIndex(l => /Role|Resource\s*Type/i.test(l) && /Hourly|Month|Unit|Seniority/i.test(l));
        const body = headerIdx >= 0 ? windowLines.slice(headerIdx + 1) : windowLines;
        const money = /(?:USD|EUR|GBP)?\s*(?:[$€£])\s?\d{1,3}(?:[,]\d{3})*(?:[.,]\d+)?/i;
        // Greedy row detector: a row must include a unit word and a price
        for (const line of body) {
          if (!/(hour|day|month|year)/i.test(line)) continue;
          if (!money.test(line)) continue;
          // Extract columns heuristically
          const cols = line.split(/\s{2,}|\t|\s\|\s/).filter(Boolean);
          const roleCell = cols[0] || line;
          const seniorityCell = cols.find(c => /junior|mid|senior|lead/i.test(c)) || '';
          const unitCell = cols.find(c => /hour|day|month|year/i.test(c)) || 'Hour';
          const priceCell = (line.match(/([$€£]\s?\d[\d,]*(?:[.,]\d+)?)/) || [])[0] || '';
          const currency = /€/.test(priceCell) ? 'EUR' : /£/.test(priceCell) ? 'GBP' : 'USD';
          const amount = Number(priceCell.replace(/[^0-9.,]/g,'').replace(/,/g,'').replace(/(\..*)\./,'$1'));
          if (!amount || !isFinite(amount)) continue;
          const uom = unitToUom(unitCell);
          const originalRole = `${roleCell} ${seniorityCell}`.trim();
          const mapped = utils.mapRoleDetail(originalRole);
          const daily = utils.normalizeToDaily(amount, uom);
          const dailyUsd = utils.convertCurrency(daily, currency, 'USD');
          rates.push({
            pdfRole: originalRole || undefined,
            role: mapped.role,
            seniority: mapped.seniority,
            mappingConfidence: mapped.confidence,
            currency,
            uom,
            amount,
            dailyUsd: Math.round(dailyUsd),
            country: 'Unknown',
            lineOfService: 'Unknown',
          });
          if (rates.length >= 100) break;
        }
      }
    } catch { /* swallow table parse errors */ }
  }

  if (USE_LLM && apiKey && OpenAIClient && textContent) {
    try {
      // Retrieve likely relevant sections for rates using embeddings when enabled
      let ragContext = '';
      try {
        if ((process.env['RAG_ENABLED'] || '').toLowerCase() === 'true') {
          let rag: any;
          try { rag = require('clients-rag'); } catch { rag = require('../../packages/clients/rag'); }
          const topK = Number(process.env['RAG_TOP_K'] || 8);
          const scored = await rag.retrieve(docId, 'rates pricing fees hourly day month year USD EUR GBP', topK, { apiKey: process.env['OPENAI_API_KEY'], model: process.env['RAG_EMBED_MODEL'] });
          ragContext = (scored || []).map((s: any) => s.text).join('\n---\n');
        }
      } catch {}
      client = new OpenAIClient(apiKey);
  const schema = {
    type: 'object',
    // Allow extra top-level props from the model to avoid brittle failures (we only read .items)
    additionalProperties: true,
        properties: {
          items: {
            type: 'array',
            maxItems: 100,
            items: {
              type: 'object',
              required: ['amount'],
      // Be permissive on item shape; we normalize below.
      additionalProperties: true,
              properties: {
                title: { type: 'string', maxLength: 160 },
                seniority: { type: 'string' },
                amount: { type: 'number' },
                currency: { type: 'string' },
                unit: { type: 'string' },
                raw_line: { type: 'string' },
                country: { type: 'string' },
                lineOfService: { type: 'string' },
              },
            },
          },
        },
      };
      const result = await (client as any).createStructured({
        model,
        system: 'Extract rate lines from the contract. Always include entries when you see an amount and unit even if role title is missing. Use a sensible title like "Hourly Rate"/"Daily Rate" when not specified. Units can be Hour/Day/Month/Year or phrases like hourly, per hour, daily, monthly, yearly. Return JSON only.',
        userChunks: [
          { type: 'text', role: 'user', content: 'CONTEXT (relevant excerpts):' },
          { type: 'text', role: 'user', content: ragContext || '(no context)' },
          { type: 'text', role: 'user', content: 'Contract text (truncated):' },
          { type: 'text', role: 'user', content: textContent.slice(0, 100_000) },
        ],
        schema,
        temperature: 0,
      });
  // Some models might return { rates: [...] } or nest differently; map common variants to .items
  let items = (result && Array.isArray((result as any).items)) ? (result as any).items as Array<any> : [];
  if (!items.length && Array.isArray((result as any).rates)) items = (result as any).rates as Array<any>;
  if (!items.length && Array.isArray((result as any).data?.items)) items = (result as any).data.items as Array<any>;
      for (const it of items) {
  const title = (it.title || '').trim() || (/(hour|hr|hourly)/i.test(String(it.unit||'')) ? 'Hourly Rate' : /(month|mo|monthly)/i.test(String(it.unit||'')) ? 'Monthly Rate' : /(year|yr|annual)/i.test(String(it.unit||'')) ? 'Yearly Rate' : /(day|daily)/i.test(String(it.unit||'')) ? 'Daily Rate' : 'Rate');
        const mapped = utils.mapRoleDetail(title);
        const uom = unitToUom(it.unit || title);
        const amount = Number(it.amount);
        if (!amount || !isFinite(amount) || amount <= 0) continue;
        const cur = ((it.currency || 'USD') as string).toUpperCase();
        const daily = utils.normalizeToDaily(amount, uom);
        const dailyUsd = utils.convertCurrency(daily, cur, 'USD');
        const country = it.country || (textContent.match(/\b(US|USA|United States|UK|United Kingdom|GB|Great Britain|Germany|France|Italy|Spain|India|Canada|Australia)\b/i)?.[0] ?? 'Unknown');
        const los = it.lineOfService || (textContent.match(/BPO|ITO|Consulting|Advisory|Audit|Tax|Engineering|Software|Data/i)?.[0] ?? 'Unknown');
        rates.push({
          pdfRole: title || undefined,
          role: mapped.role,
          seniority: mapped.seniority,
          mappingConfidence: mapped.confidence,
          sourceLine: it.raw_line || undefined,
          currency: cur,
          uom,
          amount,
          dailyUsd: Math.round(dailyUsd),
          country,
          lineOfService: los,
        });
        if (rates.length >= 100) break;
      }
    } catch (err) {
      console.warn('[worker:rates] LLM extraction failed, falling back to demo:', (err as Error).message);
    }
  }

  if (rates.length === 0 && textContent) {
    // Regex heuristic fallback to catch simple patterns e.g., "hourly rate 40 USD"
    const re = /(hourly|per\s*hour|daily|per\s*day|monthly|per\s*month|yearly|per\s*year)\s*(?:rate)?\s*[:\-]?\s*([$€£]?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)(?:\s*(USD|EUR|GBP))?/ig;
    let m: RegExpExecArray | null;
    while ((m = re.exec(textContent)) && rates.length < 50) {
      const unitHint = m[1] || '';
      const amountRaw = (m[2] || '').replace(/[,\s]/g, '').replace('€','').replace('£','').replace('$','');
      const amount = Number(amountRaw.replace(',', '.'));
      if (!amount || !isFinite(amount)) continue;
      const currency = (m[3] || (/[€]/.test(m[2]||'') ? 'EUR' : /[£]/.test(m[2]||'') ? 'GBP' : 'USD')).toUpperCase();
      const uom = unitToUom(unitHint);
  const title = /(hour|hr)/i.test(unitHint) ? 'Hourly Rate' : /(month|mo)/i.test(unitHint) ? 'Monthly Rate' : /(year|yr|annual)/i.test(unitHint) ? 'Yearly Rate' : 'Daily Rate';
      const mapped = utils.mapRoleDetail(title);
      const daily = utils.normalizeToDaily(amount, uom);
      const dailyUsd = utils.convertCurrency(daily, currency, 'USD');
      rates.push({
        pdfRole: title,
        role: mapped.role,
        seniority: mapped.seniority,
        mappingConfidence: mapped.confidence,
        currency,
        uom,
        amount,
        dailyUsd: Math.round(dailyUsd),
        country: 'Unknown',
        lineOfService: 'Unknown',
      });
    }
  }

  if (rates.length === 0) {
    // Minimal fallback so artifact exists even if nothing parsed
    rates.push({ rateName: 'Day Rate', value: 1000, currency: 'USD' });
  }

  // Generate LLM-powered best practices for rates optimization
  let bestPractices: RatesBestPractices | null = null;
  if (client && rates.length > 0) {
    try {
      bestPractices = await generateRatesBestPractices(client, rates, textContent);
    } catch (error) {
      console.warn(`[worker:rates] Best practices generation failed for ${docId}:`, error);
    }
  }

  const artifact = RatesArtifactV1Schema.parse({
    metadata: { docId, fileType: 'pdf', totalPages: 1, ocrRate: 0, provenance: [{ worker: 'rates', timestamp: new Date().toISOString(), durationMs: Date.now() - startTime }] },
    rates,
    // Add best practices to the artifact (if schema supports it)
    bestPractices: bestPractices
  });

  await db.artifact.create({
    data: {
      contractId: docId,
      type: 'RATES',
      data: artifact as any,
    },
  });

  console.log(`[worker:rates] Finished rate extraction for ${docId}`);
  return { docId };
}

/**
 * Generate LLM-powered best practices for rates and pricing optimization
 */
async function generateRatesBestPractices(
  client: any,
  extractedRates: any[],
  contractText: string
): Promise<RatesBestPractices> {
  console.log('🧠 Generating rates optimization best practices with LLM expert analysis...');

  const ratesBestPracticesPrompt = `
You are a Chief Procurement Officer and Pricing Strategy Expert with 20+ years of experience in contract negotiations, vendor management, and pricing optimization across Fortune 500 companies.

Analyze the provided contract rates and generate expert recommendations across 6 key areas:

1. PRICING OPTIMIZATION - Strategies to optimize rates and pricing structures
2. MARKET BENCHMARKING - Industry benchmarks and competitive positioning
3. RATE NEGOTIATION - Tactical negotiation strategies and leverage points
4. VALUE ENGINEERING - Alternative approaches to reduce costs while maintaining value
5. COST MANAGEMENT - Ongoing cost control and management strategies
6. PERFORMANCE INCENTIVES - Performance-based pricing and incentive structures

For each recommendation:
- Be specific and actionable with clear implementation steps
- Consider market dynamics and competitive positioning
- Provide cost-benefit analysis and ROI calculations
- Include negotiation tactics and leverage strategies
- Address both short-term savings and long-term value

EXTRACTED RATES:
${extractedRates.map(rate => `- ${rate.pdfRole || rate.role || 'Unknown Role'}: ${rate.amount} ${rate.currency}/${rate.uom} (Daily USD: ${rate.dailyUsd})`).join('\n')}

Return your analysis as a JSON object with this structure:
{
  "pricingOptimization": [
    {
      "rateCategory": "Hourly Consulting",
      "currentPricing": "current rate structure",
      "optimizationOpportunity": "specific opportunity identified",
      "pricingStrategy": "recommended strategy",
      "valueProposition": "value justification",
      "competitivePosition": "market position analysis",
      "implementationApproach": "how to implement",
      "expectedSavings": "projected savings",
      "timeline": "implementation timeline",
      "riskFactors": ["risk1", "risk2"]
    }
  ],
  "marketBenchmarking": [
    {
      "serviceCategory": "Software Development",
      "currentRate": "current contract rate",
      "marketAverage": "market average rate",
      "industryBest": "best-in-class rate",
      "benchmarkSource": "source of benchmarks",
      "positionAnalysis": "where you stand",
      "gapAssessment": "gap from market",
      "recommendedAction": "action to take",
      "negotiationLeverage": "leverage for negotiation"
    }
  ],
  "rateNegotiation": [
    {
      "negotiationPoint": "Rate Reduction",
      "currentPosition": "current contract terms",
      "targetPosition": "desired outcome",
      "justification": "business justification",
      "negotiationStrategy": "approach to negotiation",
      "fallbackOptions": ["option1", "option2"],
      "valueCreation": "mutual value creation",
      "riskMitigation": "risk mitigation approach",
      "timeline": "negotiation timeline"
    }
  ],
  "valueEngineering": [
    {
      "serviceArea": "Testing Services",
      "currentApproach": "current service model",
      "alternativeApproach": "proposed alternative",
      "valueImprovement": "value enhancement",
      "costImplication": "cost impact",
      "qualityImpact": "quality considerations",
      "implementationRequirements": ["requirement1", "requirement2"],
      "stakeholderBuyIn": "stakeholder considerations",
      "success_metrics": ["metric1", "metric2"]
    }
  ],
  "costManagement": [
    {
      "costCategory": "Labor Costs",
      "currentCost": "current cost structure",
      "costDrivers": ["driver1", "driver2"],
      "optimizationStrategy": "cost optimization approach",
      "controlMechanisms": ["control1", "control2"],
      "monitoringApproach": "how to monitor",
      "escalationTriggers": ["trigger1", "trigger2"],
      "governanceProcess": "governance framework"
    }
  ],
  "performanceIncentives": [
    {
      "performanceArea": "Quality Metrics",
      "currentStructure": "current incentive structure",
      "proposedIncentive": "recommended incentive",
      "performanceMetrics": ["metric1", "metric2"],
      "incentiveAlignment": "alignment with goals",
      "behaviorChange": "expected behavior change",
      "measurement": "measurement approach",
      "payoutMechanism": "payout structure"
    }
  ]
}

Provide 3-5 specific, actionable recommendations in each category based on the actual contract rates provided.
`;

  try {
    const response = await client.createChatCompletion({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: ratesBestPracticesPrompt
        },
        {
          role: 'user',
          content: `Contract text for analysis:\n\n${contractText.slice(0, 12000)}`
        }
      ],
      temperature: 0.2,
      max_tokens: 4000
    });

    const responseText = response.choices?.[0]?.message?.content || '';
    
    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const bestPractices = JSON.parse(jsonMatch[0]);
      
      console.log('✅ Generated rates optimization best practices:', {
        pricing: bestPractices.pricingOptimization?.length || 0,
        benchmarking: bestPractices.marketBenchmarking?.length || 0,
        negotiation: bestPractices.rateNegotiation?.length || 0,
        valueEngineering: bestPractices.valueEngineering?.length || 0,
        costManagement: bestPractices.costManagement?.length || 0,
        incentives: bestPractices.performanceIncentives?.length || 0
      });
      
      return bestPractices;
    }
  } catch (error) {
    console.error('❌ Failed to generate rates best practices:', error);
  }

  // Return empty structure if generation fails
  return {
    pricingOptimization: [],
    marketBenchmarking: [],
    rateNegotiation: [],
    valueEngineering: [],
    costManagement: [],
    performanceIncentives: []
  };
}
