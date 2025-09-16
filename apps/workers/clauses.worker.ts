// Prefer workspace import, fallback to relative if needed
let ClausesArtifactV1Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ClausesArtifactV1Schema = require('schemas').ClausesArtifactV1Schema;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ClausesArtifactV1Schema = require('../../packages/schemas/src').ClausesArtifactV1Schema;
}

/**
 * Enhanced Clauses Worker with LLM-Powered Best Practices
 * Provides expert recommendations for contract clause optimization
 */

export interface ClausesBestPractices {
  clauseOptimizations: ClauseOptimization[];
  riskMitigations: ClauseRiskMitigation[];
  negotiationStrategies: ClauseNegotiationStrategy[];
  industryStandards: ClauseIndustryStandard[];
  complianceEnhancements: ClauseComplianceEnhancement[];
  languageImprovements: ClauseLanguageImprovement[];
}

export interface ClauseOptimization {
  clauseCategory: string;
  currentLanguage: string;
  suggestedImprovement: string;
  benefit: string;
  implementation: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
}

export interface ClauseRiskMitigation {
  riskType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  currentExposure: string;
  mitigationStrategy: string;
  recommendedClauseAddition: string;
  legalRationale: string;
}

export interface ClauseNegotiationStrategy {
  clauseType: string;
  negotiationPoint: string;
  counterpartyPosition: string;
  yourPosition: string;
  compromiseSolution: string;
  fallbackOptions: string[];
}

export interface ClauseIndustryStandard {
  clauseCategory: string;
  industryBenchmark: string;
  yourContract: string;
  gapAnalysis: string;
  alignmentRecommendation: string;
  competitiveAdvantage: string;
}

export interface ClauseComplianceEnhancement {
  regulatoryArea: string;
  currentCompliance: string;
  requiredStandard: string;
  enhancementNeeded: string;
  suggestedClauseLanguage: string;
  complianceRisk: string;
}

export interface ClauseLanguageImprovement {
  clauseSection: string;
  currentLanguage: string;
  clarityIssue: string;
  improvedLanguage: string;
  ambiguityReduction: string;
  enforceabilityImprovement: string;
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

export async function runClauses(job: { data: { docId: string; tenantId?: string } }) {
    const { docId, tenantId } = job.data;
    console.log(`[worker:clauses] Starting advanced clause extraction for ${docId}`);
    const startTime = Date.now();
    
    // Get contract to ensure we have tenantId
    const contract = await db.contract.findUnique({ where: { id: docId } });
    if (!contract) throw new Error(`Contract ${docId} not found`);
    
    const contractTenantId = tenantId || contract.tenantId;
    
    // Read ingestion text
    const ingestion = await db.artifact.findFirst({ 
      where: { contractId: docId, type: 'INGESTION' }, 
      orderBy: { createdAt: 'desc' } 
    });
    const text: string = (ingestion?.data as any)?.content || '';
    
    let extractedClauses: Array<{ clauseId: string; text: string; page?: number; confidence?: number; category?: string; riskLevel?: string }> = [];
    
    const apiKey = process.env['OPENAI_API_KEY'];
    const model = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
    let client: any = null;
    
    if (apiKey && OpenAIClient && text.trim().length > 0) {
      try {
        client = new OpenAIClient(apiKey);
        
        // Intelligent clause extraction using LLM
        const clauseExtractionPrompt = `
You are a legal document analysis expert. Extract and analyze contract clauses from the provided text.

For each significant clause, provide:
1. A unique identifier (clauseId)
2. The full text of the clause
3. A category (e.g., "Payment Terms", "Liability", "Termination", "Confidentiality", "Intellectual Property", "Scope of Work", "Governing Law", "Indemnification", "Force Majeure", "Warranties")
4. A risk level (LOW, MEDIUM, HIGH) based on potential business impact
5. A confidence score (0.0 to 1.0) for the extraction quality

Focus on extracting the most important and legally significant clauses. Limit to maximum 20 clauses.

Return the result as a JSON array of objects with fields: clauseId, text, category, riskLevel, confidence.
`;

        const response = await client.createChatCompletion({
          model,
          messages: [
            {
              role: 'system',
              content: clauseExtractionPrompt
            },
            {
              role: 'user',
              content: `Contract text (first 15000 characters):\n\n${text.slice(0, 15000)}`
            }
          ],
          temperature: 0.1,
          max_tokens: 4000
        });

        const responseText = response.choices?.[0]?.message?.content || '';
        
        try {
          // Try to parse JSON from the response
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsedClauses = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsedClauses)) {
              extractedClauses = parsedClauses.map((clause: any, index: number) => ({
                clauseId: clause.clauseId || `ai-clause-${index + 1}`,
                text: clause.text || '',
                page: 1, // Default to page 1 for now
                confidence: Math.min(Math.max(clause.confidence || 0.7, 0.0), 1.0),
                category: clause.category || 'General',
                riskLevel: clause.riskLevel || 'MEDIUM'
              }));
            }
          }
        } catch (parseError) {
          console.warn(`[worker:clauses] Failed to parse LLM response as JSON for ${docId}:`, parseError);
        }
        
