import dotenv from 'dotenv';
// Load environment variables FIRST, before any other imports that need them
dotenv.config();

import { Job } from 'bullmq';
import getClient from 'clients-db';
import { ArtifactType } from 'clients-db';
import { getQueueService } from '../../utils/src/queue/queue-service';
import { QUEUE_NAMES, GenerateArtifactsJobData } from '../../utils/src/queue/contract-queue';
import pino from 'pino';

const logger = pino({ name: 'artifact-generator-worker' });
const prisma = getClient();

interface ArtifactResult {
  artifactsCreated: number;
  artifactIds: string[];
}

/**
 * Artifact Generation Worker
 * Generates AI-powered artifacts for contracts
 */
export async function generateArtifactsJob(
  job: Job<GenerateArtifactsJobData>
): Promise<ArtifactResult> {
  const { contractId, tenantId, contractText } = job.data;

  logger.info(
    { contractId, tenantId, jobId: job.id },
    'Starting artifact generation'
  );

  const artifactIds: string[] = [];

  try {
    await job.updateProgress(5);

    // Validate contract exists
    const contract = await prisma.contract.findUnique({
      where: { id: contractId, tenantId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Define artifacts to generate
    const artifactTypes: Array<{ type: ArtifactType; weight: number }> = [
      { type: 'OVERVIEW' as ArtifactType, weight: 15 },
      { type: 'CLAUSES' as ArtifactType, weight: 20 },
      { type: 'FINANCIAL' as ArtifactType, weight: 25 },
      { type: 'RISK' as ArtifactType, weight: 20 },
      { type: 'COMPLIANCE' as ArtifactType, weight: 20 },
    ];

    let progressBase = 10;

    // Generate each artifact
    for (const { type, weight } of artifactTypes) {
      try {
        logger.info({ contractId, type }, `Generating ${type} artifact`);

        // Simulate AI generation (replace with actual OpenAI call)
        const artifactData = await generateArtifactData(type, contractText, contractId);

        // Save artifact to database
        const artifact = await prisma.artifact.create({
          data: {
            contractId,
            tenantId,
            type,
            data: artifactData,
            validationStatus: 'valid',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        artifactIds.push(artifact.id);
        logger.info({ contractId, artifactId: artifact.id, type }, 'Artifact created');

        progressBase += weight;
        await job.updateProgress(progressBase);
      } catch (error) {
        logger.error({ error, contractId, type }, `Failed to generate ${type} artifact`);
        // Continue with other artifacts even if one fails
      }
    }

    // Update contract status to completed
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date(),
      },
    });

    await job.updateProgress(100);

    logger.info(
      { contractId, artifactCount: artifactIds.length },
      'Artifact generation completed'
    );

    return {
      artifactsCreated: artifactIds.length,
      artifactIds,
    };
  } catch (error) {
    logger.error({ error, contractId, jobId: job.id }, 'Artifact generation failed');

    // Update contract status
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'FAILED',
        updatedAt: new Date(),
      },
    });

    throw error;
  }
}

/**
 * Generate artifact data using OpenAI API - REAL AI ANALYSIS
 */
