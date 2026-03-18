/**
 * Unified Artifact Prompt Library
 * 
 * Single source of truth for all artifact type prompts, data shape interfaces,
 * anti-hallucination system prompt, and artifact configuration.
 * Used by both ocr-artifact-worker.ts and artifact-generator.ts.
 * 
 * Fixes P1 #1 (duplicated logic) and P1 #4 (inconsistent data shapes).
 */

import pino from 'pino';

const logger = pino({ name: 'artifact-prompts' });

// ─── Artifact Type Configuration ────────────────────────────────────────────

export type ArtifactCategory = 'core' | 'analysis' | 'advanced';

export interface ArtifactTypeConfig {
  type: string;
  enabled: boolean;
  priority: number;
  weight: number;
  qualityThreshold: number;
  maxRetries: number;
  label: string;
  category: ArtifactCategory;
  /** Max text length to send for this type (adaptive truncation) */
  maxTextLength: number;
}

export const DEFAULT_ARTIFACT_TYPES: ArtifactTypeConfig[] = [
  { type: 'OVERVIEW',            enabled: true,  priority: 1,  weight: 10, qualityThreshold: 0.70, maxRetries: 3, label: 'Overview',           category: 'core',     maxTextLength: 50000 },
  { type: 'CLAUSES',             enabled: true,  priority: 2,  weight: 12, qualityThreshold: 0.70, maxRetries: 3, label: 'Clauses',            category: 'core',     maxTextLength: 60000 },
  { type: 'FINANCIAL',           enabled: true,  priority: 3,  weight: 12, qualityThreshold: 0.75, maxRetries: 3, label: 'Financial',          category: 'core',     maxTextLength: 60000 },
  { type: 'RISK',                enabled: true,  priority: 4,  weight: 12, qualityThreshold: 0.70, maxRetries: 3, label: 'Risk',               category: 'analysis', maxTextLength: 50000 },
  { type: 'COMPLIANCE',          enabled: true,  priority: 5,  weight: 12, qualityThreshold: 0.70, maxRetries: 3, label: 'Compliance',         category: 'analysis', maxTextLength: 50000 },
  { type: 'OBLIGATIONS',         enabled: true,  priority: 6,  weight: 10, qualityThreshold: 0.70, maxRetries: 3, label: 'Obligations',        category: 'analysis', maxTextLength: 55000 },
  { type: 'RENEWAL',             enabled: true,  priority: 7,  weight: 10, qualityThreshold: 0.70, maxRetries: 3, label: 'Renewal',            category: 'analysis', maxTextLength: 45000 },
  { type: 'NEGOTIATION_POINTS',  enabled: true,  priority: 8,  weight: 8,  qualityThreshold: 0.65, maxRetries: 2, label: 'Negotiation',        category: 'advanced', maxTextLength: 50000 },
  { type: 'AMENDMENTS',          enabled: true,  priority: 9,  weight: 8,  qualityThreshold: 0.65, maxRetries: 2, label: 'Amendments',         category: 'advanced', maxTextLength: 50000 },
  { type: 'CONTACTS',            enabled: true,  priority: 10, weight: 7,  qualityThreshold: 0.65, maxRetries: 2, label: 'Contacts',           category: 'advanced', maxTextLength: 35000 },
  { type: 'PARTIES',             enabled: true,  priority: 11, weight: 8,  qualityThreshold: 0.70, maxRetries: 3, label: 'Parties',            category: 'core',     maxTextLength: 40000 },
  { type: 'TIMELINE',            enabled: true,  priority: 12, weight: 7,  qualityThreshold: 0.65, maxRetries: 2, label: 'Timeline',           category: 'advanced', maxTextLength: 50000 },
  { type: 'DELIVERABLES',        enabled: true,  priority: 13, weight: 8,  qualityThreshold: 0.65, maxRetries: 2, label: 'Deliverables',       category: 'advanced', maxTextLength: 55000 },
  { type: 'EXECUTIVE_SUMMARY',   enabled: true,  priority: 14, weight: 10, qualityThreshold: 0.70, maxRetries: 3, label: 'Executive Summary',  category: 'core',     maxTextLength: 55000 },
  { type: 'RATES',               enabled: true,  priority: 15, weight: 9,  qualityThreshold: 0.70, maxRetries: 3, label: 'Rates',              category: 'core',     maxTextLength: 60000 },
];

// ─── Standardized Output Interfaces ─────────────────────────────────────────
// These define the canonical shape that BOTH workers must produce.

export interface SourcedValue<T = string> {
  value: T;
  source: string;
  extractedFromText: boolean;
  requiresHumanReview?: boolean;
  isPlaceholder?: boolean;
}

export interface ArtifactMeta {
  generatedAt: string;
  aiGenerated: boolean;
  model: string;
  antiHallucinationEnabled: boolean;
  promptVersion: string;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCost?: number;
  fallback?: boolean;
  reason?: string;
}

export interface BaseArtifactData {
  certainty: number;
  additionalFindings?: string[];
  openEndedNotes?: string;
  _meta?: ArtifactMeta;
}

export interface OverviewArtifact extends BaseArtifactData {
  summary: string | null;
  contractType: string | null;
  contractSubtype?: string | null;
  parties: Array<{
    name: string;
    role: string;
    type?: string;
    isPlaceholder?: boolean;
  }>;
  effectiveDate: string | null;
  expirationDate: string | null;
  totalValue: string | null;
  jurisdiction: string | null;
  keyTerms: string[];
  language?: string | null;
}

export interface ClausesArtifact extends BaseArtifactData {
  clauses: Array<{
    title: string;
    content: string;
    source: string;
    importance: 'high' | 'medium' | 'low';
    category: string;
    extractedFromText: boolean;
  }>;
  missingClauses: string[];
}

export interface FinancialArtifact extends BaseArtifactData {
  totalValue: { value: number; source: string; extractedFromText: boolean } | null;
  currency: { value: string; source: string; extractedFromText: boolean } | null;
  paymentTerms: { value: string; source: string; extractedFromText: boolean } | null;
  paymentSchedule: Array<{ milestone: string; amount: number; source: string }>;
  costBreakdown: Array<{ category: string; amount: number; source: string }>;
  analysis: string;
}

export interface RiskArtifact extends BaseArtifactData {
  overallRisk: 'Low' | 'Medium' | 'High';
  riskScore: number;
  risks: Array<{
    category: string;
    level: 'Low' | 'Medium' | 'High';
    title: string;
    description: string;
    source: string;
    extractedFromText: boolean;
    mitigation: string;
  }>;
  redFlags: Array<{ flag: string; source: string; extractedFromText: boolean }>;
  missingProtections: string[];
  recommendations: string[];
}

export interface ComplianceArtifact extends BaseArtifactData {
  compliant: boolean | null;
  complianceScore: number;
  regulations: Array<{ name: string; source: string; extractedFromText: boolean }>;
  checks: Array<{
    regulation: string;
    status: 'compliant' | 'non-compliant' | 'needs-review';
    details: string;
    source: string;
  }>;
  issues: Array<{
    severity: 'high' | 'medium' | 'low';
    description: string;
    source: string;
    recommendation: string;
  }>;
  recommendations: string[];
  notFoundCompliance: string[];
}

export interface ObligationsArtifact extends BaseArtifactData {
  obligations: Array<{
    id: string;
    title: string;
    party: string;
    type: string;
    description: string;
    dueDate: string | null;
    recurring: { frequency: string; interval: number } | null;
    slaCriteria: { metric: string; target: string; unit: string } | null;
    penalty: string | null;
    sourceClause: string;
    extractedFromText: boolean;
    confidence: number;
  }>;
  milestones: Array<{ id: string; name: string; date: string; deliverables: string[]; source: string }>;
  slaMetrics: Array<{ metric: string; target: string; penalty: string; source: string }>;
  reportingRequirements: Array<{ type: string; frequency: string; recipient: string; source: string }>;
  summary: string | null;
}

export interface RenewalArtifact extends BaseArtifactData {
  autoRenewal: boolean | null;
  renewalTerms: {
    renewalPeriod: string | null;
    noticePeriodDays: number | null;
    optOutDeadline: string | null;
    source: string;
  } | null;
  terminationNotice: {
    requiredDays: number;
    format: string | null;
    recipientParty: string | null;
    source: string;
  } | null;
  priceEscalation: Array<{
    type: string;
    percentage: number;
    index: string | null;
    cap: number | null;
    effectiveDate: string;
    source: string;
  }>;
  optOutDeadlines: Array<{ date: string; description: string; source: string }>;
  renewalAlerts: Array<{ type: 'warning' | 'critical' | 'info'; message: string; dueDate: string }>;
  currentTermEnd: string | null;
  renewalCount: number | null;
  summary: string | null;
}

export interface NegotiationPointsArtifact extends BaseArtifactData {
  leveragePoints: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    strength: 'strong' | 'moderate' | 'weak';
    suggestedAction: string;
    sourceClause: string;
    extractedFromText: boolean;
  }>;
  weakClauses: Array<{
    id: string;
    clauseReference: string;
    issue: string;
    impact: 'high' | 'medium' | 'low';
    suggestedRevision: string;
    benchmarkComparison: string;
    extractedFromText: boolean;
  }>;
  benchmarkGaps: Array<{
    area: string;
    currentTerm: string;
    marketStandard: string;
    gap: string;
    recommendation: string;
  }>;
  negotiationScript: Array<{
    topic: string;
    openingPosition: string;
    fallbackPosition: string;
    walkAwayPoint: string;
    supportingEvidence: string[];
  }>;
  overallLeverage: 'strong' | 'balanced' | 'weak' | null;
  summary: string | null;
}

export interface AmendmentsArtifact extends BaseArtifactData {
  amendments: Array<{
    id: string;
    amendmentNumber: number;
    effectiveDate: string;
    title: string;
    description: string;
    changedClauses: Array<{
      clauseId: string;
      originalText: string | null;
      newText: string;
      changeType: 'added' | 'modified' | 'deleted';
    }>;
    signedBy: string[];
    sourceDocument: string;
    extractedFromText: boolean;
  }>;
  supersededClauses: Array<{ originalClause: string; supersededBy: string; effectiveDate: string }>;
  changeLog: Array<{ date: string; type: string; description: string; reference: string }>;
  consolidatedTerms: {
    lastUpdated: string;
    version: string;
    effectiveTerms: string[];
  } | null;
  summary: string | null;
}

