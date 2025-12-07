/**
 * Contract Filters Hook
 * 
 * Centralizes all filter state management for the contracts page.
 * Provides filter state, actions, and computed values.
 */

import { useState, useMemo, useCallback } from 'react';
import type { Contract } from './use-queries';

// ============================================================================
// Filter Constants
// ============================================================================

export const RISK_LEVELS = [
  { value: "low", label: "Low Risk", range: [0, 30] as [number, number] },
  { value: "medium", label: "Medium Risk", range: [30, 70] as [number, number] },
  { value: "high", label: "High Risk", range: [70, 100] as [number, number] },
];

export const VALUE_RANGES = [
  { value: 'under10k', label: 'Under $10K', min: 0, max: 10000 },
  { value: '10k-50k', label: '$10K - $50K', min: 10000, max: 50000 },
  { value: '50k-100k', label: '$50K - $100K', min: 50000, max: 100000 },
  { value: '100k-500k', label: '$100K - $500K', min: 100000, max: 500000 },
  { value: 'over500k', label: 'Over $500K', min: 500000, max: Infinity },
];

export const DATE_PRESETS = [
  { value: 'today', label: 'Today', days: 0 },
  { value: 'week', label: 'This Week', days: 7 },
  { value: 'month', label: 'This Month', days: 30 },
  { value: 'quarter', label: 'This Quarter', days: 90 },
  { value: 'year', label: 'This Year', days: 365 },
];

export const CONTRACT_TYPES = [
  "Service Agreement",
  "Master Services Agreement", 
  "Statement of Work",
  "License Agreement",
  "Non-Disclosure Agreement",
  "Employment Contract",
  "Consulting Agreement",
  "Purchase Agreement",
  "Lease Agreement",
  "Partnership",
];

// ============================================================================
// Types
// ============================================================================

export interface AdvancedFilters {
  clientName?: string;
  supplierName?: string;
  minValue?: number;
  maxValue?: number;
}

export interface FilterState {
  searchQuery: string;
  statusFilter: string;
  typeFilters: string[];
  riskFilters: string[];
  approvalFilters: string[];
  valueRangeFilter: string | null;
  dateRangeFilter: string | null;
  expirationFilters: string[];
  categoryFilter: string | null;
  advancedFilters: AdvancedFilters;
  activePreset: string | null;
}

export interface FilterActions {
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: string) => void;
  setTypeFilters: (filters: string[] | ((prev: string[]) => string[])) => void;
  setRiskFilters: (filters: string[] | ((prev: string[]) => string[])) => void;
  setApprovalFilters: (filters: string[] | ((prev: string[]) => string[])) => void;
  setValueRangeFilter: (filter: string | null) => void;
  setDateRangeFilter: (filter: string | null) => void;
  setExpirationFilters: (filters: string[] | ((prev: string[]) => string[])) => void;
  setCategoryFilter: (filter: string | null) => void;
  setAdvancedFilters: (filters: AdvancedFilters | ((prev: AdvancedFilters) => AdvancedFilters)) => void;
  setActivePreset: (preset: string | null) => void;
  clearAllFilters: () => void;
  applyPreset: (presetId: string) => void;
}

export interface FilterStats {
  hasActiveFilters: boolean;
  activeFilterCount: number;
  filteredCount: number;
  totalValue: number;
  avgValue: number;
  highRiskCount: number;
  expiringCount: number;
  uncategorizedCount: number;
  categorizedCount: number;
}

export interface UseContractFiltersResult {
  state: FilterState;
  actions: FilterActions;
  stats: FilterStats;
  filteredContracts: Contract[];
}

// Alias for backward compatibility
export type ContractFilters = Partial<FilterState>;

// ============================================================================
// Quick Filter Presets
// ============================================================================

export interface QuickPreset {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  category?: 'risk' | 'time' | 'status' | 'value' | 'compliance' | 'workflow';
  filters: {
    status?: string;
    risk?: string;
    approval?: string;
    minValue?: number;
    maxValue?: number;
    createdDays?: number;
    expirationDays?: number;
    types?: string[];
    categories?: string[];
    hasArtifacts?: boolean;
    isCategorized?: boolean;
  };
}