        console.log(`[worker:clauses] LLM extracted ${extractedClauses.length} clauses for ${docId}`);
        
      } catch (error) {
        console.warn(`[worker:clauses] LLM clause extraction failed for ${docId}:`, error);
      }
    }
    
    // Fallback to heuristic extraction if LLM fails or is not available
    if (extractedClauses.length === 0) {
      console.log(`[worker:clauses] Falling back to heuristic clause extraction for ${docId}`);
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const isClauseLine = (l: string) => 
        /^(\d+\.|\([a-z]\)|clause\b|section\b)/i.test(l) || 
        /(liability|termination|confidential|payment|scope|fees|governing\s+law|indemnif|warranty|intellectual\s+property|force\s+majeure)/i.test(l);
      
      let idx = 1;
      for (const l of lines) {
        if (isClauseLine(l)) {
          extractedClauses.push({ 
            clauseId: `heuristic-${idx++}`, 
            text: l, 
            page: 1, 
            confidence: 0.6,
            category: 'General',
            riskLevel: 'MEDIUM'
          });
          if (extractedClauses.length >= 15) break;
        }
      }
      
      if (extractedClauses.length === 0) {
        extractedClauses.push({ 
          clauseId: 'fallback-1', 
          text: (lines[0] || 'No clauses detected'), 
          page: 1, 
          confidence: 0.3,
          category: 'General',
          riskLevel: 'LOW'
        });
      }
    }

    // Generate LLM-powered best practices for clauses
    let bestPractices: ClausesBestPractices | null = null;
    if (client && extractedClauses.length > 0) {
      try {
        bestPractices = await generateClausesBestPractices(client, extractedClauses, text);
      } catch (error) {
        console.warn(`[worker:clauses] Best practices generation failed for ${docId}:`, error);
      }
    }

    // Transform to schema format (remove extra fields not in schema)
    const clausesForSchema = extractedClauses.map(clause => ({
      clauseId: clause.clauseId,
      text: clause.text,
      page: clause.page,
      confidence: clause.confidence
    }));

    const artifact = ClausesArtifactV1Schema.parse({
        metadata: { 
          docId, 
          fileType: 'pdf', 
          totalPages: 1, 
          ocrRate: 0, 
          provenance: [{ 
            worker: 'clauses', 
            timestamp: new Date().toISOString(), 
            durationMs: Date.now() - startTime 
          }] 
        },
        clauses: clausesForSchema,
        // Add best practices to the artifact (if schema supports it)
        bestPractices: bestPractices
    });

    await db.artifact.create({
        data: {
            contractId: docId,
            type: 'CLAUSES',
            data: artifact as any,
            tenantId: contractTenantId,
        },
    });

    console.log(`[worker:clauses] Finished advanced clause extraction for ${docId} (${extractedClauses.length} clauses)`);
    return { docId };
}

/**
 * Generate LLM-powered best practices for contract clauses
 */
