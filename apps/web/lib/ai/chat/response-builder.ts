import OpenAI from 'openai';
import { hybridSearch } from '@/lib/rag/advanced-rag.service';
import { prisma } from '@/lib/prisma';
import { getContractContext } from './contract-context';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '' });

export async function getOpenAIResponse(message: string, conversationHistory: Array<{ role?: string; content?: string }>, context: Record<string, any>) {
  try {
    // Extract intent entities for smart RAG triggering
    const intentEntities = context?.intent?.entities;
    
    // Check if the query needs RAG search (enhanced with intent classification)
    const needsRAG = shouldUseRAG(message, intentEntities);
    let ragContext = '';
    let ragSources: string[] = [];
    let contractContext = '';
    let ragSearchResults: Array<{ contractId?: string; contractName?: string; score?: number; content?: string }> = []; // Store actual RAG results

    // If we have a specific contract ID, fetch its details directly
    if (context?.contractId) {
      contractContext = await getContractContext(context.contractId);
      if (contractContext) {
        ragSources.push(`Contract: ${context.contractId}`);
      }
    }

    if (needsRAG) {
      try {
        // ENHANCED: Increase search depth for implicit contract queries or recommendation requests
        const searchDepth = intentEntities?.hasImplicitContractContext || intentEntities?.isAskingRecommendation ? 10 : 7;
        
        // Use advanced RAG to find relevant contract content
        const searchResults = await hybridSearch(message, {
          mode: 'hybrid',
          k: searchDepth,
          rerank: true,
          expandQuery: true,
          filters: context?.tenantId ? { tenantId: context.tenantId } : {} });

        if (searchResults.length > 0) {
          ragSearchResults = searchResults; // Store for returning to frontend
          
          // Build enhanced RAG context with better formatting
          ragContext = `\n\n**🔍 Relevant Contract Information Found (${searchResults.length} matches):**\n\n`;
          
          searchResults.forEach((r, i) => {
            const matchScore = Math.round(r.score * 100);
            const urgencyIcon = matchScore >= 90 ? '🎯' : matchScore >= 75 ? '✅' : '📄';
            
            ragContext += `---\n`;
            ragContext += `**${urgencyIcon} Match ${i + 1}: [${r.contractName}](/contracts/${r.contractId})** (${matchScore}% relevance)\n`;
            
            // Add metadata if available
            if (r.supplierName) ragContext += `• Supplier: ${r.supplierName}\n`;
            if (r.metadata?.chunkType) ragContext += `• Section: ${r.metadata.chunkType.replace('_', ' ').toLowerCase()}\n`;
            
            // Add the actual content excerpt
            ragContext += `\n> ${r.text.slice(0, 600).replace(/\n/g, '\n> ')}${r.text.length > 600 ? '...' : ''}\n\n`;
          });
          
          ragSources = [...ragSources, ...searchResults.map(r => `Contract: ${r.contractName} (ID: ${r.contractId})`)];
        }
      } catch {
        // Continue without RAG results
      }
      
      // FALLBACK: If RAG search returned nothing and we have a tenant, search rawText directly
      if (ragSearchResults.length === 0 && context?.tenantId) {
        try {
          const rawTextResults = await prisma.contract.findMany({
            where: {
              tenantId: context.tenantId,
              rawText: { not: null },
              NOT: { rawText: '' },
            },
            select: {
              id: true,
              fileName: true,
              rawText: true,
              supplierName: true,
              contractType: true,
              status: true,
            },
            take: 5,
            orderBy: { updatedAt: 'desc' },
          });
          
          // Simple keyword matching on rawText
          const queryTerms = message.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
          const matched = rawTextResults
            .filter(c => c.rawText && queryTerms.some((term: string) => c.rawText!.toLowerCase().includes(term)))
            .slice(0, 3);
          
          if (matched.length > 0) {
            ragContext = `\n\n**📄 Contract Content (keyword match from rawText):**\n\n`;
            matched.forEach((c, i) => {
              const excerpt = c.rawText!.substring(0, 800);
              ragContext += `---\n`;
              ragContext += `**Match ${i + 1}: [${c.fileName}](/contracts/${c.id})**`;
              if (c.contractType) ragContext += ` (${c.contractType})`;
              if (c.supplierName) ragContext += ` • ${c.supplierName}`;
              ragContext += `\n`;
              ragContext += `> ${excerpt.replace(/\n/g, '\n> ')}${c.rawText!.length > 800 ? '...' : ''}\n\n`;
            });
          }
        } catch {
          // Silently continue without rawText fallback
        }
      }
    }

    const systemPrompt = `You are ConTigo AI, a friendly and intelligent contract management assistant for the ConTigo platform. You can understand and respond to ANY question or request - whether it's about contracts, general topics, or just casual conversation.

**🌟 YOUR PERSONALITY:**
- Friendly, helpful, and conversational
- Professional but approachable
- Proactive in offering assistance
- Honest when you don't have specific information
- Creative in finding solutions

**🤖 YOUR CORE CAPABILITIES:**

1. **Contract Analysis & Intelligence**
   - Analyze contracts by supplier, category, year, status, or any criteria
   - Summarize contracts with value analysis, duration insights, and risks
   - Compare contracts across suppliers, time periods, or categories
   - Search contract content using semantic understanding

2. **Business Intelligence**
   - Spending analysis and cost insights
   - Renewal and expiration tracking
   - Risk identification (expiring, auto-renewals, high-value)
   - Supplier performance analysis

3. **Natural Conversation**
   - Answer general questions to the best of your ability
   - Engage in friendly conversation
   - Explain concepts clearly
   - Provide guidance on using the platform

4. **Contract Taxonomy**
   - 10 main categories: Master/Framework, Scope/Work Authorization, Performance/Operations, Purchase/Supply, Data/Security/Privacy, Confidentiality/IP, Software/Cloud, Partnerships/JV, HR/Employment, Compliance/Regulatory
   - Document roles: Primary, Supporting, Derivative, Reference, Amendment, Superseded, Template
   - Pricing models, delivery models, risk flags, and data profiles

5. **Contract Relationships**
   - Parent-child hierarchies (MSA → SOW, Framework → Work Orders)
   - Amendments, addendums, renewals, and change orders
   - Navigate contract families and hierarchies

6. **Natural Language Understanding**
   - Understand complex queries like "summarize all Deloitte contracts from 2024 with their durations and values"
   - Handle multi-criteria filters naturally including taxonomy categories
   - Provide context-aware responses based on what you find

**📊 ANALYSIS DATA PROVIDED:**
${context?.additionalContext || 'No specific analysis data available - I will search for relevant information.'}

**🔍 RAG SEARCH RESULTS:**
${ragContext || 'No semantic search results available.'}

**📄 CURRENT CONTRACT CONTEXT:**
${contractContext || 'No specific contract selected.'}

**DETECTED INTENT:** ${context?.intent ? JSON.stringify(context.intent) : 'general inquiry'}

**🧠 SMART CONTEXT DETECTION:**
${intentEntities?.questionType ? `- Question Type: ${intentEntities.questionType} (user wants ${intentEntities.questionType === 'time' ? 'timeline/date information' : intentEntities.questionType === 'reason' ? 'explanations/justifications' : intentEntities.questionType === 'quantity' ? 'counts/amounts' : intentEntities.questionType === 'entity' ? 'names/parties' : 'general information'})` : ''}
${intentEntities?.hasImplicitContractContext ? '- DETECTED implicit contract/business context in query - treating as contract-related' : ''}
${intentEntities?.hasUrgency ? '- URGENCY DETECTED - prioritize immediate/critical items' : ''}
${intentEntities?.isAskingRecommendation ? '- User wants RECOMMENDATIONS - provide actionable suggestions' : ''}
${intentEntities?.isClarificationRequest ? '- User seems to be following up or clarifying - consider conversation history' : ''}

**📝 RESPONSE GUIDELINES:**
1. **Be conversational and helpful** - respond naturally to ANY question or statement
2. When analysis data is provided above, USE IT to give detailed, data-driven responses
3. **For greetings**: Respond warmly and offer to help with contracts or answer questions
4. **For farewells**: Say goodbye professionally and offer to help again anytime
5. **For general questions**: Answer to the best of your ability, being honest if you don't know
6. **For contract questions**: ALWAYS include clickable links using [Contract Name](/contracts/CONTRACT_ID)
7. Structure longer responses with clear sections using markdown (##, **, bullets)
8. Suggest relevant follow-up questions based on the conversation
9. If you can't help with something, explain why and suggest alternatives
10. Be friendly, professional, and proactive in offering assistance
11. For off-topic questions, provide a helpful response and gently steer back to contracts if relevant
12. Use emojis sparingly but effectively to make responses engaging

**💬 HANDLING DIFFERENT MESSAGE TYPES:**
- **Greetings (hi, hello, hey)**: "Hello! 👋 I'm ConTigo AI, your contract assistant. I can help you analyze contracts, find information, track renewals, and much more. What would you like to know?"
- **Help requests**: Explain your capabilities clearly and offer examples
- **General questions**: Answer honestly, then relate to contracts if relevant
- **Off-topic**: Be helpful but explain your primary focus is contracts
- **Unclear requests**: Ask clarifying questions rather than guessing

**🚫 LIMITATIONS (be honest about these):**
- Workflow approvals/signatures (coming soon)
- Direct contract creation (suggest Upload feature instead)
- Legal advice (recommend consulting legal team)
- Real-time external data (use only provided context)`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg: { role?: string; content?: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content || '' })),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: 2000 });

    const responseContent = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

    // Format RAG results for frontend - use actual search results
    const formattedRagResults = ragSearchResults.length > 0 
      ? ragSearchResults.slice(0, 5).map(r => ({
          contractId: r.contractId,
          contractName: r.contractName || 'Unknown Contract',
          score: r.score || 0.85,
          text: (r as any).text?.slice(0, 200) + '...' || r.content?.slice(0, 200) + '...' || '',
          chunkType: (r as any).metadata?.chunkType || 'content' }))
      : [];

    // Generate smart, context-aware suggested actions based on intent and results
    const smartSuggestedActions = generateSmartSuggestedActions(context?.intent, ragSearchResults, context);
    const smartSuggestions = generateSmartFollowUpSuggestions(message, context?.intent, ragSearchResults);

    return {
      response: responseContent,
      sources: ragSources.length > 0 ? ragSources : ['AI-generated response', 'CLM Database'],
      ragResults: formattedRagResults.length > 0 ? formattedRagResults : undefined,
      usedRAG: ragSearchResults.length > 0,
      ragSearchCount: ragSearchResults.length,
      confidence: ragSearchResults.length > 0 ? 0.95 : 0.85,
      intent: { type: context?.intent?.type || 'general' },
      suggestedActions: smartSuggestedActions,
      suggestions: smartSuggestions };
  } catch (error: unknown) {
    throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Generate smart, context-aware suggested actions
 
export function generateSmartSuggestedActions(intent: { type?: string; action?: string; entities?: Record<string, any> }, ragResults: Array<{ contractId?: string; contractName?: string }>, context: Record<string, any>): Array<{ label: string; action: string }> {
  const actions: Array<{ label: string; action: string }> = [];
  
  // Intent-based actions
  if (intent?.type === 'list') {
    if (intent.action === 'list_by_supplier') {
      actions.push({ label: '📊 Supplier Analytics', action: 'supplier-analytics' });
      actions.push({ label: '🔄 Start Renewal', action: 'start-renewal' });
    } else if (intent.action === 'list_expiring') {
      actions.push({ label: '🔔 Set Reminders', action: 'set-reminders' });
      actions.push({ label: '📧 Notify Stakeholders', action: 'notify-stakeholders' });
    } else if (intent.action === 'list_by_status') {
      actions.push({ label: '📋 Export List', action: 'export-list' });
    }
  } else if (intent?.type === 'analytics') {
    actions.push({ label: '📈 Deep Dive', action: 'deep-analysis' });
    actions.push({ label: '📊 Generate Report', action: 'generate-report' });
  } else if (intent?.type === 'search') {
    actions.push({ label: '🔍 Refine Search', action: 'refine-search' });
  }
  
  // If we have RAG results, add contract-specific actions
  if (ragResults && ragResults.length > 0) {
    const firstContract = ragResults[0];
    actions.push({ 
      label: `📄 View ${firstContract.contractName?.slice(0, 20)}...`, 
      action: `view-contract:${firstContract.contractId}` 
    });
  }
  
  // Always include some default helpful actions
  if (actions.length === 0) {
    actions.push({ label: '🔍 Search Contracts', action: 'search-contracts' });
    actions.push({ label: '📊 View Dashboard', action: 'view-dashboard' });
  }
  
  // Limit to 3 most relevant actions
  return actions.slice(0, 3);
}

// Generate smart follow-up suggestions based on context
export function generateSmartFollowUpSuggestions(query: string, intent: { type?: string; action?: string; entities?: Record<string, unknown> }, ragResults: Array<{ contractId?: string; contractName?: string }>): string[] {
  const suggestions: string[] = [];
  const lowerQuery = query.toLowerCase();
  
  // Intent-based suggestions
  if (intent?.type === 'list') {
    if (intent.action === 'list_by_supplier' && intent.entities?.supplierName) {
      suggestions.push(`What's the total spend with ${intent.entities.supplierName}?`);
      suggestions.push(`Which ${intent.entities.supplierName} contracts expire soon?`);
      suggestions.push(`Compare ${intent.entities.supplierName} rates with market`);
    } else if (intent.action === 'list_expiring') {
      suggestions.push('Which ones are auto-renewing?');
      suggestions.push('Show me the highest value expiring contracts');
      suggestions.push('What are the renewal options?');
    }
  } else if (intent?.type === 'analytics') {
    suggestions.push('How does this compare to last year?');
    suggestions.push('Show me the trend over time');
    suggestions.push('What are the main risk factors?');
  }
  
  // Query-based suggestions
  if (lowerQuery.includes('compare') || lowerQuery.includes('vs')) {
    suggestions.push('Which one offers better terms?');
    suggestions.push('Show me the key differences');
  }
  
  if (lowerQuery.includes('risk') || lowerQuery.includes('expire')) {
    suggestions.push('What actions should I take?');
    suggestions.push('Who should I notify?');
  }
  
  // RAG-based suggestions
  if (ragResults && ragResults.length > 0) {
    suggestions.push('Tell me more about the first result');
    suggestions.push('Are there similar contracts?');
  }
  
  // Default fallback suggestions
  if (suggestions.length === 0) {
    suggestions.push('Tell me more about this');
    suggestions.push('What should I do next?');
    suggestions.push('Show me related contracts');
  }
  
  // Return unique suggestions, limited to 3
  return [...new Set(suggestions)].slice(0, 3);
}

// Determine if the query should use RAG search
// Enhanced with smart intent classification for better context detection
export function shouldUseRAG(query: string, intentEntities?: Record<string, any>): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Skip RAG for simple greetings/farewells
  const skipPatterns = [
    /^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening))[\s!.]*$/i,
    /^(?:bye|goodbye|thanks|thank you|cheers)[\s!.]*$/i,
  ];
  if (skipPatterns.some(p => p.test(query.trim()))) {
    return false;
  }
  
  // ENHANCED: If intent classification detected implicit contract context, always use RAG
  if (intentEntities?.hasImplicitContractContext) {
    return true;
  }
  
  // ENHANCED: If user is asking for recommendations related to contracts, use RAG
  if (intentEntities?.isAskingRecommendation && 
      (intentEntities?.questionType === 'information' || intentEntities?.questionType === 'entity')) {
    return true;
  }
  
  // ENHANCED: If query has urgency and relates to business context, use RAG
  if (intentEntities?.hasUrgency) {
    return true;
  }
  
  // Keywords that indicate contract search is needed
  const ragKeywords = [
    'find', 'search', 'show me', 'where', 'what', 'which', 'how',
    'contract', 'clause', 'term', 'liability', 'termination',
    'payment', 'renewal', 'expire', 'obligation', 'risk',
    'indemnif', 'sla', 'warranty', 'confidential', 'vendor',
    'supplier', 'agreement', 'msa', 'nda', 'sow', 'about',
    'tell me', 'explain', 'describe', 'summarize', 'analyze',
    'compare', 'list', 'get', 'check', 'review', 'look',
  ];
  
  // Always use RAG for queries longer than a few words (likely asking about something)
  const wordCount = query.trim().split(/\s+/).length;
  if (wordCount >= 3) {
    return true;
  }
  
  return ragKeywords.some(keyword => lowerQuery.includes(keyword));
}
