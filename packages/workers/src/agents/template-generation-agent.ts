/**
 * Template Generation Agent — Codename: Builder 🏗️
 *
 * Generates contract template structures from contract type, industry,
 * and existing contract analysis. Maps to 21 template families, builds
 * section skeletons with standard clauses, variables, and compliance notes.
 *
 * Cluster: operators | Handle: @builder
 */

import { BaseAgent } from './base-agent';
import type { AgentInput, AgentOutput, AgentRecommendation } from './types';
import { logger } from '../utils/logger';

// --------------------------------------------------------------------------
// Internal types
// --------------------------------------------------------------------------

interface TemplateSection {
  id: string;
  title: string;
  description: string;
  required: boolean;
  order: number;
  suggestedContent: string;
  variables: TemplateVariable[];
}

interface TemplateVariable {
  name: string;
  placeholder: string;
  type: 'text' | 'date' | 'currency' | 'number' | 'party' | 'address';
  required: boolean;
  description: string;
}

interface TemplateSuggestion {
  clause: string;
  reason: string;
  priority: 'required' | 'recommended' | 'optional';
  industry?: string;
}

interface TemplateStructure {
  templateType: string;
  templateFamily: string;
  sections: TemplateSection[];
  variables: TemplateVariable[];
  suggestedClauses: TemplateSuggestion[];
  complianceNotes: string[];
  generatedAt: string;
}

// --------------------------------------------------------------------------
// Template family definitions (21 families)
// --------------------------------------------------------------------------

interface TemplateFamilyDef {
  name: string;
  sections: Array<{ title: string; description: string; required: boolean }>;
  requiredClauses: string[];
  commonVariables: Array<{ name: string; type: TemplateVariable['type'] }>;
}

