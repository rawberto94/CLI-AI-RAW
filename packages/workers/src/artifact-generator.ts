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
    
    const prompts: Record<string, string> = {
      OVERVIEW: `Analyze this contract and extract key information. Return a JSON object with:
{
  "summary": "A 2-3 sentence executive summary",
  "contractType": "Type (Service Agreement, NDA, MSA, SOW, etc)",
  "parties": [{"name": "Party name", "role": "Client/Vendor/etc"}],
  "effectiveDate": "YYYY-MM-DD or null",
  "expirationDate": "YYYY-MM-DD or null",
  "totalValue": numeric value or 0,
  "currency": "USD/EUR/GBP/etc",
  "keyTerms": ["list", "of", "key", "terms"]
}

Contract text:
${truncatedText}`,

      CLAUSES: `Extract key clauses. Return JSON with:
{
  "clauses": [
    {"title": "Clause name", "content": "Summary (2-3 sentences)", "importance": "high/medium/low", "category": "payment/termination/liability/etc"}
  ]
}
Find 5-15 significant clauses.

Contract text:
${truncatedText}`,

      FINANCIAL: `Extract financial terms. Return JSON with:
{
  "totalValue": number or 0,
  "currency": "USD/EUR/etc",
  "paymentTerms": "Description",
  "paymentSchedule": [{"milestone": "desc", "amount": number}],
  "costBreakdown": [{"category": "name", "amount": number}],
  "analysis": "Brief financial analysis"
}

Contract text:
${truncatedText}`,

      RISK: `Analyze risks. Return JSON with:
{
  "overallRisk": "Low/Medium/High",
  "riskScore": 0-100,
  "risks": [{"category": "Financial/Legal/etc", "level": "Low/Medium/High", "title": "title", "description": "details", "mitigation": "suggestion"}],
  "redFlags": ["list of concerns"],
  "recommendations": ["key recommendations"]
}

Contract text:
${truncatedText}`,

      COMPLIANCE: `Review compliance. Return JSON with:
{
  "compliant": true/false,
  "complianceScore": 0-100,
  "checks": [{"regulation": "GDPR/SOC2/etc", "status": "compliant/non-compliant/needs-review", "details": "explanation"}],
  "issues": [{"severity": "high/medium/low", "description": "issue", "recommendation": "fix"}],
  "recommendations": ["list"]
}

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
        { role: 'system', content: 'You are a contract analysis expert. Return ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response');

    const artifactData = JSON.parse(content);
    artifactData._meta = { generatedAt: new Date().toISOString(), aiGenerated: true };
    
    logger.info({ type, contractId }, 'AI artifact generated successfully');
    return artifactData;

  } catch (error) {
    logger.error({ error, type, contractId }, 'OpenAI failed, using fallback');
    return getFallbackArtifactData(type, contractId);
  }
}

function getFallbackArtifactData(type: string, contractId: string): Record<string, any> {
  const templates: Record<string, any> = {
    OVERVIEW: { summary: `Contract ${contractId} - AI unavailable`, contractType: 'Unknown', parties: [], keyTerms: [], _meta: { fallback: true } },
    CLAUSES: { clauses: [], _meta: { fallback: true } },
    FINANCIAL: { totalValue: 0, currency: 'USD', analysis: 'AI analysis unavailable', _meta: { fallback: true } },
    RISK: { overallRisk: 'Unknown', riskScore: 50, risks: [], _meta: { fallback: true } },
    COMPLIANCE: { compliant: null, checks: [], issues: [], _meta: { fallback: true } },
  };
  return templates[type] || { type, _meta: { fallback: true } };
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
