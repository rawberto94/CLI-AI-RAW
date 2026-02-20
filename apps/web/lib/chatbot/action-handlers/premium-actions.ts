/**
 * Premium Actions Handler
 * 
 * Handles premium feature operations from chatbot commands:
 * - AI Contract Generation (blank, template, renewal, amendment)
 * - AI Copilot (drafting assistant)
 * - Legal Review
 * - Redlining
 * - Obligation Tracking
 */

import { DetectedIntent, ActionResponse, ChatContext } from '../types';

// ============ TYPES ============

type PremiumAction = 
  | 'open_generate'
  | 'generate_blank'
  | 'generate_template'
  | 'generate_renewal'
  | 'generate_amendment'
  | 'open_copilot'
  | 'copilot_draft'
  | 'copilot_review'
  | 'copilot_improve'
  | 'start_legal_review'
  | 'request_legal_approval'
  | 'open_redline'
  | 'compare_redline'
  | 'view_obligations'
  | 'add_obligation'
  | 'show_overdue_obligations'
  | 'show_upcoming_obligations';

// ============ MAIN HANDLER ============

export async function handlePremiumAction(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { entities } = intent;
  const action = intent.action as PremiumAction | undefined;
  const contractId = entities.contractId || context.currentContractId;

  switch (action) {
    // Generate
    case 'open_generate':
      return handleOpenGenerate();
    case 'generate_blank':
      return handleGenerateBlank();
    case 'generate_template':
      return handleGenerateTemplate(entities.templateType || entities.contractType);
    case 'generate_renewal':
      return handleGenerateRenewal(contractId);
    case 'generate_amendment':
      return handleGenerateAmendment(contractId);
    
    // AI Copilot
    case 'open_copilot':
      return handleOpenCopilot();
    case 'copilot_draft':
      return handleCopilotDraft(entities.contractType, entities.draftPrompt);
    case 'copilot_review':
      return handleCopilotReview(contractId);
    case 'copilot_improve':
      return handleCopilotImprove(contractId);
    
    // Legal Review
    case 'start_legal_review':
      return handleStartLegalReview(contractId);
    case 'request_legal_approval':
      return handleRequestLegalApproval(contractId);
    
    // Redlining
    case 'open_redline':
      return handleOpenRedline(contractId);
    case 'compare_redline':
      return handleCompareRedline(entities.contractA, entities.contractB);
    
    // Obligations
    case 'view_obligations':
      return handleViewObligations(contractId);
    case 'add_obligation':
      return handleAddObligation(contractId);
    case 'show_overdue_obligations':
      return handleOverdueObligations();
    case 'show_upcoming_obligations':
      return handleUpcomingObligations();
    
    default:
      return showPremiumOptions();
  }
}

// ============ GENERATE HANDLERS ============

function handleOpenGenerate(): ActionResponse {
  return {
    success: true,
    message: `✨ **AI Contract Generation**

Choose how you'd like to generate your contract:

**📝 Start Blank**
Create a new contract from scratch with AI assistance.
→ "Start a blank contract"

**📋 Use Template**
Generate from our library of professional templates:
• NDA, MSA, SoW, SLA, DPA, Employment, Consulting
→ "Generate an NDA" or "Use MSA template"

**🔄 Create Renewal**
Generate a renewal from an existing contract.
→ "Create renewal" (while viewing a contract)

**📄 Create Amendment**
Create an amendment to modify existing terms.
→ "Create amendment" (while viewing a contract)

👉 **[Open Contract Generator](/generate)**`,
    data: {
      navigation: { path: '/generate', action: 'navigate' },
      options: ['blank', 'template', 'renewal', 'amendment']
    }
  };
}

function handleGenerateBlank(): ActionResponse {
  return {
    success: true,
    message: `📝 **Start Blank Contract**

I'll help you create a new contract from scratch. The AI will guide you through:

1. **Contract Type** - What kind of agreement?
2. **Parties** - Who's involved?
3. **Key Terms** - Duration, value, obligations
4. **Clauses** - AI-suggested standard clauses

👉 **[Start Blank Contract](/generate?create=blank)**`,
    data: {
      navigation: { path: '/generate?create=blank', action: 'navigate' }
    }
  };
}

