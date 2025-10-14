// Renewal Radar Data Models
export interface RenewalData {
  contractId: string;
  startDate: Date;
  endDate: Date;
  renewalType: 'manual' | 'auto' | 'evergreen';
  noticePeriod: number; // days
  autoRenewalClause: string;
  riskLevel: 'low' | 'medium' | 'high';
  supplier: string;
  contractValue: number;
  category: string;
}

export interface RenewalFilters {
  tenantId: string;
  supplierId?: string;
  category?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  daysUntilExpiry?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface RenewalCalendar {
  renewals: Array<{
    contractId: string;
    contractName: string;
    supplier: string;
    expiryDate: Date;
    riskLevel: string;
    daysUntilExpiry: number;
    contractValue: number;
    category: string;
    renewalType: string;
    noticePeriod: number;
  }>;
  summary: {
    totalRenewals: number;
    highRiskRenewals: number;
    totalValue: number;
    averageDaysToExpiry: number;
  };
}

export interface RfxEvent {
  id: string;
  contractId: string;
  eventType: 'renewal' | 'renegotiation';
  scheduledDate: Date;
  status: 'scheduled' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedValue: number;
  category: string;
}

export interface RenewalAlert {
  id: string;
  contractId: string;
  alertType: 'renewal' | 'termination' | 'renegotiation';
  dueDate: Date;
  daysUntilDue: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'acknowledged' | 'actioned' | 'dismissed';
  supplier: string;
  contractValue: number;
  message: string;
  recommendations: string[];
}

export interface ContractExtractionResult {
  success: boolean;
  renewalData?: RenewalData;
  errors: string[];
  warnings: string[];
  confidence: number;
}