async function generateArtifactData(
  type: string,
  contractText: string,
  contractId: string
): Promise<Record<string, any>> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // If no API key, use fallback templates
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not configured, using fallback templates');
    return getFallbackArtifactData(type, contractId);
  }

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey });
    
    // Limit contract text to avoid token limits
    const truncatedText = contractText.substring(0, 15000);

    // Anti-hallucination system prompt
    const systemPrompt = `You are a contract analysis expert. Return ONLY valid JSON.

CRITICAL ANTI-HALLUCINATION RULES:
1. ONLY extract information explicitly stated in the contract text
2. DO NOT invent, infer, or assume any information not in the document
3. For each key value, add a "source" field with a quote or section reference
4. If information is not found, use null - DO NOT make up values
5. Add "extractedFromText": true for values found in document
6. Add "extractedFromText": false and "requiresHumanReview": true for any calculated/inferred values
7. Include a "certainty" score (0-1) based on how clearly the information is stated

If you cannot find specific information, return null - NEVER fabricate data.`;
    
    const prompts: Record<string, string> = {
      OVERVIEW: `Analyze this contract and extract key information. Return a JSON object with:
{
  "summary": { "value": "A 2-3 sentence executive summary", "source": "quote or section ref", "extractedFromText": true },
  "contractType": { "value": "Type (Service Agreement, NDA, MSA, SOW, etc)", "source": "where found", "extractedFromText": true },
  "parties": [{"name": "Party name", "role": "Client/Vendor/etc", "source": "quote showing party name"}],
  "effectiveDate": { "value": "YYYY-MM-DD", "source": "quote", "extractedFromText": true } or null,
  "expirationDate": { "value": "YYYY-MM-DD", "source": "quote", "extractedFromText": true } or null,
  "totalValue": { "value": number, "source": "quote", "extractedFromText": true } or null,
  "currency": "USD/EUR/GBP/etc",
  "keyTerms": ["list", "of", "key", "terms"],
  "certainty": 0.85
}

IMPORTANT: Only include data EXPLICITLY stated in the contract. Use null for missing fields.

Contract text:
${truncatedText}`,

      CLAUSES: `Extract key clauses ACTUALLY PRESENT in this contract. Return JSON with:
{
  "clauses": [
    {
      "title": "Clause name",
      "content": "Direct quote or close paraphrase from contract",
      "source": "Section name or location in document",
      "importance": "high/medium/low",
      "category": "payment/termination/liability/etc",
      "extractedFromText": true
    }
  ],
  "missingClauses": ["List common clauses NOT found in this contract"],
  "certainty": 0.85
}
Find clauses that ACTUALLY EXIST (5-15). DO NOT invent standard clauses.

Contract text:
${truncatedText}`,

      FINANCIAL: `Extract ONLY financial terms explicitly stated in this contract. Return JSON with:
{
  "totalValue": { "value": number, "source": "exact quote", "extractedFromText": true } or null,
  "currency": { "value": "USD/EUR/etc", "source": "symbol or text indicating currency", "extractedFromText": true },
  "paymentTerms": { "value": "Description", "source": "quote", "extractedFromText": true } or null,
  "paymentSchedule": [{"milestone": "desc", "amount": number, "source": "quote"}] or [],
  "costBreakdown": [{"category": "name", "amount": number, "source": "quote"}] or [],
  "analysis": "Brief analysis based ONLY on stated terms",
  "certainty": 0.85
}

DO NOT calculate totals or infer pricing not explicitly stated.

Contract text:
${truncatedText}`,

      RISK: `Analyze risks BASED ONLY ON ACTUAL CONTRACT LANGUAGE. Return JSON with:
{
  "overallRisk": "Low/Medium/High",
  "riskScore": 0-100,
  "risks": [
    {
      "category": "Financial/Legal/etc",
      "level": "Low/Medium/High",
      "title": "title",
      "description": "Based on actual contract terms",
      "source": "Quote the problematic language",
      "extractedFromText": true,
      "mitigation": "suggestion"
    }
  ],
  "redFlags": [{"flag": "concern", "source": "contract quote", "extractedFromText": true}],
  "missingProtections": ["Common protections NOT found in contract"],
  "recommendations": ["key recommendations"],
  "certainty": 0.85
}

CRITICAL: Every risk must cite specific contract language. DO NOT invent risks.

Contract text:
${truncatedText}`,

      COMPLIANCE: `Review compliance requirements EXPLICITLY MENTIONED in this contract. Return JSON with:
{
  "compliant": true/false/null (null if cannot determine),
  "complianceScore": 0-100,
  "regulations": [{"name": "GDPR/SOC2/etc", "source": "where mentioned", "extractedFromText": true}],
  "checks": [{"regulation": "Name", "status": "compliant/non-compliant/needs-review", "details": "explanation", "source": "quote"}],
  "issues": [{"severity": "high/medium/low", "description": "issue", "source": "contract language", "recommendation": "fix"}],
  "recommendations": ["list"],
  "notFoundCompliance": ["Common compliance items NOT mentioned in contract"],
  "certainty": 0.85
}

ONLY include compliance requirements EXPLICITLY stated. DO NOT assume requirements based on industry.

Contract text:
${truncatedText}`
    };

    const prompt = prompts[type];
    if (!prompt) {
      return getFallbackArtifactData(type, contractId);
    }

    logger.info({ type, contractId, textLength: truncatedText.length }, 'Calling OpenAI for artifact');

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.1, // Lower temperature for more consistent, factual extraction
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response');

    const artifactData = JSON.parse(content);
    artifactData._meta = { 
      generatedAt: new Date().toISOString(), 
      aiGenerated: true,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      antiHallucinationEnabled: true
    };
    
    logger.info({ type, contractId, certainty: artifactData.certainty }, 'AI artifact generated successfully');
    return artifactData;

  } catch (error) {
    logger.error({ error, type, contractId }, 'OpenAI failed, using fallback');
    return getFallbackArtifactData(type, contractId);
  }
}

function getFallbackArtifactData(type: string, contractId: string): Record<string, any> {
  const templates: Record<string, any> = {
    OVERVIEW: { summary: null, contractType: null, parties: [], keyTerms: [], certainty: 0, _meta: { fallback: true, reason: 'AI unavailable' } },
    CLAUSES: { clauses: [], missingClauses: ['Unable to analyze - AI unavailable'], certainty: 0, _meta: { fallback: true } },
    FINANCIAL: { totalValue: null, currency: null, analysis: 'AI analysis unavailable', certainty: 0, _meta: { fallback: true } },
    RISK: { overallRisk: 'Unknown', riskScore: null, risks: [], certainty: 0, _meta: { fallback: true } },
    COMPLIANCE: { compliant: null, checks: [], issues: [], certainty: 0, _meta: { fallback: true } },
  };
  return templates[type] || { type, certainty: 0, _meta: { fallback: true } };
}

/**
 * Register artifact generator worker
 */
export function registerArtifactGeneratorWorker() {
  const queueService = getQueueService();

  const worker = queueService.registerWorker<GenerateArtifactsJobData, ArtifactResult>(
    QUEUE_NAMES.ARTIFACT_GENERATION,
    generateArtifactsJob,
    {
      concurrency: 5, // Process 5 artifact jobs simultaneously
      limiter: {
        max: 20,
        duration: 60000, // Max 20 jobs per minute (OpenAI rate limiting)
      },
    }
  );

  logger.info('Artifact generator worker registered');

  return worker;
}