export interface ContactsArtifact extends BaseArtifactData {
  primaryContacts: Array<{
    id: string;
    name: string;
    role: string;
    party: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    isPrimary: boolean;
    extractedFromText: boolean;
  }>;
  escalationPath: Array<{
    level: number;
    role: string;
    name: string | null;
    contactInfo: string;
    escalationTrigger: string;
  }>;
  notificationAddresses: Array<{
    purpose: string;
    party: string;
    address: string;
    format: string;
  }>;
  keyPersonnel: Array<{
    name: string;
    role: string;
    responsibilities: string[];
    party: string;
  }>;
  summary: string | null;
}

export interface PartiesArtifact extends BaseArtifactData {
  parties: Array<{
    name: string;
    role: string;
    type: string;
    address?: string;
    jurisdiction?: string;
    signatoryName?: string;
    signatoryTitle?: string;
  }>;
  relationships: Array<{ partyA: string; partyB: string; relationship: string }>;
  thirdParties: Array<{ name: string; role: string }>;
}

export interface TimelineArtifact extends BaseArtifactData {
  contractTimeline: {
    executionDate: string | null;
    effectiveDate: string | null;
    expirationDate: string | null;
    totalDuration: string | null;
  };
  milestones: Array<{
    name: string;
    date: string;
    type: string;
    owner: string;
    consequences: string;
  }>;
  deadlines: Array<{
    description: string;
    date: string;
    type: string;
    consequences: string;
  }>;
  paymentSchedule: Array<{
    description: string;
    amount: string;
    dueDate: string;
    frequency: string;
  }>;
  noticePeriods: Array<{ type: string; period: string; method: string }>;
  criticalPath: string[];
}

export interface DeliverablesArtifact extends BaseArtifactData {
  deliverables: Array<{
    name: string;
    description: string;
    type: string;
    owner: string;
    recipient: string;
    dueDate?: string;
    acceptanceCriteria: string[];
    priority: 'critical' | 'high' | 'medium' | 'low';
  }>;
  servicelevels: Array<{
    metric: string;
    target: string;
    measurement: string;
    penalty: string;
  }>;
  acceptanceProcess: {
    reviewPeriod: string;
    approvalAuthority: string;
    rejectionProcess: string;
  } | null;
  workBreakdown: string[];
  exclusions: string[];
}

export interface ExecutiveSummaryArtifact extends BaseArtifactData {
  headline: string | null;
  strategicSummary: string | null;
  keyMetrics: {
    totalContractValue?: string;
    contractDuration?: string;
    keyDeadlines?: string[];
    numberOfParties?: number;
    numberOfDeliverables?: number;
  };
  businessImpact: {
    revenueImpact?: string;
    operationalImpact?: string;
    resourceRequirements?: string;
  };
  riskProfile: {
    overallRisk: string;
    topRisks: Array<{ risk: string; severity: string; mitigation: string }>;
    missingProtections: string[];
  };
  recommendedActions: Array<{
    action: string;
    priority: 'immediate' | 'short-term' | 'long-term';
    rationale: string;
  }>;
}

export interface RatesArtifact extends BaseArtifactData {
  rates: Array<{
    role: string;
    hourlyRate: number | null;
    dailyRate: number | null;
    currency: string;
    source: string;
    extractedFromText: boolean;
  }>;
  rateCards: Array<{
    name: string;
    effectiveDate: string | null;
    expirationDate: string | null;
    rates: Array<{ category: string; rate: number; unit: string }>;
    source: string;
  }>;
  pricingModel: string | null;
  discountStructure: Array<{
    type: string;
    percentage: number;
    condition: string;
    source: string;
  }>;
  escalationTerms: Array<{
    type: string;
    cap: number | null;
    frequency: string;
    source: string;
  }>;
  summary: string | null;
}

export type ArtifactDataMap = {
  OVERVIEW: OverviewArtifact;
  CLAUSES: ClausesArtifact;
  FINANCIAL: FinancialArtifact;
  RISK: RiskArtifact;
  COMPLIANCE: ComplianceArtifact;
  OBLIGATIONS: ObligationsArtifact;
  RENEWAL: RenewalArtifact;
  NEGOTIATION_POINTS: NegotiationPointsArtifact;
  AMENDMENTS: AmendmentsArtifact;
  CONTACTS: ContactsArtifact;
  PARTIES: PartiesArtifact;
  TIMELINE: TimelineArtifact;
  DELIVERABLES: DeliverablesArtifact;
  EXECUTIVE_SUMMARY: ExecutiveSummaryArtifact;
  RATES: RatesArtifact;
};

// ─── Anti-Hallucination System Prompt ───────────────────────────────────────
// Unified system prompt used by BOTH workers.

export function getSystemPrompt(): string {
  return `You are a contract analysis AI. Extract information ONLY from the provided contract text.

ANTI-HALLUCINATION RULES (CRITICAL):
1. ONLY extract information explicitly stated in the contract text
2. NEVER guess, infer, or assume information not present
3. Use null for any field where data is not found in the contract
4. Provide honest confidence/certainty scores (0.0-1.0)
5. Extract party names EXACTLY as written - never invent names
6. Quote or closely paraphrase actual contract language for sources
7. Do NOT calculate dates, totals, or values not explicitly stated
8. For every extracted value, include a "source" field citing the contract text
9. Set "extractedFromText": true only for directly quoted/paraphrased data
10. Use "requiresHumanReview": true for any inferred or uncertain values

OUTPUT QUALITY RULES:
1. Scan the ENTIRE contract text before responding
2. Prefer completeness over speed - extract all relevant data
3. Provide substantive summaries, not one-line placeholders
4. Use precise legal/business language
5. Include "additionalFindings" for anything that doesn't fit the schema
6. Include "openEndedNotes" for contextual observations`;
}

// ─── Per-Type Prompt Builder ────────────────────────────────────────────────

export interface PromptContext {
  contractText: string;
  contractType?: string;
  contractTypeHints?: string;
  /** e.g. "Service Agreement", "Master Services Agreement" */
  contractTypeDisplayName?: string;
  /** Extraction hints from contract profile */
  extractionHints?: string;
  /** Expected sections for the contract type */
  expectedSections?: string[];
  /** Clause categories to prioritize */
  clauseCategories?: string[];
  /** Financial extraction hints */
  financialFieldsHint?: string;
  /** Risk category hints */
  riskCategoriesHint?: string;

  // ── Azure Document Intelligence structured data (when DI is the OCR source) ──

  /** Pre-extracted tables from DI (with headers, rows, confidence) */
  diTables?: Array<{
    pageNumber: number;
    headers: string[];
    rows: string[][];
    confidence: number;
  }>;
  /** Key-value pairs extracted by DI */
  diKeyValuePairs?: Array<{ key: string; value: string; confidence: number }>;
  /** Pre-extracted contract fields from DI prebuilt-contract model */
  diContractFields?: {
    parties: Array<{ name: string; role?: string; address?: string; confidence: number }>;
    dates: { effectiveDate?: string; expirationDate?: string; executionDate?: string; renewalDate?: string };
    jurisdiction?: string;
    title?: string;
    confidence: number;
  };
  /** Pre-extracted invoice fields from DI prebuilt-invoice model */
  diInvoiceFields?: {
    vendorName?: string;
    customerName?: string;
    invoiceId?: string;
    invoiceDate?: string;
    invoiceTotal?: number;
    currency?: string;
    lineItems: Array<{ description?: string; quantity?: number; unitPrice?: number; amount?: number }>;
    confidence: number;
  };
  /** Aggregate DI OCR confidence (0-1, from word-level) */
  diConfidence?: number;
  /** Handwriting/signature info from DI styles analysis */
  diHandwritingInfo?: {
    hasHandwriting: boolean;
    handwrittenSpans: string[];
    handwrittenSpanCount: number;
  };
  /** Detected document languages from DI (BCP-47 locale codes) */
  diDetectedLanguages?: string[];
  /** Document structure from DI paragraph roles (title, sectionHeading, etc.) */
  diDocumentStructure?: Array<{ content: string; role: string }>;
  /** Selection marks (checkboxes) detected by DI */
  diSelectionMarks?: Array<{ state: 'selected' | 'unselected'; confidence: number; page: number }>;
  /** Barcodes detected by DI */
  diBarcodes?: Array<{ kind: string; value: string; confidence: number }>;
  /** Formulas detected by DI (LaTeX) */
  diFormulas?: Array<{ kind: string; value: string; confidence: number }>;
}

/**
 * Get the adaptive text limit for an artifact type.
 * P3 #18: Different types need different text amounts.
 */
export function getTextLimitForType(type: string): number {
  const config = DEFAULT_ARTIFACT_TYPES.find(t => t.type === type);
  return config?.maxTextLength || 50000;
}

/**
 * Truncate contract text to the appropriate limit for the artifact type.
 */
export function truncateTextForType(text: string, type: string): string {
  const limit = getTextLimitForType(type);
  if (text.length <= limit) return text;

  // For CONTACTS and PARTIES, signature blocks are at the END of documents.
  // Use head+tail strategy to preserve both start (party definitions) and end (signatures).
  const TAIL_TYPES = ['CONTACTS', 'PARTIES'];
  if (TAIL_TYPES.includes(type)) {
    const tailSize = Math.min(8000, Math.floor(limit * 0.25)); // Reserve 25% (up to 8K) for the tail
    const headSize = limit - tailSize - 100; // 100 chars for separator
    const head = text.substring(0, headSize);
    const tail = text.substring(text.length - tailSize);
    return head + '\n\n[... middle section truncated — signature blocks preserved below ...]\n\n' + tail;
  }

  return text.substring(0, limit) + '\n\n[... text truncated for processing ...]';
}

/**
 * Build the user prompt for a specific artifact type.
 * This is the single source of truth for all prompt definitions.
 */