function handleGenerateTemplate(templateType?: string): ActionResponse {
  const template = templateType?.toLowerCase();
  const queryParam = template ? `?create=template&type=${template}` : '?create=template';
  
  const templateOptions = [
    '• **NDA** - Non-Disclosure Agreement',
    '• **MSA** - Master Services Agreement',
    '• **SoW** - Statement of Work',
    '• **SLA** - Service Level Agreement',
    '• **DPA** - Data Processing Agreement',
    '• **Employment** - Employment Contract',
    '• **Consulting** - Consulting Agreement',
  ].join('\n');

  const message = template 
    ? `📋 **Generate ${template.toUpperCase()} Contract**

I'll generate a ${template.toUpperCase()} contract using our professional template.

The template includes standard clauses that you can customize to your needs.

👉 **[Generate ${template.toUpperCase()}](/generate${queryParam})**`
    : `📋 **Generate from Template**

Choose from our library of professional templates:

${templateOptions}

Each template includes standard legal clauses that you can customize.

👉 **[Open Template Library](/generate?create=template)**`;

  return {
    success: true,
    message,
    data: {
      navigation: { path: `/generate${queryParam}`, action: 'navigate' },
      selectedTemplate: template
    }
  };
}

function handleGenerateRenewal(contractId?: string): ActionResponse {
  const message = contractId 
    ? `🔄 **Create Contract Renewal**

I'll help you create a renewal for the current contract. The renewal will:

• Copy key terms from the original
• Allow you to update dates and values
• Maintain the relationship to the parent contract

👉 **[Create Renewal](/generate?create=renewal&from=${contractId})**`
    : `🔄 **Create Contract Renewal**

To create a renewal, please navigate to the contract you want to renew, or tell me which contract.

You can also go directly to generate:
👉 **[Open Contract Generator](/generate?create=renewal)**`;

  return {
    success: true,
    message,
    data: {
      navigation: { 
        path: contractId 
          ? `/generate?create=renewal&from=${contractId}` 
          : '/generate?create=renewal',
        action: 'navigate' 
      }
    }
  };
}

function handleGenerateAmendment(contractId?: string): ActionResponse {
  const message = contractId 
    ? `📄 **Create Contract Amendment**

I'll help you create an amendment to modify the current contract. The amendment will:

• Reference the original contract
• Track all changes made
• Maintain legal relationship to parent

👉 **[Create Amendment](/generate?create=amendment&from=${contractId})**`
    : `📄 **Create Contract Amendment**

To create an amendment, please navigate to the contract you want to amend, or tell me which contract.

You can also go directly to generate:
👉 **[Open Contract Generator](/generate?create=amendment)**`;

  return {
    success: true,
    message,
    data: {
      navigation: { 
        path: contractId 
          ? `/generate?create=amendment&from=${contractId}` 
          : '/generate?create=amendment',
        action: 'navigate' 
      }
    }
  };
}

// ============ AI COPILOT HANDLERS ============

function handleOpenCopilot(): ActionResponse {
  return {
    success: true,
    message: `🤖 **AI Copilot**

Your intelligent contract drafting assistant is ready! The Copilot can:

**✍️ Draft Contracts**
Tell me what kind of contract you need, and I'll help you draft it.
→ "Help me draft an NDA"

**🔍 Review Drafts**
I'll analyze your draft and suggest improvements.
→ "Review my draft"

**✨ Improve Language**
I'll enhance contract language for clarity and legal precision.
→ "Improve this contract language"

👉 **[Open AI Copilot](/drafting/copilot)**`,
    data: {
      navigation: { path: '/drafting/copilot', action: 'navigate' }
    }
  };
}

