/**
 * Creation Actions Handler
 * 
 * Handles all contract creation operations from chatbot commands:
 * - create_manual: Guide to manual contract creation page
 * - quick_upload: Trigger quick upload modal
 * - ai_draft: Start AI-assisted drafting
 * - generate_from_template: Guide to template generation
 */

import { DetectedIntent, ChatContext, ActionResponse } from '../types';

// ============ MAIN HANDLER ============

export async function handleCreationAction(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { action, entities } = intent;

  switch (action) {
    case 'create':
    case 'create_manual':
      return handleCreateManual(entities);
    
    case 'quick_upload':
      return handleQuickUpload();
    
    case 'ai_draft':
      return handleAIDraft(entities);
    
    case 'generate':
    case 'generate_from_template':
      return handleTemplateGeneration(entities);
    
    default:
      return showCreationOptions();
  }
}

// ============ ACTION IMPLEMENTATIONS ============

function handleCreateManual(entities: DetectedIntent['entities']): ActionResponse {
  const title = entities.contractTitle || entities.contractName;
  const type = entities.contractType;
  
  let queryParams = '';
  if (title || type) {
    const params = new URLSearchParams();
    if (title) params.set('title', title);
    if (type) params.set('type', type);
    queryParams = `?${params.toString()}`;
  }

  return {
    success: true,
    message: `📝 **Create a New Contract Manually**\n\nI can help you create a contract step by step. The manual creation wizard lets you:\n\n1. **Basic Info** - Set title, type, and description\n2. **Parties** - Add contract parties and their roles\n3. **Terms** - Set effective dates and renewal options\n4. **Financials** - Add value, currency, payment terms\n5. **Additional** - Tags, priority, and notes\n\n👉 **[Open Contract Creation Wizard](/contracts/new${queryParams})**\n\n💡 You can also say:\n• "Upload a contract" for quick file upload\n• "Draft an NDA with AI" for AI-assisted creation\n• "Generate from template" for template-based creation`,
    data: {
      navigation: {
        path: `/contracts/new${queryParams}`,
        action: 'navigate'
      },
      prefill: {
        title,
        type
      }
    }
  };
}

function handleQuickUpload(): ActionResponse {
  return {
    success: true,
    message: `📤 **Quick Upload**\n\nI've triggered the quick upload modal. You can:\n\n• **Drag & drop** files directly\n• **Click to browse** for documents\n• Upload **multiple files** at once\n\n**Supported formats:**\n• PDF documents\n• Word documents (.doc, .docx)\n• Images (for OCR processing)\n\n💡 The AI will automatically extract contract details from your uploaded documents.\n\n👉 If the modal didn't open, go to the **[Contracts page](/contracts)** and click **"New Contract"** → **"Quick Upload"**.`,
    data: {
      action: 'open_quick_upload',
      triggerEvent: 'openQuickUpload'
    }
  };
}

function handleAIDraft(entities: DetectedIntent['entities']): ActionResponse {
  const prompt = entities.draftPrompt || entities.contractDescription;
  const contractType = entities.contractType;
  
  let queryParams = '';
  if (prompt || contractType) {
    const params = new URLSearchParams();
    if (prompt) params.set('prompt', prompt);
    if (contractType) params.set('type', contractType);
    queryParams = `?${params.toString()}`;
  }

  // Determine contract type from keywords
  let suggestion = '';
  if (contractType) {
    const typeUpper = contractType.toUpperCase();
    if (typeUpper.includes('NDA') || typeUpper.includes('DISCLOSURE')) {
      suggestion = 'I can help you draft a Non-Disclosure Agreement. ';
    } else if (typeUpper.includes('MSA') || typeUpper.includes('SERVICE')) {
      suggestion = 'I can help you draft a Master Service Agreement. ';
    } else if (typeUpper.includes('EMPLOYMENT')) {
      suggestion = 'I can help you draft an Employment Agreement. ';
    } else if (typeUpper.includes('SLA')) {
      suggestion = 'I can help you draft a Service Level Agreement. ';
    }
  }

  return {
    success: true,
    message: `🤖 **AI Draft Assistant**\n\n${suggestion}The AI Draft Assistant uses conversational AI to help you create contracts from scratch.\n\n**How it works:**\n1. Describe what you need in plain language\n2. AI generates a structured draft with:\n   • Contract title and type\n   • Suggested parties\n   • Key terms and clauses\n3. Review and refine the draft\n4. Save directly to your contracts\n\n**Example prompts:**\n• "Create an NDA between my company and a partner"\n• "Draft a software development contract for a mobile app"\n• "Write a consulting agreement for a 3-month project"\n\n👉 **[Open AI Draft Assistant](/contracts/ai-draft${queryParams})**`,
    data: {
      navigation: {
        path: `/contracts/ai-draft${queryParams}`,
        action: 'navigate'
      },
      suggestedType: contractType
    }
  };
}