export const QUICK_PRESETS: QuickPreset[] = [
  // ===== Risk Presets =====
  { 
    id: 'high-risk', 
    label: 'High Risk', 
    description: 'Contracts with risk score above 70%',
    icon: '🔴',
    category: 'risk',
    filters: { risk: 'high' } 
  },
  { 
    id: 'high-value-high-risk', 
    label: 'High Value & High Risk', 
    description: 'Large contracts with elevated risk',
    icon: '⚠️',
    category: 'risk',
    filters: { minValue: 100000, risk: 'high' } 
  },
  { 
    id: 'needs-attention', 
    label: 'Needs Attention', 
    description: 'Failed or high-risk contracts',
    icon: '🚨',
    category: 'risk',
    filters: { status: 'failed', risk: 'high' } 
  },
  { 
    id: 'medium-risk-review', 
    label: 'Medium Risk for Review', 
    description: 'Contracts that may need review',
    icon: '🟡',
    category: 'risk',
    filters: { risk: 'medium' } 
  },

  // ===== Time-based Presets =====
  { 
    id: 'expiring-soon', 
    label: 'Expiring Soon', 
    description: 'Expiring within 30 days',
    icon: '⏰',
    category: 'time',
    filters: { expirationDays: 30 } 
  },
  { 
    id: 'expiring-this-quarter', 
    label: 'Expiring This Quarter', 
    description: 'Expiring within 90 days',
    icon: '📅',
    category: 'time',
    filters: { expirationDays: 90 } 
  },
  { 
    id: 'high-value-expiring', 
    label: 'High Value Expiring Soon', 
    description: 'Large contracts expiring within 30 days',
    icon: '💰⏰',
    category: 'time',
    filters: { minValue: 100000, expirationDays: 30 } 
  },
  { 
    id: 'recent-high-risk', 
    label: 'Recently Created High Risk', 
    description: 'New contracts with high risk',
    icon: '🆕🔴',
    category: 'time',
    filters: { createdDays: 30, risk: 'high' } 
  },
  { 
    id: 'recently-updated', 
    label: 'Recently Updated', 
    description: 'Modified in the last 7 days',
    icon: '✏️',
    category: 'time',
    filters: { createdDays: 7 } 
  },
  { 
    id: 'renewal-needed', 
    label: 'Renewal Needed', 
    description: 'Active contracts expiring in 60 days',
    icon: '🔄',
    category: 'time',
    filters: { status: 'active', expirationDays: 60 } 
  },

  // ===== Status Presets =====
  { 
    id: 'active-only', 
    label: 'Active Only', 
    description: 'Currently active contracts',
    icon: '✅',
    category: 'status',
    filters: { status: 'active' } 
  },
  { 
    id: 'pending-approval', 
    label: 'Pending Approval', 
    description: 'Awaiting approval',
    icon: '⏳',
    category: 'status',
    filters: { approval: 'pending' } 
  },
  { 
    id: 'draft-contracts', 
    label: 'Drafts', 
    description: 'Draft contracts not yet active',
    icon: '📝',
    category: 'status',
    filters: { status: 'draft' } 
  },
  { 
    id: 'expired', 
    label: 'Expired', 
    description: 'Contracts that have expired',
    icon: '❌',
    category: 'status',
    filters: { status: 'expired' } 
  },
  { 
    id: 'processing', 
    label: 'Processing', 
    description: 'Currently being processed',
    icon: '⚙️',
    category: 'status',
    filters: { status: 'processing' } 
  },

  // ===== Value Presets =====
  { 
    id: 'high-value', 
    label: 'High Value', 
    description: 'Contracts over $100K',
    icon: '💎',
    category: 'value',
    filters: { minValue: 100000 } 
  },
  { 
    id: 'enterprise', 
    label: 'Enterprise', 
    description: 'Contracts over $500K',
    icon: '🏢',
    category: 'value',
    filters: { minValue: 500000 } 
  },
  { 
    id: 'small-contracts', 
    label: 'Small Contracts', 
    description: 'Under $10K',
    icon: '📄',
    category: 'value',
    filters: { maxValue: 10000 } 
  },
  { 
    id: 'mid-value', 
    label: 'Mid-Range Value', 
    description: '$50K - $100K',
    icon: '💵',
    category: 'value',
    filters: { minValue: 50000, maxValue: 100000 } 
  },

  // ===== Compliance & Governance Presets =====
  { 
    id: 'compliance-due', 
    label: 'Compliance Review Due', 
    description: 'Active high-value contracts for compliance check',
    icon: '📋',
    category: 'compliance',
    filters: { status: 'active', minValue: 50000 } 
  },
  { 
    id: 'missing-artifacts', 
    label: 'Missing AI Artifacts', 
    description: 'Contracts without AI analysis',
    icon: '🤖❌',
    category: 'compliance',
    filters: { hasArtifacts: false } 
  },
  { 
    id: 'uncategorized', 
    label: 'Uncategorized', 
    description: 'Contracts without categories',
    icon: '🏷️❌',
    category: 'compliance',
    filters: { isCategorized: false } 
  },
  { 
    id: 'nda-review', 
    label: 'NDA Review', 
    description: 'Non-Disclosure Agreements for review',
    icon: '🔒',
    category: 'compliance',
    filters: { types: ['Non-Disclosure Agreement'] } 
  },

  // ===== Workflow Presets =====
  { 
    id: 'my-approvals', 
    label: 'My Pending Approvals', 
    description: 'Contracts awaiting your approval',
    icon: '👤⏳',
    category: 'workflow',
    filters: { approval: 'pending' } 
  },
  { 
    id: 'ready-for-review', 
    label: 'Ready for Review', 
    description: 'Completed processing, ready to review',
    icon: '👁️',
    category: 'workflow',
    filters: { status: 'processed' } 
  },
  { 
    id: 'action-required', 
    label: 'Action Required', 
    description: 'Needs immediate attention',
    icon: '❗',
    category: 'workflow',
    filters: { approval: 'pending', expirationDays: 14 } 
  },
  { 
    id: 'service-agreements', 
    label: 'Service Agreements', 
    description: 'All service-related contracts',
    icon: '🛠️',
    category: 'workflow',
    filters: { types: ['Service Agreement', 'Master Services Agreement'] } 
  },
];