function handleCopilotDraft(contractType?: string, prompt?: string): ActionResponse {
  const params = new URLSearchParams({ mode: 'draft' });
  if (contractType) params.set('type', contractType);
  if (prompt) params.set('prompt', prompt);

  return {
    success: true,
    message: `✍️ **AI Draft Assistant**

${contractType ? `I'll help you draft a ${contractType} contract.` : 'Tell me what kind of contract you need, and I\'ll help you draft it.'}

The AI will:
• Generate appropriate clauses
• Suggest key terms based on contract type
• Ensure legal compliance
• Let you customize everything

👉 **[Start Drafting](/drafting/copilot?${params.toString()})**`,
    data: {
      navigation: { path: `/drafting/copilot?${params.toString()}`, action: 'navigate' }
    }
  };
}

function handleCopilotReview(contractId?: string): ActionResponse {
  const path = contractId 
    ? `/drafting/copilot?mode=review&contract=${contractId}`
    : '/drafting/copilot?mode=review';

  return {
    success: true,
    message: `🔍 **AI Contract Review**

${contractId ? 'I\'ll analyze the current contract and provide detailed feedback.' : 'Navigate to a contract or paste content for review.'}

The review includes:
• Clause analysis and risk assessment
• Missing clause detection
• Language improvement suggestions
• Compliance checks

👉 **[Start Review](/drafting/copilot?mode=review)**`,
    data: {
      navigation: { path, action: 'navigate' }
    }
  };
}

function handleCopilotImprove(contractId?: string): ActionResponse {
  const path = contractId 
    ? `/drafting/copilot?mode=improve&contract=${contractId}`
    : '/drafting/copilot?mode=improve';

  return {
    success: true,
    message: `✨ **Improve Contract Language**

I'll enhance your contract language for:
• Legal precision and clarity
• Consistent terminology
• Risk mitigation wording
• Professional tone

👉 **[Improve Language](/drafting/copilot?mode=improve)**`,
    data: {
      navigation: { path, action: 'navigate' }
    }
  };
}

// ============ LEGAL REVIEW HANDLERS ============

function handleStartLegalReview(contractId?: string): ActionResponse {
  const path = contractId 
    ? `/contracts/${contractId}/legal-review`
    : '/contracts';

  const message = contractId 
    ? `⚖️ **AI Legal Review**

I'll perform a comprehensive legal analysis of this contract:

**What's Analyzed:**
• Risk clauses (liability, indemnification, termination)
• Compliance requirements
• Missing standard clauses
• Unusual or concerning terms
• Jurisdiction and governing law

**Output:**
• Risk score and assessment
• Clause-by-clause analysis
• Recommended changes
• Compliance checklist

👉 **[Start Legal Review](/contracts/${contractId}/legal-review)**`
    : `⚖️ **AI Legal Review**

To start a legal review, please navigate to the contract you want to analyze.

The legal review will examine:
• Risk clauses and liability exposure
• Compliance with regulations
• Missing or unusual terms
• Suggested improvements`;

  return {
    success: true,
    message,
    data: {
      navigation: { path, action: 'navigate' }
    }
  };
}

function handleRequestLegalApproval(contractId?: string): ActionResponse {
  return {
    success: true,
    message: contractId 
      ? `📋 **Request Legal Approval**

I'll submit this contract for legal team approval.

The request will include:
• AI-generated risk summary
• Key clauses flagged for review
• Suggested review priority

👉 **[Submit for Legal Approval](/contracts/${contractId}/legal-review?action=request-approval)**`
      : `📋 **Request Legal Approval**

Please navigate to the specific contract you'd like to submit for legal approval.`,
    data: {
      navigation: contractId 
        ? { path: `/contracts/${contractId}/legal-review?action=request-approval`, action: 'navigate' }
        : undefined
    }
  };
}

// ============ REDLINE HANDLERS ============

function handleOpenRedline(contractId?: string): ActionResponse {
  const path = contractId 
    ? `/contracts/${contractId}/redline`
    : '/contracts';

  const message = contractId 
    ? `📝 **Redline Editor**

Open the track-changes editor for this contract:

**Features:**
• Track all insertions and deletions
• Compare with previous versions
• Accept/reject individual changes
• Comment and collaborate
• Export with markup

👉 **[Open Redline Editor](/contracts/${contractId}/redline)**`
    : `📝 **Redline Editor**

To use the redline editor, please navigate to the contract you want to edit.

The redline editor allows you to:
• Track changes visually
• Compare document versions
• Collaborate with markup`;

  return {
    success: true,
    message,
    data: {
      navigation: { path, action: 'navigate' }
    }
  };
}

