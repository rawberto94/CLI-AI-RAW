/**
 * ⚠️ LEGACY Non-Streaming AI Chat API
 *
 * This route delegates to modular helpers under /lib/ai/chat/*.
 * The streaming endpoint at /api/ai/chat/stream is preferred for
 * new integrations.
 *
 * @deprecated Prefer /api/ai/chat/stream for all new integrations
 */

import { hybridSearch } from '@/lib/rag/advanced-rag.service'
import { prisma } from '@/lib/prisma'
import { conversationMemoryService } from 'data-orchestration/services'
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

// AI Chat modules
import { detectIntentWithLLMFallback } from '@/lib/ai/chat/intent-detection';
import {
  findMatchingContracts, listContractsBySupplier, listExpiringContracts,
  listContractsByStatus, listHighValueContracts, listContractsBySignatureStatus,
  listContractsByDocumentType, listNonContractDocuments, listContractsNeedingSignature,
  countContracts, getSupplierSummary
} from '@/lib/ai/chat/contract-queries';
import { getContractIntelligence, getProactiveInsights, searchContractsFlexible, compareContracts } from '@/lib/ai/chat/contract-intelligence';
import { getSpendAnalysis, getCostSavingsOpportunities, getRiskAssessment, getComplianceStatus, getSupplierPerformance } from '@/lib/ai/chat/procurement-analytics';
import { performDeepAnalysis, getRateComparison } from '@/lib/ai/chat/deep-analysis';
import { performContractComparison, compareContractClauses, performGroupComparison } from '@/lib/ai/chat/contract-comparison';
import { getTaxonomyCategories, getCategoryDetails, suggestCategoryForContract, getContractsInCategory } from '@/lib/ai/chat/taxonomy-operations';
import { findMasterAgreements, getContractHierarchy } from '@/lib/ai/chat/contract-hierarchy';
import { getOpenAIResponse } from '@/lib/ai/chat/response-builder';

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
  const userRole = ctx.userRole || 'VIEWER';

  // ── Rate limit: shared bucket with streaming endpoint ──
  const rl = checkRateLimit(tenantId, userId, '/api/ai/chat', { ...AI_RATE_LIMITS.streaming, identifier: 'ai-chat' });
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const { message, contractId, context: initialContext, conversationHistory, conversationId: providedConversationId } = await request.json()
    let context = initialContext || {};

    if (!message) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Message is required', 400);
    }

    // P0: Input length validation — prevent cost DoS via oversized messages
    const MAX_MESSAGE_LENGTH = 50_000;
    if (typeof message === 'string' && message.length > MAX_MESSAGE_LENGTH) {
      return createErrorResponse(ctx, 'BAD_REQUEST', `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`, 400);
    }
    if (Array.isArray(conversationHistory) && conversationHistory.length > 20) {
      conversationHistory.length = 20;
    }

    // ─── Role-based write protection (matches stream route) ─────────
    // FIX: Check intent-based actions, not exact message match (old check was dead code)
    const WRITE_ACTION_PATTERNS = [
      /\b(start|begin|kick\s*off|launch|initiate)\b.*\b(workflow|approval|review)\b/i,
      /\b(approve|reject|decline)\b.*\b(workflow|contract|step)\b/i,
      /\b(create|draft|add|new)\b.*\b(contract|agreement)\b/i,
      /\b(update|edit|modify|change)\b.*\b(contract|agreement)\b/i,
      /\b(delete|remove|cancel)\b.*\b(contract|agreement|workflow)\b/i,
    ];
    const lowerMsg = message.toLowerCase();
    const isWriteAction = WRITE_ACTION_PATTERNS.some(p => p.test(lowerMsg));
    if (userRole === 'VIEWER' && isWriteAction) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Your role does not allow write operations via chat. Contact an admin to upgrade your permissions.', 403);
    }

    // ============================================
    // CONVERSATION MEMORY INTEGRATION
    // ============================================
    let conversationId = providedConversationId;
    let resolvedMessage = message;
    let referenceResolutions: Array<{ type: string; originalText: string; resolvedValue: string; confidence: number }> = [];

    // Get or create conversation
    if (!conversationId) {
      conversationId = await conversationMemoryService.createConversation(tenantId, userId);
    }

    // Resolve references in the message ("it", "that contract", "the supplier")
    try {
      const resolutionResult = await conversationMemoryService.resolveReferences(
        conversationId,
        message,
        tenantId
      );
      resolvedMessage = resolutionResult.resolvedMessage;
      referenceResolutions = resolutionResult.resolutions;
    } catch {
      // Fallback to original message if reference resolution fails
      resolvedMessage = message;
    }

    // Save user message to conversation memory
    await conversationMemoryService.addMessage(conversationId, 'user', message);

    // Log reference resolutions for debugging
    if (referenceResolutions.length > 0) {
    }

    // Always use real OpenAI with real database data
    if (!process.env.OPENAI_API_KEY) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.', 500);
    }

    // Detect intent from the resolved message (with references resolved)
    const intent = await detectIntentWithLLMFallback(resolvedMessage);

    // Build database context based on detected intent
    let additionalContext = '';
    let contractPreviews: Array<{ id?: string; name?: string; supplier?: string; status?: string; value?: number; expirationDate?: string | null; daysUntilExpiry?: number | null; riskLevel?: string; type?: string }> = []; // Store contracts for visual preview cards
    let proactiveAlerts: string[] = []; // Store proactive alerts to show
    let proactiveInsightsData: string[] = []; // Store insights
    const suggestedActions: { label: string; action: string }[] = []; // Store action buttons
    
    // Helper to format contracts for preview cards - declare before use
    const formatContractForPreview = (c: { id?: string | null; contractTitle?: string | null; title?: string | null; name?: string | null; supplierName?: string | null; supplier?: string | null; status?: string | null; totalValue?: number | string | { toString(): string } | null; value?: number | string | null; expirationDate?: string | Date | null; contractType?: string | null; type?: string | null; fileName?: string | null; [key: string]: unknown }) => {
      const expiry = c.expirationDate ? new Date(c.expirationDate as string | Date) : null;
      const daysUntilExpiry = expiry ? Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
      
      return {
        id: c.id ?? undefined,
        name: c.contractTitle || c.title || c.name || 'Untitled Contract',
        supplier: c.supplierName || c.supplier || undefined,
        status: c.status ?? undefined,
        value: Number(c.totalValue || c.value || 0),
        expirationDate: expiry ? expiry.toISOString() : null,
        daysUntilExpiry: daysUntilExpiry,
        riskLevel: daysUntilExpiry !== null && daysUntilExpiry <= 30 ? 'high' : 
                   daysUntilExpiry !== null && daysUntilExpiry <= 90 ? 'medium' : 'low',
        type: c.contractType || c.type || 'CONTRACT' };
    };
    
    // Fetch proactive insights on first message or status/dashboard queries
    const isStatusQuery = /status|dashboard|overview|summary|what.*happening|urgent|critical|attention/i.test(message);
    if (isStatusQuery || (!conversationHistory || conversationHistory.length === 0)) {
      const insights = await getProactiveInsights(tenantId);
      proactiveAlerts = insights.criticalAlerts;
      proactiveInsightsData = insights.insights;
      
      // Add urgent contracts to previews if available
      if (insights.urgentContracts.length > 0 && contractPreviews.length === 0) {
        contractPreviews = insights.urgentContracts.map(formatContractForPreview);
      }
      
      // Add proactive alerts to context
      if (proactiveAlerts.length > 0 || proactiveInsightsData.length > 0) {
        additionalContext += `\n\n**⚡ PROACTIVE ALERTS:**\n${proactiveAlerts.join('\n')}\n\n**💡 INSIGHTS:**\n${proactiveInsightsData.join('\n')}`;
      }
    }

    // ============================================
    // CONVERSATIONAL HANDLERS (greetings, help, general)
    // Handle any type of message naturally
    // ============================================
    if (intent.action === 'greeting' || intent.action === 'farewell' || intent.action === 'help') {
      // Get a quick summary of the user's contracts for context
      const contractSummary = await prisma.contract.aggregate({
        where: { tenantId },
        _count: { id: true },
        _sum: { totalValue: true } });
      
      const expiringCount = await prisma.contract.count({
        where: { 
          tenantId,
          expirationDate: { 
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // Next 90 days
          },
          status: 'ACTIVE'
        } });

      additionalContext += `\n\n**📊 YOUR CONTRACT PORTFOLIO SUMMARY:**`;
      additionalContext += `\n- Total Contracts: ${contractSummary._count.id}`;
      additionalContext += `\n- Portfolio Value: $${Number(contractSummary._sum.totalValue || 0).toLocaleString()}`;
      additionalContext += `\n- Contracts Expiring in 90 Days: ${expiringCount}`;
      
      // Add helpful suggestions based on what user might want
      additionalContext += `\n\n**🎯 THINGS I CAN HELP YOU WITH:**`;
      additionalContext += `\n- "Show me contracts expiring soon"`;
      additionalContext += `\n- "Summarize all contracts from [Supplier Name]"`;
      additionalContext += `\n- "What contracts need attention?"`;
      additionalContext += `\n- "Compare Supplier A vs Supplier B"`;
      additionalContext += `\n- "Find contracts about [topic]"`;
    }
    
    // For general queries, always try RAG search to find relevant info
    if (intent.action === 'general' && intent.entities.searchQuery) {
      additionalContext += `\n\n**📋 HANDLING GENERAL QUERY:**`;
      additionalContext += `\nThe user asked: "${message}"`;
      additionalContext += `\nExtracted search terms: "${intent.entities.searchQuery}"`;
      additionalContext += `\nPlease provide a helpful, conversational response. If this relates to contracts, use the RAG results. If not, answer to the best of your ability.`;
    }

    // ============================================
    // CONTRACT-SPECIFIC INTELLIGENCE
    // When viewing a specific contract, provide deep context
    // ============================================
    if (contractId) {
      const intel = await getContractIntelligence(contractId, tenantId);
      if (intel) {
        // Add contract preview card
        contractPreviews = [{
          id: intel.contract.id,
          name: intel.contract.title,
          supplier: intel.contract.supplier ?? undefined,
          status: intel.contract.status ?? undefined,
          value: intel.contract.value,
          expirationDate: intel.contract.expirationDate ? new Date(intel.contract.expirationDate).toISOString() : null,
          daysUntilExpiry: intel.contract.daysUntilExpiry,
          riskLevel: intel.risks.level?.toLowerCase() || 'medium',
          type: intel.contract.type ?? undefined }];

        // Build comprehensive context from artifacts
        additionalContext += `\n\n**📄 CURRENT CONTRACT INTELLIGENCE:**\n`;
        additionalContext += `• **Name:** ${intel.contract.title}\n`;
        additionalContext += `• **Supplier:** ${intel.contract.supplier || 'Not specified'}\n`;
        additionalContext += `• **Value:** $${intel.contract.value.toLocaleString()}\n`;
        additionalContext += `• **Status:** ${intel.contract.status}\n`;
        if (intel.contract.daysUntilExpiry !== null) {
          const urgencyEmoji = intel.contract.daysUntilExpiry <= 30 ? '🔴' : intel.contract.daysUntilExpiry <= 90 ? '🟠' : '🟢';
          additionalContext += `• **Expiry:** ${urgencyEmoji} ${intel.contract.daysUntilExpiry} days (${intel.contract.expirationDate ? new Date(intel.contract.expirationDate).toLocaleDateString() : 'N/A'})\n`;
        }
        if (intel.contract.autoRenewal) {
          additionalContext += `• **Auto-Renewal:** ⚠️ Enabled\n`;
        }

        // Add extracted insights
        if (intel.insights.summary) {
          additionalContext += `\n**Summary:** ${intel.insights.summary}\n`;
        }
        if (intel.insights.paymentTerms && intel.insights.paymentTerms !== 'Not specified') {
          additionalContext += `• **Payment Terms:** ${typeof intel.insights.paymentTerms === 'object' ? JSON.stringify(intel.insights.paymentTerms) : intel.insights.paymentTerms}\n`;
        }
        if (intel.insights.terminationNotice && intel.insights.terminationNotice !== 'Not specified') {
          additionalContext += `• **Termination Notice:** ${intel.insights.terminationNotice} days\n`;
        }

        // Add critical clauses
        if (intel.insights.criticalClauses && intel.insights.criticalClauses.length > 0) {
          additionalContext += `\n**⚠️ Critical Clauses:**\n`;
          intel.insights.criticalClauses.forEach((clause: { title?: string; type?: string; summary?: string; text?: string }) => {
            additionalContext += `- ${clause.title || clause.type}: ${clause.summary || clause.text?.slice(0, 150) || 'See contract'}\n`;
          });
        }

        // Add risks
        if (intel.risks.factors && intel.risks.factors.length > 0) {
          additionalContext += `\n**🚨 Risk Factors (${intel.risks.level}):**\n`;
          intel.risks.factors.slice(0, 5).forEach((risk: string | { description?: string; factor?: string }) => {
            additionalContext += `- ${typeof risk === 'string' ? risk : risk.description || risk.factor}\n`;
          });
        }

        // Add obligations if available
        if (intel.obligations.ourObligations && intel.obligations.ourObligations.length > 0) {
          additionalContext += `\n**📋 Our Key Obligations:**\n`;
          intel.obligations.ourObligations.slice(0, 5).forEach((obl: string | { description?: string; title?: string }) => {
            additionalContext += `- ${typeof obl === 'string' ? obl : obl.description || obl.title}\n`;
          });
        }

        // Add rate card snippet if available
        if (intel.rates && intel.rates.length > 0) {
          additionalContext += `\n**💰 Rate Card (${intel.rates.length} roles):**\n`;
          intel.rates.slice(0, 5).forEach((rate: { role?: string; title?: string; rate?: number; hourlyRate?: number; amount?: number }) => {
            additionalContext += `- ${rate.role || rate.title}: $${rate.rate || rate.hourlyRate || rate.amount}/hr\n`;
          });
        }

        // Add relationships
        if (intel.relationships.parent) {
          additionalContext += `\n**🔗 Parent Contract:** [${intel.relationships.parent.contractTitle}](/contracts/${intel.relationships.parent.id})\n`;
        }
        if (intel.relationships.children && intel.relationships.children.length > 0) {
          additionalContext += `\n**🔗 Child Contracts (${intel.relationships.children.length}):**\n`;
          intel.relationships.children.slice(0, 3).forEach((child: { contractTitle?: string; id?: string; contractType?: string }) => {
            additionalContext += `- [${child.contractTitle}](/contracts/${child.id}) (${child.contractType})\n`;
          });
        }

        // ============================================
        // CONTRACT-SPECIFIC RAG SEARCH
        // When viewing a specific contract, use RAG to find relevant sections
        // This enables deep Q&A about the contract's content
        // ============================================
        const isContractSpecificQuestion = /\b(what|where|how|when|which|who|is there|are there|does|do|can|will|should|tell me|explain|describe|analyze|summarize|find|search|show|identify|list|extract)\b/i.test(message);
        
        if (isContractSpecificQuestion) {
          try {
            // Search within THIS contract only using RAG
            const contractSpecificResults = await hybridSearch(resolvedMessage, {
              mode: 'hybrid',
              k: 6,
              rerank: true,
              expandQuery: true,
              filters: { 
                tenantId,
                contractIds: [contractId], // Scope to this contract only
              } });

            if (contractSpecificResults.length > 0) {
              additionalContext += `\n\n**📑 RELEVANT CONTRACT SECTIONS (from RAG search):**\n`;
              contractSpecificResults.forEach((result, i) => {
                const sectionLabel = result.metadata?.heading || result.metadata?.section || `Section ${i + 1}`;
                const relevanceIcon = result.score >= 0.85 ? '🎯' : result.score >= 0.7 ? '✅' : '📄';
                additionalContext += `\n**${relevanceIcon} ${sectionLabel}** (${Math.round(result.score * 100)}% relevant):\n`;
                additionalContext += `> ${result.text.slice(0, 500).replace(/\n/g, ' ')}${result.text.length > 500 ? '...' : ''}\n`;
              });
              
              additionalContext += `\n*Use these contract sections to provide a precise, cited answer to the user's question. Quote specific text when relevant.*\n`;
            }
          } catch {
            // Continue without contract-specific RAG if it fails
          }
        }
      }
    }

    // ============================================
    // FLEXIBLE SEARCH FOR UNSTRUCTURED QUERIES
    // When user asks about something specific by name
    // FIX: Only run this if detectIntent() didn't already classify as 'search'
    // to avoid duplicate search results in additionalContext.
    // ============================================
    const searchMatch = message.match(/(?:find|search|show|get|about|tell me about)\s+(?:the\s+)?(?:contract\s+)?(?:with|for|called|named)?\s*["\']?([^"'\n]+?)["\']?(?:\s+contract)?$/i);
    if (searchMatch && !contractId && intent.type !== 'list' && intent.type !== 'search') {
      const searchTerm = searchMatch[1]?.trim();
      if (searchTerm && searchTerm.length > 2) {
        const searchResults = await searchContractsFlexible(searchTerm, tenantId, 5);
        if (searchResults.length > 0) {
          contractPreviews = searchResults.map(formatContractForPreview);
          additionalContext += `\n\n**🔍 Contracts matching "${searchTerm}":**\n`;
          searchResults.forEach((c, i) => {
            additionalContext += `${i + 1}. [${c.title}](/contracts/${c.id}) - ${c.supplier || 'Unknown'}, $${c.value.toLocaleString()}, ${c.status}\n`;
          });
        }
      }
    }

    // ============================================
    // CONTRACT-SPECIFIC DEEP ANALYSIS (from chatbot without contractId)
    // When user mentions a contract by name and wants to ask questions about it
    // ============================================
    if (!contractId && intent.entities.contractName && (
      intent.action === 'deep_analysis' || 
      intent.action === 'clause_search' || 
      intent.action === 'risk_assessment'
    )) {
      // First, find the contract by name
      const matchingContracts = await prisma.contract.findMany({
        where: {
          tenantId,
          OR: [
            { contractTitle: { contains: intent.entities.contractName, mode: 'insensitive' } },
            { supplierName: { contains: intent.entities.contractName, mode: 'insensitive' } },
            { fileName: { contains: intent.entities.contractName, mode: 'insensitive' } },
          ] },
        select: {
          id: true,
          contractTitle: true,
          supplierName: true,
          status: true,
          totalValue: true,
          expirationDate: true,
          contractType: true,
          fileName: true },
        take: 3 });

      if (matchingContracts.length > 0) {
        // Use the first matching contract (or the best match)
        const targetContract = matchingContracts[0];
        const contractTitle = targetContract.contractTitle || targetContract.fileName || 'Contract';
        
        // Add contract preview card
        contractPreviews = matchingContracts.map(c => formatContractForPreview({
          ...c,
          name: c.contractTitle || c.fileName }));
        
        additionalContext += `\n\n**📄 Analyzing: [${contractTitle}](/contracts/${targetContract.id})**\n`;
        additionalContext += `- Supplier: ${targetContract.supplierName || 'Not specified'}\n`;
        additionalContext += `- Value: $${Number(targetContract.totalValue || 0).toLocaleString()}\n`;
        additionalContext += `- Status: ${targetContract.status}\n`;
        
        // Now perform RAG search scoped to this contract
        const searchQuery = intent.entities.searchQuery || intent.entities.clauseTerm || message;
        try {
          const contractRagResults = await hybridSearch(searchQuery, {
            mode: 'hybrid',
            k: 8,
            rerank: true,
            expandQuery: true,
            filters: { 
              tenantId,
              contractIds: [targetContract.id], // Scope to this specific contract
            } });

          if (contractRagResults.length > 0) {
            additionalContext += `\n\n**📑 RELEVANT SECTIONS FROM ${contractTitle.toUpperCase()}:**\n`;
            contractRagResults.forEach((result, i) => {
              const sectionLabel = result.metadata?.heading || result.metadata?.section || `Section ${i + 1}`;
              const relevanceIcon = result.score >= 0.85 ? '🎯' : result.score >= 0.7 ? '✅' : '📄';
              additionalContext += `\n**${relevanceIcon} ${sectionLabel}** (${Math.round(result.score * 100)}% match):\n`;
              additionalContext += `> ${result.text.slice(0, 600).replace(/\n/g, ' ')}${result.text.length > 600 ? '...' : ''}\n`;
            });
            
            additionalContext += `\n*Based on the contract sections above, provide a detailed answer with citations. Quote specific text when answering.*\n`;
          } else {
            additionalContext += `\n\n⚠️ No specific sections found matching your query. The contract may not contain detailed text for RAG analysis.\n`;
          }
        } catch {
          // Continue without RAG results if search fails
        }
        
        if (matchingContracts.length > 1) {
          additionalContext += `\n\n*Note: Found ${matchingContracts.length} contracts matching "${intent.entities.contractName}". Analyzing the first match. Other matches:*\n`;
          matchingContracts.slice(1).forEach((c, i) => {
            additionalContext += `- [${c.contractTitle || c.fileName}](/contracts/${c.id})\n`;
          });
        }
      } else {
        additionalContext += `\n\n⚠️ Could not find a contract matching "${intent.entities.contractName}". Please check the contract name and try again, or [browse all contracts](/contracts).\n`;
      }
    }
    
    // ============================================
    // PROCUREMENT AGENT: Query real database based on intent
    // ============================================
    
    // For list intents - query database and add to context
    if (intent.type === 'list') {
       
      let contracts: any[] = [];
      if (intent.action === 'list_by_supplier' && intent.entities.supplierName) {
        contracts = await listContractsBySupplier(intent.entities.supplierName, tenantId);
        contractPreviews = contracts.map(formatContractForPreview);
        additionalContext = `\n\n**Contracts with ${intent.entities.supplierName}:**\n${contracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Status: ${c.status}, Value: $${Number(c.totalValue || 0).toLocaleString()}, Expires: ${c.expirationDate ? new Date(c.expirationDate).toLocaleDateString() : 'N/A'}`
        ).join('\n') || 'No contracts found.'}`;
      } else if (intent.action === 'list_expiring') {
        contracts = await listExpiringContracts(intent.entities.daysUntilExpiry || 30, tenantId, intent.entities.supplierName);
        contractPreviews = contracts.map(formatContractForPreview);
        additionalContext = `\n\n**Contracts Expiring in ${intent.entities.daysUntilExpiry || 30} Days:**\n${contracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Expires: ${c.expirationDate ? new Date(c.expirationDate).toLocaleDateString() : 'N/A'}, Supplier: ${c.supplierName}, Value: $${Number(c.totalValue || 0).toLocaleString()}`
        ).join('\n') || 'No expiring contracts found.'}`;
      } else if (intent.action === 'list_by_status' && intent.entities.status) {
        contracts = await listContractsByStatus(intent.entities.status, tenantId);
        contractPreviews = contracts.map(formatContractForPreview);
        additionalContext = `\n\n**${intent.entities.status} Contracts:**\n${contracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Supplier: ${c.supplierName}, Value: $${Number(c.totalValue || 0).toLocaleString()}`
        ).join('\n') || 'No contracts found.'}`;
      } else if (intent.action === 'list_by_value') {
        contracts = await listHighValueContracts(intent.entities.valueThreshold || 100000, tenantId);
        contractPreviews = contracts.map(formatContractForPreview);
        additionalContext = `\n\n**High Value Contracts (>$${(intent.entities.valueThreshold || 100000).toLocaleString()}):**\n${contracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Supplier: ${c.supplierName}, Value: $${Number(c.totalValue || 0).toLocaleString()}`
        ).join('\n') || 'No high-value contracts found.'}`;
      } else if (intent.action === 'list_by_signature' && intent.entities.signatureStatus) {
        // Query contracts by signature status from metadata
        contracts = await listContractsBySignatureStatus(intent.entities.signatureStatus, tenantId);
        contractPreviews = contracts.map(formatContractForPreview);
        const statusLabel = intent.entities.signatureStatus === 'signed' ? 'Signed' :
                           intent.entities.signatureStatus === 'partially_signed' ? 'Partially Signed' :
                           intent.entities.signatureStatus === 'unsigned' ? 'Unsigned' : 'Unknown Status';
        additionalContext = `\n\n**📝 ${statusLabel} Contracts:**\n${contracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Supplier: ${c.supplierName}, Status: ${c.status}, Signature: ${c.signatureStatus || 'unknown'}`
        ).join('\n') || `No ${statusLabel.toLowerCase()} contracts found.`}`;
      } else if (intent.action === 'list_needing_signature') {
        // Query contracts needing signature attention (flagged or unsigned/partially_signed)
        contracts = await listContractsNeedingSignature(tenantId);
        contractPreviews = contracts.map(formatContractForPreview);
        additionalContext = `\n\n**⚠️ Contracts Needing Signature Attention:**\n${contracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Supplier: ${c.supplierName}, Signature: ${c.signatureStatus || 'unknown'}${c.signatureRequiredFlag ? ' ⚠️ FLAGGED' : ''}`
        ).join('\n') || 'No contracts need signature attention.'}`;
      } else if (intent.action === 'list_by_document_type' && intent.entities.documentType) {
        // Query contracts by document classification
        contracts = await listContractsByDocumentType(intent.entities.documentType, tenantId);
        contractPreviews = contracts.map(formatContractForPreview);
        const typeLabels: Record<string, string> = {
          contract: 'Contracts',
          purchase_order: 'Purchase Orders',
          invoice: 'Invoices',
          quote: 'Quotes',
          proposal: 'Proposals',
          work_order: 'Work Orders',
          letter_of_intent: 'Letters of Intent',
          memorandum: 'Memoranda',
          amendment: 'Amendments',
          addendum: 'Addenda',
          unknown: 'Unknown Document Types' };
        const label = typeLabels[intent.entities.documentType] || intent.entities.documentType;
        additionalContext = `\n\n**📄 ${label}:**\n${contracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Supplier: ${c.supplierName}, Status: ${c.status}, Type: ${c.documentClassification || 'contract'}`
        ).join('\n') || `No ${label.toLowerCase()} found.`}`;
      } else if (intent.action === 'list_non_contracts') {
        // Query documents that are flagged as non-contracts
        contracts = await listNonContractDocuments(tenantId);
        contractPreviews = contracts.map(formatContractForPreview);
        additionalContext = `\n\n**⚠️ Non-Contract Documents:**\n${contracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Type: **${c.documentClassification?.replace(/_/g, ' ') || 'unknown'}**, Supplier: ${c.supplierName}`
        ).join('\n') || 'No non-contract documents found.'}`;
      }
    }

    // ============================================
    // SEMANTIC SEARCH INTENTS
    // For deep content search using RAG
    // ============================================
    if (intent.type === 'search') {
      const searchQuery = intent.entities.searchQuery || intent.entities.clauseTerm || message;
      
      try {
        const ragResults = await hybridSearch(searchQuery, {
          mode: 'hybrid',
          k: 8,
          rerank: true,
          expandQuery: true,
          filters: { tenantId } });

        if (ragResults.length > 0) {
          contractPreviews = ragResults.slice(0, 5).map(r => ({
            id: r.contractId,
            name: r.contractName || 'Contract',
            supplier: r.supplierName || 'Unknown',
            status: r.status || 'active',
            value: Number(r.totalValue || 0),
            matchScore: Math.round(r.score * 100),
            riskLevel: 'medium',
            type: 'CONTRACT' }));

          if (intent.action === 'semantic_search') {
            additionalContext += `\n\n**🔍 Semantic Search Results for "${searchQuery}":**\n\n`;
            ragResults.forEach((r, i) => {
              const scoreIcon = r.score >= 0.9 ? '🎯' : r.score >= 0.75 ? '✅' : '📄';
              additionalContext += `**${scoreIcon} ${i + 1}. [${r.contractName}](/contracts/${r.contractId})** (${Math.round(r.score * 100)}% match)\n`;
              if (r.supplierName) additionalContext += `   Supplier: ${r.supplierName}\n`;
              additionalContext += `   > "${r.text.slice(0, 300).replace(/\n/g, ' ')}..."\n\n`;
            });
          } else if (intent.action === 'clause_search') {
            additionalContext += `\n\n**📑 Contracts containing "${intent.entities.clauseTerm}":**\n\n`;
            ragResults.forEach((r, i) => {
              additionalContext += `**${i + 1}. [${r.contractName}](/contracts/${r.contractId})**\n`;
              if (r.supplierName) additionalContext += `   Supplier: ${r.supplierName}\n`;
              additionalContext += `   > "${r.text.slice(0, 250).replace(/\n/g, ' ')}..."\n\n`;
            });
          }
        } else {
          additionalContext += `\n\n⚠️ No contracts found matching "${searchQuery}". Try different keywords or check the spelling.`;
        }
      } catch {
        // Continue without semantic search results
      }
    }
    
    // For analytics intents
    if (intent.type === 'analytics') {
      if (intent.action === 'count') {
        const counts = await countContracts(tenantId, intent.entities.supplierName);
        additionalContext = `\n\n**Contract Counts${intent.entities.supplierName ? ` for ${intent.entities.supplierName}` : ''}:**\n- Total: ${counts.total}\n- Active: ${counts.active}\n- Expiring Soon (90 days): ${counts.expiringSoon}\n- Draft: ${counts.draft || 0}\n- Expired: ${counts.expired || 0}`;
      } else if (intent.action === 'summarize' && intent.entities.supplierName) {
        const summary = await getSupplierSummary(intent.entities.supplierName, tenantId);
        if (summary) {
          additionalContext = `\n\n**Supplier Summary for ${summary.supplierName}:**\n- Total Contracts: ${summary.totalContracts}\n- Active Contracts: ${summary.activeContracts}\n- Total Value: $${summary.totalValue.toLocaleString()}\n- Expiring in 90 Days: ${summary.expiringIn90Days}\n- Contract Types: ${summary.contractTypes?.join(', ') || 'Various'}`;
        }
      } else if (intent.action === 'deep_analysis') {
        // ADVANCED AI AGENT: Deep Analysis
        const analysis = await performDeepAnalysis(tenantId, {
          supplierName: intent.entities.supplierName,
          category: intent.entities.category,
          year: intent.entities.timePeriod,
          analysisAspects: intent.entities.analysisAspects });
        
        // Build comprehensive analysis context
        const filterDesc = [
          intent.entities.supplierName && `Supplier: ${intent.entities.supplierName}`,
          intent.entities.category && `Category: ${intent.entities.category}`,
          intent.entities.timePeriod && `Year: ${intent.entities.timePeriod}`,
        ].filter(Boolean).join(' | ') || 'All Contracts';
        
        additionalContext = `\n\n**📊 Deep Analysis Report**\n*Filters: ${filterDesc}*\n`;
        
        if (analysis.summary.totalContracts === 0) {
          additionalContext += `\nNo contracts found matching the specified criteria.`;
        } else {
          // Summary Section
          additionalContext += `\n**Summary:**\n`;
          additionalContext += `- Total Contracts: ${analysis.summary.totalContracts}\n`;
          additionalContext += `- Active Contracts: ${analysis.summary.activeContracts}\n`;
          additionalContext += `- Total Value: $${analysis.summary.totalValue.toLocaleString()}\n`;
          additionalContext += `- Average Value: $${Math.round(analysis.summary.averageValue).toLocaleString()}\n`;
          
          // Duration Analysis
          if (analysis.summary.averageDurationMonths > 0) {
            additionalContext += `\n**Duration Analysis:**\n`;
            additionalContext += `- Average Duration: ${analysis.summary.averageDurationMonths} months\n`;
            additionalContext += `- Shortest: ${analysis.summary.shortestDurationMonths} months\n`;
            additionalContext += `- Longest: ${analysis.summary.longestDurationMonths} months\n`;
          }
          
          // Category Breakdown
          const categories = Object.entries(analysis.byCategory);
          if (categories.length > 0) {
            additionalContext += `\n**By Category:**\n`;
            categories.slice(0, 8).forEach(([cat, data]) => {
              additionalContext += `- ${cat}: ${data.count} contracts, $${data.value.toLocaleString()}\n`;
            });
          }
          
          // Status Breakdown
          const statuses = Object.entries(analysis.byStatus);
          if (statuses.length > 0) {
            additionalContext += `\n**By Status:**\n`;
            statuses.forEach(([status, count]) => {
              additionalContext += `- ${status}: ${count} contracts\n`;
            });
          }
          
          // Risk Analysis
          if (analysis.riskAnalysis.expiringIn90Days > 0 || analysis.riskAnalysis.autoRenewalCount > 0) {
            additionalContext += `\n**⚠️ Risk Alerts:**\n`;
            if (analysis.riskAnalysis.expiringIn30Days > 0) {
              additionalContext += `- 🔴 Expiring in 30 days: ${analysis.riskAnalysis.expiringIn30Days}\n`;
            }
            if (analysis.riskAnalysis.expiringIn90Days > 0) {
              additionalContext += `- 🟠 Expiring in 90 days: ${analysis.riskAnalysis.expiringIn90Days}\n`;
            }
            if (analysis.riskAnalysis.autoRenewalCount > 0) {
              additionalContext += `- 🔄 Auto-renewal enabled: ${analysis.riskAnalysis.autoRenewalCount}\n`;
            }
            if (analysis.riskAnalysis.highValueAtRisk > 0) {
              additionalContext += `- 💰 High-value at risk: ${analysis.riskAnalysis.highValueAtRisk}\n`;
            }
          }
          
          // Top Contracts with Links
          if (analysis.contracts.length > 0) {
            additionalContext += `\n**Top Contracts by Value:**\n`;
            analysis.contracts.slice(0, 10).forEach((c, i) => {
              additionalContext += `${i + 1}. [📄 ${c.title}](/contracts/${c.id}) - $${c.value.toLocaleString()}`;
              if (c.durationMonths > 0) additionalContext += ` (${c.durationMonths} mo)`;
              additionalContext += `\n`;
            });
          }
        }
        
        // Store the full analysis in context for the LLM
        context = { ...context, deepAnalysis: analysis };
      } else if (intent.action === 'compare_contracts') {
        // ============================================
        // MULTI-CONTRACT COMPARISON HANDLER
        // ============================================
        const comparisonEntities = intent.entities.comparisonEntities as string[];
        
        if (comparisonEntities && comparisonEntities.length >= 2) {
          const entity1 = comparisonEntities[0] || '';
          const entity2 = comparisonEntities[1] || '';
          
          
          const comparison = await performContractComparison(
            entity1,
            entity2,
            tenantId,
            intent.entities.comparisonAspects as any
          );
          
          // Build comprehensive comparison context
          additionalContext = `\n\n**🔍 Contract Comparison: ${entity1} vs ${entity2}**\n`;
          
          if (!comparison.entity1 && !comparison.entity2) {
            additionalContext += `\n❌ Could not find contracts matching either "${entity1}" or "${entity2}". Please verify the supplier or contract names.\n`;
            additionalContext += `\n💡 **Tip:** Try using partial names or check the contracts list for exact names.`;
          } else if (!comparison.entity1) {
            additionalContext += `\n⚠️ Could not find contracts for "${entity1}". `;
            additionalContext += `Found contract(s) for "${entity2}": **${comparison.entity2?.contractTitle}** with ${comparison.entity2?.supplierName}.\n`;
          } else if (!comparison.entity2) {
            additionalContext += `\n⚠️ Could not find contracts for "${entity2}". `;
            additionalContext += `Found contract(s) for "${entity1}": **${comparison.entity1?.contractTitle}** with ${comparison.entity1?.supplierName}.\n`;
          } else {
            // Full comparison available
            additionalContext += `\n---\n`;
            additionalContext += `| Aspect | ${comparison.entity1.supplierName} | ${comparison.entity2.supplierName} |\n`;
            additionalContext += `|--------|----------|----------|\n`;
            additionalContext += `| **Contract** | ${comparison.entity1.contractTitle} | ${comparison.entity2.contractTitle} |\n`;
            additionalContext += `| **Status** | ${comparison.entity1.status} | ${comparison.entity2.status} |\n`;
            
            // Add value row
            const formatCurrency = (val: number, curr: string = 'USD') => 
              new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(val);
            
            additionalContext += `| **Total Value** | ${formatCurrency(comparison.entity1.totalValue, comparison.entity1.currency || 'USD')} | ${formatCurrency(comparison.entity2.totalValue, comparison.entity2.currency || 'USD')} |\n`;
            additionalContext += `| **Annual Value** | ${formatCurrency(comparison.entity1.annualValue || 0)} | ${formatCurrency(comparison.entity2.annualValue || 0)} |\n`;
            additionalContext += `| **Duration** | ${comparison.entity1.durationMonths} months | ${comparison.entity2.durationMonths} months |\n`;
            additionalContext += `| **Category** | ${comparison.entity1.categoryL1 || 'N/A'} | ${comparison.entity2.categoryL1 || 'N/A'} |\n`;
            additionalContext += `| **Payment Terms** | ${comparison.entity1.paymentTerms || 'N/A'} | ${comparison.entity2.paymentTerms || 'N/A'} |\n`;
            additionalContext += `| **Auto-Renewal** | ${comparison.entity1.autoRenewalEnabled ? '✅ Yes' : '❌ No'} | ${comparison.entity2.autoRenewalEnabled ? '✅ Yes' : '❌ No'} |\n`;
            additionalContext += `| **Notice Period** | ${comparison.entity1.noticePeriodDays ? `${comparison.entity1.noticePeriodDays} days` : 'N/A'} | ${comparison.entity2.noticePeriodDays ? `${comparison.entity2.noticePeriodDays} days` : 'N/A'} |\n`;
            
            // Expiration dates
            const formatDate = (d: Date | null) => d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
            additionalContext += `| **Expires** | ${formatDate(comparison.entity1.expirationDate)} | ${formatDate(comparison.entity2.expirationDate)} |\n`;
            additionalContext += `\n---\n`;
            
            // Key Differences Section
            if (comparison.differences.length > 0) {
              additionalContext += `\n**📋 Key Differences (${comparison.differences.length}):**\n`;
              comparison.differences.slice(0, 12).forEach((diff, i) => {
                additionalContext += `\n**${i + 1}. ${diff.label}**\n`;
                additionalContext += `   • ${entity1}: ${diff.value1}\n`;
                additionalContext += `   • ${entity2}: ${diff.value2}\n`;
                additionalContext += `   • _${diff.analysis}_\n`;
              });
            }
            
            // Similarities Section
            if (comparison.similarities.length > 0) {
              additionalContext += `\n**✅ Similarities (${comparison.similarities.length}):**\n`;
              comparison.similarities.slice(0, 8).forEach(sim => {
                additionalContext += `- ${sim.label}: ${sim.sharedValue}\n`;
              });
            }
            
            // Key Insights
            if (comparison.keyInsights.length > 0) {
              additionalContext += `\n**💡 Key Insights:**\n`;
              comparison.keyInsights.forEach(insight => {
                additionalContext += `- ${insight}\n`;
              });
            }
            
            // Rate comparison if both have rates
            if (comparison.entity1.rates && comparison.entity1.rates.length > 0 && 
                comparison.entity2.rates && comparison.entity2.rates.length > 0) {
              additionalContext += `\n**💰 Rate Card Comparison:**\n`;
              additionalContext += `| Role | ${comparison.entity1.supplierName} | ${comparison.entity2.supplierName} | Difference |\n`;
              additionalContext += `|------|----------|----------|------------|\n`;
              
              // Build rate comparison table
              const roles1 = new Map(comparison.entity1.rates.map(r => [r.roleName.toLowerCase(), r]));
              const roles2 = new Map(comparison.entity2.rates.map(r => [r.roleName.toLowerCase(), r]));
              const allRolesArray = Array.from(new Set([...Array.from(roles1.keys()), ...Array.from(roles2.keys())]));
              
              let rateRowCount = 0;
              for (const role of allRolesArray) {
                if (rateRowCount >= 8) break; // Limit to 8 rows
                const r1 = roles1.get(role);
                const r2 = roles2.get(role);
                if (r1 && r2) {
                  const diff = r1.rate - r2.rate;
                  const pct = r2.rate > 0 ? Math.round((diff / r2.rate) * 100) : 0;
                  additionalContext += `| ${r1.roleName} | ${formatCurrency(r1.rate)}/${r1.unit} | ${formatCurrency(r2.rate)}/${r2.unit} | ${diff > 0 ? '+' : ''}${pct}% |\n`;
                  rateRowCount++;
                }
              }
            }
            
            // Recommendation
            additionalContext += `\n**🎯 Recommendation:**\n${comparison.recommendation}\n`;
            
            // Quick actions
            additionalContext += `\n**Quick Actions:**\n`;
            additionalContext += `- [📄 View ${comparison.entity1.contractTitle}](/contracts/${comparison.entity1.id})\n`;
            additionalContext += `- [📄 View ${comparison.entity2.contractTitle}](/contracts/${comparison.entity2.id})\n`;
          }
          
          // Store comparison in context for LLM
          context = { ...context, contractComparison: comparison };
        } else {
          additionalContext += `\n\n⚠️ Please specify two contracts or suppliers to compare. For example: "Compare Deloitte vs Accenture contracts" or "What's the difference between Microsoft MSA and IBM services agreement?"`;
        }
      } else if (intent.action === 'compare_clauses') {
        // ============================================
        // CLAUSE-SPECIFIC COMPARISON HANDLER
        // ============================================
        const comparisonEntities = intent.entities.comparisonEntities as string[];
        const clauseType = intent.entities.clauseType as string || 'termination';
        
        if (comparisonEntities && comparisonEntities.length >= 2) {
          const entity1 = comparisonEntities[0] || '';
          const entity2 = comparisonEntities[1] || '';
          
          
          const clauseComparison = await compareContractClauses(
            entity1,
            entity2,
            clauseType,
            tenantId
          );
          
          additionalContext = `\n\n**📑 ${clauseType.charAt(0).toUpperCase() + clauseType.slice(1)} Clause Comparison**\n`;
          additionalContext += `*Comparing ${entity1} vs ${entity2}*\n\n`;
          
          additionalContext += `**Analysis:** ${clauseComparison.analysis}\n\n`;
          
          if (clauseComparison.differences.length > 0) {
            additionalContext += `**Key Differences:**\n`;
            clauseComparison.differences.forEach(diff => {
              additionalContext += `- ${diff}\n`;
            });
            additionalContext += `\n`;
          }
          
          if (clauseComparison.entity1Clause) {
            additionalContext += `**${entity1} Clause:**\n> ${clauseComparison.entity1Clause.substring(0, 400)}${clauseComparison.entity1Clause.length > 400 ? '...' : ''}\n\n`;
          }
          
          if (clauseComparison.entity2Clause) {
            additionalContext += `**${entity2} Clause:**\n> ${clauseComparison.entity2Clause.substring(0, 400)}${clauseComparison.entity2Clause.length > 400 ? '...' : ''}\n\n`;
          }
          
          additionalContext += `**🎯 Recommendation:** ${clauseComparison.recommendation}\n`;
          
          context = { ...context, clauseComparison };
        } else {
          additionalContext += `\n\n⚠️ Please specify two contracts or suppliers to compare clauses. For example: "Compare termination clauses in Deloitte and Accenture contracts"`;
        }
      } else if (intent.action === 'compare_groups') {
        // ============================================
        // MULTI-CONTRACT GROUP COMPARISON HANDLER
        // Compare all contracts from one supplier/year vs another
        // ============================================
        const comparisonGroups = intent.entities.comparisonGroups as Array<{supplier?: string; year?: string; category?: string}>;
        
        if (comparisonGroups && comparisonGroups.length >= 2) {
          
          const groupComparison = await performGroupComparison(comparisonGroups, tenantId);
          
          additionalContext = `\n\n**📊 Contract Group Comparison**\n`;
          additionalContext += `*Comparing ${comparisonGroups.map(g => `${g.supplier || 'All'}${g.year ? ` (${g.year})` : ''}`).join(' vs ')}*\n\n`;
          
          if (groupComparison.groups.length === 0) {
            additionalContext += `❌ No contracts found for the specified criteria. Please check supplier names and try again.\n`;
          } else {
            // Summary table header
            additionalContext += `| Metric |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${g.label} |`;
            });
            additionalContext += `\n|--------|`;
            groupComparison.groups.forEach(() => {
              additionalContext += `----------|`;
            });
            additionalContext += `\n`;
            
            // Row: Contract Count
            additionalContext += `| **Contract Count** |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${g.contractCount} |`;
            });
            additionalContext += `\n`;
            
            // Row: Total Value
            const formatCurrency = (val: number, curr: string = 'USD') => 
              new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(val);
            
            additionalContext += `| **Total Value** |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${formatCurrency(g.totalValue)} |`;
            });
            additionalContext += `\n`;
            
            // Row: Average Value
            additionalContext += `| **Average Value** |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${formatCurrency(g.avgValue)} |`;
            });
            additionalContext += `\n`;
            
            // Row: Average Duration
            additionalContext += `| **Avg Duration** |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${g.avgDurationMonths.toFixed(1)} months |`;
            });
            additionalContext += `\n`;
            
            // Row: Active Contracts
            additionalContext += `| **Active** |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${g.activeCount} |`;
            });
            additionalContext += `\n`;
            
            // Row: Expiring Soon (30 days)
            additionalContext += `| **Expiring Soon** |`;
            groupComparison.groups.forEach(g => {
              additionalContext += ` ${g.expiringSoonCount} |`;
            });
            additionalContext += `\n\n`;
            
            // Key Insights
            if (groupComparison.insights.length > 0) {
              additionalContext += `**💡 Key Insights:**\n`;
              groupComparison.insights.forEach(insight => {
                additionalContext += `- ${insight}\n`;
              });
              additionalContext += `\n`;
            }
            
            // Category Breakdown
            if (groupComparison.categoryBreakdown && Object.keys(groupComparison.categoryBreakdown).length > 0) {
              additionalContext += `**📁 Category Breakdown:**\n`;
              additionalContext += `| Category |`;
              groupComparison.groups.forEach(g => {
                additionalContext += ` ${g.label} |`;
              });
              additionalContext += `\n|----------|`;
              groupComparison.groups.forEach(() => {
                additionalContext += `----------|`;
              });
              additionalContext += `\n`;
              
              Object.keys(groupComparison.categoryBreakdown).slice(0, 8).forEach(cat => {
                additionalContext += `| ${cat} |`;
                groupComparison.groups.forEach((g, idx) => {
                  const catData = groupComparison.categoryBreakdown?.[cat]?.[idx];
                  additionalContext += ` ${catData?.count || 0} (${formatCurrency(catData?.value || 0)}) |`;
                });
                additionalContext += `\n`;
              });
              additionalContext += `\n`;
            }
            
            // Rate comparison if available
            if (groupComparison.rateComparison && groupComparison.rateComparison.length > 0) {
              additionalContext += `**💰 Average Rates by Role:**\n`;
              additionalContext += `| Role |`;
              groupComparison.groups.forEach(g => {
                additionalContext += ` ${g.label} |`;
              });
              additionalContext += ` Difference |\n`;
              additionalContext += `|------|`;
              groupComparison.groups.forEach(() => {
                additionalContext += `----------|`;
              });
              additionalContext += `------------|\n`;
              
              groupComparison.rateComparison.slice(0, 10).forEach(r => {
                additionalContext += `| ${r.role} |`;
                r.rates.forEach(rate => {
                  additionalContext += ` ${formatCurrency(rate)} |`;
                });
                const rate0 = r.rates[0] ?? 0;
                const rate1 = r.rates[1] ?? 1;
                const diff = r.rates.length >= 2 ? ((rate0 - rate1) / rate1 * 100).toFixed(1) : '0';
                additionalContext += ` ${parseFloat(diff) > 0 ? '+' : ''}${diff}% |\n`;
              });
              additionalContext += `\n`;
            }
            
            // Recommendation
            additionalContext += `**🎯 Recommendation:**\n${groupComparison.recommendation}\n`;
          }
          
          context = { ...context, groupComparison };
        } else {
          additionalContext += `\n\n⚠️ Please specify at least two groups to compare. For example: "Compare all Deloitte 2024 contracts vs Accenture 2024" or "Compare IT Services category vs Consulting category"`;
        }
      }
    }
    
    // For workflow intents
    if (intent.type === 'workflow') {
      const matchedContracts = await findMatchingContracts(intent.entities, tenantId);
      
      if (matchedContracts.length > 0) {
        additionalContext += `\n\n**Matching Contracts Found:**\n${matchedContracts.map(c => 
          `- [${c.contractTitle}](/contracts/${c.id}) - Supplier: ${c.supplierName || 'Unknown'}, Status: ${c.status}, Value: $${Number(c.totalValue || 0).toLocaleString()}`
        ).join('\n')}`;
      }
      
      // For create_linked, also find parent contracts
      if (intent.action === 'create_linked') {
        if (intent.entities.supplierName) {
          const masterAgreements = await findMasterAgreements(intent.entities.supplierName, tenantId, intent.entities.parentYear);
          if (masterAgreements.length > 0) {
            additionalContext += `\n\n**Master Agreements to link to:**\n${masterAgreements.map(m => 
              `- [${m.contractTitle}](/contracts/${m.id}) - Status: ${m.status}, Value: $${Number(m.totalValue || 0).toLocaleString()}`
            ).join('\n')}`;
          }
        }
      }
    }
    
    // For action intents (hierarchy view)
    if (intent.type === 'action' && intent.action === 'show_hierarchy' && intent.entities.contractName) {
      const contracts = await findMatchingContracts({ contractName: intent.entities.contractName }, tenantId);
      const firstContract = contracts[0];
      if (firstContract) {
        const hierarchy = await getContractHierarchy(firstContract.id, tenantId);
        if (hierarchy) {
          additionalContext += `\n\n**Contract Hierarchy for ${hierarchy.contractTitle}:**`;
          if (hierarchy.parentContract) {
            additionalContext += `\n- Parent: [${hierarchy.parentContract.contractTitle}](/contracts/${hierarchy.parentContract.id}) (${hierarchy.parentContract.status})`;
          }
          additionalContext += `\n- Current: [${hierarchy.contractTitle}](/contracts/${hierarchy.id}) (${hierarchy.status}, Value: $${Number(hierarchy.totalValue || 0).toLocaleString()})`;
          if (hierarchy.childContracts && hierarchy.childContracts.length > 0) {
            additionalContext += `\n- Children (${hierarchy.childContracts.length}):\n${hierarchy.childContracts.map((c) => 
              `  - [${c.contractTitle}](/contracts/${c.id}) (${c.contractType}, ${c.status})`
            ).join('\n')}`;
          }
        }
      }
    }

    // ============================================
    // BI-DIRECTIONAL UPDATE ACTIONS (write-back to database)
    // ============================================
    const updateActions = ['update_expiration', 'update_effective_date', 'update_value', 'update_status', 'update_title', 'update_supplier', 'update_client', 'update_category'];
    if (intent.type === 'action' && intent.action && updateActions.includes(intent.action)) {
      const contractId = context?.contractId || intent.entities.contractId;
      
      if (!contractId) {
        additionalContext += `\n\n⚠️ **Which contract would you like to update?**\n\nPlease specify the contract name or navigate to the contract page first.`;
      } else {
        // Import and call the update action handler
        try {
          const { handleUpdateActions } = await import('@/lib/chatbot/action-handlers/update-actions');
          const updateResult = await handleUpdateActions(intent as any, {
            tenantId,
            userId: undefined,
            currentContractId: contractId });
          
          if (updateResult.success) {
            additionalContext += `\n\n${updateResult.message}`;
            
            // Add confirmation buttons if pending
            if (updateResult.data && (updateResult.data as any).requiresConfirmation) {
              const pendingId = (updateResult.data as any).pendingActionId;
              suggestedActions.push(
                { label: '✅ Yes, update', action: `confirm-action:${pendingId}` },
                { label: '❌ Cancel', action: `reject-action:${pendingId}` }
              );
            }
          } else {
            additionalContext += `\n\n❌ ${updateResult.message}`;
          }
        } catch {
          additionalContext += `\n\n❌ Failed to process update request. Please try again.`;
        }
      }
    }
    
    // For procurement analytics intents
    if (intent.type === 'procurement') {
      if (intent.action === 'spend_analysis') {
        const spendData = await getSpendAnalysis(tenantId, intent.entities.supplierName);
        additionalContext += `\n\n**Spend Analysis${intent.entities.supplierName ? ` for ${intent.entities.supplierName}` : ''}:**`;
        additionalContext += `\n- Total Contracts: ${spendData?.totalContracts || 0}`;
        additionalContext += `\n- Total Spend: $${(spendData?.totalSpend || 0).toLocaleString()}`;
        additionalContext += `\n- Annual Run Rate: $${(spendData?.annualSpend || 0).toLocaleString()}`;
        if (spendData?.bySupplier) {
          additionalContext += `\n\nTop Suppliers by Spend:\n${spendData.bySupplier.slice(0, 10).map(([name, data]: [string, any], i: number) => 
            `${i + 1}. ${name}: $${data.value.toLocaleString()} (${data.count} contracts)`
          ).join('\n')}`;
        }
        if (spendData?.byCategory && spendData.byCategory.length > 0) {
          additionalContext += `\n\nSpend by Category:\n${spendData.byCategory.slice(0, 5).map(([name, data]: [string, any]) => 
            `- ${name}: $${data.value.toLocaleString()}`
          ).join('\n')}`;
        }
      } else if (intent.action === 'savings_opportunities') {
        const savingsData = await getCostSavingsOpportunities(tenantId);
        additionalContext += `\n\n**Cost Savings Opportunities:**`;
        additionalContext += `\n- Total Opportunities: ${savingsData.count}`;
        additionalContext += `\n- Potential Savings: $${savingsData.totalPotentialSavings.toLocaleString()}`;
        if (savingsData.opportunities.length > 0) {
          additionalContext += `\n\nTop Opportunities:\n${savingsData.opportunities.slice(0, 5).map((opp: any, i: number) => 
            `${i + 1}. ${opp.title}: $${Number(opp.potentialSavingsAmount).toLocaleString()} potential savings\n   - Category: ${opp.category} | Confidence: ${opp.confidence}\n   - Contract: ${opp.contract?.contractTitle || 'N/A'}`
          ).join('\n')}`;
        }
      } else if (intent.action === 'risk_assessment') {
        const riskData = await getRiskAssessment(tenantId);
        additionalContext += `\n\n**Risk Assessment:**`;
        additionalContext += `\n- Critical Risk: ${riskData.criticalCount} contracts`;
        additionalContext += `\n- High Risk: ${riskData.highRiskCount} contracts`;
        additionalContext += `\n- Auto-Renewal Enabled: ${riskData.autoRenewalCount} contracts`;
        if (riskData.contracts.length > 0) {
          additionalContext += `\n\nContracts Requiring Attention:\n${riskData.contracts.slice(0, 8).map((c, i) => 
            `${i + 1}. [📄 ${c.contractTitle}](/contracts/${c.id})\n   - Risk Level: ${c.expirationRisk || 'HIGH'} | Days Until Expiry: ${c.daysUntilExpiry || 'N/A'}\n   - Supplier: ${c.supplierName} | Auto-Renew: ${c.autoRenewalEnabled ? 'Yes' : 'No'}`
          ).join('\n')}`;
        }
      } else if (intent.action === 'compliance_status') {
        const complianceData = await getComplianceStatus(tenantId, intent.entities.supplierName);
        additionalContext += `\n\n**Compliance Status${intent.entities.supplierName ? ` for ${intent.entities.supplierName}` : ''}:**`;
        additionalContext += `\n- Total Contracts: ${complianceData.totalContracts}`;
        const compliancePercent = complianceData.totalContracts > 0 
          ? Math.round(complianceData.compliantCount / complianceData.totalContracts * 100) 
          : 0;
        additionalContext += `\n- Compliant: ${complianceData.compliantCount} (${compliancePercent}%)`;
        additionalContext += `\n- Issues Found: ${complianceData.issueCount}`;
        if (complianceData.contracts.length > 0) {
          additionalContext += `\n\nContracts with Issues:\n${complianceData.contracts.slice(0, 5).map((c) => 
            `- [📄 ${c.contractTitle}](/contracts/${c.id}) (Score: ${c.complianceScore}%, Issues: ${c.issueCount})`
          ).join('\n')}`;
        }
      } else if (intent.action === 'supplier_performance' && intent.entities.supplierName) {
        const performanceData = await getSupplierPerformance(tenantId, intent.entities.supplierName);
        additionalContext += `\n\n**Supplier Performance for ${intent.entities.supplierName}:**`;
        additionalContext += `\n- Overall Score: ${performanceData.overallScore}%`;
        additionalContext += `\n- Delivery Score: ${performanceData.deliveryScore}%`;
        additionalContext += `\n- Quality Score: ${performanceData.qualityScore}%`;
        additionalContext += `\n- Communication Score: ${performanceData.communicationScore}%`;
        additionalContext += `\n- Value Score: ${performanceData.valueScore}%`;
        additionalContext += `\n- Active Contracts: ${performanceData.activeContracts}`;
        additionalContext += `\n- Total Value: $${performanceData.totalValue.toLocaleString()}`;
        additionalContext += `\n- Relationship Duration: ${performanceData.relationshipMonths} months`;
      } else if (intent.action === 'rate_comparison') {
        const rateData = await getRateComparison(tenantId, intent.entities.supplierName);
        additionalContext += `\n\n**Rate Comparison${intent.entities.supplierName ? ` for ${intent.entities.supplierName}` : ''}:**`;
        additionalContext += `\n- Rate Cards Analyzed: ${rateData.rateCards.length}`;
        if (rateData.rateCards.length > 0) {
          const avgVariance = rateData.rateCards.reduce((sum: number, c: { vsMarket?: number }) => sum + (c.vsMarket || 0), 0) / rateData.rateCards.length;
          additionalContext += `\n- Overall Position: ${avgVariance < 0 ? 'Below Market' : avgVariance < 10 ? 'At Market' : 'Above Market'} (${avgVariance > 0 ? '+' : ''}${avgVariance.toFixed(1)}% vs market)`;
          additionalContext += `\n\nRate Details:\n${rateData.rateCards.slice(0, 8).map((card: { roleName?: string; rate?: number; marketRate?: number; vsMarket?: number }) => 
            `- ${card.roleName}: $${card.rate}/hr (Market: $${card.marketRate}/hr, ${(card.vsMarket || 0) > 0 ? '+' : ''}${card.vsMarket}%)`
          ).join('\n')}`;
        }
      } else if (intent.action === 'top_suppliers') {
        const spendData = await getSpendAnalysis(tenantId);
        if (spendData) {
          additionalContext += `\n\n**Top Suppliers by Spend:**`;
          additionalContext += `\n- Total Suppliers: ${spendData.bySupplier.length}`;
          additionalContext += `\n\nRanking:\n${spendData.bySupplier.slice(0, 10).map(([name, data]: [string, any], i: number) => 
            `${i + 1}. ${name}: $${data.value.toLocaleString()} (${data.count} contracts)`
          ).join('\n')}`;
        } else {
          additionalContext += `\n\n**Top Suppliers:** Unable to retrieve spend data.`;
        }
      } else if (intent.action === 'auto_renewals') {
        const riskData = await getRiskAssessment(tenantId);
        const autoRenewalContracts = riskData.contracts.filter((c) => c.autoRenewalEnabled);
        additionalContext += `\n\n**Auto-Renewal Contracts:**`;
        additionalContext += `\n- Total with Auto-Renewal: ${riskData.autoRenewalCount}`;
        additionalContext += `\n- Renewing in 90 Days: ${autoRenewalContracts.filter((c) => c.daysUntilExpiry && c.daysUntilExpiry <= 90).length}`;
        if (autoRenewalContracts.length > 0) {
          additionalContext += `\n\nContracts:\n${autoRenewalContracts.slice(0, 8).map((c) => 
            `- ${c.contractTitle} (Supplier: ${c.supplierName}, Renews: ${c.expirationDate ? new Date(c.expirationDate).toLocaleDateString() : 'N/A'})`
          ).join('\n')}`;
        }
      }
    }

    // For comparison intents
    if (intent.type === 'comparison') {
      if (intent.action === 'compare_contracts' && intent.entities.contractA && intent.entities.contractB) {
        const comparison = await compareContracts(
          intent.entities.contractA,
          intent.entities.contractB,
          tenantId
        );
        
        additionalContext += `\n\n${comparison.summary}`;
        
        if (comparison.contractA && comparison.contractB && comparison.comparison.length > 0) {
          additionalContext += `\n\n**Side-by-Side Comparison:**\n`;
          additionalContext += `| Field | ${comparison.contractA.fileName} | ${comparison.contractB.fileName} | Status |\n`;
          additionalContext += `|-------|----------|----------|--------|\n`;
          comparison.comparison.forEach(c => {
            const statusIcon = c.difference === 'same' ? '✓' : 
              c.difference === 'better_a' ? '⬆️' :
              c.difference === 'better_b' ? '⬇️' :
              c.difference === 'na' ? '—' : '≠';
            additionalContext += `| ${c.field} | ${c.valueA} | ${c.valueB} | ${statusIcon} |\n`;
          });
          
          // Add contract preview cards
          contractPreviews.push(
            formatContractForPreview(comparison.contractA),
            formatContractForPreview(comparison.contractB)
          );
        }
        
        context = { ...context, comparison };
      } else if (intent.action === 'compare_suppliers' && intent.entities.supplierA && intent.entities.supplierB) {
        // Compare contracts from two different suppliers
        const [supplierAContracts, supplierBContracts] = await Promise.all([
          prisma.contract.findMany({
            where: { tenantId, supplierName: { contains: intent.entities.supplierA, mode: 'insensitive' } },
            orderBy: { totalValue: 'desc' },
            take: 10 }),
          prisma.contract.findMany({
            where: { tenantId, supplierName: { contains: intent.entities.supplierB, mode: 'insensitive' } },
            orderBy: { totalValue: 'desc' },
            take: 10 }),
        ]);
        
         
        const calcStats = (contracts: any[]) => ({
          count: contracts.length,
          totalValue: contracts.reduce((s, c) => s + Number(c.totalValue || 0), 0),
          avgValue: contracts.length > 0 ? contracts.reduce((s, c) => s + Number(c.totalValue || 0), 0) / contracts.length : 0,
          activeCount: contracts.filter(c => c.status === 'ACTIVE').length });
        
        const statsA = calcStats(supplierAContracts);
        const statsB = calcStats(supplierBContracts);
        
        additionalContext += `\n\n## Supplier Comparison: ${intent.entities.supplierA} vs ${intent.entities.supplierB}\n\n`;
        additionalContext += `| Metric | ${intent.entities.supplierA} | ${intent.entities.supplierB} |\n`;
        additionalContext += `|--------|----------|----------|\n`;
        additionalContext += `| Total Contracts | ${statsA.count} | ${statsB.count} |\n`;
        additionalContext += `| Total Value | $${statsA.totalValue.toLocaleString()} | $${statsB.totalValue.toLocaleString()} |\n`;
        additionalContext += `| Average Contract Value | $${Math.round(statsA.avgValue).toLocaleString()} | $${Math.round(statsB.avgValue).toLocaleString()} |\n`;
        additionalContext += `| Active Contracts | ${statsA.activeCount} | ${statsB.activeCount} |\n`;
        
        // Determine which is better overall
        if (statsA.totalValue !== statsB.totalValue) {
          const higher = statsA.totalValue > statsB.totalValue ? intent.entities.supplierA : intent.entities.supplierB;
          additionalContext += `\n💰 **${higher}** has higher total contract value.`;
        }
        
        context = { ...context, supplierComparison: { supplierA: intent.entities.supplierA, supplierB: intent.entities.supplierB, statsA, statsB } };
      } else if (intent.action === 'side_by_side') {
        additionalContext += `\n\n**Side-by-Side Comparison:**\nTo compare contracts, please specify which contracts you'd like to compare. For example:\n- "Compare Contract A with Contract B"\n- "Compare Acme Corp contract vs Globex contract"\n- "What's different between MSA 2024 and MSA 2023"`;
      }
    }

    // For taxonomy intents
    if (intent.type === 'taxonomy') {
      if (intent.action === 'list_categories') {
        const taxonomyData = await getTaxonomyCategories(tenantId);
        additionalContext += `\n\n**Taxonomy Categories:**`;
        additionalContext += `\n- Total Categories: ${taxonomyData.stats.totalCategories}`;
        additionalContext += `\n- L1 Categories: ${taxonomyData.stats.totalL1}`;
        additionalContext += `\n- L2 Subcategories: ${taxonomyData.stats.totalL2}`;
        if (taxonomyData.hierarchy.length > 0) {
          additionalContext += `\n\nTop-Level Categories:\n${taxonomyData.hierarchy.slice(0, 10).map((cat: { name?: string; path?: string; children?: unknown[] }, i: number) => 
            `${i + 1}. ${cat.name} (${cat.path || 'N/A'}) - ${cat.children?.length || 0} subcategories`
          ).join('\n')}`;
        }
        context = { ...context, taxonomyData };
      } else if (intent.action === 'category_details' && intent.entities.category) {
        const categoryDetails = await getCategoryDetails(intent.entities.category, tenantId);
        if (categoryDetails) {
          additionalContext += `\n\n**Category Details for ${categoryDetails.name}:**`;
          additionalContext += `\n- Path: ${categoryDetails.path || 'N/A'}`;
          additionalContext += `\n- Level: L${categoryDetails.level}`;
          if (categoryDetails.children && categoryDetails.children.length > 0) {
            additionalContext += `\n\nSubcategories: ${categoryDetails.children.map((c: { name?: string }) => c.name).join(', ')}`;
          }
          context = { ...context, categoryDetails };
        }
      } else if (intent.action === 'suggest_category' && intent.entities.contractName) {
        const categorySuggestion = await suggestCategoryForContract(intent.entities.contractName, tenantId);
        if (categorySuggestion) {
          additionalContext += `\n\n**Category Suggestion for "${intent.entities.contractName}":**`;
          if (categorySuggestion.currentCategory) {
            additionalContext += `\n- Current Category: ${categorySuggestion.currentCategory.name}`;
          } else {
            additionalContext += `\n- Currently uncategorized`;
          }
          if (categorySuggestion.suggestions.length > 0) {
            additionalContext += `\n\nSuggested Categories:\n${categorySuggestion.suggestions.slice(0, 5).map((s: { name?: string; code?: string }, i: number) => 
              `${i + 1}. ${s.name} (${s.code})`
            ).join('\n')}`;
          }
          context = { ...context, categorySuggestion };
        }
      } else if (intent.action === 'browse_taxonomy' && intent.entities.category) {
        const categoryContracts = await getContractsInCategory(intent.entities.category, tenantId);
        if (categoryContracts) {
          additionalContext += `\n\n**Contracts in ${categoryContracts.category.name}:**`;
          additionalContext += `\n- Total Contracts: ${categoryContracts.totalContracts}`;
          additionalContext += `\n- Total Value: $${categoryContracts.totalValue.toLocaleString()}`;
          if (categoryContracts.contracts.length > 0) {
            additionalContext += `\n\nContracts:\n${categoryContracts.contracts.slice(0, 10).map((c: any, i: number) => 
              `${i + 1}. [📄 ${c.contractTitle}](/contracts/${c.id}) - ${c.supplierName} - $${Number(c.totalValue || 0).toLocaleString()}`
            ).join('\n')}`;
          }
          context = { ...context, categoryContracts };
        }
      }
    }

    // For system status intents
    if (intent.type === 'system') {
      if (intent.action === 'system_health') {
        try {
          // Fetch worker health from health server (if available)
          const healthUrl = process.env.WORKER_HEALTH_URL || 'http://localhost:9090';
          const [healthRes, resilienceRes] = await Promise.allSettled([
            fetch(`${healthUrl}/healthz`, { signal: AbortSignal.timeout(5000) }),
            fetch(`${healthUrl}/resilience`, { signal: AbortSignal.timeout(5000) }),
          ]);
          
          let healthData: { status?: string; uptime?: number; workers?: { running?: number; total?: number }; queues?: { activeJobs?: number; waitingJobs?: number; failedJobs?: number } } | null = null;
          let resilienceData: { circuitBreakers?: Record<string, { state: string; totalRequests: number; totalFailures: number }> } | null = null;
          
          if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
            healthData = await healthRes.value.json();
          }
          if (resilienceRes.status === 'fulfilled' && resilienceRes.value.ok) {
            resilienceData = await resilienceRes.value.json();
          }

          if (healthData) {
            additionalContext += `\n\n**System Health Status:**`;
            additionalContext += `\n- Overall Status: ${healthData.status === 'healthy' ? '✅ Healthy' : healthData.status === 'degraded' ? '⚠️ Degraded' : '❌ Unhealthy'}`;
            additionalContext += `\n- Uptime: ${Math.floor((healthData.uptime ?? 0) / 3600)}h ${Math.floor(((healthData.uptime ?? 0) % 3600) / 60)}m`;
            additionalContext += `\n- Workers: ${healthData.workers?.running || 0}/${healthData.workers?.total || 0} running`;
            additionalContext += `\n- Active Jobs: ${healthData.queues?.activeJobs || 0}`;
            additionalContext += `\n- Waiting Jobs: ${healthData.queues?.waitingJobs || 0}`;
            additionalContext += `\n- Failed Jobs: ${healthData.queues?.failedJobs || 0}`;
          }
          
          if (resilienceData?.circuitBreakers) {
            const circuits = Object.entries(resilienceData.circuitBreakers);
            if (circuits.length > 0) {
              additionalContext += `\n\n**Circuit Breakers:**`;
              for (const [name, stats] of circuits) {
                const s = stats as { state: string; totalRequests: number; totalFailures: number };
                additionalContext += `\n- ${name}: ${s.state === 'CLOSED' ? '✅ Closed' : s.state === 'OPEN' ? '🔴 Open' : '🟡 Half-Open'} (${s.totalRequests} requests, ${s.totalFailures} failures)`;
              }
            }
          }

          context = { ...context, systemHealth: { healthData, resilienceData } };
        } catch {
          // system health fetch error ignored
        }
      } else if (intent.action === 'categorization_accuracy') {
        try {
          const accuracyRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/analytics/categorization-accuracy`, {
            headers: { 'x-tenant-id': tenantId } });
          
          if (accuracyRes.ok) {
            const accuracy = await accuracyRes.json();
            additionalContext += `\n\n**AI Categorization Accuracy:**`;
            additionalContext += `\n- Overall Accuracy: ${(accuracy.overall?.accuracy * 100 || 0).toFixed(1)}%`;
            additionalContext += `\n- Total Classified: ${accuracy.overall?.totalClassified || 0} contracts`;
            additionalContext += `\n- User Corrections: ${accuracy.overall?.totalCorrected || 0}`;
            
            if (accuracy.byConfidence && accuracy.byConfidence.length > 0) {
              additionalContext += `\n\n**By Confidence Level:**`;
              for (const bucket of accuracy.byConfidence) {
                additionalContext += `\n- ${bucket.bucket}: ${(bucket.accuracy * 100).toFixed(1)}% accuracy (${bucket.count} contracts)`;
              }
            }
            
            if (accuracy.recentTrend && accuracy.recentTrend.length > 0) {
              const latestTrend = accuracy.recentTrend[0];
              additionalContext += `\n\n**Recent Trend:** ${latestTrend.date}: ${(latestTrend.accuracy * 100).toFixed(1)}% accuracy`;
            }
            
            context = { ...context, categorizationAccuracy: accuracy };
          }
        } catch {
          additionalContext += `\n\n**Categorization Accuracy:** Unable to retrieve accuracy metrics.`;
        }
      } else if (intent.action === 'queue_status') {
        try {
          const healthUrl = process.env.WORKER_HEALTH_URL || 'http://localhost:9090';
          const metricsRes = await fetch(`${healthUrl}/metrics/json`, { signal: AbortSignal.timeout(5000) });
          
          if (metricsRes.ok) {
            const metrics = await metricsRes.json();
            additionalContext += `\n\n**Queue Status:**`;
            additionalContext += `\n- Total Queues: ${metrics.queues?.length || 0}`;
            additionalContext += `\n- Active Jobs: ${metrics.totals?.activeJobs || 0}`;
            additionalContext += `\n- Waiting Jobs: ${metrics.totals?.waitingJobs || 0}`;
            additionalContext += `\n- Completed Today: ${metrics.totals?.completedJobs || 0}`;
            additionalContext += `\n- Failed Today: ${metrics.totals?.failedJobs || 0}`;
            
            if (metrics.queues && metrics.queues.length > 0) {
              additionalContext += `\n\n**Queue Details:**`;
              for (const q of metrics.queues.slice(0, 5)) {
                additionalContext += `\n- ${q.name}: ${q.waiting} waiting, ${q.active} active, ${q.failed} failed`;
              }
            }
            
            context = { ...context, queueMetrics: metrics };
          }
        } catch {
          additionalContext += `\n\n**Queue Status:** Unable to retrieve queue metrics. Workers may be running on a separate server.`;
        }
      } else if (intent.action === 'ai_performance') {
        try {
          const healthUrl = process.env.WORKER_HEALTH_URL || 'http://localhost:9090';
          const resilienceRes = await fetch(`${healthUrl}/resilience`, { signal: AbortSignal.timeout(5000) });
          
          if (resilienceRes.ok) {
            const resilience = await resilienceRes.json();
            const openaiCircuit = resilience.circuitBreakers?.openai;
            
            additionalContext += `\n\n**AI Service Status:**`;
            if (openaiCircuit) {
              additionalContext += `\n- Circuit State: ${openaiCircuit.state === 'CLOSED' ? '✅ Healthy' : openaiCircuit.state === 'OPEN' ? '🔴 Service Unavailable' : '🟡 Testing Recovery'}`;
              additionalContext += `\n- Total Requests: ${openaiCircuit.totalRequests || 0}`;
              additionalContext += `\n- Success Rate: ${openaiCircuit.totalRequests > 0 ? (((openaiCircuit.totalRequests - openaiCircuit.totalFailures) / openaiCircuit.totalRequests) * 100).toFixed(1) : 100}%`;
              additionalContext += `\n- Consecutive Failures: ${openaiCircuit.consecutiveFailures || 0}`;
            } else {
              additionalContext += `\n- Status: ✅ Operational (no issues detected)`;
            }
            
            context = { ...context, aiPerformance: { openaiCircuit } };
          }
        } catch {
          additionalContext += `\n\n**AI Performance:** ✅ Operational - no circuit breaker data available (this chat is working!)`;
        }
      }
    }

    // Call OpenAI with the enriched context
    const response = await getOpenAIResponse(resolvedMessage, conversationHistory || [], { 
      contractId, 
      context,
      intent,
      additionalContext }) as any;

    // ============================================
    // CONVERSATION MEMORY UPDATE
    // ============================================
    // Save assistant response to conversation memory
    await conversationMemoryService.addMessage(
      conversationId, 
      'assistant', 
      response.response,
      {
        intent: intent.type,
        action: intent.action,
        entities: intent.entities,
        executedAction: true }
    );

    // Update reference context for future messages
    if (intent.entities.contractName) {
      await conversationMemoryService.updateReferenceContext(conversationId, {
        lastContractName: intent.entities.contractName });
    }
    if (intent.entities.supplierName) {
      await conversationMemoryService.updateReferenceContext(conversationId, {
        lastSupplierName: intent.entities.supplierName });
    }
    if (intent.entities.category) {
      await conversationMemoryService.updateReferenceContext(conversationId, {
        lastCategory: intent.entities.category });
    }

    // Add conversation ID to response
    response.conversationId = conversationId;

    // Add reference resolutions if any
    if (referenceResolutions.length > 0) {
      response.referenceResolutions = referenceResolutions;
    }

    // ENHANCED: Generate clarification prompts for low-confidence or ambiguous queries
    if (intent.confidence < 0.6) {
      const clarification = await conversationMemoryService.generateClarificationPrompts(
        message,
        intent.confidence,
        intent.entities
      );
      
      if (clarification.needsClarification) {
        response.clarificationNeeded = true;
        response.clarificationPrompts = clarification.prompts;
        response.clarificationType = clarification.clarificationType;
      }
    }

    // ENHANCED: Generate proactive suggestions based on conversation context and intent classification
    const suggestions = await conversationMemoryService.generateSuggestions(conversationId, tenantId, intent.entities);
    if (suggestions.length > 0) {
      response.suggestions = suggestions;
    }

    // Add contract previews to response if we have them
    if (contractPreviews.length > 0) {
      response.contractPreviews = contractPreviews;
    }

    // Add proactive alerts and insights to response
    if (proactiveAlerts.length > 0) {
      response.proactiveAlerts = proactiveAlerts;
    }
    if (proactiveInsightsData.length > 0) {
      response.proactiveInsights = proactiveInsightsData;
    }

    return createSuccessResponse(ctx, response)
  } catch (error: unknown) {
    // Generate helpful error response with recovery suggestions
    const err = error as { code?: string; message?: string };
    const errorCode = err.code || 'UNKNOWN_ERROR';
    const errorMessage = err.message || 'Failed to process chat message';
    
    let userFriendlyMessage = 'I encountered an issue processing your request.';
    let recoverySuggestions: string[] = [];
    let suggestedActions: { label: string; action: string }[] = [];
    
    // Categorize error and provide specific recovery options
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('billing') || errorMessage.includes('rate limit') || errorCode === 'rate_limit_exceeded') {
      userFriendlyMessage = '⏳ AI service quota exceeded or rate-limited.';
      recoverySuggestions = [
        'Your OpenAI API key may have exceeded its spending limit — check your billing at platform.openai.com',
        'Wait a few minutes and try again',
        'Contact your administrator to increase the API quota',
      ];
      suggestedActions = [
        { label: '🔄 Retry', action: 'retry' },
        { label: '📋 View Contracts', action: 'list-contracts' },
      ];
    } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      userFriendlyMessage = '⏱️ The request took too long to process.';
      recoverySuggestions = [
        'Try a more specific search (e.g., add supplier name or date range)',
        'Ask about a single contract instead of all contracts',
        'Check your internet connection',
      ];
      suggestedActions = [
        { label: '🔄 Retry', action: 'retry' },
        { label: '📋 Show Active Contracts', action: 'list-active' },
      ];
    } else if (errorMessage.includes('OPENAI_API_KEY') || errorMessage.includes('api_key')) {
      userFriendlyMessage = '🔑 AI service is not configured properly.';
      recoverySuggestions = [
        'Contact your administrator to set up the AI service',
        'In the meantime, you can still browse and search contracts manually',
      ];
      suggestedActions = [
        { label: '📋 Browse Contracts', action: 'browse' },
      ];
    } else if (errorMessage.includes('not found') || errorCode === 'NOT_FOUND') {
      userFriendlyMessage = '🔍 I couldn\'t find what you\'re looking for.';
      recoverySuggestions = [
        'Check the spelling of supplier or contract names',
        'Try searching with partial names',
        'Ask me to list all contracts to find what you need',
      ];
      suggestedActions = [
        { label: '📋 List All Contracts', action: 'list-all' },
        { label: '🔍 Search Contracts', action: 'search' },
      ];
    } else if (errorMessage.includes('database') || errorMessage.includes('prisma') || errorMessage.includes('connection')) {
      userFriendlyMessage = '🗄️ I\'m having trouble accessing the contract database.';
      recoverySuggestions = [
        'The database may be temporarily unavailable',
        'Try again in a few moments',
        'If the problem persists, contact support',
      ];
      suggestedActions = [
        { label: '🔄 Retry', action: 'retry' },
      ];
    } else {
      recoverySuggestions = [
        'Try rephrasing your question',
        'Ask a more specific question',
        'Start with a simple query like "show me contracts expiring soon"',
      ];
      suggestedActions = [
        { label: '🔄 Retry', action: 'retry' },
        { label: '📋 Show All Contracts', action: 'list-all' },
        { label: '❓ Help', action: 'help' },
      ];
    }
    
    // Return a user-friendly error response that the UI can display nicely
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `${userFriendlyMessage}\n\n**What you can try:**\n${recoverySuggestions.map(s => `• ${s}`).join('\n')}`, 200, {
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});