// ============================================================================
// Preset Helpers
// ============================================================================

export type PresetCategory = 'risk' | 'time' | 'status' | 'value' | 'compliance' | 'workflow';

export const PRESET_CATEGORIES: { id: PresetCategory; label: string; icon: string }[] = [
  { id: 'risk', label: 'Risk', icon: '⚠️' },
  { id: 'time', label: 'Time-based', icon: '⏰' },
  { id: 'status', label: 'Status', icon: '📊' },
  { id: 'value', label: 'Value', icon: '💰' },
  { id: 'compliance', label: 'Compliance', icon: '📋' },
  { id: 'workflow', label: 'Workflow', icon: '🔄' },
];

export function getPresetsByCategory(category: PresetCategory): QuickPreset[] {
  return QUICK_PRESETS.filter(p => p.category === category);
}

export function getGroupedPresets(): Record<PresetCategory, QuickPreset[]> {
  return QUICK_PRESETS.reduce((acc, preset) => {
    const category = preset.category || 'workflow';
    if (!acc[category]) acc[category] = [];
    acc[category].push(preset);
    return acc;
  }, {} as Record<PresetCategory, QuickPreset[]>);
}

export function getPresetById(id: string): QuickPreset | undefined {
  return QUICK_PRESETS.find(p => p.id === id);
}

export function getFavoritePresets(favoriteIds: string[]): QuickPreset[] {
  return favoriteIds
    .map(id => getPresetById(id))
    .filter((p): p is QuickPreset => p !== undefined);
}

// Default favorites for new users
export const DEFAULT_FAVORITE_PRESETS = [
  'expiring-soon',
  'high-risk',
  'pending-approval',
  'uncategorized',
];

// ============================================================================
// Initial State
// ============================================================================