function handleCompareRedline(contractA?: string, contractB?: string): ActionResponse {
  const params = new URLSearchParams();
  if (contractA) params.set('original', contractA);
  if (contractB) params.set('revised', contractB);
  
  const path = params.toString() 
    ? `/contracts/redline?${params.toString()}`
    : '/contracts/redline';

  return {
    success: true,
    message: `🔄 **Compare & Redline**

I'll compare two contract versions and show all differences with redline markup.

${contractA && contractB 
  ? 'Ready to compare the specified contracts.'
  : 'Please specify which two contracts or versions to compare.'}

👉 **[Compare Documents](/contracts/redline${params.toString() ? `?${params.toString()}` : ''})**`,
    data: {
      navigation: { path, action: 'navigate' }
    }
  };
}

// ============ OBLIGATION HANDLERS ============

function handleViewObligations(contractId?: string): ActionResponse {
  const path = contractId 
    ? `/obligations?contract=${contractId}`
    : '/obligations';

  return {
    success: true,
    message: `📅 **Obligation Tracking**

${contractId ? 'Viewing obligations for this contract:' : 'Your obligation dashboard:'}

**Track:**
• Payment deadlines
• Delivery milestones
• Reporting requirements
• Compliance obligations
• Renewal dates

👉 **[View Obligations](${path})**`,
    data: {
      navigation: { path, action: 'navigate' }
    }
  };
}

function handleAddObligation(contractId?: string): ActionResponse {
  const path = contractId 
    ? `/obligations?contract=${contractId}&action=add`
    : '/obligations?action=add';

  return {
    success: true,
    message: `➕ **Add Obligation**

Create a new obligation to track:

**Fields:**
• Title and description
• Due date
• Associated contract
• Responsible party
• Priority level
• Reminder settings

👉 **[Add Obligation](${path})**`,
    data: {
      navigation: { path, action: 'navigate' }
    }
  };
}

function handleOverdueObligations(): ActionResponse {
  return {
    success: true,
    message: `⚠️ **Overdue Obligations**

Viewing obligations that are past their due date.

These items need immediate attention!

👉 **[View Overdue](/obligations?status=overdue)**`,
    data: {
      navigation: { path: '/obligations?status=overdue', action: 'navigate' }
    }
  };
}

function handleUpcomingObligations(): ActionResponse {
  return {
    success: true,
    message: `📆 **Upcoming Obligations**

Viewing obligations due in the next 7 days.

Stay ahead of your deadlines!

👉 **[View Upcoming](/obligations?status=upcoming)**`,
    data: {
      navigation: { path: '/obligations?status=upcoming', action: 'navigate' }
    }
  };
}

// ============ FALLBACK ============

function showPremiumOptions(): ActionResponse {
  return {
    success: true,
    message: `✨ **Premium AI Features**

Unlock the full power of AI contract management:

**📄 Generate Contracts**
Create contracts from scratch or templates with AI assistance.
→ "Generate a contract" | "Use NDA template"

**🤖 AI Copilot**
Your intelligent drafting assistant.
→ "Open AI Copilot" | "Help me draft"

**⚖️ Legal Review**
AI-powered legal clause analysis.
→ "Start legal review" | "Check legal risks"

**📝 Redlining**
Track changes and compare versions.
→ "Open redline editor" | "Compare documents"

**📅 Obligation Tracking**
Never miss a deadline.
→ "Show my obligations" | "Upcoming deadlines"

What would you like to do?`,
    data: {
      options: ['generate', 'copilot', 'legal', 'redline', 'obligations']
    }
  };
}

// ============ PATTERN DETECTION ============

