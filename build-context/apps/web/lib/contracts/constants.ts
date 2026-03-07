/**
 * Contract Filter Constants
 * 
 * Centralized configuration for all contract filtering options
 */

import {
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  TimerOff,
  CalendarClock,
  Calendar,
  CircleDot,
  Zap,
  Shield,
  TrendingUp,
  Target,
  Bell,
  FileCheck,
  Scale,
} from "lucide-react";
import type {
  RiskLevelConfig,
  ApprovalStatusConfig,
  ValueRangeConfig,
  DatePresetConfig,
  ExpirationFilterConfig,
  QuickPresetConfig,
  SortField,
  RiskLevel,
  ApprovalStatus,
  FilterState,
} from "./types";

// ============================================================================
// CONTRACT STATUS
// ============================================================================

export const CONTRACT_STATUSES = [
  { value: 'all', label: 'All Contracts', color: 'text-slate-600', bgColor: 'bg-slate-100' },
  { value: 'completed', label: 'Active', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  { value: 'processing', label: 'Processing', color: 'text-violet-700', bgColor: 'bg-violet-50' },
  { value: 'failed', label: 'Failed', color: 'text-red-700', bgColor: 'bg-red-50' },
  { value: 'pending', label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-50' },
] as const;

// ============================================================================
// CONTRACT TYPES
// ============================================================================

export const CONTRACT_TYPES = [
  "Service Agreement",
  "Master Services Agreement",
  "Statement of Work",
  "NDA",
  "Non-Disclosure Agreement",
  "Employment Contract",
  "Lease Agreement",
  "Vendor Agreement",
  "Consulting Agreement",
  "License Agreement",
  "Partnership Agreement",
  "Purchase Agreement",
  "Subscription Agreement",
  "SaaS Agreement",
  "Maintenance Agreement",
  "Supply Agreement",
] as const;

// ============================================================================
// RISK LEVELS
// ============================================================================

export const RISK_LEVELS: RiskLevelConfig[] = [
  { value: "low", label: "Low Risk", range: [0, 30], color: "text-emerald-600", bgColor: "bg-emerald-50" },
  { value: "medium", label: "Medium Risk", range: [30, 70], color: "text-amber-600", bgColor: "bg-amber-50" },
  { value: "high", label: "High Risk", range: [70, 100], color: "text-red-600", bgColor: "bg-red-50" },
];

export const getRiskLevel = (score?: number): RiskLevelConfig | undefined => {
  if (score === undefined || score === null) return undefined;
  return RISK_LEVELS.find(level => score >= level.range[0] && score < level.range[1]);
};

// ============================================================================
// APPROVAL STATUSES
// ============================================================================

export const APPROVAL_STATUSES: ApprovalStatusConfig[] = [
  { value: "pending", label: "Pending Approval", icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50" },
  { value: "approved", label: "Approved", icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-50" },
  { value: "rejected", label: "Rejected", icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-50" },
  { value: "none", label: "No Approval", icon: FileText, color: "text-slate-500", bgColor: "bg-slate-50" },
];

// ============================================================================
// VALUE RANGES
// ============================================================================

export const VALUE_RANGES: ValueRangeConfig[] = [
  { value: 'under10k', label: 'Under $10K', min: 0, max: 10000 },
  { value: '10k-50k', label: '$10K - $50K', min: 10000, max: 50000 },
  { value: '50k-100k', label: '$50K - $100K', min: 50000, max: 100000 },
  { value: '100k-500k', label: '$100K - $500K', min: 100000, max: 500000 },
  { value: '500k-1m', label: '$500K - $1M', min: 500000, max: 1000000 },
  { value: 'over1m', label: 'Over $1M', min: 1000000, max: Infinity },
];

export const getValueRange = (value: string): ValueRangeConfig | undefined => {
  return VALUE_RANGES.find(range => range.value === value);
};

// ============================================================================
// DATE PRESETS
// ============================================================================

export const DATE_PRESETS: DatePresetConfig[] = [
  { value: 'today', label: 'Today', days: 1 },
  { value: 'week', label: 'This Week', days: 7 },
  { value: 'month', label: 'This Month', days: 30 },
  { value: 'quarter', label: 'This Quarter', days: 90 },
  { value: 'half-year', label: 'Last 6 Months', days: 180 },
  { value: 'year', label: 'This Year', days: 365 },
];

// ============================================================================
// EXPIRATION FILTERS
// ============================================================================

export const EXPIRATION_FILTERS: ExpirationFilterConfig[] = [
  { value: 'expired', label: 'Expired', icon: TimerOff, color: 'text-red-600' },
  { value: 'expiring-7', label: 'Expiring in 7 days', icon: AlertTriangle, color: 'text-amber-600' },
  { value: 'expiring-30', label: 'Expiring in 30 days', icon: CalendarClock, color: 'text-yellow-600' },
  { value: 'expiring-90', label: 'Expiring in 90 days', icon: Calendar, color: 'text-violet-600' },
  { value: 'expiring-year', label: 'Expiring in 1 year', icon: Calendar, color: 'text-slate-600' },
  { value: 'no-expiry', label: 'No Expiration', icon: CircleDot, color: 'text-slate-500' },
];

// ============================================================================
// SORT OPTIONS
// ============================================================================

export const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'title', label: 'Name' },
  { value: 'value', label: 'Value' },
  { value: 'expirationDate', label: 'Expiration Date' },
  { value: 'status', label: 'Status' },
  { value: 'riskScore', label: 'Risk Score' },
];

// ============================================================================
// QUICK PRESETS
// ============================================================================

export const QUICK_PRESETS: QuickPresetConfig[] = [
  { 
    id: 'high-value-expiring', 
    label: 'High Value Expiring', 
    description: 'Contracts over $100K expiring in 30 days',
    icon: Zap, 
    color: 'text-amber-600',
    filters: { minValue: 100000, expirationDays: 30 } 
  },
  { 
    id: 'needs-attention', 
    label: 'Needs Attention', 
    description: 'Failed or high-risk contracts',
    icon: AlertTriangle, 
    color: 'text-red-600',
    filters: { status: 'failed', risk: 'high' } 
  },
  { 
    id: 'recent-high-risk', 
    label: 'Recent High Risk', 
    description: 'High-risk contracts from last 30 days',
    icon: Shield, 
    color: 'text-orange-600',
    filters: { createdDays: 30, risk: 'high' } 
  },
  { 
    id: 'pending-approval', 
    label: 'Pending Approval', 
    description: 'Contracts awaiting approval',
    icon: Clock, 
    color: 'text-violet-600',
    filters: { approval: 'pending' } 
  },
  { 
    id: 'expiring-soon', 
    label: 'Expiring Soon', 
    description: 'Contracts expiring in 30 days',
    icon: Bell, 
    color: 'text-purple-600',
    filters: { expirationDays: 30 } 
  },
  { 
    id: 'uncategorized', 
    label: 'Uncategorized', 
    description: 'Contracts without a category',
    icon: Target, 
    color: 'text-slate-600',
    filters: { categoryId: 'uncategorized' } 
  },
];

// ============================================================================
// PAGINATION
// ============================================================================

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

// ============================================================================
// DEFAULT FILTER STATE
// ============================================================================

export const DEFAULT_FILTER_STATE: FilterState = {
  searchQuery: '',
  status: 'all',
  types: [],
  riskLevels: [] as RiskLevel[],
  approvalStatuses: [] as ApprovalStatus[],
  valueRange: null,
  dateRange: null,
  expirationFilters: [],
  categoryId: null,
  tags: [],
};

export const DEFAULT_SORT_STATE = {
  field: 'createdAt' as SortField,
  direction: 'desc' as const,
};
