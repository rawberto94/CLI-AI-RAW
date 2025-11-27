import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { hybridSearch } from '@/lib/rag/advanced-rag.service'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Mock AI responses based on context
const mockAIResponses: Record<string, (query: string, context: any) => any> = {
  'high-risk contracts': (query, context) => ({
    response: `I found **5 high-risk contracts** that require attention:

1. **Acme Corp MSA** - Risk Score: 78/100
   - Issues: Unlimited liability clause, no termination cap
   - Action: Review liability terms with legal

2. **TechVendor Agreement** - Risk Score: 72/100
   - Issues: Auto-renewal without notice, steep penalties
   - Action: Set calendar reminder 90 days before renewal

3. **Global Services Contract** - Risk Score: 85/100
   - Issues: Non-standard indemnification, data breach liability
   - Action: Immediate legal review required

Would you like me to create a detailed risk report or schedule reviews for these contracts?`,
    sources: [
      'Contract: Acme Corp MSA (ID: contract-001)',
      'Contract: TechVendor Agreement (ID: contract-034)',
      'Risk Analysis Dashboard',
    ],
    suggestedActions: [
      { label: '📊 Generate Risk Report', action: 'generate-risk-report' },
      { label: '📅 Schedule Legal Reviews', action: 'schedule-reviews' },
      { label: '🔍 View All High-Risk Contracts', action: 'view-high-risk' },
    ],
    suggestions: [
      'Show me details for Acme Corp MSA',
      'What are common risk patterns?',
      'Create a risk mitigation plan',
    ],
  }),

  'expire': (query, context) => ({
    response: `I found **12 contracts expiring in the next 30 days**:

**Critical (7 days or less):**
• Master Services Agreement - Acme Corp (expires in 3 days) - $250K/year
• NDA - TechPartner Inc (expires in 5 days)

**Urgent (7-14 days):**
• Software License - CloudVendor (expires in 9 days) - $120K/year
• Consulting Agreement - Strategy Co (expires in 11 days) - $80K/year

**Total Annual Value at Risk: $450,000**

I recommend sending renewal reminders immediately for the critical contracts.`,
    sources: ['Deadlines Dashboard', 'Contract Renewals Report'],
    suggestedActions: [
      { label: '📧 Send Renewal Reminders', action: 'send-reminders' },
      { label: '📊 Create Renewal Report', action: 'create-report' },
    ],
    suggestions: [
      'What is the renewal process for Acme Corp?',
      'Show me all auto-renewing contracts',
    ],
  }),

  'pending approvals': (query, context) => ({
    response: `You have **8 pending approvals** across different workflows:

**Urgent (Waiting >5 days):**
1. Contract Review - Global Services Agreement (waiting 7 days)
2. Template Approval - Updated NDA Template (waiting 6 days)

**Recent (<2 days):**
3. Signature Request - Vendor Agreement
4. Workflow Step - MSA Amendment

Would you like me to open the approval interface?`,
    sources: ['Workflow Dashboard', 'Your Pending Tasks'],
    suggestedActions: [
      { label: '✅ Approve All Standard Items', action: 'bulk-approve' },
      { label: '👀 Review Urgent Items', action: 'review-urgent' },
    ],
    suggestions: ['Show me the Global Services Agreement', 'Who else needs to approve these?'],
  }),

  'summarize': (query, context) => ({
    response: `**Contract Summary: Master Service Agreement**

**Key Details:**
• Parties: Acme Corporation ↔ Your Company
• Effective: January 15, 2024
• Term: 12 months (expires in 45 days)
• Value: $250,000/year

**Key Terms:**
• Payment: Net-30 days
• Liability Cap: $500,000
• Termination: 60-day notice

**Risk Score: 68/100 (Medium-High)**

**Recommended Actions:**
1. Schedule renewal discussion
2. Review scope clarity issues

Would you like a detailed risk report?`,
    sources: ['Contract: MSA-Acme-Corp-2024', 'Risk Analysis Report'],
    suggestedActions: [
      { label: '📅 Schedule Renewal Meeting', action: 'schedule-renewal' },
      { label: '⚠️ View Detailed Risks', action: 'view-risks' },
    ],
    suggestions: ['What are the active SOWs?', 'Compare to similar MSAs'],
  }),

  'default': (query, context) => ({
    response: `I understand you're asking about "${query}". 

I can help you with:
• Contract Analysis & Search
• Deadlines & Renewals
• Workflows & Approvals
• Templates & Clauses
• Analytics & Reports

Could you provide more details about what you'd like to know?`,
    sources: [],
    suggestedActions: [
      { label: '🔍 Search Contracts', action: 'search-contracts' },
      { label: '📊 View Dashboard', action: 'view-dashboard' },
    ],
    suggestions: [
      'Show me all high-risk contracts',
      'What contracts expire soon?',
      'Summarize my pending approvals',
    ],
  }),
};

