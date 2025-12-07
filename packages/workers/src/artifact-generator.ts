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
      { type: 'OVERVIEW' as ArtifactType, weight: 10 },
      { type: 'CLAUSES' as ArtifactType, weight: 12 },
      { type: 'FINANCIAL' as ArtifactType, weight: 12 },
      { type: 'RISK' as ArtifactType, weight: 12 },
      { type: 'COMPLIANCE' as ArtifactType, weight: 12 },
      { type: 'OBLIGATIONS' as ArtifactType, weight: 10 },
      { type: 'RENEWAL' as ArtifactType, weight: 10 },
      { type: 'NEGOTIATION_POINTS' as ArtifactType, weight: 8 },
      { type: 'AMENDMENTS' as ArtifactType, weight: 7 },
      { type: 'CONTACTS' as ArtifactType, weight: 7 },
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
${truncatedText}`,

      OBLIGATIONS: `Extract all obligations, deliverables, SLAs, and milestones EXPLICITLY stated in this contract. Return JSON with:
{
  "obligations": [
    {
      "id": "obl_1",
      "title": "Obligation title",
      "party": "Which party is responsible (exact name from contract)",
      "type": "deliverable/sla/milestone/reporting/compliance/other",
      "description": "Direct quote or close paraphrase",
      "dueDate": "YYYY-MM-DD" or null,
      "recurring": {"frequency": "monthly/quarterly/annually", "interval": 1} or null,
      "slaCriteria": {"metric": "Response Time", "target": "4 hours", "unit": "hours"} or null,
      "penalty": "Penalty for non-compliance" or null,
      "sourceClause": "Section reference",
      "extractedFromText": true,
      "confidence": 0.9
    }
  ],
  "milestones": [
    {"id": "ms_1", "name": "Milestone name", "date": "YYYY-MM-DD", "deliverables": ["list"], "source": "quote"}
  ],
  "slaMetrics": [
    {"metric": "Uptime", "target": "99.9%", "penalty": "$1000/violation", "source": "quote"}
  ],
  "reportingRequirements": [
    {"type": "Monthly report", "frequency": "monthly", "recipient": "Client", "source": "quote"}
  ],
  "summary": "Brief summary of key obligations",
  "certainty": 0.85
}

CRITICAL: Only extract obligations EXPLICITLY stated. DO NOT infer or invent SLAs not in the document.

Contract text:
${truncatedText}`,

      RENEWAL: `Extract all renewal, termination, and expiration terms EXPLICITLY stated in this contract. Return JSON with:
{
  "autoRenewal": true/false/null,
  "renewalTerms": {
    "renewalPeriod": "1 year" or null,
    "noticePeriodDays": 30 or null,
    "optOutDeadline": "YYYY-MM-DD" or null,
    "source": "exact quote"
  },
  "terminationNotice": {
    "requiredDays": 30,
    "format": "Written notice" or null,
    "recipientParty": "Party name" or null,
    "source": "quote"
  },
  "priceEscalation": [
    {"type": "Annual", "percentage": 3, "index": "CPI" or null, "cap": 5 or null, "effectiveDate": "YYYY-MM-DD", "source": "quote"}
  ],
  "optOutDeadlines": [
    {"date": "YYYY-MM-DD", "description": "Last day to opt out", "source": "quote"}
  ],
  "renewalAlerts": [
    {"type": "warning/critical/info", "message": "Alert message", "dueDate": "YYYY-MM-DD"}
  ],
  "currentTermEnd": "YYYY-MM-DD" or null,
  "renewalCount": number or null,
  "summary": "Brief summary of renewal terms",
  "certainty": 0.85
}

CRITICAL: Only extract renewal terms EXPLICITLY stated. Calculate optOutDeadline based on noticePeriodDays + currentTermEnd if both available.

Contract text:
${truncatedText}`,

      NEGOTIATION_POINTS: `Analyze this contract for negotiation leverage points and weaknesses. Return JSON with:
{
  "leveragePoints": [
    {
      "id": "lp_1",
      "title": "Leverage point title",
      "description": "Why this is advantageous",
      "category": "pricing/terms/liability/sla/termination",
      "strength": "strong/moderate/weak",
      "suggestedAction": "How to leverage this",
      "sourceClause": "Section reference",
      "extractedFromText": true
    }
  ],
  "weakClauses": [
    {
      "id": "wc_1",
      "clauseReference": "Section X.X",
      "issue": "What's problematic",
      "impact": "high/medium/low",
      "suggestedRevision": "Proposed better language",
      "benchmarkComparison": "Market standard for comparison",
      "extractedFromText": true
    }
  ],
  "benchmarkGaps": [
    {
      "area": "Payment Terms",
      "currentTerm": "Net 15",
      "marketStandard": "Net 30",
      "gap": "Below market",
      "recommendation": "Negotiate to Net 30"
    }
  ],
  "negotiationScript": [
    {
      "topic": "Payment Terms",
      "openingPosition": "We propose Net 45",
      "fallbackPosition": "We can accept Net 30",
      "walkAwayPoint": "Net 15 is unacceptable",
      "supportingEvidence": ["Industry standard is Net 30", "Our cash flow requires 30+ days"]
    }
  ],
  "overallLeverage": "strong/balanced/weak",
  "summary": "Brief negotiation strategy summary",
  "certainty": 0.85
}

