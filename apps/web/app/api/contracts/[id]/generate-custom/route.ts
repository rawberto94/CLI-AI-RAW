/**
 * Custom Artifact Generation API
 * 
 * Generates custom artifacts based on user-specified topics and focus areas.
 * Leverages the AI artifact generator with custom prompts.
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Topic-specific system prompts
const TOPIC_PROMPTS: Record<string, string> = {
  liability: `You are a legal analyst specializing in liability and indemnification clauses. 
    Analyze the contract focusing on:
    - Limitation of liability clauses
    - Indemnification obligations
    - Insurance requirements
    - Caps on damages
    - Exclusions and carve-outs
    - Risk allocation between parties`,
  
  ip: `You are an intellectual property specialist. Analyze the contract focusing on:
    - IP ownership and assignment
    - License grants and restrictions
    - Work-for-hire provisions
    - Trade secret protections
    - Patent and trademark rights
    - Background and foreground IP`,
  
  termination: `You are a contract specialist focusing on term and termination. Analyze:
    - Contract duration and renewals
    - Termination for convenience
    - Termination for cause/breach
    - Notice requirements
    - Wind-down obligations
    - Survival clauses`,
  
  payment: `You are a financial analyst specializing in payment terms. Analyze:
    - Payment schedules and milestones
    - Pricing and fee structures
    - Late payment penalties
    - Currency and tax provisions
    - Invoice requirements
    - Audit rights`,
  
  confidentiality: `You are an information security specialist. Analyze:
    - Definition of confidential information
    - Permitted disclosures
    - Protection obligations
    - Duration of confidentiality
    - Return/destruction of information
    - Exceptions and carve-outs`,
  
  sla: `You are a service level expert. Analyze:
    - Performance metrics and KPIs
    - Uptime guarantees
    - Response times
    - Service credits and remedies
    - Measurement and reporting
    - Escalation procedures`,
  
  compliance: `You are a regulatory compliance specialist. Analyze:
    - Regulatory requirements
    - Data protection and privacy
    - Industry-specific compliance
    - Audit rights and obligations
    - Certification requirements
    - Reporting obligations`,
  
  custom: `You are a comprehensive contract analyst. Analyze the contract based on the user's specific focus area.`
};

interface GenerationRequest {
  topic: string;
  focusArea?: string;
  customPrompt?: string;
  contractId: string;
  tenantId?: string;
}

interface ArtifactResult {
  id: string;
  type: string;
  topic: string;
  title: string;
  summary: string;
  keyFindings: {
    title: string;
    description: string;
    severity?: 'high' | 'medium' | 'low';
    recommendation?: string;
  }[];
  riskScore: number;
  confidence: number;
  generatedAt: string;
  focusArea?: string;
  rawAnalysis?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params;
  
  const ctx = getApiContext(request);
  try {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    const body: GenerationRequest = await request.json();
    const { topic, focusArea, customPrompt } = body;

    // Validate topic
    if (!topic || !TOPIC_PROMPTS[topic]) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid topic. Valid topics: ', 400);
    }

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'AI service not configured. Please set OPENAI_API_KEY.', 503);
    }

    // Fetch contract text (mock for now, would fetch from database)
    const contractText = await getContractText(contractId, tenantId);
    
    if (!contractText) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found or has no text content', 404);
    }

    // Build the prompt
    const systemPrompt = TOPIC_PROMPTS[topic];
    const userPrompt = buildUserPrompt(topic, focusArea, customPrompt, contractText);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const rawAnalysis = completion.choices[0]?.message?.content || '{}';
    
    // Parse and structure the response
    const parsedAnalysis = parseAnalysis(rawAnalysis, topic, focusArea);

    return createSuccessResponse(ctx, {
      success: true,
      artifact: parsedAnalysis,
      usage: completion.usage
    });

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

function buildUserPrompt(
  topic: string, 
  focusArea?: string, 
  customPrompt?: string, 
  contractText?: string
): string {
  let prompt = `Analyze the following contract and provide a structured analysis.\n\n`;
  
  if (focusArea) {
    prompt += `Focus specifically on: ${focusArea}\n\n`;
  }
  
  if (customPrompt) {
    prompt += `Additional context: ${customPrompt}\n\n`;
  }
  
  prompt += `Contract text:\n${contractText}\n\n`;
  
  prompt += `Provide your analysis in the following JSON format:
{
  "title": "Analysis title",
  "summary": "Brief executive summary (2-3 sentences)",
  "keyFindings": [
    {
      "title": "Finding title",
      "description": "Detailed finding description",
      "severity": "high|medium|low",
      "recommendation": "Suggested action or consideration"
    }
  ],
  "riskScore": 0-100,
  "confidence": 0-100,
  "additionalNotes": "Any other relevant observations"
}`;

  return prompt;
}

function parseAnalysis(rawAnalysis: string, topic: string, focusArea?: string): ArtifactResult {
  try {
    const parsed = JSON.parse(rawAnalysis);
    
    return {
      id: `custom-${Date.now()}`,
      type: 'custom',
      topic,
      title: parsed.title || `${topic.charAt(0).toUpperCase() + topic.slice(1)} Analysis`,
      summary: parsed.summary || 'Analysis completed',
      keyFindings: parsed.keyFindings || [],
      riskScore: parsed.riskScore || 50,
      confidence: parsed.confidence || 85,
      generatedAt: new Date().toISOString(),
      focusArea,
      rawAnalysis
    };
  } catch {
    // Return structured response even if parsing fails
    return {
      id: `custom-${Date.now()}`,
      type: 'custom',
      topic,
      title: `${topic.charAt(0).toUpperCase() + topic.slice(1)} Analysis`,
      summary: rawAnalysis.slice(0, 200),
      keyFindings: [],
      riskScore: 50,
      confidence: 60,
      generatedAt: new Date().toISOString(),
      focusArea,
      rawAnalysis
    };
  }
}

async function getContractText(contractId: string, tenantId: string): Promise<string | null> {
  // In production, this would fetch from database
  // For now, return mock contract text
  
  try {
    // Try to fetch from internal API or database
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/contracts/${contractId}`,
      {
        headers: { 'x-tenant-id': tenantId }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.rawText || data.content || data.extractedText || null;
    }
  } catch {
    // Could not fetch contract text
  }
  
  // No mock fallback — return null so the caller can return a proper error
  return null;
}