function selectResponse(query: string, context: any) {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('high-risk') || lowerQuery.includes('risky')) {
    return mockAIResponses['high-risk contracts']?.(query, context);
  }
  if (lowerQuery.includes('expire') || lowerQuery.includes('renewal')) {
    return mockAIResponses['expire']?.(query, context);
  }
  if (lowerQuery.includes('pending') || lowerQuery.includes('approval')) {
    return mockAIResponses['pending approvals']?.(query, context);
  }
  if (lowerQuery.includes('summarize') || lowerQuery.includes('summary')) {
    return mockAIResponses['summarize']?.(query, context);
  }

  return mockAIResponses['default']?.(query, context);
}

async function getOpenAIResponse(message: string, conversationHistory: any[], context: any) {
  try {
    // Check if the query needs RAG search
    const needsRAG = shouldUseRAG(message);
    let ragContext = '';
    let ragSources: string[] = [];

    if (needsRAG) {
      try {
        // Use advanced RAG to find relevant contract content
        const ragResults = await hybridSearch(message, {
          mode: 'hybrid',
          k: 5,
          rerank: true,
          expandQuery: true,
          filters: context?.tenantId ? { tenantId: context.tenantId } : {},
        });

        if (ragResults.length > 0) {
          ragContext = `\n\n**Relevant Contract Information Found:**\n${ragResults.map((r, i) => 
            `[${i + 1}] From "${r.contractName}" (${Math.round(r.score * 100)}% match):\n${r.text.slice(0, 500)}...`
          ).join('\n\n')}`;
          
          ragSources = ragResults.map(r => `Contract: ${r.contractName} (ID: ${r.contractId})`);
        }
      } catch (ragError) {
        console.error('RAG search error:', ragError);
        // Continue without RAG results
      }
    }

    const systemPrompt = `You are an AI assistant for a Contract Lifecycle Management (CLM) system. You help users with:
- Searching and analyzing contracts
- Managing deadlines and renewals
- Creating templates and clauses
- Identifying risks and compliance issues
- Workflow approvals and signatures
- Generating reports and insights

Current context: ${context?.context || 'global'}
Contract ID: ${context?.contractId || 'none'}
${ragContext}

When answering:
1. Be concise and actionable
2. Use markdown formatting (bold, bullets, headers)
3. Reference specific contracts when relevant
4. Suggest next steps or related queries
5. If you found contract information above, cite it in your response`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseContent = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

    return {
      response: responseContent,
      sources: ragSources.length > 0 ? ragSources : ['AI-generated response', 'CLM Database'],
      suggestedActions: [
        { label: '🔍 Search Contracts', action: 'search-contracts' },
        { label: '📊 View Dashboard', action: 'view-dashboard' },
      ],
      suggestions: [
        'Tell me more about this',
        'What are the next steps?',
        'Show me related contracts',
      ],
    };
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

// Determine if the query should use RAG search
function shouldUseRAG(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Keywords that indicate contract search is needed
  const ragKeywords = [
    'find', 'search', 'show me', 'where', 'what', 'which',
    'contract', 'clause', 'term', 'liability', 'termination',
    'payment', 'renewal', 'expire', 'obligation', 'risk',
    'indemnif', 'sla', 'warranty', 'confidential', 'vendor',
    'supplier', 'agreement', 'msa', 'nda', 'sow',
  ];
  
  return ragKeywords.some(keyword => lowerQuery.includes(keyword));
}

export async function POST(request: NextRequest) {
  try {
    const { message, contractId, context, conversationHistory, useMock = false } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    let response;

    if (useMock) {
      // Use mock responses
      response = selectResponse(message, { contractId, context, conversationHistory });
      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
    } else {
      // Use real OpenAI
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json(
          { error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file or enable mock mode.' },
          { status: 500 }
        );
      }
      response = await getOpenAIResponse(message, conversationHistory || [], { contractId, context });
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
