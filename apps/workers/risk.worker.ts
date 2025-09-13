// Prefer workspace import, fallback to relative if needed
let RiskArtifactV1Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RiskArtifactV1Schema = require('schemas').RiskArtifactV1Schema;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RiskArtifactV1Schema = require('../../packages/schemas/src').RiskArtifactV1Schema;
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

export async function runRisk(job: { data: { docId: string } }) {
  const { docId } = job.data;
  console.log(`[worker:risk] Starting advanced risk analysis for ${docId}`);
  const startTime = Date.now();
  
  // Read ingestion text and previous artifacts for context
  const ingestion = await db.artifact.findFirst({ 
    where: { contractId: docId, type: 'INGESTION' }, 
    orderBy: { createdAt: 'desc' } 
  });
  const clauses = await db.artifact.findFirst({ 
    where: { contractId: docId, type: 'CLAUSES' }, 
    orderBy: { createdAt: 'desc' } 
  });
  
  const text = String((ingestion?.data as any)?.content || '');
  const extractedClauses = (clauses?.data as any)?.clauses || [];
  
  let risks: any[] = [];
  
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  
  if (apiKey && OpenAIClient && text.trim().length > 0) {
    try {
      const client = new OpenAIClient(apiKey);
      
      // Create context from extracted clauses
      const clauseContext = extractedClauses.map((clause: any) => 
        `${clause.clauseId}: ${clause.text}`
      ).join('\n');
      
      const riskAnalysisPrompt = `
You are a legal risk analysis expert specializing in contract review. Analyze the provided contract for potential business and legal risks.

Evaluate the following risk categories and identify specific risks:

1. **Financial Risks**: Payment terms, penalties, late fees, currency risks, cost overruns
2. **Legal/Compliance Risks**: Regulatory compliance, governing law issues, dispute resolution
3. **Operational Risks**: Service level agreements, performance standards, delivery requirements
4. **Liability Risks**: Indemnification, limitation of liability, insurance requirements
5. **Intellectual Property Risks**: IP ownership, licensing, confidentiality breaches
6. **Termination Risks**: Termination clauses, notice periods, exit costs
7. **Force Majeure Risks**: Force majeure coverage, business continuity

For each identified risk, provide:
- riskType: Category of risk (Financial, Legal, Operational, Liability, IP, Termination, Force Majeure)
- description: Clear description of the specific risk
- severity: LOW, MEDIUM, or HIGH based on potential business impact
- recommendation: Brief mitigation recommendation (optional)

Return the result as a JSON array of risk objects. Focus on the most significant risks (max 15).
`;

      const response = await client.createChatCompletion({
        model,
        messages: [
          {
            role: 'system',
            content: riskAnalysisPrompt
          },
          {
            role: 'user',
            content: `CONTRACT CLAUSES:\n${clauseContext}\n\nFULL CONTRACT TEXT (first 12000 characters):\n${text.slice(0, 12000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 3000
      });

      const responseText = response.choices?.[0]?.message?.content || '';
      
      try {
        // Try to parse JSON from the response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedRisks = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsedRisks)) {
            risks = parsedRisks.map((risk: any) => ({
              riskType: risk.riskType || 'General',
              description: risk.description || 'Risk identified',
              severity: (risk.severity || 'medium').toLowerCase(),
              recommendation: risk.recommendation || undefined
            }));
          }
        }
      } catch (parseError) {
        console.warn(`[worker:risk] Failed to parse LLM response as JSON for ${docId}:`, parseError);
      }
      
      console.log(`[worker:risk] LLM identified ${risks.length} risks for ${docId}`);
      
    } catch (error) {
      console.warn(`[worker:risk] LLM risk analysis failed for ${docId}:`, error);
    }
  }
  
  // Fallback to heuristic risk analysis if LLM fails
  if (risks.length === 0) {
    console.log(`[worker:risk] Falling back to heuristic risk analysis for ${docId}`);
    const t = text.toLowerCase();
    
    // Financial risks
    if (/payment\s+terms?:?\s*(more than|over|exceed)\s*60/.test(t) || /net\s*(?:90|120)/.test(t)) {
      risks.push({ 
        riskType: 'Financial', 
        description: 'Extended payment terms may impact cash flow (60+ days)', 
        severity: 'medium' 
      });
    }
    
    // Liability risks
    if (!/limitation\s+of\s+liability|liability\s+cap/.test(t)) {
      risks.push({ 
        riskType: 'Liability', 
        description: 'No clear limitation of liability clause found', 
        severity: 'high' 
      });
    }
    
    // IP risks
    if (!/confidential/.test(t) && !/non.?disclosure/.test(t)) {
      risks.push({ 
        riskType: 'IP', 
        description: 'Confidentiality terms not clearly defined', 
        severity: 'medium' 
      });
    }
    
    // Termination risks
    if (!/terminat/.test(t) || !/notice/.test(t)) {
      risks.push({ 
        riskType: 'Termination', 
        description: 'Termination clauses may be unclear or missing', 
        severity: 'medium' 
      });
    }
    
    // Operational risks
    if (/penalty|penalt/.test(t) || /liquidated\s+damages/.test(t)) {
      risks.push({ 
        riskType: 'Operational', 
        description: 'Performance penalties or liquidated damages present', 
        severity: 'high' 
      });
    }
    
    if (risks.length === 0) {
      risks.push({ 
        riskType: 'General', 
        description: 'No major risks detected in heuristic analysis', 
        severity: 'low' 
      });
    }
  }

  // Clean up risks for schema (remove recommendation field if present)
  const risksForSchema = risks.map(risk => ({
    riskType: risk.riskType,
    description: risk.description,
    severity: risk.severity
  }));

  const artifact = RiskArtifactV1Schema.parse({
    metadata: { 
      docId, 
      fileType: 'pdf', 
      totalPages: 1, 
      ocrRate: 0, 
      provenance: [{ 
        worker: 'risk', 
        timestamp: new Date().toISOString(), 
        durationMs: Date.now() - startTime 
      }] 
    },
    risks: risksForSchema,
  });

  await db.artifact.create({
    data: {
      contractId: docId,
      type: 'RISK',
      data: artifact as any,
    },
  });

  console.log(`[worker:risk] Finished advanced risk analysis for ${docId} (${risks.length} risks identified)`);
  return { docId };
}
