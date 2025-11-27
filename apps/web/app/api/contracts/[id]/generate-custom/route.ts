/**
 * Custom Artifact Generation API
 * 
 * Generates custom artifacts based on user-specified topics and focus areas.
 * Leverages the AI artifact generator with custom prompts.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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
  
  try {
    const body: GenerationRequest = await request.json();
    const { topic, focusArea, customPrompt, tenantId = 'demo' } = body;

    // Validate topic
    if (!topic || !TOPIC_PROMPTS[topic]) {
      return NextResponse.json(
        { error: 'Invalid topic. Valid topics: ' + Object.keys(TOPIC_PROMPTS).join(', ') },
        { status: 400 }
      );
    }

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      // Return mock data if no API key
      return NextResponse.json({
        success: true,
        artifact: generateMockArtifact(topic, focusArea),
        message: 'Generated using mock data (OpenAI not configured)'
      });
    }

    // Fetch contract text (mock for now, would fetch from database)
    const contractText = await getContractText(contractId, tenantId);
    
    if (!contractText) {
      return NextResponse.json(
        { error: 'Contract not found or has no text content' },
        { status: 404 }
      );
    }

    // Build the prompt
    const systemPrompt = TOPIC_PROMPTS[topic];
    const userPrompt = buildUserPrompt(topic, focusArea, customPrompt, contractText);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
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

    return NextResponse.json({
      success: true,
      artifact: parsedAnalysis,
      usage: completion.usage
    });

  } catch (error) {
    console.error('Custom artifact generation error:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate custom artifact', details: (error as Error).message },
      { status: 500 }
    );
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

function generateMockArtifact(topic: string, focusArea?: string): ArtifactResult {
  const topicTitles: Record<string, string> = {
    liability: 'Liability & Risk Analysis',
    ip: 'Intellectual Property Analysis',
    termination: 'Termination Rights Analysis',
    payment: 'Payment Terms Analysis',
    confidentiality: 'Confidentiality Analysis',
    sla: 'Service Level Analysis',
    compliance: 'Compliance Analysis',
    custom: 'Custom Analysis'
  };

  const mockFindings: Record<string, any[]> = {
    liability: [
      {
        title: 'Liability Cap Identified',
        description: 'Contract limits liability to the total fees paid in the preceding 12 months.',
        severity: 'medium',
        recommendation: 'Consider negotiating for a higher cap or carve-outs for willful misconduct.'
      },
      {
        title: 'Indemnification Asymmetry',
        description: 'The indemnification obligations appear to be more extensive for the buyer than the seller.',
        severity: 'high',
        recommendation: 'Request mutual indemnification terms or limit scope of buyer obligations.'
      }
    ],
    ip: [
      {
        title: 'IP Assignment Clause Present',
        description: 'All work product created under this agreement is assigned to the client.',
        severity: 'low',
        recommendation: 'Standard provision. Ensure background IP exceptions are clearly defined.'
      },
      {
        title: 'License Grant for Tools',
        description: 'Vendor retains ownership of pre-existing tools and grants a limited license.',
        severity: 'low',
        recommendation: 'Verify license scope covers intended business use.'
      }
    ],
    termination: [
      {
        title: 'Termination for Convenience',
        description: 'Either party may terminate with 30 days written notice.',
        severity: 'medium',
        recommendation: 'Consider negotiating for a longer notice period or transition assistance.'
      },
      {
        title: 'Auto-Renewal Clause',
        description: 'Contract auto-renews for 1-year terms unless notice given 60 days prior.',
        severity: 'high',
        recommendation: 'Set calendar reminder for renewal notice deadline.'
      }
    ],
    payment: [
      {
        title: 'Net-30 Payment Terms',
        description: 'Invoices are due within 30 days of receipt.',
        severity: 'low',
        recommendation: 'Standard payment terms. No action required.'
      },
      {
        title: 'Late Payment Interest',
        description: 'Late payments accrue interest at 1.5% per month.',
        severity: 'medium',
        recommendation: 'Ensure payment processes can meet deadlines to avoid charges.'
      }
    ],
    confidentiality: [
      {
        title: 'Broad Confidentiality Definition',
        description: 'Confidential information includes all non-public business information.',
        severity: 'low',
        recommendation: 'Ensure marking and identification procedures are in place.'
      },
      {
        title: '5-Year Confidentiality Period',
        description: 'Obligations survive for 5 years after contract termination.',
        severity: 'medium',
        recommendation: 'Track confidential materials for compliance with retention period.'
      }
    ],
    sla: [
      {
        title: '99.9% Uptime Guarantee',
        description: 'Service provider guarantees 99.9% monthly uptime.',
        severity: 'low',
        recommendation: 'Calculate acceptable downtime (43.8 minutes/month) against business needs.'
      },
      {
        title: 'Service Credit Cap',
        description: 'Maximum service credits limited to 10% of monthly fees.',
        severity: 'high',
        recommendation: 'May be insufficient for critical services. Negotiate higher cap.'
      }
    ],
    compliance: [
      {
        title: 'GDPR Compliance Required',
        description: 'Contract includes data processing addendum for EU data.',
        severity: 'medium',
        recommendation: 'Ensure internal processes align with DPA requirements.'
      },
      {
        title: 'Audit Rights Included',
        description: 'Customer has right to audit vendor compliance annually.',
        severity: 'low',
        recommendation: 'Schedule audits and maintain compliance documentation.'
      }
    ],
    custom: [
      {
        title: 'General Finding',
        description: focusArea || 'Analysis completed based on custom parameters.',
        severity: 'medium',
        recommendation: 'Review findings and consider follow-up analysis if needed.'
      }
    ]
  };

  return {
    id: `custom-${Date.now()}`,
    type: 'custom',
    topic,
    title: topicTitles[topic] || 'Custom Analysis',
    summary: `Comprehensive ${topic} analysis completed. ${mockFindings[topic]?.length || 1} key findings identified requiring attention.`,
    keyFindings: mockFindings[topic] || mockFindings.custom,
    riskScore: Math.floor(Math.random() * 30) + 40,
    confidence: Math.floor(Math.random() * 15) + 80,
    generatedAt: new Date().toISOString(),
    focusArea
  };
}

async function getContractText(contractId: string, tenantId: string): Promise<string | null> {
  // In production, this would fetch from database
  // For now, return mock contract text
  
  try {
    // Try to fetch from internal API or database
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'}/api/contracts/${contractId}`,
      {
        headers: { 'x-tenant-id': tenantId }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.rawText || data.content || data.extractedText || null;
    }
  } catch (e) {
    console.log('Could not fetch contract text, using mock');
  }
  
  // Return mock text for demo
  return `
    MASTER SERVICES AGREEMENT
    
    This Master Services Agreement ("Agreement") is entered into as of the Effective Date
    by and between Company A ("Client") and Company B ("Provider").
    
    1. SERVICES
    Provider shall provide the services described in each Statement of Work.
    
    2. TERM
    This Agreement shall commence on the Effective Date and continue for a period of
    three (3) years, unless earlier terminated.
    
    3. FEES AND PAYMENT
    Client shall pay Provider the fees set forth in each Statement of Work.
    Payment is due within thirty (30) days of invoice date.
    
    4. CONFIDENTIALITY
    Each party agrees to maintain the confidentiality of the other party's
    Confidential Information for a period of five (5) years.
    
    5. LIMITATION OF LIABILITY
    Neither party's liability shall exceed the total fees paid in the preceding
    twelve (12) month period.
    
    6. INDEMNIFICATION
    Each party shall indemnify the other against third-party claims arising from
    their breach of this Agreement.
    
    7. TERMINATION
    Either party may terminate this Agreement with thirty (30) days written notice.
    Termination for material breach may be immediate upon notice.
    
    8. INTELLECTUAL PROPERTY
    All work product created under this Agreement shall be owned by Client.
    Provider retains ownership of pre-existing materials and tools.
  `;
}