const TEMPLATE_FAMILIES: Record<string, TemplateFamilyDef> = {
  NDA: {
    name: 'Non-Disclosure Agreement',
    sections: [
      { title: 'Parties', description: 'Identifying information for disclosing and receiving parties', required: true },
      { title: 'Definition of Confidential Information', description: 'Scope and categories of protected information', required: true },
      { title: 'Obligations of Receiving Party', description: 'Duties regarding handling of confidential information', required: true },
      { title: 'Exclusions', description: 'Information excluded from confidentiality obligations', required: true },
      { title: 'Term and Termination', description: 'Duration of agreement and termination provisions', required: true },
      { title: 'Return of Information', description: 'Obligations to return or destroy materials', required: true },
      { title: 'Remedies', description: 'Available remedies for breach', required: false },
      { title: 'General Provisions', description: 'Governing law, amendments, notices', required: true },
    ],
    requiredClauses: ['Confidentiality obligations', 'Non-use restriction', 'Return/destroy obligation'],
    commonVariables: [
      { name: 'Disclosing Party', type: 'party' },
      { name: 'Receiving Party', type: 'party' },
      { name: 'Effective Date', type: 'date' },
      { name: 'Confidentiality Period', type: 'text' },
    ],
  },
  MSA: {
    name: 'Master Service Agreement',
    sections: [
      { title: 'Parties and Recitals', description: 'Party identification and background', required: true },
      { title: 'Scope of Services', description: 'General description of services to be provided', required: true },
      { title: 'Statements of Work', description: 'Framework for individual work orders', required: true },
      { title: 'Fees and Payment', description: 'Pricing structure and payment terms', required: true },
      { title: 'Term and Termination', description: 'Duration, renewal, and termination conditions', required: true },
      { title: 'Intellectual Property', description: 'Ownership of work product and IP rights', required: true },
      { title: 'Warranties', description: 'Service warranties and disclaimers', required: true },
      { title: 'Limitation of Liability', description: 'Caps on liability and exclusions', required: true },
      { title: 'Indemnification', description: 'Mutual or one-way indemnification provisions', required: true },
      { title: 'Confidentiality', description: 'Confidentiality obligations for both parties', required: true },
      { title: 'Insurance', description: 'Required insurance coverage', required: false },
      { title: 'General Provisions', description: 'Governing law, notices, force majeure, assignments', required: true },
    ],
    requiredClauses: ['Scope of service', 'Payment terms', 'Limitation of liability', 'IP ownership', 'Termination rights'],
    commonVariables: [
      { name: 'Client Name', type: 'party' },
      { name: 'Service Provider', type: 'party' },
      { name: 'Effective Date', type: 'date' },
      { name: 'Payment Terms', type: 'text' },
      { name: 'Liability Cap', type: 'currency' },
    ],
  },
  SAAS: {
    name: 'SaaS Subscription Agreement',
    sections: [
      { title: 'Parties', description: 'Provider and subscriber identification', required: true },
      { title: 'Service Description', description: 'Platform, features, and access rights', required: true },
      { title: 'Subscription and Fees', description: 'Pricing tiers, billing cycle, usage limits', required: true },
      { title: 'Service Level Agreement', description: 'Uptime guarantees, support response times, credits', required: true },
      { title: 'Data Protection', description: 'Data handling, privacy, security obligations', required: true },
      { title: 'Acceptable Use', description: 'Permitted and prohibited uses', required: true },
      { title: 'Intellectual Property', description: 'Ownership, licensing, user data rights', required: true },
      { title: 'Term, Renewal, and Termination', description: 'Subscription periods and cancellation', required: true },
      { title: 'Limitation of Liability', description: 'Liability caps and exclusions', required: true },
      { title: 'General Provisions', description: 'Governing law, modifications, notices', required: true },
    ],
    requiredClauses: ['SLA uptime guarantee', 'Data processing terms', 'Service credits', 'Termination and data export'],
    commonVariables: [
      { name: 'Provider Name', type: 'party' },
      { name: 'Subscriber Name', type: 'party' },
      { name: 'Subscription Tier', type: 'text' },
      { name: 'Monthly Fee', type: 'currency' },
      { name: 'Uptime SLA', type: 'text' },
      { name: 'Billing Start Date', type: 'date' },
    ],
  },
  SOW: {
    name: 'Statement of Work',
    sections: [
      { title: 'Project Overview', description: 'Background, objectives, and scope', required: true },
      { title: 'Deliverables', description: 'Specific deliverables with acceptance criteria', required: true },
      { title: 'Timeline and Milestones', description: 'Project schedule with key milestones', required: true },
      { title: 'Resources and Responsibilities', description: 'Team allocation and role responsibilities', required: true },
      { title: 'Pricing and Payment Schedule', description: 'Fees tied to milestones or time-and-materials', required: true },
      { title: 'Change Management', description: 'Process for scope changes and approvals', required: true },
      { title: 'Acceptance Testing', description: 'Criteria and process for deliverable acceptance', required: true },
      { title: 'Assumptions and Dependencies', description: 'Key assumptions and external dependencies', required: false },
    ],
    requiredClauses: ['Deliverable descriptions', 'Acceptance criteria', 'Payment milestones', 'Change control process'],
    commonVariables: [
      { name: 'Project Name', type: 'text' },
      { name: 'Client Name', type: 'party' },
      { name: 'Start Date', type: 'date' },
      { name: 'End Date', type: 'date' },
      { name: 'Total Budget', type: 'currency' },
    ],
  },
  LICENSE: {
    name: 'Software License Agreement',
    sections: [
      { title: 'Grant of License', description: 'Scope and type of license granted', required: true },
      { title: 'Restrictions', description: 'Prohibited uses and limitations', required: true },
      { title: 'Fees and Royalties', description: 'License fees, payment schedule', required: true },
      { title: 'Intellectual Property', description: 'Ownership and IP reservations', required: true },
      { title: 'Support and Maintenance', description: 'Support obligations and updates', required: false },
      { title: 'Warranties and Disclaimers', description: 'Product warranties and limitations', required: true },
      { title: 'Term and Termination', description: 'License duration and termination rights', required: true },
      { title: 'General Provisions', description: 'Governing law, limitation of liability', required: true },
    ],
    requiredClauses: ['License grant scope', 'Usage restrictions', 'IP ownership', 'Warranty disclaimer'],
    commonVariables: [
      { name: 'Licensor', type: 'party' },
      { name: 'Licensee', type: 'party' },
      { name: 'License Type', type: 'text' },
      { name: 'License Fee', type: 'currency' },
      { name: 'License Start Date', type: 'date' },
    ],
  },
};

