/**
 * Contract Types and Interfaces
 * 
 * Centralized type definitions for the contracts module
 */

import { LucideIcon } from "lucide-react";

// ============================================================================
// CORE TYPES
// ============================================================================

export interface ContractCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  path: string;
}

export interface ContractParties {
  client?: string;
  supplier?: string;
}

export interface ContractProcessing {
  progress: number;
  currentStage: string;
}

export interface Contract {
  id: string;
  title: string;
  filename?: string;
  originalName?: string;
  status: ContractStatus;
  parties?: ContractParties;
  value?: number;
  effectiveDate?: string;
  expirationDate?: string;
  riskScore?: number;
  uploadedAt?: string;
  createdAt?: string;
  error?: string;
  processing?: ContractProcessing;
  category?: ContractCategory | null;
  type?: string;
  approvalStatus?: ApprovalStatus;
  tags?: string[];
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export type ContractStatus = 'all' | 'completed' | 'processing' | 'failed' | 'pending' | 'uploaded';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'none';
export type RiskLevel = 'low' | 'medium' | 'high';
export type SortField = 'title' | 'createdAt' | 'value' | 'expirationDate' | 'status' | 'riskScore';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'compact' | 'cards' | 'timeline' | 'kanban';

export interface FilterState {
  searchQuery: string;
  status: ContractStatus;
  types: string[];
  riskLevels: RiskLevel[];
  approvalStatuses: ApprovalStatus[];
  valueRange: string | null;
  dateRange: string | null;
  expirationFilters: string[];
  categoryId: string | null;
  tags: string[];
}

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface AdvancedFilters {
  clientName?: string;
  supplierName?: string;
  minValue?: number;
  maxValue?: number;
  effectiveDateFrom?: string;
  effectiveDateTo?: string;
  expirationDateFrom?: string;
  expirationDateTo?: string;
  hasAttachments?: boolean;
  hasObligations?: boolean;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface RiskLevelConfig {
  value: RiskLevel;
  label: string;
  range: [number, number];
  color: string;
  bgColor: string;
}

export interface ApprovalStatusConfig {
  value: ApprovalStatus;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export interface ValueRangeConfig {
  value: string;
  label: string;
  min: number;
  max: number;
}

export interface DatePresetConfig {
  value: string;
  label: string;
  days: number;
}

export interface ExpirationFilterConfig {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

export interface QuickPresetConfig {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  color: string;
  filters: Partial<FilterState> & {
    minValue?: number;
    expirationDays?: number;
    createdDays?: number;
    risk?: RiskLevel;
    approval?: ApprovalStatus;
  };
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
}

// ============================================================================
// STATS TYPES
// ============================================================================

export interface ContractStats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  totalValue: number;
  avgValue: number;
  highRiskCount: number;
  expiringCount: number;
  categorizedCount: number;
  uncategorizedCount: number;
}

export interface FilteredStats {
  count: number;
  totalValue: number;
  avgValue: number;
  highRiskCount: number;
  expiringCount: number;
}

// ============================================================================
// ACTION TYPES
// ============================================================================

export type BulkAction = 'export' | 'analyze' | 'share' | 'delete' | 'categorize' | 'approve';

export interface BulkActionResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
}