const initialState: FilterState = {
  searchQuery: '',
  statusFilter: 'all',
  typeFilters: [],
  riskFilters: [],
  approvalFilters: [],
  valueRangeFilter: null,
  dateRangeFilter: null,
  expirationFilters: [],
  categoryFilter: null,
  advancedFilters: {},
  activePreset: null,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useContractFilters(contracts: Contract[]): UseContractFiltersResult {
  // State
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery);
  const [statusFilter, setStatusFilter] = useState(initialState.statusFilter);
  const [typeFilters, setTypeFilters] = useState<string[]>(initialState.typeFilters);
  const [riskFilters, setRiskFilters] = useState<string[]>(initialState.riskFilters);
  const [approvalFilters, setApprovalFilters] = useState<string[]>(initialState.approvalFilters);
  const [valueRangeFilter, setValueRangeFilter] = useState<string | null>(initialState.valueRangeFilter);
  const [dateRangeFilter, setDateRangeFilter] = useState<string | null>(initialState.dateRangeFilter);
  const [expirationFilters, setExpirationFilters] = useState<string[]>(initialState.expirationFilters);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(initialState.categoryFilter);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(initialState.advancedFilters);
  const [activePreset, setActivePreset] = useState<string | null>(initialState.activePreset);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilters([]);
    setRiskFilters([]);
    setApprovalFilters([]);
    setValueRangeFilter(null);
    setDateRangeFilter(null);
    setExpirationFilters([]);
    setCategoryFilter(null);
    setAdvancedFilters({});
    setActivePreset(null);
  }, []);

  // Apply preset
  const applyPreset = useCallback((presetId: string) => {
    clearAllFilters();
    setActivePreset(presetId);
    
    const preset = QUICK_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    if ('status' in preset.filters && preset.filters.status) {
      setStatusFilter(preset.filters.status);
    }
    if ('risk' in preset.filters && preset.filters.risk) {
      setRiskFilters([preset.filters.risk]);
    }
    if ('approval' in preset.filters && preset.filters.approval) {
      setApprovalFilters([preset.filters.approval]);
    }
    if ('minValue' in preset.filters && preset.filters.minValue) {
      const range = VALUE_RANGES.find(r => r.min >= (preset.filters.minValue || 0));
      if (range) setValueRangeFilter(range.value);
    }
    if ('createdDays' in preset.filters && preset.filters.createdDays) {
      const datePreset = DATE_PRESETS.find(p => p.days <= (preset.filters.createdDays || 30));
      if (datePreset) setDateRangeFilter(datePreset.value);
    }
    if ('expirationDays' in preset.filters && preset.filters.expirationDays) {
      setExpirationFilters(['expiring-30']);
    }
  }, [clearAllFilters]);

  // Check if filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery !== '' ||
      statusFilter !== 'all' ||
      typeFilters.length > 0 ||
      riskFilters.length > 0 ||
      approvalFilters.length > 0 ||
      valueRangeFilter !== null ||
      dateRangeFilter !== null ||
      expirationFilters.length > 0 ||
      categoryFilter !== null ||
      Object.keys(advancedFilters).length > 0 ||
      activePreset !== null
    );
  }, [
    searchQuery, statusFilter, typeFilters, riskFilters, approvalFilters,
    valueRangeFilter, dateRangeFilter, expirationFilters, categoryFilter,
    advancedFilters, activePreset
  ]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return [
      searchQuery ? 1 : 0,
      statusFilter !== 'all' ? 1 : 0,
      typeFilters.length,
      riskFilters.length,
      approvalFilters.length,
      valueRangeFilter ? 1 : 0,
      dateRangeFilter ? 1 : 0,
      expirationFilters.length,
      categoryFilter ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
  }, [
    searchQuery, statusFilter, typeFilters, riskFilters, approvalFilters,
    valueRangeFilter, dateRangeFilter, expirationFilters, categoryFilter
  ]);

  // Filter contracts
  const filteredContracts = useMemo(() => {
    if (!Array.isArray(contracts)) return [];

    const now = new Date();
    const query = searchQuery.toLowerCase();

    return contracts.filter((contract) => {
      // Search filter
      const matchesSearch = !searchQuery || 
        contract.title?.toLowerCase().includes(query) ||
        contract.id?.toLowerCase().includes(query) ||
        contract.parties?.client?.toLowerCase().includes(query) ||
        contract.parties?.supplier?.toLowerCase().includes(query) ||
        contract.type?.toLowerCase().includes(query);

      // Status filter
      const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;

      // Type filter
      const matchesType = typeFilters.length === 0 || 
        (contract.type && typeFilters.includes(contract.type));

      // Risk filter
      const matchesRisk = riskFilters.length === 0 || riskFilters.some(risk => {
        const level = RISK_LEVELS.find(l => l.value === risk);
        if (!level?.range || contract.riskScore === undefined) return false;
        return contract.riskScore >= (level.range[0] ?? 0) && contract.riskScore < (level.range[1] ?? 100);
      });

      // Approval filter
      const matchesApproval = approvalFilters.length === 0 || approvalFilters.some(approval => {
        const contractApprovalStatus = (contract as any).approvalStatus || 'none';
        return contractApprovalStatus === approval;
      });

      // Value range filter
      const matchesValueRange = !valueRangeFilter || (() => {
        const range = VALUE_RANGES.find(r => r.value === valueRangeFilter);
        if (!range || !contract.value) return false;
        return contract.value >= range.min && contract.value < range.max;
      })();

      // Date range filter
      const matchesDateRange = !dateRangeFilter || (() => {
        const preset = DATE_PRESETS.find(p => p.value === dateRangeFilter);
        if (!preset || !contract.createdAt) return false;
        const createdDate = new Date(contract.createdAt);
        const cutoffDate = new Date(now.getTime() - preset.days * 24 * 60 * 60 * 1000);
        return createdDate >= cutoffDate;
      })();

      // Expiration filter
      const matchesExpiration = expirationFilters.length === 0 || expirationFilters.some(exp => {
        if (!contract.expirationDate && exp === 'no-expiry') return true;
        if (!contract.expirationDate) return false;

        const expirationDate = new Date(contract.expirationDate);
        const daysUntilExpiry = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        switch (exp) {
          case 'expired': return daysUntilExpiry < 0;
          case 'expiring-7': return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
          case 'expiring-30': return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
          case 'expiring-90': return daysUntilExpiry >= 0 && daysUntilExpiry <= 90;
          default: return true;
        }
      });

      // Category filter
      const matchesCategory = !categoryFilter || 
        (categoryFilter === 'uncategorized' ? !contract.category : contract.category?.id === categoryFilter);

      // Advanced filters
      const matchesAdvanced = 
        (!advancedFilters.clientName || contract.parties?.client?.toLowerCase().includes(advancedFilters.clientName.toLowerCase())) &&
        (!advancedFilters.supplierName || contract.parties?.supplier?.toLowerCase().includes(advancedFilters.supplierName.toLowerCase())) &&
        (!advancedFilters.minValue || (contract.value && contract.value >= advancedFilters.minValue)) &&
        (!advancedFilters.maxValue || (contract.value && contract.value <= advancedFilters.maxValue));

      return matchesSearch && matchesStatus && matchesType && matchesRisk && 
             matchesApproval && matchesValueRange && matchesDateRange && 
             matchesExpiration && matchesCategory && matchesAdvanced;
    });
  }, [
    contracts, searchQuery, statusFilter, typeFilters, riskFilters,
    approvalFilters, valueRangeFilter, dateRangeFilter, expirationFilters,
    categoryFilter, advancedFilters
  ]);

  // Compute stats
  const stats = useMemo(() => {
    const now = new Date();
    const totalValue = filteredContracts.reduce((sum, c) => sum + (c.value || 0), 0);
    const highRiskCount = filteredContracts.filter(c => (c.riskScore || 0) >= 70).length;
    const expiringCount = filteredContracts.filter(c => {
      if (!c.expirationDate) return false;
      const daysUntil = Math.ceil((new Date(c.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 30;
    }).length;
    const uncategorizedCount = contracts.filter(c => !c.category).length;
    const categorizedCount = contracts.length - uncategorizedCount;

    return {
      hasActiveFilters,
      activeFilterCount,
      filteredCount: filteredContracts.length,
      totalValue,
      avgValue: filteredContracts.length > 0 ? totalValue / filteredContracts.length : 0,
      highRiskCount,
      expiringCount,
      uncategorizedCount,
      categorizedCount,
    };
  }, [filteredContracts, contracts, hasActiveFilters, activeFilterCount]);

  // Compile state
  const state: FilterState = {
    searchQuery,
    statusFilter,
    typeFilters,
    riskFilters,
    approvalFilters,
    valueRangeFilter,
    dateRangeFilter,
    expirationFilters,
    categoryFilter,
    advancedFilters,
    activePreset,
  };

  // Compile actions
  const actions: FilterActions = {
    setSearchQuery,
    setStatusFilter,
    setTypeFilters,
    setRiskFilters,
    setApprovalFilters,
    setValueRangeFilter,
    setDateRangeFilter,
    setExpirationFilters,
    setCategoryFilter,
    setAdvancedFilters,
    setActivePreset,
    clearAllFilters,
    applyPreset,
  };

  return {
    state,
    actions,
    stats,
    filteredContracts,
  };
}

export default useContractFilters;
