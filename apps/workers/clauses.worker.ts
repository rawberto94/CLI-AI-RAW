// Prefer workspace import, fallback to relative if needed
let ClausesArtifactV1Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ClausesArtifactV1Schema = require('schemas').ClausesArtifactV1Schema;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ClausesArtifactV1Schema = require('../../packages/schemas/src').ClausesArtifactV1Schema;
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

export async function runClauses(job: { data: { docId: string } }) {
    const { docId } = job.data;
    console.log(`[worker:clauses] Starting advanced clause extraction for ${docId}`);
    const startTime = Date.now();
    
    // Read ingestion text
    const ingestion = await db.artifact.findFirst({ 
      where: { contractId: docId, type: 'INGESTION' }, 
      orderBy: { createdAt: 'desc' } 
    });
    const text: string = (ingestion?.data as any)?.content || '';
    
    let extractedClauses: Array<{ clauseId: string; text: string; page?: number; confidence?: number; category?: string; riskLevel?: string }> = [];
    
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    if (apiKey && OpenAIClient && text.trim().length > 0) {
      try {
        const client = new OpenAIClient(apiKey);
        
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
    });

    await db.artifact.create({
        data: {
            contractId: docId,
            type: 'CLAUSES',
            data: artifact as any,
        },
    });

    console.log(`[worker:clauses] Finished advanced clause extraction for ${docId} (${extractedClauses.length} clauses)`);
    return { docId };
}
