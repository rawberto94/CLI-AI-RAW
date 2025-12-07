/**
 * Contract Utilities
 * 
 * Helper functions for contract data formatting and manipulation
 */

import type { Contract, ContractStats, RiskLevel } from './types';
import { RISK_LEVELS } from './constants';

// ============================================================================
// FORMATTING
// ============================================================================

export const formatCurrency = (value?: number, currency = 'USD'): string => {
  if (value === undefined || value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatCurrencyCompact = (value?: number, currency = 'USD'): string => {
  if (value === undefined || value === null) return '—';
  
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return formatCurrency(value, currency);
};

export const formatDate = (dateString?: string): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatDateRelative = (dateString?: string): string => {
  if (!dateString) return '—';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays === 1) return 'Yesterday';
    if (absDays < 7) return `${absDays} days ago`;
    if (absDays < 30) return `${Math.floor(absDays / 7)} weeks ago`;
    if (absDays < 365) return `${Math.floor(absDays / 30)} months ago`;
    return `${Math.floor(absDays / 365)} years ago`;
  }
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 30) return `In ${Math.floor(diffDays / 7)} weeks`;
  if (diffDays < 365) return `In ${Math.floor(diffDays / 30)} months`;
  return `In ${Math.floor(diffDays / 365)} years`;
};

// ============================================================================
// RISK HELPERS
// ============================================================================

export const getRiskLevelFromScore = (score?: number): RiskLevel | undefined => {
  if (score === undefined || score === null) return undefined;
  if (score < 30) return 'low';
  if (score < 70) return 'medium';
  return 'high';
};

export const getRiskConfig = (score?: number) => {
  const level = getRiskLevelFromScore(score);
  if (!level) return undefined;
  return RISK_LEVELS.find(l => l.value === level);
};

export const getRiskColor = (score?: number): string => {
  const level = getRiskLevelFromScore(score);
  switch (level) {
    case 'low': return 'text-emerald-600';
    case 'medium': return 'text-amber-600';
    case 'high': return 'text-red-600';
    default: return 'text-slate-400';
  }
};

export const getRiskBgColor = (score?: number): string => {
  const level = getRiskLevelFromScore(score);
  switch (level) {
    case 'low': return 'bg-emerald-50';
    case 'medium': return 'bg-amber-50';
    case 'high': return 'bg-red-50';
    default: return 'bg-slate-50';
  }
};

// ============================================================================
// EXPIRATION HELPERS
// ============================================================================

export const getDaysUntilExpiration = (expirationDate?: string): number | null => {
  if (!expirationDate) return null;
  const expDate = new Date(expirationDate);
  const now = new Date();
  return Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export const isExpired = (expirationDate?: string): boolean => {
  const days = getDaysUntilExpiration(expirationDate);
  return days !== null && days < 0;
};

export const isExpiringSoon = (expirationDate?: string, daysThreshold = 30): boolean => {
  const days = getDaysUntilExpiration(expirationDate);
  return days !== null && days >= 0 && days <= daysThreshold;
};

export const getExpirationStatus = (expirationDate?: string): 'expired' | 'critical' | 'warning' | 'normal' | 'none' => {
  if (!expirationDate) return 'none';
  const days = getDaysUntilExpiration(expirationDate);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'warning';
  return 'normal';
};

// ============================================================================
// CONTRACT HELPERS
// ============================================================================

export const isNewContract = (createdAt?: string, daysThreshold = 7): boolean => {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);
  return created > cutoff;
};

export const getStatusConfig = (status: string) => {
  const configs: Record<string, { label: string; color: string; bgColor: string }> = {
    completed: { label: 'Active', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
    processing: { label: 'Processing', color: 'text-blue-700', bgColor: 'bg-blue-50' },
    failed: { label: 'Failed', color: 'text-red-700', bgColor: 'bg-red-50' },
    pending: { label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-50' },
    uploaded: { label: 'Uploaded', color: 'text-slate-700', bgColor: 'bg-slate-50' },
  };
  return configs[status] || { label: status, color: 'text-slate-700', bgColor: 'bg-slate-50' };
};

// ============================================================================
// STATS HELPERS
// ============================================================================

export const calculateContractStats = (contracts: Contract[]): ContractStats => {
  const total = contracts.length;
  const completed = contracts.filter(c => c.status === 'completed').length;
  const processing = contracts.filter(c => c.status === 'processing').length;
  const failed = contracts.filter(c => c.status === 'failed').length;
  const totalValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);
  const avgValue = total > 0 ? totalValue / total : 0;
  const highRiskCount = contracts.filter(c => (c.riskScore || 0) >= 70).length;
  const now = Date.now();
  const expiringCount = contracts.filter(c => {
    if (!c.expirationDate) return false;
    const days = (new Date(c.expirationDate).getTime() - now) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  }).length;
  const categorizedCount = contracts.filter(c => c.category).length;
  const uncategorizedCount = total - categorizedCount;
  
  return {
    total,
    completed,
    processing,
    failed,
    totalValue,
    avgValue,
    highRiskCount,
    expiringCount,
    categorizedCount,
    uncategorizedCount,
  };
};

// ============================================================================
// SEARCH HELPERS
// ============================================================================

export const normalizeSearchQuery = (query: string): string => {
  return query.toLowerCase().trim();
};

export const highlightMatch = (text: string, query: string): string => {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
};

// ============================================================================
// EXPORT HELPERS
// ============================================================================

export const contractToCSVRow = (contract: Contract): Record<string, string> => {
  return {
    id: contract.id,
    title: contract.title || '',
    status: contract.status,
    type: contract.type || '',
    client: contract.parties?.client || '',
    supplier: contract.parties?.supplier || '',
    value: contract.value?.toString() || '',
    effectiveDate: contract.effectiveDate || '',
    expirationDate: contract.expirationDate || '',
    riskScore: contract.riskScore?.toString() || '',
    category: contract.category?.name || '',
    createdAt: contract.createdAt || '',
  };
};

export const generateCSV = (contracts: Contract[]): string => {
  if (contracts.length === 0) return '';
  
  const headers = [
    'ID', 'Title', 'Status', 'Type', 'Client', 'Supplier', 
    'Value', 'Effective Date', 'Expiration Date', 'Risk Score', 
    'Category', 'Created At'
  ];
  
  const rows = contracts.map(c => {
    const row = contractToCSVRow(c);
    return Object.values(row).map(v => `"${v.replace(/"/g, '""')}"`).join(',');
  });
  
  return [headers.join(','), ...rows].join('\n');
};