export function buildArtifactPrompt(type: string, ctx: PromptContext): string | null {
  const truncatedText = truncateTextForType(ctx.contractText, type);
  const typeContext = ctx.contractTypeHints
    ? `\nCONTRACT TYPE DETECTED: ${ctx.contractTypeDisplayName || ctx.contractType}\n${ctx.contractTypeHints}\n${ctx.expectedSections ? `EXPECTED SECTIONS: ${ctx.expectedSections.join(', ')}\n` : ''}`
    : '';

  // Build DI pre-validated data context — inject structured data into prompts
  // Gate on minimum confidence threshold to avoid injecting noisy extractions
  const DI_MIN_CONFIDENCE = 0.5;
  let diContext = '';
  if (ctx.diConfidence && ctx.diConfidence >= DI_MIN_CONFIDENCE) {
    const diParts: string[] = ['\n--- PRE-VALIDATED DATA (Azure Document Intelligence, high confidence) ---'];
    
    // Contract fields — useful across nearly all artifact types
    if (ctx.diContractFields && ['OVERVIEW', 'CLAUSES', 'RISK', 'COMPLIANCE', 'OBLIGATIONS', 'RENEWAL', 'PARTIES', 'CONTACTS', 'DELIVERABLES', 'TIMELINE', 'FINANCIAL'].includes(type)) {
      const cf = ctx.diContractFields;
      if (cf.parties.length > 0) {
        const trustedParties = cf.parties.filter(p => p.confidence >= 0.5);
        if (trustedParties.length > 0) {
          diParts.push('\nPRE-VALIDATED CONTRACT PARTIES:');
          for (const p of trustedParties) {
            diParts.push(`  - ${p.name}${p.role ? ` (${p.role})` : ''}${p.address ? `, ${p.address}` : ''} [confidence: ${(p.confidence * 100).toFixed(0)}%]`);
          }
        }
      }
      if (cf.dates.effectiveDate) diParts.push(`PRE-VALIDATED Effective Date: ${cf.dates.effectiveDate}`);
      if (cf.dates.expirationDate) diParts.push(`PRE-VALIDATED Expiration Date: ${cf.dates.expirationDate}`);
      if (cf.dates.executionDate) diParts.push(`PRE-VALIDATED Execution Date: ${cf.dates.executionDate}`);
      if (cf.jurisdiction) diParts.push(`PRE-VALIDATED Jurisdiction: ${cf.jurisdiction}`);
      if (cf.title) diParts.push(`PRE-VALIDATED Document Title: ${cf.title}`);
    }

    // Invoice fields for FINANCIAL, OVERVIEW
    if (ctx.diInvoiceFields && ['FINANCIAL', 'OVERVIEW', 'RATES'].includes(type)) {
      const inv = ctx.diInvoiceFields;
      diParts.push('\nPRE-VALIDATED INVOICE DATA:');
      if (inv.vendorName) diParts.push(`  Vendor: ${inv.vendorName}`);
      if (inv.customerName) diParts.push(`  Customer: ${inv.customerName}`);
      if (inv.invoiceId) diParts.push(`  Invoice #: ${inv.invoiceId}`);
      if (inv.invoiceDate) diParts.push(`  Date: ${inv.invoiceDate}`);
      if (inv.invoiceTotal != null) diParts.push(`  Total: ${inv.currency || ''} ${inv.invoiceTotal}`);
      if (inv.lineItems.length > 0) {
        diParts.push('  Line Items:');
        for (const li of inv.lineItems) {
          diParts.push(`    - ${li.description || 'N/A'}: qty ${li.quantity ?? '-'} × ${li.unitPrice ?? '-'} = ${li.amount ?? '-'}`);
        }
      }
    }

    // Tables — valuable for financial, compliance (SLA/insurance tables), clauses (amendment schedules), deliverables (milestones)
    if (ctx.diTables && ctx.diTables.length > 0 && ['FINANCIAL', 'RATES', 'OVERVIEW', 'OBLIGATIONS', 'CLAUSES', 'COMPLIANCE', 'DELIVERABLES', 'TIMELINE'].includes(type)) {
      const trustedTables = ctx.diTables.filter(t => t.confidence >= 0.5);
      if (trustedTables.length > 0) {
        diParts.push(`\nPRE-VALIDATED TABLES (${trustedTables.length} found):`);
        for (let i = 0; i < Math.min(trustedTables.length, 10); i++) {
          const t = trustedTables[i];
          if (t && t.headers.length > 0) {
            diParts.push(`  Table ${i + 1} (page ${t.pageNumber}, confidence ${(t.confidence * 100).toFixed(0)}%):`);
            diParts.push(`    | ${t.headers.join(' | ')} |`);
            for (const row of t.rows.slice(0, 20)) {
              diParts.push(`    | ${row.join(' | ')} |`);
            }
          }
        }
      }
    }

    // Key-value pairs for all types — filter out low-confidence pairs
    if (ctx.diKeyValuePairs && ctx.diKeyValuePairs.length > 0) {
      const trustedKV = ctx.diKeyValuePairs.filter(kv => kv.confidence >= 0.5);
      if (trustedKV.length > 0) {
        diParts.push(`\nPRE-VALIDATED KEY-VALUE PAIRS (${trustedKV.length} found):`);
        for (const kv of trustedKV.slice(0, 30)) {
          diParts.push(`  ${kv.key}: ${kv.value} [confidence: ${(kv.confidence * 100).toFixed(0)}%]`);
        }
      }
    }

    // Document structure from DI paragraphs — helps identify sections, titles, headings
    const structureTypes = ['OVERVIEW', 'CLAUSES', 'OBLIGATIONS', 'COMPLIANCE', 'TIMELINE', 'DELIVERABLES'];
    if (ctx.diDocumentStructure && ctx.diDocumentStructure.length > 0 && structureTypes.includes(type)) {
      const titles = ctx.diDocumentStructure.filter(p => p.role === 'title');
      const headings = ctx.diDocumentStructure.filter(p => p.role === 'sectionHeading');
      if (titles.length > 0 || headings.length > 0) {
        diParts.push(`\nDOCUMENT STRUCTURE (from DI paragraph analysis):`);
        if (titles.length > 0) {
          diParts.push(`  Document title(s): ${titles.map(t => `"${t.content}"`).join(', ')}`);
        }
        if (headings.length > 0) {
          diParts.push(`  Section headings (${headings.length}):`);
          for (const h of headings.slice(0, 30)) {
            diParts.push(`    - ${h.content}`);
          }
        }
      }
    }

    // Handwriting/signature detection — critical for CONTACTS and PARTIES
    if (ctx.diHandwritingInfo && ['CONTACTS', 'PARTIES'].includes(type)) {
      if (ctx.diHandwritingInfo.hasHandwriting) {
        diParts.push(`\nPRE-VALIDATED HANDWRITING DETECTION:`);
        diParts.push(`  Handwritten spans detected: ${ctx.diHandwritingInfo.handwrittenSpanCount}`);
        diParts.push(`  This document contains HANDWRITTEN content (confirmed by Azure Document Intelligence).`);
        if (ctx.diHandwritingInfo.handwrittenSpans.length > 0) {
          diParts.push(`  Handwritten text found:`);
          for (const span of ctx.diHandwritingInfo.handwrittenSpans.slice(0, 20)) {
            diParts.push(`    - "${span}"`);
          }
          diParts.push(`  IMPORTANT: Handwritten text MAY indicate signatures, initials, OR annotations/fill-ins.`);
          diParts.push(`  You MUST verify whether handwritten content appears in or near SIGNATURE BLOCKS before concluding the document is signed.`);
          diParts.push(`  Handwritten margin notes, annotations, or form field fill-ins are NOT signatures.`);
          diParts.push(`  Only mark as "signed" if handwritten marks appear on/near designated signature lines.`);
        }
      } else {
        diParts.push(`\nPRE-VALIDATED HANDWRITING DETECTION:`);
        diParts.push(`  No handwritten content detected by Azure Document Intelligence.`);
        diParts.push(`  NOTE: This means no physical signatures were found. Look for typed /s/ signatures or electronic signature indicators (DocuSign, Adobe Sign) instead.`);
      }
    }

    // Document language detection — helps with locale-specific formatting
    if (ctx.diDetectedLanguages && ctx.diDetectedLanguages.length > 0) {
      diParts.push(`\nDETECTED DOCUMENT LANGUAGES: ${ctx.diDetectedLanguages.join(', ')}`);
      diParts.push(`  Use language-aware interpretation for dates (DD.MM.YYYY vs MM/DD/YYYY), currency, and terminology.`);
    }

    // Selection marks (checkboxes) — important for compliance, insurance, and intake forms
    const checkboxTypes = ['COMPLIANCE', 'RISK', 'OVERVIEW', 'OBLIGATIONS'];
    if (ctx.diSelectionMarks && ctx.diSelectionMarks.length > 0 && checkboxTypes.includes(type)) {
      const selected = ctx.diSelectionMarks.filter(sm => sm.state === 'selected');
      const unselected = ctx.diSelectionMarks.filter(sm => sm.state === 'unselected');
      diParts.push(`\nSELECTION MARKS (CHECKBOXES) — ${ctx.diSelectionMarks.length} detected:`);
      diParts.push(`  Checked: ${selected.length}, Unchecked: ${unselected.length}`);
      diParts.push(`  NOTE: Checked/unchecked boxes indicate agreed terms, selected options, or compliance attestations.`);
    }

    // Barcodes — useful for document identification, payment references
    const barcodeTypes = ['FINANCIAL', 'OVERVIEW', 'RATES'];
    if (ctx.diBarcodes && ctx.diBarcodes.length > 0 && barcodeTypes.includes(type)) {
      diParts.push(`\nBARCODES DETECTED (${ctx.diBarcodes.length}):`);
      for (const bc of ctx.diBarcodes.slice(0, 10)) {
        diParts.push(`  [${bc.kind}] ${bc.value} (confidence: ${(bc.confidence * 100).toFixed(0)}%)`);
      }
    }

    // Formulas — useful for financial calculations, rate computations
    const formulaTypes = ['FINANCIAL', 'RATES'];
    if (ctx.diFormulas && ctx.diFormulas.length > 0 && formulaTypes.includes(type)) {
      diParts.push(`\nMATHEMATICAL FORMULAS DETECTED (${ctx.diFormulas.length}):`);
      for (const f of ctx.diFormulas.slice(0, 15)) {
        diParts.push(`  [${f.kind}] ${f.value}`);
      }
      diParts.push(`  NOTE: These LaTeX formulas were extracted by DI. Use them for accurate financial calculations.`);
    }

    diParts.push('\nIMPORTANT: Use the pre-validated data above as ground truth when it conflicts with OCR text. These values have been extracted by Azure Document Intelligence with high precision.');
    diParts.push('--- END PRE-VALIDATED DATA ---\n');
    diContext = diParts.join('\n');
  }

  const clauseCategories = ctx.clauseCategories && ctx.clauseCategories.length > 0
    ? ctx.clauseCategories.join(', ')
    : 'payment, termination, liability, confidentiality, indemnification, warranty, scope, other';

  const financialFieldsHint = ctx.financialFieldsHint || 'Extract any financial terms present';
  const riskCategoriesHint = ctx.riskCategoriesHint || 'Analyze general contract risks';

  const prompts: Record<string, string> = {
    OVERVIEW: `Analyze this contract COMPREHENSIVELY and extract all key information. Return a JSON object with:
{
  "summary": "A thorough executive summary of 8-12 sentences covering: what the contract is, who the parties are and their roles, the core purpose and scope, key commercial terms (value, duration, payment structure), the most important obligations on each side, notable risks or unusual provisions, and any critical deadlines. This should be detailed enough that a reader understands the contract without reading it.",
  "executiveBriefing": "A detailed 2-3 paragraph briefing suitable for C-level executives highlighting: 1) What this contract does and why it matters, 2) Key value proposition and commercial terms, 3) Main obligations and deliverables, 4) Notable risks, opportunities, or unusual provisions, 5) Recommended actions or decisions needed",
  "contractType": "The type of contract (e.g., Service Agreement, NDA, MSA, SOW, Employment, Lease)",
  "contractTypeConfidence": number 0-100 indicating confidence in type classification,
  "documentNumber": "The contract/agreement/PO number as written in the document header or title (e.g., 'Agreement No. 12345', 'PO-2024-001'). null if no document number found.",
  "language": "The primary language the document is written in (e.g., 'English', 'German', 'French', 'Italian', 'Spanish'). Use the full language name, not ISO code.",
  "parties": [{"name": "Party name", "role": "Client/Vendor/Contractor/etc", "address": "if mentioned", "jurisdiction": "Country/State if mentioned", "isPlaceholder": false}],
  "effectiveDate": "YYYY-MM-DD or null if not found",
  "expirationDate": "YYYY-MM-DD or null if not found",
  "totalValue": numeric value or 0 if not found,
  "currency": "USD/EUR/GBP/CHF/etc",
  "keyTerms": ["list", "of", "key", "terms", "or", "topics"],
  "jurisdiction": "Legal jurisdiction if mentioned",
  "governingLaw": "Applicable law/state",
  "definedTerms": [{"term": "Definition name", "definition": "Brief definition"}],
  "documentStructure": ["List of main sections/headings found"],
  "keyDates": [{"event": "Event name (signing, start, end, renewal, milestone)", "date": "YYYY-MM-DD", "description": "Brief description", "source": "Section/clause where found"}],
  "keyNumbers": [{"metric": "Metric name", "value": "Value with units", "context": "What this number represents", "source": "Section where found"}],
  "redFlags": [{"issue": "Description of concern", "severity": "high/medium/low", "location": "Where in the document", "recommendation": "What to do about it"}],
  "scopeOfWork": "Detailed description of what work/services/goods the contract covers (3-5 sentences minimum). Null if not applicable.",
  "termAndTermination": "Summary of contract duration, renewal terms, and termination rights (2-3 sentences)",
  "additionalFindings": [
    {
      "field": "Auto-discovered field name not in schema above",
      "value": "Extracted value",
      "sourceSection": "Section/location in document where found",
      "confidence": 0.85,
      "category": "legal|financial|operational|dates|parties|other"
    }
  ],
  "openEndedNotes": "Any other relevant observations, unusual terms, or important context not captured by the structured fields above. Include anything a contract reviewer should know.",
  "certainty": 0.85
}

${typeContext}

IMPORTANT EXTRACTION RULES:
1. Be thorough - scan the ENTIRE document for information.
2. Extract ALL parties mentioned, not just primary parties.
3. Look for dates in multiple formats (MM/DD/YYYY, DD.MM.YYYY, "January 1, 2024", "1st day of January").
4. For totalValue, include recurring costs multiplied by term length if applicable.
5. If you discover important information that doesn't fit the schema above, add it to additionalFindings. Never discard relevant contract details.
6. KeyNumbers should capture any significant metrics (headcount, quantities, limits, thresholds).
7. The executiveBriefing should be actionable - what would an executive need to know to make decisions?
8. The summary MUST be comprehensive (8-12 sentences) - this is the primary description users will see.
9. For every extracted fact, mentally verify it exists in the source text. Do NOT invent or assume information.
10. Include source section references where possible for traceability.
11. Extract party names EXACTLY as written. If placeholders like "[Client Name]" exist, set isPlaceholder: true.

Contract text:
${truncatedText}`,

    CLAUSES: `Extract the key clauses from this contract. Return a JSON object with:
{
  "clauses": [
    {
      "title": "Clause title/name",
      "section": "Section number if available (e.g., 5.2)",
      "content": "Brief summary of what the clause says (2-3 sentences)",
      "fullText": "The verbatim clause text if short enough (under 500 chars)",
      "importance": "high/medium/low",
      "category": "${clauseCategories.split(', ').slice(0, 5).join('/')}",
      "obligations": ["List any specific obligations created"],
      "risks": ["Any risks or concerns with this clause"],
      "crossReferences": ["References to other sections/clauses"],
      "extractedFromText": true
    }
  ],
  "missingClauses": ["Standard clauses NOT found that might be expected"],
  "unusualClauses": ["Any non-standard or unusual provisions"],
  "additionalFindings": [
    {
      "field": "Any clause-related info not fitting above schema",
      "value": "The extracted content",
      "sourceSection": "Section/location",
      "confidence": 0.85,
      "category": "legal|financial|operational|restriction|right|obligation"
    }
  ],
  "openEndedNotes": "Any other clause-related observations, cross-references, or dependencies between clauses not captured above.",
  "certainty": 0.85
}

${typeContext}

Find ALL significant clauses (aim for 5-20 clauses). Focus on:
${clauseCategories}

IMPORTANT: If you find clauses or provisions that don't fit the schema, add them to additionalFindings. Capture EVERYTHING relevant.
If a standard clause for this contract type is missing, note it in missingClauses.
DO NOT invent standard clauses that are not present.

Contract text:
${truncatedText}`,

    FINANCIAL: `Extract ALL financial terms from this contract comprehensively. Return a JSON object with:
{
  "totalValue": numeric value or 0 or null if not applicable,
  "currency": "USD/EUR/GBP/etc",
  "hasFinancialTerms": true/false - set false if this contract type typically has no financial terms (like NDAs),
  "paymentTerms": "Description of payment terms (e.g., Net 30, monthly, milestone-based)",
  "paymentSchedule": [{"milestone": "description", "amount": number, "dueDate": "date or trigger", "year": number}],
  "yearlyBreakdown": [
    {
      "year": 1,
      "label": "Year 1 (2024-2025)",
      "payments": [{"description": "Payment description", "amount": number, "dueDate": "date"}],
      "subtotal": number
    }
  ],
  "costBreakdown": [{"category": "name", "amount": number, "description": "details"}],
  "rateCards": [
    {
      "id": "rate-1",
      "role": "Job title or resource type (e.g., Senior Developer, Project Manager)",
      "rate": numeric hourly/daily/monthly rate,
      "unit": "hourly/daily/monthly/yearly",
      "currency": "USD/EUR/GBP"
    }
  ],
  "financialTables": [
    {
      "tableName": "Name/title of the pricing table",
      "headers": ["Column1", "Column2", "Amount"],
      "rows": [{"Column1": "value", "Column2": "value", "Amount": number}],
      "totals": {"Column1": "Total", "Amount": number},
      "notes": "Any footnotes or additional info"
    }
  ],
  "offers": [
    {
      "offerName": "Name of offer/proposal",
      "validityPeriod": "How long the offer is valid",
      "totalAmount": number,
      "lineItems": [{"description": "item description", "quantity": 1, "unit": "each/hour/month", "unitPrice": number, "total": number}],
      "terms": ["List of terms for this offer"]
    }
  ],
  "penalties": [{"type": "late_payment/breach/sla_violation", "amount": number, "description": "description", "trigger": "what triggers the penalty"}],
  "discounts": [{"type": "early_payment/volume/loyalty", "value": number, "unit": "percentage/fixed", "description": "details"}],
  "paymentMethod": "How payments should be made (wire, check, ACH, etc.)",
  "invoicingRequirements": "Any invoicing requirements mentioned",
  "contractTypeSpecificFinancials": {},
  "additionalFindings": [
    {
      "field": "Any financial info not fitting above schema (bonuses, royalties, escalations, caps, etc.)",
      "value": "The extracted value or description",
      "sourceSection": "Section/table where found",
      "confidence": 0.85,
      "category": "pricing|payment|penalty|incentive|cap|escalation|other"
    }
  ],
  "openEndedNotes": "Any other financial observations - hidden costs, unusual payment structures, financial risks, or pricing anomalies not captured above.",
  "certainty": 0.85
}

${typeContext}
${financialFieldsHint}

IMPORTANT EXTRACTION RULES:
1. If this is an NDA or similar non-financial contract, set hasFinancialTerms=false and skip financial extraction.
2. For EMPLOYMENT: Extract base salary, bonuses, equity grants, benefits value, severance.
3. For LEASE: Extract rent schedule, CAM charges, security deposit, tenant improvements.
4. For LICENSE/SUBSCRIPTION: Extract license fees, royalties, usage tiers.
5. For LOAN: Extract principal, interest rate, repayment schedule.
6. Group payments by contract year in yearlyBreakdown. Year 1 starts from contract effective date.
7. Extract ALL rate cards/pricing for labor, resources, or services.
8. Look for pricing tables - extract as financialTables with proper column headers.
9. For tables, preserve the structure with headers and row data.
10. **CRITICAL: If you find ANY financial information not fitting the schema, add it to additionalFindings. Never discard financial data.**
11. DO NOT calculate totals or infer pricing not explicitly stated.

Contract text:
${truncatedText}`,

    RISK: `Analyze this contract for risks specific to its type. Return a JSON object with:
{
  "overallRisk": "Low/Medium/High/Critical",
  "riskScore": number from 0-100 (0=no risk, 100=extreme risk),
  "contractTypeRisks": "${riskCategoriesHint}",
  "risks": [
    {
      "category": "Financial/Legal/Operational/Compliance/Reputational/ContractTypeSpecific",
      "level": "Low/Medium/High/Critical",
      "title": "Short risk title",
      "description": "Detailed description of the risk",
      "mitigation": "Suggested mitigation or action",
      "clauseReference": "Section/clause number where risk originates",
      "extractedFromText": true
    }
  ],
  "redFlags": [{"flag": "critical concern", "source": "contract quote", "extractedFromText": true}],
  "missingProtections": ["Standard protections for this contract type that are missing"],
  "recommendations": ["Key recommendations for negotiation or review"],
  "comparativeAnalysis": "How this contract compares to market standard for its type",
  "additionalFindings": [
    {
      "field": "Any risk-related finding not fitting above schema",
      "value": "Description of the risk or concern",
      "sourceSection": "Section/clause where found",
      "confidence": 0.85,
      "severity": "critical|high|medium|low"
    }
  ],
  "openEndedNotes": "Any other risk observations, potential disputes, enforceability concerns, or contextual risks not captured above.",
  "certainty": 0.85
}

${typeContext}
${riskCategoriesHint}

Look for:
- Unfavorable terms, one-sided clauses
- Missing protections (liability caps, termination rights)
- Contract-type-specific risks (see above)
- Compliance concerns (GDPR, regulatory)
- Financial risks (payment terms, penalties)
- Ambiguous language that could cause disputes
- CRITICAL: Every risk must cite specific contract language. DO NOT invent risks.
- Any risk or concern not fitting the schema goes in additionalFindings

Contract text:
${truncatedText}`,

    COMPLIANCE: `Review this contract for compliance requirements. Return a JSON object with:
{
  "compliant": true/false (overall assessment),
  "complianceScore": number from 0-100,
  "checks": [
    {
      "regulation": "Name of regulation/standard (GDPR, SOC2, HIPAA, etc)",
      "status": "compliant/non-compliant/needs-review/not-applicable",
      "details": "Brief explanation",
      "source": "where mentioned in contract",
      "extractedFromText": true
    }
  ],
  "issues": [
    {
      "severity": "high/medium/low",
      "description": "Description of the compliance issue",
      "recommendation": "How to address it",
      "source": "contract language"
    }
  ],
  "dataProtection": {
    "hasDataProcessing": true/false,
    "hasDPA": true/false,
    "concerns": ["any data protection concerns"]
  },
  "recommendations": ["List of compliance recommendations"],
  "notFoundCompliance": ["Common compliance items NOT mentioned in contract"],
  "additionalFindings": [
    {
      "field": "Any compliance-related finding not in schema",
      "value": "Description",
      "regulation": "Related regulation if any",
      "severity": "critical|high|medium|low"
    }
  ],
  "openEndedNotes": "Any other regulatory concerns, industry-specific compliance needs, or jurisdictional issues not captured above.",
  "certainty": 0.85
}

ONLY include compliance requirements EXPLICITLY stated. DO NOT assume requirements based on industry.

Contract text:
${truncatedText}`,

    OBLIGATIONS: `Extract all contractual obligations from this contract. Return a JSON object with:
{
  "obligations": [
    {
      "id": "obl_1",
      "party": "Name of responsible party (exact name from contract)",
      "obligation": "Description of the obligation",
      "type": "deliverable/payment/reporting/compliance/performance",
      "dueDate": "Due date or trigger event if specified",
      "frequency": "one-time/daily/weekly/monthly/quarterly/annually/ongoing",
      "status": "pending/in-progress/completed/overdue",
      "priority": "high/medium/low",
      "slaCriteria": {"metric": "Metric name", "target": "Target value", "unit": "unit"} or null,
      "penalty": "Penalty for non-compliance" or null,
      "sourceClause": "Section reference",
      "extractedFromText": true,
      "confidence": 0.9
    }
  ],
  "milestones": [
    {
      "id": "ms_1",
      "name": "Milestone name",
      "description": "What needs to be delivered",
      "dueDate": "Date or timeframe",
      "associatedPayment": number or null,
      "deliverables": ["list"],
      "status": "pending",
      "source": "Section reference"
    }
  ],
  "slaMetrics": [{"metric": "Uptime", "target": "99.9%", "penalty": "$1000/violation", "source": "quote"}],
  "reportingRequirements": [{"type": "Monthly report", "frequency": "monthly", "recipient": "Client", "source": "quote"}],
  "keyDeadlines": ["List of critical deadlines mentioned"],
  "summary": "Brief summary of major obligations for each party",
  "additionalFindings": [
    {
      "field": "Any obligation not fitting the schema above",
      "value": "Description of the obligation",
      "party": "Responsible party",
      "dueInfo": "Timing or trigger if known",
      "category": "deliverable|payment|reporting|compliance|operational|other"
    }
  ],
  "openEndedNotes": "Any other obligation-related observations, dependencies between obligations, or conditional triggers not captured above.",
  "certainty": 0.85
}

CRITICAL: Only extract obligations EXPLICITLY stated. DO NOT infer or invent SLAs not in the document.

Contract text:
${truncatedText}`,

    RENEWAL: `Analyze the renewal and termination terms of this contract. Return a JSON object with:
{
  "autoRenewal": true/false,
  "renewalTerms": {
    "renewalPeriod": "Duration of renewal period (e.g., 1 year, 12 months)",
    "noticePeriodDays": number or null,
    "optOutDeadline": "YYYY-MM-DD or null",
    "source": "exact quote"
  },
  "renewalNoticeRequired": true/false,
  "noticeRequirements": {
    "noticePeriod": "How many days before expiry",
    "noticeMethod": "How notice must be given (written, email, etc.)",
    "noticeRecipient": "Who to notify"
  },
  "terminationRights": {
    "forCause": "Conditions allowing termination for cause",
    "forConvenience": "Conditions for termination without cause",
    "noticePeriod": "Required notice for termination"
  },
  "terminationNotice": {
    "requiredDays": 30,
    "format": "Written notice" or null,
    "recipientParty": "Party name" or null,
    "source": "quote"
  },
  "priceEscalation": [{"type": "Annual/CPI-linked/negotiated", "percentage": number, "cap": number or null, "effectiveDate": "YYYY-MM-DD", "source": "quote"}],
  "earlyTerminationFees": "Any fees for early termination",
  "currentTermEnd": "Contract end date if specified (YYYY-MM-DD)",
  "optOutDeadlines": [{"date": "YYYY-MM-DD", "description": "Last day to opt out", "source": "quote"}],
  "renewalAlerts": [{"type": "warning/critical/info", "message": "Alert message", "dueDate": "YYYY-MM-DD"}],
  "renewalCount": number or null,
  "renewalHistory": [],
  "recommendations": ["Recommendations for renewal strategy"],
  "additionalFindings": [
    {
      "field": "Any renewal/termination info not in schema",
      "value": "Description",
      "sourceSection": "Section where found",
      "category": "renewal|termination|extension|option|other"
    }
  ],
  "openEndedNotes": "Any other renewal/termination observations - special conditions, negotiation opportunities, or strategic considerations.",
  "summary": "Brief summary of renewal terms",
  "certainty": 0.85
}

CRITICAL: Only extract renewal terms EXPLICITLY stated. Calculate optOutDeadline based on noticePeriodDays + currentTermEnd if both available.

Contract text:
${truncatedText}`,

    NEGOTIATION_POINTS: `Identify negotiation points and areas for improvement in this contract. Return a JSON object with:
{
  "negotiationPoints": [
    {
      "clause": "Name or section of the clause",
      "currentTerms": "Current contract language or terms",
      "concern": "Why this might be problematic",
      "suggestedChange": "Recommended modification",
      "priority": "high/medium/low",
      "impact": "financial/legal/operational"
    }
  ],
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
  "favorabilityScore": number from 0-100 (0=very unfavorable, 100=very favorable),
  "favorabilityAssessment": "Overall assessment of contract favorability",
  "overallLeverage": "strong/balanced/weak",
  "imbalances": ["List of terms that heavily favor one party"],
  "missingProtections": ["Standard clauses or protections that are missing"],
  "strongPoints": ["Terms that are particularly favorable"],
  "benchmarkGaps": [{"area": "Payment Terms", "currentTerm": "Net 15", "marketStandard": "Net 30", "gap": "Below market", "recommendation": "Negotiate to Net 30"}],
  "negotiationScript": [{"topic": "Payment Terms", "openingPosition": "We propose Net 45", "fallbackPosition": "We can accept Net 30", "walkAwayPoint": "Net 15 is unacceptable", "supportingEvidence": ["Industry standard is Net 30"]}],
  "recommendations": ["Top recommendations for negotiation"],
  "additionalFindings": [
    {
      "field": "Any negotiation-relevant finding not in schema",
      "value": "Description",
      "leverage": "strong|weak|neutral",
      "category": "pricing|terms|rights|obligations|other"
    }
  ],
  "openEndedNotes": "Any other negotiation insights - leverage points, counterparty pressures, market context, or strategic observations.",
  "summary": "Brief negotiation strategy summary",
  "certainty": 0.85
}

CRITICAL: Base ALL analysis on actual contract language. DO NOT invent leverage points not supported by the text.

Contract text:
${truncatedText}`,

    AMENDMENTS: `Extract information about any amendments, addenda, or modifications to this contract. Return a JSON object with:
{
  "hasAmendments": true/false,
  "amendments": [
    {
      "id": "amd_1",
      "number": "Amendment number or identifier",
      "amendmentNumber": 1,
      "date": "Date of amendment",
      "effectiveDate": "YYYY-MM-DD",
      "title": "Title or subject of amendment",
      "summary": "Brief description of changes",
      "affectedSections": ["List of sections modified"],
      "changedClauses": [{"clauseId": "Section 5.2", "originalText": "Old text" or null, "newText": "New text", "changeType": "added/modified/deleted"}],
      "parties": ["Parties who signed"],
      "signedBy": ["Party names"],
      "sourceDocument": "Amendment 1 dated MM/DD/YYYY",
      "extractedFromText": true
    }
  ],
  "changeHistory": [
    {
      "date": "Date of change",
      "type": "amendment/addendum/modification/side-letter",
      "description": "What was changed",
      "reference": "Amendment 1"
    }
  ],
  "supersededClauses": [{"originalClause": "Section 3.1", "supersededBy": "Amendment 2, Section 3.1", "effectiveDate": "YYYY-MM-DD"}],
  "originalContractDate": "Date of original contract if mentioned",
  "latestVersion": "Current version number if versioned",
  "consolidatedTerms": {"lastUpdated": "YYYY-MM-DD", "version": "2.0", "effectiveTerms": ["List of current effective provisions"]} or null,
  "summary": "Overview of contract modification history",
  "additionalFindings": [
    {
      "field": "Any amendment-related info not in schema",
      "value": "Description",
      "date": "Date if known",
      "category": "amendment|addendum|side-letter|modification|other"
    }
  ],
  "openEndedNotes": "Any other observations about the amendment history, superseded terms, or version conflicts.",
  "certainty": 0.85
}

CRITICAL: Only extract amendments EXPLICITLY documented. If this is the original contract with no amendments, return empty arrays.

Contract text:
${truncatedText}`,

    CONTACTS: `Extract all contact information, key personnel, and SIGNATURE STATUS from this contract. Return a JSON object with:
{
  "contacts": [
    {
      "name": "Full name",
      "role": "Job title or role",
      "organization": "Company name",
      "partyType": "client/vendor/witness/guarantor",
      "email": "Email address if provided",
      "phone": "Phone number if provided",
      "address": "Mailing address if provided",
      "isSignatory": true/false,
      "isPrimaryContact": true/false,
      "extractedFromText": true
    }
  ],
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
  "signatories": [
    {
      "name": "Name of signatory",
      "title": "Job title",
      "organization": "Company",
      "dateSigned": "Signature date if shown (YYYY-MM-DD format)",
      "isSigned": true/false
    }
  ],
  "signatureStatus": "signed/partially_signed/unsigned/unknown",
  "signatureDate": "YYYY-MM-DD - the date the contract was signed",
  "signatureAnalysis": {
    "totalSignatureBlocks": "Number of signature blocks/lines found",
    "signedBlocks": "Number of blocks with actual signatures",
    "unsignedBlocks": "Number of empty/blank signature lines",
    "hasWitnessSignatures": true/false,
    "hasNotaryOrSeal": true/false,
    "executionLanguage": "Any 'IN WITNESS WHEREOF' or similar execution language found"
  },
  "escalationPath": [{"level": 1, "role": "Account Manager", "name": "Name if specified" or null, "contactInfo": "Contact details", "escalationTrigger": "When to escalate"}],
  "noticeAddresses": [
    {
      "party": "Party name",
      "address": "Full notice address",
      "attention": "Attention to (if specified)",
      "format": "Certified Mail/Email/Both"
    }
  ],
  "keyPersonnel": [{"name": "Person name", "role": "Their title/role", "responsibilities": ["List of duties"], "party": "Party name"}],
  "summary": "Overview of key contacts for contract management",
  "additionalFindings": [
    {
      "field": "Any contact-related info not in schema",
      "value": "Description",
      "contactType": "escalation|emergency|technical|billing|legal|other"
    }
  ],
  "openEndedNotes": "Any other contact observations - escalation procedures, preferred communication methods, or key relationship notes.",
  "certainty": 0.85
}

CRITICAL SIGNATURE STATUS DETECTION RULES:
- Look at the END of the document for signature blocks
- "signed" = ALL signature lines have actual signatures (handwritten marks, typed /s/ names with dates, or electronic signature indicators like DocuSign/Adobe Sign)
- "partially_signed" = SOME but NOT ALL signature lines have signatures
- "unsigned" = NO signatures present, all signature lines are blank/empty — ONLY use this if you are confident no marks exist on signature lines
- "unknown" = Cannot find signature blocks or document format is unclear
- Empty lines like "________________________" without marks above/below = unsigned
- Names TYPED above/below signature lines are NOT signatures unless accompanied by "/s/" prefix or are clearly part of an electronic signature block with dates
- Handwritten annotations, margin notes, or fill-in fields are NOT signatures — only marks in designated signature blocks count
- IMPORTANT: If the PRE-VALIDATED HANDWRITING DETECTION section above indicates handwritten content was detected, and this document has signature blocks, you should strongly presume the document IS signed unless there is clear contrary evidence. Handwritten signatures often appear as illegible marks that OCR cannot read as text, but the handwriting detection confirmed physical marks exist. Do NOT mark as "unsigned" when handwriting was detected near signature areas.
- If handwriting data indicates signatures were detected by Document Intelligence, weigh that evidence HEAVILY in favor of "signed" — the AI model cannot see the physical marks, only the extracted text
- For each signatory, set "isSigned": true if there is ANY indication they signed (handwritten mark, /s/ prefix, date next to their name, DocuSign stamp, or DI handwriting detection near their signature block)
ONLY extract contact information EXPLICITLY stated. DO NOT invent contacts or assume standard roles.

Contract text:
${truncatedText}`,

    PARTIES: `Extract comprehensive party information from this contract. Return a JSON object with:
{
  "parties": [
    {
      "name": "Full legal entity name exactly as written in the contract",
      "role": "Client/Vendor/Contractor/Employer/Employee/Licensor/Licensee/Landlord/Tenant/etc",
      "type": "corporation/llc/partnership/individual/government/nonprofit/other",
      "address": "Full address if mentioned",
      "jurisdiction": "State/Country of incorporation or residence",
      "registrationNumber": "Company registration/tax ID if mentioned",
      "signatoryName": "Name of the person signing on behalf of this party",
      "signatoryTitle": "Title/role of the signatory",
      "contactInfo": {"email": "if mentioned", "phone": "if mentioned", "website": "if mentioned"},
      "obligations": ["Key obligations this party has under the contract"],
      "rights": ["Key rights this party has under the contract"],
      "source": "Section/clause where this party is first introduced",
      "isPlaceholder": false
    }
  ],
  "relationships": [
    {
      "partyA": "Name",
      "partyB": "Name",
      "relationship": "Description of the contractual relationship",
      "powerDynamic": "equal/partyA-dominant/partyB-dominant"
    }
  ],
  "thirdParties": [
    {
      "name": "Any third parties mentioned (subcontractors, beneficiaries, guarantors)",
      "role": "Their role in the contract",
      "source": "Where mentioned"
    }
  ],
  "guarantors": [{"name": "Guarantor name", "guaranteeScope": "What they guarantee"}],
  "additionalFindings": [{"field": "Party-related finding", "value": "Detail", "source": "Section"}],
  "openEndedNotes": "Any notable observations about party relationships, affiliates, or organizational structure.",
  "certainty": 0.85
}

${typeContext}

CRITICAL RULES:
1. Extract party names EXACTLY as written in the contract - do not paraphrase or abbreviate.
2. Every party field must reference where in the document the information was found.
3. Include ALL parties - primary, secondary, third-party beneficiaries, guarantors, agents.
4. Do NOT invent party information. If a field is not mentioned, use null.
5. Look carefully for "defined as" or "hereinafter referred to as" constructs.
6. If the document uses placeholders (e.g., "[Client Name]"), set isPlaceholder: true.

Contract text:
${truncatedText}`,

    TIMELINE: `Extract a comprehensive timeline of all dates, deadlines, milestones, and temporal events from this contract. Return a JSON object with:
{
  "contractTimeline": {
    "executionDate": {"date": "YYYY-MM-DD or null", "source": "Section reference"},
    "effectiveDate": {"date": "YYYY-MM-DD or null", "source": "Section reference"},
    "expirationDate": {"date": "YYYY-MM-DD or null", "source": "Section reference"},
    "totalDuration": "Human-readable duration (e.g., '3 years', '36 months')",
    "renewalDates": [{"date": "YYYY-MM-DD", "description": "Renewal event", "source": "Section"}]
  },
  "milestones": [
    {
      "name": "Milestone name/description",
      "date": "YYYY-MM-DD or relative description (e.g., '30 days after effective date')",
      "type": "delivery/payment/review/approval/transition/go-live/other",
      "owner": "Which party is responsible",
      "dependencies": ["Any prerequisites"],
      "deliverables": ["What must be completed"],
      "consequences": "What happens if missed",
      "source": "Section/clause reference"
    }
  ],
  "deadlines": [
    {
      "description": "Deadline description",
      "date": "YYYY-MM-DD or relative",
      "type": "notice/filing/delivery/payment/response/other",
      "consequences": "What happens if deadline is missed",
      "source": "Section reference"
    }
  ],
  "paymentSchedule": [
    {
      "description": "Payment description",
      "amount": "Amount if specified",
      "dueDate": "YYYY-MM-DD or relative or recurring description",
      "frequency": "one-time/monthly/quarterly/annually/milestone-based/other",
      "source": "Section reference"
    }
  ],
  "noticePeriods": [
    {
      "type": "termination/renewal/breach/change/other",
      "period": "Duration (e.g., '30 days', '90 days')",
      "method": "How notice must be given",
      "source": "Section reference"
    }
  ],
  "criticalPath": ["Ordered list of the most important dates/events that determine the contract's lifecycle"],
  "additionalFindings": [{"field": "Timeline finding", "value": "Detail", "source": "Section"}],
  "openEndedNotes": "Any temporal observations, implied deadlines, or scheduling concerns.",
  "certainty": 0.85
}

${typeContext}

CRITICAL RULES:
1. Extract ALL dates mentioned anywhere in the contract, even in appendices.
2. Convert relative dates to absolute where possible (e.g., "30 days after January 1" = "January 31").
3. Always cite the source section for every date and deadline.
4. For recurring events, specify the frequency and first occurrence.
5. Do NOT invent dates. If a date is unclear, note the ambiguity.

Contract text:
${truncatedText}`,

    DELIVERABLES: `Extract all deliverables, work products, services, and outputs from this contract. Return a JSON object with:
{
  "deliverables": [
    {
      "name": "Deliverable name/title",
      "description": "Detailed description of what must be delivered (2-3 sentences)",
      "type": "document/software/service/report/hardware/training/milestone/other",
      "owner": "Which party is responsible for delivering",
      "recipient": "Which party receives the deliverable",
      "dueDate": "YYYY-MM-DD or relative or null",
      "acceptanceCriteria": ["List of acceptance criteria if specified"],
      "qualityStandards": ["Quality requirements or standards referenced"],
      "dependencies": ["Prerequisites or dependent deliverables"],
      "status": "defined/implied/conditional",
      "priority": "critical/high/medium/low",
      "source": "Section/clause where specified"
    }
  ],
  "servicelevels": [
    {
      "metric": "SLA metric name",
      "target": "Target value",
      "measurement": "How it's measured",
      "penalty": "Penalty for non-compliance",
      "source": "Section reference"
    }
  ],
  "acceptanceProcess": {
    "reviewPeriod": "Duration for review/acceptance",
    "approvalAuthority": "Who approves deliverables",
    "rejectionProcess": "What happens if deliverable is rejected",
    "disputes": "How disputes about acceptance are resolved"
  },
  "workBreakdown": ["High-level breakdown of work phases or streams if identifiable"],
  "exclusions": ["Explicitly excluded items or services"],
  "assumptions": ["Stated assumptions about deliverables"],
  "additionalFindings": [{"field": "Deliverable finding", "value": "Detail", "source": "Section"}],
  "openEndedNotes": "Any observations about deliverable scope, gaps, or ambiguities.",
  "certainty": 0.85
}

${typeContext}

CRITICAL RULES:
1. Extract EVERY deliverable mentioned, including those in appendices, SOWs, and schedules.
2. Distinguish between explicitly defined and implied deliverables.
3. Note acceptance criteria and quality standards where specified.
4. Capture dependencies between deliverables.
5. Do NOT invent deliverables. Only extract what is explicitly or clearly implied in the text.

Contract text:
${truncatedText}`,

    EXECUTIVE_SUMMARY: `Generate a comprehensive executive summary of this contract suitable for senior leadership review. Return a JSON object with:
{
  "headline": "One-line headline capturing the essence of the contract (< 100 chars)",
  "strategicSummary": "A 3-4 paragraph strategic summary (400-600 words) covering: 1) Purpose and scope of the agreement, 2) Business context and strategic value, 3) Key commercial terms and financial impact, 4) Risk profile and recommended actions",
  "keyMetrics": {
    "totalContractValue": "Total value with currency",
    "contractDuration": "Duration in human-readable format",
    "keyDeadlines": ["Most important dates/deadlines"],
    "numberOfParties": number,
    "numberOfDeliverables": number or "N/A"
  },
  "businessImpact": {
    "revenueImpact": "Description of revenue/cost implications",
    "operationalImpact": "How this affects operations",
    "strategicAlignment": "How this aligns with business objectives (if inferrable)",
    "resourceRequirements": "Key resources or commitments needed"
  },
  "riskProfile": {
    "overallRisk": "low/medium/high/critical",
    "topRisks": [
      {
        "risk": "Risk description",
        "severity": "high/medium/low",
        "mitigation": "Suggested mitigation or existing protection",
        "source": "Section reference"
      }
    ],
    "missingProtections": ["Standard protections not found in this contract"]
  },
  "recommendedActions": [
    {
      "action": "What needs to be done",
      "priority": "immediate/short-term/long-term",
      "owner": "Who should take this action",
      "rationale": "Why this action is recommended"
    }
  ],
  "negotiationInsights": {
    "favorability": "Score 1-10, 1=heavily favors counterparty, 10=heavily favors our side",
    "leveragePoints": ["Areas where we have negotiation leverage"],
    "concessions": ["Areas where concessions were made"],
    "improvementOpportunities": ["Terms that could be improved in future negotiations"]
  },
  "additionalFindings": [{"field": "Finding", "value": "Detail", "source": "Section"}],
  "openEndedNotes": "Any strategic observations, concerns, or opportunities not captured above.",
  "certainty": 0.85
}

${typeContext}

CRITICAL RULES:
1. The strategicSummary must be comprehensive (400-600 words) - this is the primary document executives will read.
2. Focus on business impact and actionable insights, not legal jargon.
3. Every risk and recommendation must cite its source in the contract.
4. Be specific about numbers, dates, and obligations - avoid vague language.
5. Do NOT invent information. Base all analysis solely on what appears in the contract text.
6. The headline should be memorable and capture the deal's significance.

Contract text:
${truncatedText}`,

    RATES: `Extract all rates, pricing matrices, labor rates, and fee structures from this contract.${typeContext}
Return JSON with:
{
  "rates": [
    {
      "role": "Role or service name",
      "hourlyRate": number or null,
      "dailyRate": number or null,
      "currency": "USD/EUR/CHF/GBP",
      "source": "exact quote or section reference",
      "extractedFromText": true
    }
  ],
  "rateCards": [
    {
      "name": "Rate card/schedule name",
      "effectiveDate": "YYYY-MM-DD" or null,
      "expirationDate": "YYYY-MM-DD" or null,
      "rates": [{"category": "Category name", "rate": number, "unit": "hour/day/month/project"}],
      "source": "section reference"
    }
  ],
  "pricingModel": "time-and-materials/fixed-price/milestone/subscription/hybrid" or null,
  "discountStructure": [{"type": "volume/early-payment/loyalty", "percentage": number, "condition": "Description", "source": "quote"}],
  "escalationTerms": [{"type": "annual/CPI-linked/negotiated", "cap": number or null, "frequency": "annual/other", "source": "quote"}],
  "summary": "Brief summary of pricing structure",
  "additionalFindings": [],
  "openEndedNotes": null,
  "certainty": 0.85
}

CRITICAL: Only extract rates EXPLICITLY stated. Do NOT invent pricing or calculate derived rates.

Contract text:
${truncatedText}`,
  };

  const prompt = prompts[type] || null;
  if (!prompt) return null;

  // Inject few-shot example before contract text for key artifact types
  const fewShot = FEW_SHOT_EXAMPLES[type];
  let finalPrompt = prompt;
  if (fewShot) {
    finalPrompt = finalPrompt.replace(
      'Contract text:\n',
      `\n--- FEW-SHOT EXAMPLE (for output format reference only — do NOT copy these values) ---
INPUT SNIPPET: "${fewShot.inputSnippet}"
EXPECTED OUTPUT SNIPPET:
${JSON.stringify(fewShot.outputSnippet, null, 2)}
--- END EXAMPLE ---

Contract text:\n`
    );
  }

  // Inject DI context before the contract text section if available
  if (diContext) {
    finalPrompt = finalPrompt.replace('Contract text:\n', diContext + '\nContract text:\n');
  }
  return finalPrompt;
}