CRITICAL: Base ALL analysis on actual contract language. DO NOT invent leverage points not supported by the text.

Contract text:
${truncatedText}`,

      AMENDMENTS: `Extract all amendments, modifications, and change history from this contract. Return JSON with:
{
  "amendments": [
    {
      "id": "amd_1",
      "amendmentNumber": 1,
      "effectiveDate": "YYYY-MM-DD",
      "title": "Amendment title",
      "description": "Brief description",
      "changedClauses": [
        {"clauseId": "Section 5.2", "originalText": "Old text" or null, "newText": "New text", "changeType": "added/modified/deleted"}
      ],
      "signedBy": ["Party names"],
      "sourceDocument": "Amendment 1 dated MM/DD/YYYY",
      "extractedFromText": true
    }
  ],
  "supersededClauses": [
    {"originalClause": "Section 3.1", "supersededBy": "Amendment 2, Section 3.1", "effectiveDate": "YYYY-MM-DD"}
  ],
  "changeLog": [
    {"date": "YYYY-MM-DD", "type": "Amendment/Addendum/Modification", "description": "Change description", "reference": "Amendment 1"}
  ],
  "consolidatedTerms": {
    "lastUpdated": "YYYY-MM-DD",
    "version": "2.0",
    "effectiveTerms": ["List of current effective provisions"]
  },
  "summary": "Brief amendment history summary",
  "certainty": 0.85
}

CRITICAL: Only extract amendments EXPLICITLY documented. If this is the original contract with no amendments, return empty arrays.

Contract text:
${truncatedText}`,

      CONTACTS: `Extract all key contacts, notification addresses, and escalation paths from this contract. Return JSON with:
{
  "primaryContacts": [
    {
      "id": "con_1",
      "name": "Contact name",
      "role": "Project Manager",
      "party": "Client/Vendor name",
      "email": "email@example.com" or null,
      "phone": "+1-555-0123" or null,
      "address": "Full address" or null,
      "isPrimary": true/false,
      "extractedFromText": true
    }
  ],
  "escalationPath": [
    {
      "level": 1,
      "role": "Account Manager",
      "name": "Name if specified" or null,
      "contactInfo": "Contact details",
      "escalationTrigger": "When to escalate"
    }
  ],
  "notificationAddresses": [
    {
      "purpose": "Legal Notices/Billing/Technical/General",
      "party": "Party name",
      "address": "Full address",
      "format": "Certified Mail/Email/Both"
    }
  ],
  "keyPersonnel": [
    {
      "name": "Person name",
      "role": "Their title/role",
      "responsibilities": ["List", "of", "duties"],
      "party": "Party name"
    }
  ],
  "summary": "Brief contacts summary",
  "certainty": 0.85
}

CRITICAL: Only extract contact information EXPLICITLY stated. DO NOT invent contacts or assume standard roles.

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
    OBLIGATIONS: { obligations: [], milestones: [], slaMetrics: [], reportingRequirements: [], summary: null, certainty: 0, _meta: { fallback: true } },
    RENEWAL: { autoRenewal: null, renewalTerms: null, terminationNotice: null, priceEscalation: [], optOutDeadlines: [], renewalAlerts: [], summary: null, certainty: 0, _meta: { fallback: true } },
    NEGOTIATION_POINTS: { leveragePoints: [], weakClauses: [], benchmarkGaps: [], negotiationScript: [], overallLeverage: null, summary: null, certainty: 0, _meta: { fallback: true } },
    AMENDMENTS: { amendments: [], supersededClauses: [], changeLog: [], consolidatedTerms: null, summary: null, certainty: 0, _meta: { fallback: true } },
    CONTACTS: { primaryContacts: [], escalationPath: [], notificationAddresses: [], keyPersonnel: [], summary: null, certainty: 0, _meta: { fallback: true } },
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
