// Compliance Engine Data Models
export interface CompliancePolicy {
  id: string;
  tenantId: string;
  clauseType: 'liability' | 'ip' | 'termination' | 'confidentiality' | 'gdpr' | 'audit' | 'esg';
  requirement: 'must' | 'should' | 'can';
  weight: number; // 0-1
  template: string;
  validationRules: ValidationRule[];
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationRule {
  id: string;
  type: 'presence' | 'content' | 'value' | 'pattern';
  condition: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  parameters?: Record<string, any>;
}

export interface ComplianceResult {
  contractId: string;
  tenantId: string;
  overallScore: number; // 0-100
  clauseResults: ClauseResult[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  assessedAt: Date;
  assessedBy: string; // system or user ID
}

export interface ClauseResult {
  clauseType: string;
  status: 'present' | 'weak' | 'missing';
  score: number; // 0-100
  weight: number;
  findings: string[];
  recommendations: string[];
  extractedText?: string;
  confidence: number; // 0-1
  template?: string;
}

export interface ComplianceFilters {
  tenantId: string;
  supplierId?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  clauseType?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  minScore?: number;
  maxScore?: number;
}

export interface ComplianceReport {
  tenantId: string;
  generatedAt: Date;
  filters: ComplianceFilters;
  summary: {
    totalContracts: number;
    averageScore: number;
    riskDistribution: Record<string, number>;
    clauseTypeDistribution: Record<string, {
      present: number;
      weak: number;
      missing: number;
    }>;
  };
  details: ComplianceResult[];
  trends: Array<{
    period: string;
    averageScore: number;
    contractCount: number;
  }>;
  topIssues: Array<{
    issue: string;
    frequency: number;
    impact: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export interface RemediationPlan {
  contractId: string;
  priority: 'high' | 'medium' | 'low';
  estimatedEffort: number; // hours
  potentialRiskReduction: number; // percentage
  actions: RemediationAction[];
  timeline: number; // days
  cost?: number;
  assignedTo?: string;
}

export interface RemediationAction {
  id: string;
  clauseType: string;
  action: 'add' | 'modify' | 'strengthen' | 'remove';
  description: string;
  template: string;
  effort: 'low' | 'medium' | 'high';
  priority: number; // 1-5
  dependencies?: string[]; // other action IDs
  riskReduction: number; // percentage
}

export interface ClauseScanResult {
  success: boolean;
  contractId: string;
  scannedClauses: ScannedClause[];
  errors: string[];
  warnings: string[];
  confidence: number;
  processingTime: number; // milliseconds
}

export interface ScannedClause {
  type: string;
  text: string;
  location: {
    page?: number;
    section?: string;
    paragraph?: number;
  };
  confidence: number;
  strength: 'strong' | 'moderate' | 'weak';
  deviations: string[];
  suggestions: string[];
}

export interface PolicyTemplate {
  id: string;
  name: string;
  clauseType: string;
  template: string;
  variables: Array<{
    name: string;
    type: 'text' | 'number' | 'date' | 'select';
    required: boolean;
    options?: string[];
  }>;
  version: string;
  isDefault: boolean;
}