function handleTemplateGeneration(entities: DetectedIntent['entities']): ActionResponse {
  const templateType = entities.templateType || entities.contractType;
  
  let queryParams = '';
  if (templateType) {
    queryParams = `?template=${encodeURIComponent(templateType)}`;
  }

  const templateOptions = [
    '• **Software License Agreement** - SaaS and software licensing',
    '• **Master Services Agreement (MSA)** - Professional services',
    '• **Non-Disclosure Agreement (NDA)** - Confidentiality protection',
    '• **Service Level Agreement (SLA)** - Service guarantees',
    '• **Data Processing Agreement (DPA)** - GDPR compliance',
    '• **Employment Agreement** - Hiring contracts',
    '• **Consulting Agreement** - Consultant engagements',
    '• **Statement of Work (SoW)** - Project scopes'
  ];

  return {
    success: true,
    message: `📋 **Generate from Template**\n\nChoose from our library of professional contract templates:\n\n${templateOptions.join('\n')}\n\n**How it works:**\n1. Select a template type\n2. Fill in your specific details (parties, dates, values)\n3. Preview the generated contract\n4. Download as PDF or Word\n\n👉 **[Open Template Generator](/contracts/generate${queryParams})**\n\n💡 Each template includes standard legal clauses that you can customize.`,
    data: {
      navigation: {
        path: `/contracts/generate${queryParams}`,
        action: 'navigate'
      },
      selectedTemplate: templateType,
      availableTemplates: [
        'software_license',
        'msa',
        'nda',
        'sla',
        'dpa',
        'employment',
        'consulting',
        'sow'
      ]
    }
  };
}

function showCreationOptions(): ActionResponse {
  return {
    success: true,
    message: `📄 **Contract Creation Options**\n\nI can help you create a new contract in several ways:\n\n**1. 📤 Quick Upload** *(fastest)*\n   Upload existing contract documents\n   → "Upload a contract" or "Quick upload"\n\n**2. 📝 Manual Creation** *(most control)*\n   Enter contract details step by step\n   → "Create a new contract manually"\n\n**3. 🤖 AI Draft** *(easiest)*\n   Describe what you need in plain language\n   → "Draft an NDA" or "AI help me create a contract"\n\n**4. 📋 Templates** *(professional)*\n   Generate from pre-built templates\n   → "Generate from template" or "Use NDA template"\n\nWhich option would you like to use?`,
    data: {
      options: [
        { key: 'quick_upload', label: 'Quick Upload', path: '/contracts', action: 'openQuickUpload' },
        { key: 'manual', label: 'Manual Creation', path: '/contracts/new' },
        { key: 'ai_draft', label: 'AI Draft', path: '/contracts/ai-draft' },
        { key: 'template', label: 'From Template', path: '/contracts/generate' }
      ]
    }
  };
}

// ============ PATTERN MATCHING ============

export const creationActionPatterns = [
  // Manual creation patterns
  { pattern: /(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?contract\s+(?:manually|by\s+hand)/i, action: 'create_manual' as const },
  { pattern: /(?:enter|input|type)\s+contract\s+(?:details|info|information)/i, action: 'create_manual' as const },
  { pattern: /(?:new|start)\s+(?:a\s+)?contract\s+(?:form|wizard)/i, action: 'create_manual' as const },
  
  // Quick upload patterns
  { pattern: /(?:quick|fast)\s+upload/i, action: 'quick_upload' as const },
  { pattern: /upload\s+(?:a\s+)?(?:new\s+)?(?:contract|document|file)/i, action: 'quick_upload' as const },
  { pattern: /(?:drag\s+and\s+drop|drop)\s+(?:a\s+)?(?:contract|file)/i, action: 'quick_upload' as const },
  
  // AI draft patterns
  { pattern: /(?:ai|artificial\s+intelligence)\s+(?:help\s+)?(?:me\s+)?(?:draft|create|write)/i, action: 'ai_draft' as const },
  { pattern: /(?:draft|write|create)\s+(?:an?\s+)?(?:contract|agreement)\s+(?:with\s+)?ai/i, action: 'ai_draft' as const },
  { pattern: /draft\s+(?:an?\s+)?(?:nda|msa|sow|sla|employment|consulting)/i, action: 'ai_draft' as const },
  { pattern: /(?:help\s+me\s+)?(?:write|draft)\s+(?:an?\s+)?(?:contract|agreement)/i, action: 'ai_draft' as const },
  
  // Template patterns
  { pattern: /(?:use|generate\s+from|start\s+with)\s+(?:a\s+)?template/i, action: 'generate_from_template' as const },
  { pattern: /(?:nda|msa|sow|sla)\s+template/i, action: 'generate_from_template' as const },
  { pattern: /(?:template|standard)\s+(?:contract|agreement)/i, action: 'generate_from_template' as const },
  
  // General creation patterns (fallback to options)
  { pattern: /(?:create|make|add|new)\s+(?:a\s+)?(?:new\s+)?contract/i, action: 'create' as const },
  { pattern: /(?:how\s+(?:do\s+i|can\s+i|to))\s+(?:create|add|make)\s+(?:a\s+)?contract/i, action: 'create' as const },
];

export default handleCreationAction;