export const premiumActionPatterns = [
  // Generate patterns
  { pattern: /(?:open|go\s+to|show)\s+(?:contract\s+)?generat(?:e|or|ion)/i, action: 'open_generate' as const },
  { pattern: /(?:start|create|make)\s+(?:a\s+)?blank\s+(?:contract|document)/i, action: 'generate_blank' as const },
  { pattern: /(?:generate|create|use)\s+(?:an?\s+)?(?:nda|msa|sow|sla|dpa)\s*(?:contract|agreement|template)?/i, action: 'generate_template' as const },
  { pattern: /(?:use|generate\s+from|start\s+with)\s+(?:a\s+)?template/i, action: 'generate_template' as const },
  { pattern: /(?:create|generate|start)\s+(?:a\s+)?(?:contract\s+)?renewal/i, action: 'generate_renewal' as const },
  { pattern: /(?:renew)\s+(?:this\s+)?contract/i, action: 'generate_renewal' as const },
  { pattern: /(?:create|generate|start)\s+(?:a\s+)?(?:contract\s+)?amendment/i, action: 'generate_amendment' as const },
  { pattern: /(?:amend)\s+(?:this\s+)?contract/i, action: 'generate_amendment' as const },
  
  // AI Copilot patterns
  { pattern: /(?:open|launch|start)\s+(?:ai\s+)?copilot/i, action: 'open_copilot' as const },
  { pattern: /(?:help\s+me\s+)?draft\s+(?:a\s+)?(?:contract|agreement|nda|msa)/i, action: 'copilot_draft' as const },
  { pattern: /(?:ai\s+)?(?:assist|help)\s+(?:me\s+)?(?:with\s+)?drafting/i, action: 'copilot_draft' as const },
  { pattern: /(?:review|analyze)\s+(?:my\s+)?(?:draft|document|contract)/i, action: 'copilot_review' as const },
  { pattern: /(?:improve|enhance|fix)\s+(?:the\s+)?(?:contract\s+)?(?:language|wording|text)/i, action: 'copilot_improve' as const },
  
  // Legal Review patterns
  { pattern: /(?:start|begin|run)\s+(?:a\s+)?legal\s+review/i, action: 'start_legal_review' as const },
  { pattern: /(?:check|analyze|review)\s+(?:for\s+)?legal\s+(?:risks?|issues?|terms?)/i, action: 'start_legal_review' as const },
  { pattern: /(?:request|submit\s+for)\s+legal\s+(?:approval|review)/i, action: 'request_legal_approval' as const },
  
  // Redline patterns
  { pattern: /(?:open|start|use)\s+(?:the\s+)?redline\s*(?:editor)?/i, action: 'open_redline' as const },
  { pattern: /(?:track\s+changes|markup|redline)/i, action: 'open_redline' as const },
  { pattern: /(?:compare|diff)\s+(?:and\s+)?redline/i, action: 'compare_redline' as const },
  
  // Obligation patterns
  { pattern: /(?:show|view|list|see)\s+(?:my\s+)?obligations?/i, action: 'view_obligations' as const },
  { pattern: /(?:add|create|new)\s+(?:an?\s+)?obligation/i, action: 'add_obligation' as const },
  { pattern: /(?:overdue|past\s+due|late)\s+obligations?/i, action: 'show_overdue_obligations' as const },
  { pattern: /(?:upcoming|next|due\s+soon)\s+(?:obligations?|deadlines?)/i, action: 'show_upcoming_obligations' as const },
  { pattern: /(?:obligations?\s+)?(?:for\s+)?(?:this|the)\s+(?:contract|week|month)/i, action: 'view_obligations' as const },
];

export function detectPremiumIntent(query: string): DetectedIntent | null {
  const lowerQuery = query.toLowerCase().trim();
  
  for (const { pattern, action } of premiumActionPatterns) {
    if (pattern.test(lowerQuery)) {
      // Extract any template type mentioned
      const templateMatch = lowerQuery.match(/(?:nda|msa|sow|sla|dpa|employment|consulting)/i);
      const templateType = templateMatch ? templateMatch[0].toUpperCase() : undefined;
      
      return {
        type: 'action',
        action: action as any,
        entities: {
          templateType,
          contractType: templateType,
        },
        confidence: 0.9,
      };
    }
  }
  
  return null;
}

export default handlePremiumAction;