async function generateClausesBestPractices(
  client: any,
  extractedClauses: any[],
  contractText: string
): Promise<ClausesBestPractices> {
  console.log('🧠 Generating clauses best practices with LLM expert analysis...');

  const clausesBestPracticesPrompt = `
You are a senior contract lawyer and legal strategist with 20+ years of experience in contract drafting, negotiation, and risk management. 

Analyze the provided contract clauses and generate expert recommendations across 6 key areas:

1. CLAUSE OPTIMIZATIONS - Specific improvements to make clauses more effective
2. RISK MITIGATIONS - Strategies to reduce legal and business risks
3. NEGOTIATION STRATEGIES - Tactical advice for contract negotiations
4. INDUSTRY STANDARDS - Alignment with industry best practices
5. COMPLIANCE ENHANCEMENTS - Regulatory and legal compliance improvements
6. LANGUAGE IMPROVEMENTS - Clarity, enforceability, and precision enhancements

For each recommendation:
- Be specific and actionable
- Explain the legal rationale
- Consider business implications
- Provide actual clause language suggestions where appropriate
- Assess implementation effort and priority

EXTRACTED CLAUSES SUMMARY:
${extractedClauses.map(clause => `- ${clause.category}: ${clause.text.slice(0, 200)}...`).join('\n')}

Return your analysis as a JSON object with this structure:
{
  "clauseOptimizations": [
    {
      "clauseCategory": "Payment Terms",
      "currentLanguage": "excerpt from current clause",
      "suggestedImprovement": "specific improvement recommendation",
      "benefit": "business/legal benefit",
      "implementation": "how to implement",
      "priority": "high|medium|low",
      "effort": "low|medium|high"
    }
  ],
  "riskMitigations": [
    {
      "riskType": "Financial Risk",
      "riskLevel": "high",
      "currentExposure": "description of current risk",
      "mitigationStrategy": "strategy to mitigate",
      "recommendedClauseAddition": "specific clause language",
      "legalRationale": "why this helps legally"
    }
  ],
  "negotiationStrategies": [
    {
      "clauseType": "Liability",
      "negotiationPoint": "key point to negotiate",
      "counterpartyPosition": "likely counterparty stance",
      "yourPosition": "your recommended position",
      "compromiseSolution": "middle ground option",
      "fallbackOptions": ["option1", "option2"]
    }
  ],
  "industryStandards": [
    {
      "clauseCategory": "Termination",
      "industryBenchmark": "standard industry practice",
      "yourContract": "what your contract says",
      "gapAnalysis": "difference analysis",
      "alignmentRecommendation": "how to align",
      "competitiveAdvantage": "strategic benefit"
    }
  ],
  "complianceEnhancements": [
    {
      "regulatoryArea": "Data Protection",
      "currentCompliance": "current compliance level",
      "requiredStandard": "required compliance standard",
      "enhancementNeeded": "what needs to be enhanced",
      "suggestedClauseLanguage": "specific clause text",
      "complianceRisk": "risk of non-compliance"
    }
  ],
  "languageImprovements": [
    {
      "clauseSection": "Force Majeure",
      "currentLanguage": "current clause language",
      "clarityIssue": "clarity problem identified",
      "improvedLanguage": "improved clause language",
      "ambiguityReduction": "how ambiguity is reduced",
      "enforceabilityImprovement": "how enforceability improves"
    }
  ]
}

Provide 3-5 specific, actionable recommendations in each category based on the actual contract clauses provided.
`;

  try {
    const response = await client.createChatCompletion({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: clausesBestPracticesPrompt
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
      
      console.log('✅ Generated clauses best practices:', {
        optimizations: bestPractices.clauseOptimizations?.length || 0,
        mitigations: bestPractices.riskMitigations?.length || 0,
        strategies: bestPractices.negotiationStrategies?.length || 0,
        standards: bestPractices.industryStandards?.length || 0,
        compliance: bestPractices.complianceEnhancements?.length || 0,
        improvements: bestPractices.languageImprovements?.length || 0
      });
      
      return bestPractices;
    }
  } catch (error) {
    console.error('❌ Failed to generate clauses best practices:', error);
  }

  // Return empty structure if generation fails
  return {
    clauseOptimizations: [],
    riskMitigations: [],
    negotiationStrategies: [],
    industryStandards: [],
    complianceEnhancements: [],
    languageImprovements: []
  };
}
