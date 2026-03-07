/**
 * Prompt Templates Library
 * 
 * Reusable prompt templates for common AI analysis tasks.
 * Features:
 * - Pre-built templates for contract analysis
 * - Variable substitution
 * - Template composition
 * - Custom template creation
 */

// Types
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  template: string;
  variables: TemplateVariable[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tags?: string[];
  isBuiltIn: boolean;
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: unknown;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: string[];
  };
}

export type TemplateCategory = 
  | 'analysis'
  | 'extraction'
  | 'comparison'
  | 'summarization'
  | 'risk'
  | 'compliance'
  | 'drafting'
  | 'custom';

// Built-in templates
export const BUILTIN_TEMPLATES: PromptTemplate[] = [
  // ===== ANALYSIS TEMPLATES =====
  {
    id: 'contract-overview',
    name: 'Contract Overview',
    description: 'Generate a comprehensive overview of a contract',
    category: 'analysis',
    template: `Analyze the following contract and provide a comprehensive overview:

**Contract:**
{{contractText}}

Please provide:
1. **Type of Agreement**: Identify what type of contract this is
2. **Parties Involved**: List all parties and their roles
3. **Effective Date & Duration**: When does it start and end?
4. **Primary Purpose**: What is the main objective of this contract?
5. **Key Terms Summary**: Summarize the most important terms
6. **Financial Terms**: Any payments, fees, or financial obligations
7. **Notable Clauses**: Highlight any unusual or significant clauses

Format your response in clear sections with bullet points where appropriate.`,
    variables: [
      {
        name: 'contractText',
        description: 'The full text of the contract',
        type: 'string',
        required: true,
        validation: { minLength: 100 },
      },
    ],
    model: 'gpt-4o-mini',
    maxTokens: 2000,
    temperature: 0.3,
    tags: ['overview', 'summary', 'general'],
    isBuiltIn: true,
  },
  {
    id: 'quick-summary',
    name: 'Quick Summary',
    description: 'Generate a brief executive summary',
    category: 'summarization',
    template: `Provide a brief executive summary of this contract in 3-5 sentences:

{{contractText}}

Focus on: parties, purpose, duration, and key financial terms.`,
    variables: [
      {
        name: 'contractText',
        description: 'The contract text to summarize',
        type: 'string',
        required: true,
      },
    ],
    model: 'gpt-4o-mini',
    maxTokens: 500,
    temperature: 0.3,
    tags: ['summary', 'executive', 'brief'],
    isBuiltIn: true,
  },

  // ===== EXTRACTION TEMPLATES =====
  {
    id: 'extract-key-dates',
    name: 'Extract Key Dates',
    description: 'Extract all important dates and deadlines',
    category: 'extraction',
    template: `Extract all important dates and deadlines from this contract:

{{contractText}}

Return a JSON array with the following structure for each date:
[
  {
    "date": "YYYY-MM-DD or description if specific date not given",
    "type": "effective|expiration|renewal|deadline|milestone|notice|other",
    "description": "What this date represents",
    "clause": "Reference to the clause containing this date",
    "isRecurring": boolean
  }
]

Only return valid JSON, no additional text.`,
    variables: [
      {
        name: 'contractText',
        description: 'The contract text to analyze',
        type: 'string',
        required: true,
      },
    ],
    model: 'gpt-4o-mini',
    maxTokens: 1500,
    temperature: 0.1,
    tags: ['extraction', 'dates', 'deadlines'],
    isBuiltIn: true,
  },
  {
    id: 'extract-obligations',
    name: 'Extract Obligations',
    description: 'Extract all contractual obligations by party',
    category: 'extraction',
    template: `Extract all contractual obligations from this contract, organized by party:

{{contractText}}

Return a JSON object:
{
  "parties": [
    {
      "name": "Party name",
      "role": "Role in contract",
      "obligations": [
        {
          "description": "Description of the obligation",
          "type": "payment|delivery|performance|reporting|compliance|other",
          "deadline": "When due, if specified",
          "conditions": "Any conditions that must be met",
          "penalty": "Consequences of non-compliance, if specified"
        }
      ]
    }
  ]
}

Only return valid JSON.`,
    variables: [
      {
        name: 'contractText',
        description: 'The contract text to analyze',
        type: 'string',
        required: true,
      },
    ],
    model: 'gpt-4o',
    maxTokens: 3000,
    temperature: 0.2,
    tags: ['extraction', 'obligations', 'duties'],
    isBuiltIn: true,
  },
  {
    id: 'extract-financial-terms',
    name: 'Extract Financial Terms',
    description: 'Extract all financial information and payment terms',
    category: 'extraction',
    template: `Extract all financial terms and payment information from this contract:

{{contractText}}

Return JSON:
{
  "totalValue": "Total contract value if stated",
  "currency": "Currency used",
  "paymentTerms": [
    {
      "amount": "Amount or calculation method",
      "frequency": "one-time|monthly|quarterly|annually|milestone-based|other",
      "dueDate": "When payment is due",
      "conditions": "Payment conditions"
    }
  ],
  "penalties": [
    {
      "type": "late payment|breach|termination|other",
      "amount": "Penalty amount or calculation",
      "description": "Description of penalty"
    }
  ],
  "adjustments": "Any price adjustment clauses",
  "expenses": "Reimbursable expenses terms"
}

Only return valid JSON.`,
    variables: [
      {
        name: 'contractText',
        description: 'The contract text to analyze',
        type: 'string',
        required: true,
      },
    ],
    model: 'gpt-4o-mini',
    maxTokens: 2000,
    temperature: 0.1,
    tags: ['extraction', 'financial', 'payment'],
    isBuiltIn: true,
  },

  // ===== RISK TEMPLATES =====
  {
    id: 'risk-assessment',
    name: 'Risk Assessment',
    description: 'Comprehensive risk analysis of contract terms',
    category: 'risk',
    template: `Perform a comprehensive risk assessment of this contract from the perspective of {{perspective}}:

{{contractText}}

Analyze and categorize risks:

1. **Legal Risks**: Liability exposure, indemnification gaps, jurisdiction issues
2. **Financial Risks**: Payment terms, penalties, cost overruns
3. **Operational Risks**: Performance requirements, resource commitments
4. **Compliance Risks**: Regulatory requirements, data protection
5. **Termination Risks**: Exit clauses, consequences of termination

For each risk identified, provide:
- Risk Level: Critical / High / Medium / Low
- Description: What is the risk?
- Mitigation: How can it be addressed?
- Clause Reference: Where in the contract?

Also identify any missing clauses that should be added.`,
    variables: [
      {
        name: 'contractText',
        description: 'The contract text to analyze',
        type: 'string',
        required: true,
      },
      {
        name: 'perspective',
        description: 'Whose perspective to analyze from',
        type: 'string',
        required: false,
        default: 'the company reviewing the contract',
      },
    ],
    model: 'gpt-4o',
    maxTokens: 3000,
    temperature: 0.4,
    tags: ['risk', 'assessment', 'analysis'],
    isBuiltIn: true,
  },
  {
    id: 'liability-check',
    name: 'Liability Check',
    description: 'Analyze liability and indemnification clauses',
    category: 'risk',
    template: `Analyze the liability and indemnification provisions in this contract:

{{contractText}}

Evaluate:
1. **Liability Caps**: Are there limits on liability? Are they adequate?
2. **Indemnification**: Who indemnifies whom? What triggers indemnification?
3. **Insurance Requirements**: What coverage is required?
4. **Limitation of Liability**: What types of damages are excluded?
5. **Force Majeure**: What events excuse performance?

Provide a risk score (1-10) and specific recommendations for negotiation.`,
    variables: [
      {
        name: 'contractText',
        description: 'The contract text to analyze',
        type: 'string',
        required: true,
      },
    ],
    model: 'gpt-4o',
    maxTokens: 2000,
    temperature: 0.3,
    tags: ['risk', 'liability', 'indemnification'],
    isBuiltIn: true,
  },

  // ===== COMPARISON TEMPLATES =====
  {
    id: 'compare-contracts',
    name: 'Compare Contracts',
    description: 'Side-by-side comparison of two contracts',
    category: 'comparison',
    template: `Compare these two contracts and highlight the differences:

**Contract A:**
{{contractA}}

**Contract B:**
{{contractB}}

Provide a detailed comparison:

1. **Key Differences**: Major terms that differ
2. **Financial Comparison**: Pricing, payment terms, penalties
3. **Risk Comparison**: Which has more favorable risk allocation?
4. **Term Comparison**: Duration, renewal, termination
5. **Obligation Comparison**: What each party must do
6. **Missing in A**: What A lacks that B has
7. **Missing in B**: What B lacks that A has

Recommend which contract is more favorable and why.`,
    variables: [
      {
        name: 'contractA',
        description: 'First contract text',
        type: 'string',
        required: true,
      },
      {
        name: 'contractB',
        description: 'Second contract text',
        type: 'string',
        required: true,
      },
    ],
    model: 'gpt-4o',
    maxTokens: 4000,
    temperature: 0.3,
    tags: ['comparison', 'diff', 'analysis'],
    isBuiltIn: true,
  },
  {
    id: 'compare-to-standard',
    name: 'Compare to Standard Terms',
    description: 'Compare contract against industry standard terms',
    category: 'comparison',
    template: `Compare this contract against standard {{industryType}} contract terms:

{{contractText}}

Analyze:
1. **Deviations from Standard**: Where does this contract differ from typical terms?
2. **Missing Standard Clauses**: What typical clauses are absent?
3. **Unusual Terms**: Any terms that are atypical for this type of contract?
4. **Favorable Terms**: Terms that are better than standard
5. **Unfavorable Terms**: Terms that are worse than standard

Provide specific recommendations for alignment with industry standards.`,
    variables: [
      {
        name: 'contractText',
        description: 'The contract text to analyze',
        type: 'string',
        required: true,
      },
      {
        name: 'industryType',
        description: 'Type of industry/contract',
        type: 'string',
        required: false,
        default: 'software services',
        validation: {
          enum: ['software services', 'consulting', 'employment', 'NDA', 'procurement', 'lease', 'partnership'],
        },
      },
    ],
    model: 'gpt-4o',
    maxTokens: 2500,
    temperature: 0.4,
    tags: ['comparison', 'standard', 'benchmark'],
    isBuiltIn: true,
  },

  // ===== COMPLIANCE TEMPLATES =====
  {
    id: 'gdpr-compliance',
    name: 'GDPR Compliance Check',
    description: 'Check contract for GDPR compliance',
    category: 'compliance',
    template: `Review this contract for GDPR compliance:

{{contractText}}

Check for:
1. **Data Processing Agreement (DPA)**: Is there a proper DPA?
2. **Data Subject Rights**: Are rights properly addressed?
3. **Data Transfer**: Are international transfers compliant?
4. **Security Measures**: Are adequate technical measures specified?
5. **Breach Notification**: Is there a proper notification clause?
6. **Sub-processors**: Are sub-processors handled correctly?
7. **Data Retention**: Are retention periods specified?

For each item, indicate:
- Status: Compliant / Non-compliant / Partially Compliant / Not Applicable
- Finding: What was found or missing
- Recommendation: How to remediate

Overall GDPR compliance score: X/10`,
    variables: [
      {
        name: 'contractText',
        description: 'The contract text to analyze',
        type: 'string',
        required: true,
      },
    ],
    model: 'gpt-4o',
    maxTokens: 2500,
    temperature: 0.2,
    tags: ['compliance', 'gdpr', 'privacy', 'data protection'],
    isBuiltIn: true,
  },
  {
    id: 'security-requirements',
    name: 'Security Requirements Check',
    description: 'Analyze security and confidentiality provisions',
    category: 'compliance',
    template: `Analyze the security and confidentiality provisions in this contract:

{{contractText}}

Evaluate:
1. **Confidentiality Clause**: Scope, duration, exceptions
2. **Security Requirements**: Technical and organizational measures
3. **Access Controls**: Who can access what data?
4. **Audit Rights**: Can you audit the other party?
5. **Incident Response**: How are breaches handled?
6. **Certifications**: Required security certifications (SOC2, ISO27001, etc.)
7. **Data Handling**: Storage, encryption, disposal requirements

Identify gaps and provide security-focused recommendations.`,
    variables: [
      {
        name: 'contractText',
        description: 'The contract text to analyze',
        type: 'string',
        required: true,
      },
    ],
    model: 'gpt-4o',
    maxTokens: 2000,
    temperature: 0.3,
    tags: ['compliance', 'security', 'confidentiality'],
    isBuiltIn: true,
  },

  // ===== DRAFTING TEMPLATES =====
  {
    id: 'suggest-amendments',
    name: 'Suggest Amendments',
    description: 'Generate suggested contract amendments',
    category: 'drafting',
    template: `Based on this contract, suggest amendments to improve the position of {{partyRole}}:

{{contractText}}

{{#if concerns}}
Specific concerns to address: {{concerns}}
{{/if}}

For each suggestion:
1. **Current Language**: Quote the existing clause
2. **Issue**: Why it should be changed
3. **Suggested Language**: Proposed new wording
4. **Rationale**: Why this change benefits {{partyRole}}
5. **Negotiability**: How negotiable is this point? (Must-have / Nice-to-have / Walk-away)

Prioritize suggestions from most to least important.`,
    variables: [
      {
        name: 'contractText',
        description: 'The contract text to analyze',
        type: 'string',
        required: true,
      },
      {
        name: 'partyRole',
        description: 'Which party perspective to take',
        type: 'string',
        required: false,
        default: 'the reviewing party',
      },
      {
        name: 'concerns',
        description: 'Specific concerns to address',
        type: 'string',
        required: false,
      },
    ],
    model: 'gpt-4o',
    maxTokens: 3000,
    temperature: 0.5,
    tags: ['drafting', 'amendments', 'negotiation'],
    isBuiltIn: true,
  },
  {
    id: 'generate-clause',
    name: 'Generate Clause',
    description: 'Generate a specific contract clause',
    category: 'drafting',
    template: `Generate a {{clauseType}} clause for a {{contractType}} contract.

Requirements:
- Jurisdiction: {{jurisdiction}}
- Governing law preference: {{governingLaw}}
{{#if additionalRequirements}}
- Additional requirements: {{additionalRequirements}}
{{/if}}

Provide:
1. The clause text in proper legal language
2. Brief explanation of key provisions
3. Variations (stronger/weaker versions if applicable)
4. Common negotiation points`,
    variables: [
      {
        name: 'clauseType',
        description: 'Type of clause to generate',
        type: 'string',
        required: true,
        validation: {
          enum: [
            'limitation of liability',
            'indemnification',
            'termination',
            'confidentiality',
            'force majeure',
            'dispute resolution',
            'intellectual property',
            'non-compete',
            'non-solicitation',
            'warranty',
            'data protection',
          ],
        },
      },
      {
        name: 'contractType',
        description: 'Type of contract',
        type: 'string',
        required: true,
      },
      {
        name: 'jurisdiction',
        description: 'Legal jurisdiction',
        type: 'string',
        required: false,
        default: 'United States',
      },
      {
        name: 'governingLaw',
        description: 'Preferred governing law',
        type: 'string',
        required: false,
        default: 'New York',
      },
      {
        name: 'additionalRequirements',
        description: 'Any additional requirements',
        type: 'string',
        required: false,
      },
    ],
    model: 'gpt-4o',
    maxTokens: 2000,
    temperature: 0.4,
    tags: ['drafting', 'clause', 'generation'],
    isBuiltIn: true,
  },
];

