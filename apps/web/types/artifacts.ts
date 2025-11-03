/**
 * Artifact Type Definitions
 * Provides strong typing for contract artifacts across the application
 */

export type ArtifactType = 'overview' | 'clauses' | 'financial' | 'risk' | 'compliance';

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

export interface Artifact {
  id?: string;  // Optional database ID
  type: ArtifactType;
  data: OverviewData | ClausesData | FinancialData | RiskData | ComplianceData;
  confidence?: number;
  model?: string;
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