// Lightweight family stubs for less common types
const STUB_FAMILIES: Record<string, string> = {
  AMENDMENT: 'Contract Amendment',
  ADDENDUM: 'Contract Addendum',
  PO: 'Purchase Order',
  EMPLOYMENT: 'Employment Agreement',
  LEASE: 'Lease Agreement',
  CONSULTING: 'Consulting Agreement',
  PARTNERSHIP: 'Partnership Agreement',
  DISTRIBUTION: 'Distribution Agreement',
  FRANCHISE: 'Franchise Agreement',
  AGENCY: 'Agency Agreement',
  SUPPLY: 'Supply Agreement',
  CONSTRUCTION: 'Construction Contract',
  MAINTENANCE: 'Maintenance Agreement',
  RESELLER: 'Reseller Agreement',
  JOINT_VENTURE: 'Joint Venture Agreement',
  SETTLEMENT: 'Settlement Agreement',
};

// --------------------------------------------------------------------------
// Industry compliance mapping
// --------------------------------------------------------------------------

const INDUSTRY_CLAUSES: Record<string, TemplateSuggestion[]> = {
  healthcare: [
    { clause: 'HIPAA Business Associate Agreement', reason: 'Required when handling PHI under HIPAA', priority: 'required', industry: 'healthcare' },
    { clause: 'Data breach notification (72-hour)', reason: 'HIPAA breach notification requirements', priority: 'required', industry: 'healthcare' },
  ],
  finance: [
    { clause: 'SOX compliance attestation', reason: 'Sarbanes-Oxley financial reporting requirements', priority: 'required', industry: 'finance' },
    { clause: 'Anti-money laundering provisions', reason: 'AML/KYC regulatory obligations', priority: 'recommended', industry: 'finance' },
  ],
  government: [
    { clause: 'FAR/DFARS flow-down clauses', reason: 'Federal Acquisition Regulation compliance', priority: 'required', industry: 'government' },
    { clause: 'FOIA and records retention', reason: 'Freedom of Information Act requirements', priority: 'recommended', industry: 'government' },
  ],
  technology: [
    { clause: 'Open-source license compliance', reason: 'Manage open-source licensing obligations', priority: 'recommended', industry: 'technology' },
    { clause: 'Data portability and export', reason: 'Ensure data portability at contract end', priority: 'recommended', industry: 'technology' },
  ],
  general: [
    { clause: 'GDPR data processing addendum', reason: 'Required when processing EU personal data', priority: 'recommended', industry: 'general' },
    { clause: 'Force majeure clause', reason: 'Protect against unforeseeable events', priority: 'recommended', industry: 'general' },
  ],
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function detectContractType(ctx: Record<string, any>): string {
  const type = (ctx.contractType || ctx.type || '').toUpperCase().trim();
  if (type && (TEMPLATE_FAMILIES[type] || STUB_FAMILIES[type])) return type;

  // Heuristic detection from text
  const text = ((ctx.rawText || ctx.contractText || '') as string).toLowerCase();
  if (/non-?\s*disclosure|nda|confidential\s+information/i.test(text)) return 'NDA';
  if (/master\s+service|msa/i.test(text)) return 'MSA';
  if (/software\s+as\s+a\s+service|saas|subscription/i.test(text)) return 'SAAS';
  if (/statement\s+of\s+work|sow|deliverable/i.test(text)) return 'SOW';
  if (/license\s+agreement|licens(?:e|or)/i.test(text)) return 'LICENSE';
  if (/purchase\s+order|p\.?o\.?\s/i.test(text)) return 'PO';
  if (/amendment/i.test(text)) return 'AMENDMENT';
  if (/lease|tenant|landlord/i.test(text)) return 'LEASE';
  if (/consulting/i.test(text)) return 'CONSULTING';
  return type || 'OTHER';
}

function detectIndustry(ctx: Record<string, any>): string {
  const industry = (ctx.industry || ctx.department || '').toLowerCase();
  if (industry) {
    for (const key of Object.keys(INDUSTRY_CLAUSES)) {
      if (industry.includes(key)) return key;
    }
  }
  const text = ((ctx.rawText || '') as string).toLowerCase();
  if (/hipaa|phi|protected\s+health/i.test(text)) return 'healthcare';
  if (/sox|sarbanes|aml|kyc/i.test(text)) return 'finance';
  if (/far\s+|dfars|federal\s+acqui/i.test(text)) return 'government';
  return 'general';
}

// --------------------------------------------------------------------------
// Agent implementation
// --------------------------------------------------------------------------

export class TemplateGenerationAgent extends BaseAgent {
  name = 'template-generation-agent';
  version = '1.0.0';
  capabilities = ['template-generation', 'learning'] as string[];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const ctx = { ...input.context, ...(input.context?.contract || {}) };
    const contractType = detectContractType(ctx);
    const industry = detectIndustry(ctx);

    logger.info({ contractId: input.contractId, contractType, industry }, 'Generating template structure');

    const family = TEMPLATE_FAMILIES[contractType];
    const familyName = family?.name || STUB_FAMILIES[contractType] || 'General Contract';

    // --- Build sections ---
    const sections: TemplateSection[] = family
      ? family.sections.map((s, idx) => ({
          id: `section-${idx + 1}`,
          title: s.title,
          description: s.description,
          required: s.required,
          order: idx + 1,
          suggestedContent: `[${s.title} content — ${s.description}]`,
          variables: [],
        }))
      : this.buildGenericSections();

    // --- Build variables ---
    const variables: TemplateVariable[] = family
      ? family.commonVariables.map(v => ({
          name: v.name,
          placeholder: `{{${v.name.replace(/\s+/g, '_').toLowerCase()}}}`,
          type: v.type,
          required: true,
          description: `${v.name} for this ${familyName}`,
        }))
      : this.buildGenericVariables();

    // Assign variables to matching sections
    for (const v of variables) {
      const matchingSection = sections.find(s =>
        s.title.toLowerCase().includes(v.name.toLowerCase().split(' ')[0] || '') ||
        s.title.toLowerCase().includes('parties')
      );
      if (matchingSection) matchingSection.variables.push(v);
    }

    // --- Suggested clauses ---
    const suggestedClauses: TemplateSuggestion[] = [];

    // Required clauses from family
    if (family) {
      for (const clause of family.requiredClauses) {
        suggestedClauses.push({ clause, reason: `Standard requirement for ${familyName}`, priority: 'required' });
      }
    }

    // Industry-specific clauses
    const industryClauses = INDUSTRY_CLAUSES[industry] || INDUSTRY_CLAUSES['general'] || [];
    suggestedClauses.push(...industryClauses);

    // Universal recommended clauses not already covered
    const universalClauses = [
      { clause: 'Dispute resolution mechanism', reason: 'Provides structured process for resolving disagreements', priority: 'recommended' as const },
      { clause: 'Assignment and delegation', reason: 'Controls whether obligations can be transferred to third parties', priority: 'recommended' as const },
      { clause: 'Notices provision', reason: 'Establishes communication requirements for formal notices', priority: 'recommended' as const },
    ];
    for (const uc of universalClauses) {
      if (!suggestedClauses.some(sc => sc.clause.toLowerCase().includes(uc.clause.split(' ')[0]!.toLowerCase()))) {
        suggestedClauses.push(uc);
      }
    }

    // --- Compliance notes ---
    const complianceNotes: string[] = [];
    if (industry === 'healthcare') complianceNotes.push('Ensure HIPAA Business Associate Agreement is executed before data exchange.');
    if (industry === 'finance') complianceNotes.push('SOX compliance requires segregation of duties in approval workflows.');
    if (industry === 'government') complianceNotes.push('Review applicable FAR/DFARS clauses for flow-down requirements.');
    complianceNotes.push('Verify data processing addendum aligns with applicable privacy regulations (GDPR, CCPA).');
    if (contractType === 'SAAS') complianceNotes.push('SLA uptime guarantee should specify measurement methodology and service credit calculation.');

    const structure: TemplateStructure = {
      templateType: contractType,
      templateFamily: familyName,
      sections,
      variables,
      suggestedClauses,
      complianceNotes,
      generatedAt: new Date().toISOString(),
    };

    // --- Recommendations for gaps ---
    const recommendations: AgentRecommendation[] = [];
    const missingRequired = suggestedClauses.filter(c => c.priority === 'required');
    if (missingRequired.length > 0) {
      recommendations.push({
        id: `tmpl-rec-required-${Date.now()}`,
        title: 'Required clauses for this contract type',
        description: `${missingRequired.length} clause(s) are standard for ${familyName}: ${missingRequired.map(c => c.clause).join(', ')}.`,
        category: 'compliance' as const,
        priority: 'high' as const,
        confidence: 0.9,
        effort: 'medium' as const,
        timeframe: 'During drafting',
        actions: [],
        reasoning: 'Include all required clauses to reduce legal risk and ensure enforceability.',
      });
    }

    if (complianceNotes.length > 0) {
      recommendations.push({
        id: `tmpl-rec-compliance-${Date.now()}`,
        title: 'Regulatory compliance considerations',
        description: complianceNotes.join(' '),
        category: 'compliance' as const,
        priority: 'medium' as const,
        confidence: 0.85,
        effort: 'low' as const,
        timeframe: 'Before execution',
        actions: [],
        reasoning: `Industry (${industry}) and contract type (${contractType}) require specific regulatory compliance.`,
      });
    }

    const confidence = this.calculateConfidence({
      dataQuality: family ? 0.95 : 0.6,
      modelConfidence: 0.85,
      validationPassed: true,
    });

    return {
      success: true,
      data: structure,
      recommendations,
      confidence,
      reasoning: this.formatReasoning([
        `Contract type: ${contractType} (${familyName})`,
        `Industry: ${industry}`,
        `Generated ${sections.length} sections with ${variables.length} variables`,
        `${suggestedClauses.length} clause suggestions (${missingRequired.length} required)`,
        `${complianceNotes.length} compliance note(s)`,
      ]),
      metadata: { contractType, industry, sectionCount: sections.length },
    };
  }

  private buildGenericSections(): TemplateSection[] {
    return [
      { id: 'section-1', title: 'Parties', description: 'Identification of contracting parties', required: true, order: 1, suggestedContent: '[Party identification]', variables: [] },
      { id: 'section-2', title: 'Recitals', description: 'Background and purpose of the agreement', required: false, order: 2, suggestedContent: '[Agreement background]', variables: [] },
      { id: 'section-3', title: 'Terms and Conditions', description: 'Core terms of the agreement', required: true, order: 3, suggestedContent: '[Core terms]', variables: [] },
      { id: 'section-4', title: 'Obligations', description: 'Party obligations and responsibilities', required: true, order: 4, suggestedContent: '[Obligations]', variables: [] },
      { id: 'section-5', title: 'Term and Termination', description: 'Duration and termination provisions', required: true, order: 5, suggestedContent: '[Term and termination]', variables: [] },
      { id: 'section-6', title: 'General Provisions', description: 'Governing law, notices, amendments', required: true, order: 6, suggestedContent: '[General provisions]', variables: [] },
    ];
  }

  private buildGenericVariables(): TemplateVariable[] {
    return [
      { name: 'Party A', placeholder: '{{party_a}}', type: 'party', required: true, description: 'First contracting party' },
      { name: 'Party B', placeholder: '{{party_b}}', type: 'party', required: true, description: 'Second contracting party' },
      { name: 'Effective Date', placeholder: '{{effective_date}}', type: 'date', required: true, description: 'Date agreement takes effect' },
      { name: 'Term Length', placeholder: '{{term_length}}', type: 'text', required: true, description: 'Duration of the agreement' },
    ];
  }

  protected getEventType(): 'template_generated' {
    return 'template_generated';
  }
}

export const templateGenerationAgent = new TemplateGenerationAgent();