// ─── Few-Shot Examples ──────────────────────────────────────────────────────
// Compact representative input→output examples to ground the LLM on expected
// format and detail level. These are NOT real contracts — they are synthetic.

const FEW_SHOT_EXAMPLES: Record<string, { inputSnippet: string; outputSnippet: Record<string, any> }> = {
  OVERVIEW: {
    inputSnippet: 'This Master Services Agreement ("Agreement") is entered into as of January 15, 2024, by and between Acme Corp, a Delaware corporation ("Client"), and TechFlow Inc, a California LLC ("Vendor"). The Agreement shall remain in effect for a period of three (3) years... total value not to exceed $2,400,000.',
    outputSnippet: {
      summary: "This is a 3-year Master Services Agreement between Acme Corp (Client) and TechFlow Inc (Vendor) with a total value cap of $2,400,000. The agreement was entered into on January 15, 2024...",
      contractType: "Master Services Agreement",
      parties: [{ name: "Acme Corp", role: "Client", jurisdiction: "Delaware", isPlaceholder: false }, { name: "TechFlow Inc", role: "Vendor", jurisdiction: "California", isPlaceholder: false }],
      effectiveDate: "2024-01-15",
      totalValue: 2400000,
      currency: "USD",
      certainty: 0.92,
    },
  },
  CLAUSES: {
    inputSnippet: 'Section 8.1 Limitation of Liability: In no event shall either party be liable for any indirect, incidental, special, or consequential damages... Section 8.2 Indemnification: Vendor shall indemnify and hold harmless Client from and against any claims arising from Vendor\'s negligence.',
    outputSnippet: {
      clauses: [
        { title: "Limitation of Liability", section: "8.1", content: "Mutual exclusion of indirect, incidental, special, and consequential damages.", importance: "high", category: "liability", extractedFromText: true },
        { title: "Indemnification", section: "8.2", content: "Vendor indemnifies Client against claims arising from Vendor's negligence.", importance: "high", category: "indemnification", extractedFromText: true },
      ],
      certainty: 0.90,
    },
  },
  FINANCIAL: {
    inputSnippet: 'The total contract value shall not exceed $1,200,000 USD. Payment shall be made in monthly installments of $100,000, due within Net 30 of invoice receipt. A 2% early payment discount applies for payments within 10 days.',
    outputSnippet: {
      totalValue: 1200000,
      currency: "USD",
      hasFinancialTerms: true,
      paymentTerms: "Monthly installments of $100,000, Net 30",
      discounts: [{ type: "early_payment", value: 2, unit: "percentage", description: "2% discount for payment within 10 days" }],
      certainty: 0.95,
    },
  },
  RISK: {
    inputSnippet: 'Vendor\'s total aggregate liability under this Agreement shall not exceed the fees paid in the preceding 12 months. Client waives all warranties except those expressly stated herein.',
    outputSnippet: {
      overallRisk: "Medium",
      riskScore: 55,
      risks: [
        { category: "Financial", level: "Medium", title: "Limited vendor liability cap", description: "Vendor liability capped at 12 months of fees, which may not cover significant losses.", mitigation: "Negotiate higher liability cap or carve-outs for data breach and IP infringement.", clauseReference: "Aggregate liability clause", extractedFromText: true },
        { category: "Legal", level: "High", title: "Broad warranty waiver by Client", description: "Client waives all warranties except express ones, removing implied merchantability protections.", mitigation: "Negotiate to retain key implied warranties.", clauseReference: "Warranty waiver clause", extractedFromText: true },
      ],
      certainty: 0.85,
    },
  },
  OBLIGATIONS: {
    inputSnippet: 'Vendor shall deliver monthly progress reports by the 5th business day of each month. Client shall provide access to necessary systems within 10 business days of signing.',
    outputSnippet: {
      obligations: [
        { id: "obl_1", party: "Vendor", obligation: "Deliver monthly progress reports by 5th business day of each month", type: "reporting", frequency: "monthly", priority: "medium", extractedFromText: true, confidence: 0.95 },
        { id: "obl_2", party: "Client", obligation: "Provide access to necessary systems within 10 business days of signing", type: "deliverable", frequency: "one-time", priority: "high", extractedFromText: true, confidence: 0.95 },
      ],
      certainty: 0.92,
    },
  },
};