// Template service
class PromptTemplateService {
  private customTemplates = new Map<string, PromptTemplate>();

  /**
   * Get all available templates
   */
  getAll(): PromptTemplate[] {
    return [...BUILTIN_TEMPLATES, ...this.customTemplates.values()];
  }

  /**
   * Get templates by category
   */
  getByCategory(category: TemplateCategory): PromptTemplate[] {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * Get template by ID
   */
  getById(id: string): PromptTemplate | undefined {
    return BUILTIN_TEMPLATES.find(t => t.id === id) || this.customTemplates.get(id);
  }

  /**
   * Search templates by name or tags
   */
  search(query: string): PromptTemplate[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Render template with variables
   */
  render(templateId: string, variables: Record<string, unknown>): string {
    const template = this.getById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    for (const v of template.variables) {
      if (v.required && variables[v.name] === undefined) {
        throw new Error(`Missing required variable: ${v.name}`);
      }
    }

    // Simple template rendering with {{variable}} syntax
    let rendered = template.template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value ?? ''));
    }

    // Handle conditionals {{#if variable}}...{{/if}}
    rendered = rendered.replace(
      /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, varName, content) => {
        return variables[varName] ? content : '';
      }
    );

    // Clean up any remaining unrendered variables
    rendered = rendered.replace(/\{\{[\w#/]+\}\}/g, '');

    return rendered.trim();
  }

  /**
   * Add custom template
   */
  addCustomTemplate(template: Omit<PromptTemplate, 'isBuiltIn'>): PromptTemplate {
    const customTemplate: PromptTemplate = {
      ...template,
      isBuiltIn: false,
    };
    this.customTemplates.set(template.id, customTemplate);
    return customTemplate;
  }

  /**
   * Update custom template
   */
  updateCustomTemplate(id: string, updates: Partial<PromptTemplate>): PromptTemplate | null {
    const existing = this.customTemplates.get(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, isBuiltIn: false };
    this.customTemplates.set(id, updated);
    return updated;
  }

  /**
   * Delete custom template
   */
  deleteCustomTemplate(id: string): boolean {
    return this.customTemplates.delete(id);
  }

  /**
   * Get template categories
   */
  getCategories(): { category: TemplateCategory; count: number }[] {
    const categories = new Map<TemplateCategory, number>();
    
    for (const template of this.getAll()) {
      categories.set(template.category, (categories.get(template.category) || 0) + 1);
    }

    return Array.from(categories.entries()).map(([category, count]) => ({
      category,
      count,
    }));
  }

  /**
   * Validate variables against template
   */
  validateVariables(
    templateId: string,
    variables: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const template = this.getById(templateId);
    if (!template) {
      return { valid: false, errors: ['Template not found'] };
    }

    const errors: string[] = [];

    for (const v of template.variables) {
      const value = variables[v.name];

      // Check required
      if (v.required && (value === undefined || value === null || value === '')) {
        errors.push(`${v.name} is required`);
        continue;
      }

      if (value === undefined) continue;

      // Check type
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== v.type && !(v.type === 'object' && actualType === 'object')) {
        errors.push(`${v.name} must be of type ${v.type}`);
      }

      // Check validation rules
      if (v.validation && typeof value === 'string') {
        if (v.validation.minLength && value.length < v.validation.minLength) {
          errors.push(`${v.name} must be at least ${v.validation.minLength} characters`);
        }
        if (v.validation.maxLength && value.length > v.validation.maxLength) {
          errors.push(`${v.name} must be at most ${v.validation.maxLength} characters`);
        }
        if (v.validation.pattern && !new RegExp(v.validation.pattern).test(value)) {
          errors.push(`${v.name} does not match required pattern`);
        }
        if (v.validation.enum && !v.validation.enum.includes(value)) {
          errors.push(`${v.name} must be one of: ${v.validation.enum.join(', ')}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export const promptTemplates = new PromptTemplateService();
