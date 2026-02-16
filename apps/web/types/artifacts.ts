/**
 * Artifact Type Definitions
 * Provides strong typing for all 11 contract artifact types across the application.
 */

export type ArtifactType =
  | 'overview'
  | 'clauses'
  | 'financial'
  | 'risk'
  | 'compliance'
  | 'rates'
  | 'obligations'
  | 'renewal'
  | 'negotiation_points'
  | 'amendments'
  | 'contacts';

// =============================================================================
// Overview
// =============================================================================

export interface Party {
  name: string;
  role: 'provider' | 'client' | 'other';
}

export interface OverviewData {
  summary?: string;
  parties?: Party[];
  contractType?: string;
  totalValue?: number;
  startDate?: string;
  endDate?: string;
  confidence?: number;
  model?: string;
}

// =============================================================================
// Clauses
// =============================================================================

export interface Clause {
  name?: string;
  category?: string;
  excerpt?: string;
  text?: string;
  location?: string;
  relevance?: number;
}

export interface ClausesData {
  clauses?: Clause[];
  confidence?: number;
  model?: string;
}

// =============================================================================
// Financial
// =============================================================================

export interface PaymentTerm {
  description: string;
}

export interface PaymentSchedule {
  milestone: string;
  amount: number;
  date?: string;
}

export interface RateCard {
  role?: string;
  title?: string;
  rate: number;
  currency?: string;
}

export interface FinancialData {
  financial?: {
    totalValue?: number;
    currency?: string;
    paymentTerms?: string[];
    paymentSchedule?: PaymentSchedule[];
    rateCards?: RateCard[];
  };
  totalValue?: number;
  currency?: string;
  paymentTerms?: string[];
  paymentSchedule?: PaymentSchedule[];
  rateCards?: RateCard[];
  confidence?: number;
  model?: string;
}

// =============================================================================
// Risk
// =============================================================================

export interface Risk {
  title?: string;
  category?: string;
  severity?: 'high' | 'medium' | 'low';
  rationale?: string;
  description?: string;
  mitigation?: string;
}

export interface RiskData {
  risks?: Risk[];
  confidence?: number;
  model?: string;
}

// =============================================================================
// Compliance
// =============================================================================

export interface ComplianceItem {
  standard?: string;
  requirement?: string;
  present: boolean;
  notes?: string;
  details?: string;
  excerpt?: string;
}

export interface ComplianceData {
  summary?: string;
  compliance?: ComplianceItem[];
  confidence?: number;
  model?: string;
}

// =============================================================================
// Rates (dedicated rate cards / pricing schedules)
// =============================================================================

export interface RatesData {
  rateSchedule?: Array<{
    role?: string;
    title?: string;
    rate: number;
    currency?: string;
    unit?: string;
    effectiveDate?: string;
    expirationDate?: string;
  }>;
  pricingTiers?: Array<{
    tier: string;
    threshold?: number;
    rate: number;
  }>;
  discountSchedule?: Array<{
    condition: string;
    discount: number;
    type: 'percentage' | 'fixed';
  }>;
  summary?: string;
  confidence?: number;
  model?: string;
}

// =============================================================================
// Obligations (SLAs, deliverables, milestones)
// =============================================================================

export interface Obligation {
  id: string;
  title: string;
  party: string;
  type: 'deliverable' | 'sla' | 'milestone' | 'reporting' | 'compliance' | 'other';
  description: string;
  dueDate?: string;
  recurring?: { frequency: string; interval: number };
  status?: 'pending' | 'in-progress' | 'completed' | 'overdue';
  slaCriteria?: { metric: string; target: string | number; unit?: string };
  penalty?: string;
  sourceClause?: string;
  confidence?: number;
}

export interface ObligationsData {
  obligations: Obligation[];
  milestones?: Array<{
    id: string;
    name: string;
    date: string;
    deliverables: string[];
    status?: 'upcoming' | 'due' | 'completed' | 'missed';
  }>;
  slaMetrics?: Array<{
    metric: string;
    target: string | number;
    currentValue?: string | number;
    status?: 'met' | 'at-risk' | 'breached';
    penalty?: string;
  }>;
  summary?: string;
  confidence?: number;
  model?: string;
}

// =============================================================================
// Renewal (auto-renewal, termination, expiration)
// =============================================================================