// ─── Fallback Templates ─────────────────────────────────────────────────────
// Used when AI is unavailable. Returns empty/null structures.

export function getFallbackTemplate(type: string): Record<string, any> {
  const meta = { fallback: true, reason: 'AI unavailable', generatedAt: new Date().toISOString(), aiGenerated: false, model: 'none', antiHallucinationEnabled: false, promptVersion: PROMPT_VERSION };

  const templates: Record<string, Record<string, any>> = {
    OVERVIEW:          { summary: null, executiveBriefing: null, contractType: null, contractTypeConfidence: 0, parties: [], effectiveDate: null, expirationDate: null, totalValue: 0, currency: 'USD', keyTerms: [], jurisdiction: null, governingLaw: null, definedTerms: [], documentStructure: [], keyDates: [], keyNumbers: [], redFlags: [], scopeOfWork: null, termAndTermination: null, additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    CLAUSES:           { clauses: [], missingClauses: ['Unable to analyze - AI unavailable'], unusualClauses: [], additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    FINANCIAL:         { totalValue: 0, currency: 'USD', hasFinancialTerms: null, paymentTerms: null, paymentSchedule: [], yearlyBreakdown: [], costBreakdown: [], rateCards: [], financialTables: [], offers: [], penalties: [], discounts: [], paymentMethod: null, invoicingRequirements: null, contractTypeSpecificFinancials: {}, additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    RISK:              { overallRisk: 'Unknown', riskScore: 50, contractTypeRisks: null, risks: [], redFlags: [], missingProtections: [], recommendations: ['Configure AI analysis for proper risk assessment'], comparativeAnalysis: null, additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    COMPLIANCE:        { compliant: null, complianceScore: 0, checks: [], issues: [], dataProtection: { hasDataProcessing: null, hasDPA: null, concerns: [] }, recommendations: ['Configure AI analysis for compliance review'], notFoundCompliance: [], additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    OBLIGATIONS:       { obligations: [], milestones: [], slaMetrics: [], reportingRequirements: [], keyDeadlines: [], summary: 'Obligation extraction requires AI - please configure API keys', additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    RENEWAL:           { autoRenewal: null, renewalTerms: null, renewalNoticeRequired: null, noticeRequirements: null, terminationRights: null, terminationNotice: null, priceEscalation: [], earlyTerminationFees: null, currentTermEnd: null, optOutDeadlines: [], renewalAlerts: [], renewalCount: null, renewalHistory: [], recommendations: ['Configure AI analysis for renewal terms extraction'], summary: null, additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    NEGOTIATION_POINTS:{ negotiationPoints: [], leveragePoints: [], weakClauses: [], favorabilityScore: 50, favorabilityAssessment: 'AI analysis required', overallLeverage: null, imbalances: [], missingProtections: [], strongPoints: [], benchmarkGaps: [], negotiationScript: [], recommendations: ['Configure AI analysis for negotiation points'], summary: null, additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    AMENDMENTS:        { hasAmendments: false, amendments: [], changeHistory: [], supersededClauses: [], originalContractDate: null, latestVersion: null, consolidatedTerms: null, summary: 'Amendment extraction requires AI analysis', additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    CONTACTS:          { contacts: [], primaryContacts: [], signatories: [], signatureStatus: 'unknown', signatureDate: null, signatureAnalysis: { totalSignatureBlocks: 0, signedBlocks: 0, unsignedBlocks: 0, hasWitnessSignatures: false, hasNotaryOrSeal: false, executionLanguage: null }, escalationPath: [], noticeAddresses: [], keyPersonnel: [], summary: 'Contact extraction requires AI analysis', additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    PARTIES:           { parties: [], relationships: [], thirdParties: [], guarantors: [], additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    TIMELINE:          { contractTimeline: { executionDate: null, effectiveDate: null, expirationDate: null, totalDuration: null, renewalDates: [] }, milestones: [], deadlines: [], paymentSchedule: [], noticePeriods: [], criticalPath: [], additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    DELIVERABLES:      { deliverables: [], servicelevels: [], acceptanceProcess: null, workBreakdown: [], exclusions: [], assumptions: [], additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    EXECUTIVE_SUMMARY: { headline: null, strategicSummary: null, keyMetrics: {}, businessImpact: {}, riskProfile: { overallRisk: 'Unknown', topRisks: [], missingProtections: [] }, recommendedActions: [], negotiationInsights: null, additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
    RATES:             { rates: [], rateCards: [], pricingModel: null, discountStructure: [], escalationTerms: [], summary: null, additionalFindings: [], openEndedNotes: null, certainty: 0, _meta: meta },
  };

  return templates[type] ? { ...templates[type] } : { type, certainty: 0, _meta: meta };
}

// ─── Token Cost Estimation ──────────────────────────────────────────────────
// P2 #11: Unified cost tracking for both workers.

interface TokenPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const MODEL_PRICING: Record<string, TokenPricing> = {
  'gpt-4o':                  { inputPer1M: 2.50,  outputPer1M: 10.00 },
  'gpt-4o-mini':             { inputPer1M: 0.15,  outputPer1M: 0.60 },
  'gpt-4-turbo':             { inputPer1M: 10.00, outputPer1M: 30.00 },
  'gpt-3.5-turbo':           { inputPer1M: 0.50,  outputPer1M: 1.50 },
  'mistral-large-latest':    { inputPer1M: 2.00,  outputPer1M: 6.00 },
  'mistral-medium-latest':   { inputPer1M: 2.70,  outputPer1M: 8.10 },
};

export function estimateTokenCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o'];
  return (promptTokens / 1_000_000) * (pricing?.inputPer1M ?? 0) + (completionTokens / 1_000_000) * (pricing?.outputPer1M ?? 0);
}

// ─── Cost Budget ────────────────────────────────────────────────────────────
// P2 #11: Enforce per-contract cost limits.

export interface CostBudget {
  maxCostPerContract: number; // USD
  maxCostPerTenant: number;   // USD
  warningThreshold: number;   // fraction (0.8 = 80%)
}

const DEFAULT_COST_BUDGET: CostBudget = {
  maxCostPerContract: parseFloat(process.env.MAX_ARTIFACT_COST_PER_CONTRACT || '2.00'),
  maxCostPerTenant: parseFloat(process.env.MAX_ARTIFACT_COST_PER_TENANT_DAILY || '50.00'),
  warningThreshold: 0.8,
};

export class ArtifactCostTracker {
  private contractCosts: Map<string, number> = new Map();
  private tenantDailyCosts: Map<string, { total: number; date: string }> = new Map();
  private budget: CostBudget;

  constructor(budget?: Partial<CostBudget>) {
    this.budget = { ...DEFAULT_COST_BUDGET, ...budget };
  }

  addCost(contractId: string, tenantId: string, cost: number): void {
    const currentContractCost = (this.contractCosts.get(contractId) || 0) + cost;
    this.contractCosts.set(contractId, currentContractCost);

    const today = new Date().toISOString().slice(0, 10);
    const tenantEntry = this.tenantDailyCosts.get(tenantId);
    if (tenantEntry && tenantEntry.date === today) {
      tenantEntry.total += cost;
    } else {
      this.tenantDailyCosts.set(tenantId, { total: cost, date: today });
    }
  }

  canProceed(contractId: string, tenantId: string): { allowed: boolean; reason?: string; warning?: string } {
    const contractCost = this.contractCosts.get(contractId) || 0;
    const today = new Date().toISOString().slice(0, 10);
    const tenantEntry = this.tenantDailyCosts.get(tenantId);
    const tenantCost = tenantEntry?.date === today ? tenantEntry.total : 0;

    if (contractCost >= this.budget.maxCostPerContract) {
      return { allowed: false, reason: `Contract cost limit reached ($${contractCost.toFixed(4)} >= $${this.budget.maxCostPerContract})` };
    }
    if (tenantCost >= this.budget.maxCostPerTenant) {
      return { allowed: false, reason: `Tenant daily cost limit reached ($${tenantCost.toFixed(4)} >= $${this.budget.maxCostPerTenant})` };
    }

    const warnings: string[] = [];
    if (contractCost >= this.budget.maxCostPerContract * this.budget.warningThreshold) {
      warnings.push(`Contract nearing cost limit ($${contractCost.toFixed(4)}/$${this.budget.maxCostPerContract})`);
    }
    if (tenantCost >= this.budget.maxCostPerTenant * this.budget.warningThreshold) {
      warnings.push(`Tenant nearing daily cost limit ($${tenantCost.toFixed(4)}/$${this.budget.maxCostPerTenant})`);
    }

    return { allowed: true, warning: warnings.length ? warnings.join('; ') : undefined };
  }

  getContractCost(contractId: string): number {
    return this.contractCosts.get(contractId) || 0;
  }

  getTenantDailyCost(tenantId: string): number {
    const today = new Date().toISOString().slice(0, 10);
    const entry = this.tenantDailyCosts.get(tenantId);
    return entry?.date === today ? entry.total : 0;
  }

  reset(contractId: string): void {
    this.contractCosts.delete(contractId);
  }
}

// ─── Safe JSON Parser ───────────────────────────────────────────────────────

export function safeParseJSON(text: string, artifactType: string): Record<string, any> | null {
  try {
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.slice(7);
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.slice(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.slice(0, -3);
    }
    cleanText = cleanText.trim();
    return JSON.parse(cleanText);
  } catch (error) {
    logger.warn({
      artifactType,
      error: error instanceof Error ? error.message : String(error),
      textPreview: text.substring(0, 200),
    }, 'Failed to parse JSON response, attempting extraction');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ─── Quality Thresholds ─────────────────────────────────────────────────────
// Unified quality thresholds (fixes P2 OCR worker using lower thresholds)

export const UNIFIED_QUALITY_THRESHOLDS = {
  overall: 0.70,
  completeness: 0.60,
  accuracy: 0.70,
  consistency: 0.65,
  confidence: 0.60,
};

// ─── Prompt Version ─────────────────────────────────────────────────────────

export const PROMPT_VERSION = 'unified-artifact-prompts-v4';

// Integrate with prompt registry for version tracking and A/B testing
let _registryLoaded = false;
function ensureRegistryLoaded(): void {
  if (_registryLoaded) return;
  _registryLoaded = true;
  try {
    // Dynamic import to avoid circular dependency issues
    const { promptRegistry } = require('./prompt-registry');
    if (promptRegistry) {
      logger.info('Prompt registry available — version tracking enabled');
    }
  } catch {
    // Registry not available — use inline prompts (no-op)
  }
}

// ─── Required Fields per Type ───────────────────────────────────────────────
// Used by quality validator to check completeness.

export const REQUIRED_FIELDS: Record<string, string[]> = {
  OVERVIEW:            ['summary', 'contractType', 'parties'],
  CLAUSES:             ['clauses'],
  FINANCIAL:           ['currency'],
  RISK:                ['overallRisk', 'risks'],
  COMPLIANCE:          ['checks'],
  OBLIGATIONS:         ['obligations'],
  RENEWAL:             ['autoRenewal', 'renewalTerms'],
  NEGOTIATION_POINTS:  ['leveragePoints'],
  AMENDMENTS:          ['amendments'],
  CONTACTS:            ['primaryContacts'],
  PARTIES:             ['parties'],
  TIMELINE:            ['contractTimeline', 'milestones'],
  DELIVERABLES:        ['deliverables'],
  EXECUTIVE_SUMMARY:   ['strategicSummary', 'keyMetrics'],
  RATES:               ['rates'],
};
