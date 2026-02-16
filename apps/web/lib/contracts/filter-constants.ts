import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock,
  FileText,
  Shield,
  TimerOff,
  XCircle,
  Zap,
} from "lucide-react";

// ============ SORT OPTIONS ============
export type SortField = 'title' | 'createdAt' | 'value' | 'expirationDate' | 'status';
export type SortDirection = 'asc' | 'desc';

export const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'title', label: 'Name' },
  { value: 'value', label: 'Value' },
  { value: 'expirationDate', label: 'Expiration' },
  { value: 'status', label: 'Status' },
];

// ============ FILTER CONFIGURATION ============
export const CONTRACT_TYPES = [
  "Service Agreement",
  "NDA",
  "Employment",
  "Lease",
  "Vendor Agreement",
  "Consulting",
  "License",
  "Partnership",
];

export const RISK_LEVELS = [
  { value: "low", label: "Low Risk", range: [0, 30] },
  { value: "medium", label: "Medium Risk", range: [30, 70] },
  { value: "high", label: "High Risk", range: [70, 100] },
];

// Approval statuses - Hidden for now, will be enabled in future
// export const APPROVAL_STATUSES = [
//   { value: "pending", label: "Pending Approval", icon: Clock, color: "text-amber-600" },
//   { value: "approved", label: "Approved", icon: CheckCircle, color: "text-green-600" },
//   { value: "rejected", label: "Rejected", icon: AlertTriangle, color: "text-red-600" },
//   { value: "none", label: "No Approval", icon: FileText, color: "text-slate-500" },
// ];

// Value range presets
export const VALUE_RANGES = [
  { value: 'under10k', label: 'Under $10K', min: 0, max: 10000 },
  { value: '10k-50k', label: '$10K - $50K', min: 10000, max: 50000 },
  { value: '50k-100k', label: '$50K - $100K', min: 50000, max: 100000 },
  { value: '100k-500k', label: '$100K - $500K', min: 100000, max: 500000 },
  { value: 'over500k', label: 'Over $500K', min: 500000, max: Infinity },
];

// Date range presets
export const DATE_PRESETS = [
  { value: 'today', label: 'Today', days: 0 },
  { value: 'week', label: 'This Week', days: 7 },
  { value: 'month', label: 'This Month', days: 30 },
  { value: 'quarter', label: 'This Quarter', days: 90 },
  { value: 'year', label: 'This Year', days: 365 },
];

// Expiration status options
export const EXPIRATION_FILTERS = [
  { value: 'expired', label: 'Expired', icon: TimerOff, color: 'text-red-600 dark:text-red-400' },
  { value: 'expiring-7', label: 'Expiring in 7 days', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
  { value: 'expiring-30', label: 'Expiring in 30 days', icon: CalendarClock, color: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'expiring-90', label: 'Expiring in 90 days', icon: Calendar, color: 'text-slate-600 dark:text-slate-400' },
  { value: 'no-expiry', label: 'No Expiration', icon: CircleDot, color: 'text-slate-500 dark:text-slate-400' },
];

// Signature status filter options
export const SIGNATURE_FILTERS = [
  { value: 'signed', label: 'Signed', icon: CheckCircle2, color: 'text-green-600 dark:text-green-400' },
  { value: 'partially_signed', label: 'Partially Signed', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
  { value: 'unsigned', label: 'Unsigned', icon: XCircle, color: 'text-red-600 dark:text-red-400' },
  { value: 'unknown', label: 'Unknown', icon: CircleDot, color: 'text-slate-500 dark:text-slate-400' },
];

// Document type filter options
export const DOCUMENT_TYPE_FILTERS = [
  { value: 'contract', label: 'Contract', icon: FileText, color: 'text-slate-700' },
  { value: 'purchase_order', label: 'Purchase Order', icon: FileText, color: 'text-orange-600 dark:text-orange-400' },
  { value: 'invoice', label: 'Invoice', icon: FileText, color: 'text-sky-600 dark:text-sky-400' },
  { value: 'quote', label: 'Quote', icon: FileText, color: 'text-teal-600 dark:text-teal-400' },
  { value: 'proposal', label: 'Proposal', icon: FileText, color: 'text-cyan-600 dark:text-cyan-400' },
  { value: 'amendment', label: 'Amendment', icon: FileText, color: 'text-slate-600 dark:text-slate-400' },
  { value: 'addendum', label: 'Addendum', icon: FileText, color: 'text-slate-600 dark:text-slate-400' },
];

// Pagination options
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Quick filter presets
export const QUICK_PRESETS: Array<{
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  filters: {
    minValue?: number;
    expirationDays?: number;
    status?: string;
    risk?: string;
    createdDays?: number;
    approval?: string;
  };
}> = [
  { id: 'high-value-expiring', label: 'High Value Expiring Soon', icon: Zap, color: 'text-amber-600 dark:text-amber-400',
    filters: { minValue: 100000, expirationDays: 30 } },
  { id: 'needs-attention', label: 'Needs Attention', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400',
    filters: { status: 'failed', risk: 'high' } },
  { id: 'recent-high-risk', label: 'Recent High Risk', icon: Shield, color: 'text-orange-600 dark:text-orange-400',
    filters: { createdDays: 30, risk: 'high' } },
  // Pending Approval - Hidden for now, will be enabled in future
  // { id: 'pending-approval', label: 'Pending Approval', icon: Clock, color: 'text-violet-600',
  //   filters: { approval: 'pending' } },
];

// ============ STABLE UTILITY FUNCTIONS ============
// Defined outside components to avoid re-creating references on every render
// (which would break memo() on child rows)

export function formatCurrency(value?: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(dateString?: string) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