export interface RenewalData {
  autoRenewal: boolean;
  renewalTerms?: {
    renewalPeriod: string;
    noticePeriodDays: number;
    optOutDeadline?: string;
  };
  terminationNotice?: {
    requiredDays: number;
    format?: string;
    recipientParty?: string;
  };
  priceEscalation?: Array<{
    type: string;
    percentage?: number;
    index?: string;
    cap?: number;
    effectiveDate?: string;
  }>;
  optOutDeadlines?: Array<{
    date: string;
    description: string;
    daysRemaining?: number;
  }>;
  renewalAlerts?: Array<{
    type: 'warning' | 'critical' | 'info';
    message: string;
    dueDate?: string;
  }>;
  currentTermEnd?: string;
  renewalCount?: number;
  summary?: string;
  confidence?: number;
  model?: string;
}

// =============================================================================
// Negotiation Points (leverage, weak clauses, benchmarks)
// =============================================================================

export interface NegotiationPointsData {
  leveragePoints?: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    strength: 'strong' | 'moderate' | 'weak';
    suggestedAction?: string;
    sourceClause?: string;
  }>;
  weakClauses?: Array<{
    id: string;
    clauseReference: string;
    issue: string;
    impact: 'high' | 'medium' | 'low';
    suggestedRevision?: string;
    benchmarkComparison?: string;
  }>;
  benchmarkGaps?: Array<{
    area: string;
    currentTerm: string;
    marketStandard: string;
    gap: string;
    recommendation: string;
  }>;
  negotiationScript?: Array<{
    topic: string;
    openingPosition: string;
    fallbackPosition: string;
    walkAwayPoint?: string;
    supportingEvidence?: string[];
  }>;
  summary?: string;
  overallLeverage?: 'strong' | 'balanced' | 'weak';
  confidence?: number;
  model?: string;
}

// =============================================================================
// Amendments (change history, modifications)
// =============================================================================

export interface AmendmentsData {
  amendments?: Array<{
    id: string;
    amendmentNumber: number;
    effectiveDate: string;
    title: string;
    description: string;
    changedClauses: Array<{
      clauseId: string;
      originalText?: string;
      newText: string;
      changeType: 'added' | 'modified' | 'deleted';
    }>;
    signedBy?: string[];
    sourceDocument?: string;
  }>;
  supersededClauses?: Array<{
    originalClause: string;
    supersededBy: string;
    effectiveDate: string;
  }>;
  changeLog?: Array<{
    date: string;
    type: string;
    description: string;
    reference?: string;
  }>;
  consolidatedTerms?: {
    lastUpdated: string;
    version: string;
    effectiveTerms: string[];
  };
  summary?: string;
  confidence?: number;
  model?: string;
}

// =============================================================================
// Contacts (key people, escalation paths)
// =============================================================================

export interface ContactsData {
  primaryContacts?: Array<{
    id: string;
    name: string;
    role: string;
    party: string;
    email?: string;
    phone?: string;
    address?: string;
    isPrimary?: boolean;
  }>;
  escalationPath?: Array<{
    level: number;
    role: string;
    name?: string;
    contactInfo?: string;
    escalationTrigger?: string;
  }>;
  notificationAddresses?: Array<{
    purpose: string;
    party: string;
    address: string;
    format?: string;
  }>;
  keyPersonnel?: Array<{
    name: string;
    role: string;
    responsibilities: string[];
    party: string;
  }>;
  summary?: string;
  confidence?: number;
  model?: string;
}

// =============================================================================
// Union types
// =============================================================================

export type ArtifactData =
  | OverviewData
  | ClausesData
  | FinancialData
  | RiskData
  | ComplianceData
  | RatesData
  | ObligationsData
  | RenewalData
  | NegotiationPointsData
  | AmendmentsData
  | ContactsData;

export interface Artifact {
  id?: string;
  type: ArtifactType;
  data: ArtifactData;
  confidence?: number;
  model?: string;
  isEdited?: boolean;
  editCount?: number;
  lastEditedAt?: string;
}

export interface Contract {
  id: string;
  name: string;
  status: string;
  supplier?: string;
  totalValue?: number;
  potentialSavings?: number;
  startDate?: string;
  endDate?: string;
}
