'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  UserPlus,
  Calendar,
  FileText,
  MessageSquare,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  User,
  Building2,
  DollarSign,
  TrendingUp,
  Download,
  MoreHorizontal,
  Eye,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Framer Motion typing workaround
const MotionDiv = motion.div as unknown as React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & {
    initial?: object;
    animate?: object;
    exit?: object;
    transition?: object;
    className?: string;
  }
>;

interface HistoryEntry {
  id: string;
  contractId: string;
  contractName: string;
  type: 'contract' | 'amendment' | 'renewal' | 'termination';
  action: 'approved' | 'rejected' | 'escalated' | 'delegated' | 'created' | 'comment';
  actor: {
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
  timestamp: string;
  stepName?: string;
  comment?: string;
  metadata?: {
    value?: number;
    supplier?: string;
    previousAssignee?: string;
    newAssignee?: string;
    reason?: string;
  };
}

interface ApprovalHistoryProps {
  contractId?: string;
  limit?: number;
  showFilters?: boolean;
  className?: string;
}

const actionConfig = {
  approved: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
    label: 'Approved',
  },
  rejected: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
    label: 'Rejected',
  },
  escalated: {
    icon: ArrowRight,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-200',
    label: 'Escalated',
  },
  delegated: {
    icon: UserPlus,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
    label: 'Delegated',
  },
  created: {
    icon: FileText,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    borderColor: 'border-indigo-200',
    label: 'Submitted',
  },
  comment: {
    icon: MessageSquare,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
    label: 'Comment',
  },
};

const typeConfig = {
  contract: { label: 'Contract', color: 'bg-blue-100 text-blue-700' },
  amendment: { label: 'Amendment', color: 'bg-purple-100 text-purple-700' },
  renewal: { label: 'Renewal', color: 'bg-green-100 text-green-700' },
  termination: { label: 'Termination', color: 'bg-red-100 text-red-700' },
};

// Mock history data
const mockHistory: HistoryEntry[] = [
  {
    id: 'h1',
    contractId: 'contract-001',
    contractName: 'Cloud Services Agreement - TechCorp',
    type: 'contract',
    action: 'approved',
    actor: { name: 'Michael Chen', email: 'michael@company.com', role: 'CFO' },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    stepName: 'Executive Approval',
    comment: 'Approved. Budget allocated from Q1 operations.',
    metadata: { value: 450000, supplier: 'TechCorp Solutions' },
  },
  {
    id: 'h2',
    contractId: 'contract-001',
    contractName: 'Cloud Services Agreement - TechCorp',
    type: 'contract',
    action: 'approved',
    actor: { name: 'Emily Davis', email: 'emily@company.com', role: 'Legal Counsel' },
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    stepName: 'Legal Review',
    comment: 'Terms reviewed. No significant risks identified.',
  },
  {
    id: 'h3',
    contractId: 'contract-002',
    contractName: 'Hardware Procurement - DataTech',
    type: 'contract',
    action: 'rejected',
    actor: { name: 'Sarah Johnson', email: 'sarah@company.com', role: 'Procurement Manager' },
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    stepName: 'Initial Review',
    comment: 'Pricing 15% above market rate. Please renegotiate.',
    metadata: { value: 125000, supplier: 'DataTech Inc', reason: 'Price too high' },
  },
  {
    id: 'h4',
    contractId: 'contract-003',
    contractName: 'Software License Renewal - Adobe',
    type: 'renewal',
    action: 'delegated',
    actor: { name: 'John Smith', email: 'john@company.com', role: 'IT Director' },
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    stepName: 'IT Review',
    metadata: { previousAssignee: 'John Smith', newAssignee: 'Alex Williams', value: 85000 },
  },
  {
    id: 'h5',
    contractId: 'contract-004',
    contractName: 'Maintenance Agreement - FacilityPro',
    type: 'amendment',
    action: 'escalated',
    actor: { name: 'Lisa Park', email: 'lisa@company.com', role: 'Operations Manager' },
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    stepName: 'Operations Review',
    comment: 'Scope change requires VP approval due to budget impact.',
    metadata: { value: 200000 },
  },
  {
    id: 'h6',
    contractId: 'contract-005',
    contractName: 'Consulting Services - McKinsey',
    type: 'contract',
    action: 'created',
    actor: { name: 'Tom Wilson', email: 'tom@company.com', role: 'Strategy Lead' },
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    metadata: { value: 750000, supplier: 'McKinsey & Company' },
  },
];

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function HistoryEntryCard({ entry, showContract = true }: { entry: HistoryEntry; showContract?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = actionConfig[entry.action];
  const Icon = config.icon;
  const tConfig = typeConfig[entry.type];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative pl-8 pb-6',
        'before:absolute before:left-[11px] before:top-8 before:bottom-0 before:w-0.5 before:bg-slate-200',
        'last:before:hidden last:pb-0'
      )}
      role="listitem"
    >
      {/* Timeline dot */}
      <div className={cn(
        'absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center',
        config.bgColor,
        config.borderColor,
        'border-2 z-10'
      )} aria-hidden="true">
        <Icon className={cn('w-3 h-3', config.color)} />
      </div>

      {/* Content */}
      <div 
        className={cn(
          'p-4 rounded-xl border bg-white/80 backdrop-blur-sm transition-all hover:shadow-md',
          'focus-within:ring-2 focus-within:ring-indigo-500/30',
          config.borderColor
        )}
        tabIndex={0}
        role="article"
        aria-label={`${entry.actor.name} ${config.label.toLowerCase()} ${showContract ? entry.contractName : ''} ${formatRelativeTime(entry.timestamp)}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn('font-semibold', config.color)}>
                {config.label}
              </span>
              {entry.stepName && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {entry.stepName}
                </span>
              )}
              {showContract && (
                <span className={cn('text-xs px-2 py-0.5 rounded-full', tConfig.color)}>
                  {tConfig.label}
                </span>
              )}
            </div>
            
            {showContract && (
              <Link
                href={`/contracts/${entry.contractId}`}
                className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors"
              >
                {entry.contractName}
              </Link>
            )}
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs text-slate-400">
              {formatRelativeTime(entry.timestamp)}
            </div>
            {entry.metadata?.value && (
              <div className="text-sm font-semibold text-emerald-600 flex items-center gap-1 justify-end mt-1">
                <DollarSign className="w-3 h-3" />
                {entry.metadata.value.toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Actor info */}
        <div className="flex items-center gap-2 mt-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
            {entry.actor.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-700">{entry.actor.name}</div>
            <div className="text-xs text-slate-400">{entry.actor.role}</div>
          </div>
        </div>

        {/* Comment/Details */}
        {(entry.comment || entry.metadata?.reason || entry.action === 'delegated') && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            {entry.comment && (
              <p className="text-sm text-slate-600 italic">&ldquo;{entry.comment}&rdquo;</p>
            )}
            {entry.metadata?.reason && !entry.comment && (
              <p className="text-sm text-slate-600">
                <span className="font-medium">Reason:</span> {entry.metadata.reason}
              </p>
            )}
            {entry.action === 'delegated' && entry.metadata && (
              <p className="text-sm text-slate-600">
                Delegated from <span className="font-medium">{entry.metadata.previousAssignee}</span> to{' '}
                <span className="font-medium">{entry.metadata.newAssignee}</span>
              </p>
            )}
          </div>
        )}

        {/* Expand for more details */}
        {entry.metadata?.supplier && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            onKeyDown={handleKeyDown}
            aria-expanded={isExpanded}
            aria-controls={`details-${entry.id}`}
            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded px-1"
          >
            {isExpanded ? 'Hide details' : 'Show details'}
            <ChevronDown className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-180')} aria-hidden="true" />
          </button>
        )}

        <AnimatePresence>
          {isExpanded && entry.metadata?.supplier && (
            <MotionDiv
              id={`details-${entry.id}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
              role="region"
              aria-label="Additional details"
            >
              <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-600">Supplier: {entry.metadata.supplier}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-600">
                    Date: {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>
    </MotionDiv>
  );
}

export function ApprovalHistory({
  contractId,
  limit = 20,
  showFilters = true,
  className,
}: ApprovalHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'approved' | 'rejected' | 'escalated' | 'delegated'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');

  useEffect(() => {
    // Simulate API fetch
    const fetchHistory = async () => {
      setLoading(true);
      // In production, fetch from API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let filtered = [...mockHistory];
      if (contractId) {
        filtered = filtered.filter(h => h.contractId === contractId);
      }
      
      setHistory(filtered.slice(0, limit));
      setLoading(false);
    };
    
    fetchHistory();
  }, [contractId, limit]);

  const filteredHistory = history.filter(entry => {
    if (filter !== 'all' && entry.action !== filter) return false;
    if (searchQuery && !entry.contractName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !entry.actor.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    if (dateRange !== 'all') {
      const entryDate = new Date(entry.timestamp);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      const rangeDays = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      if (diffDays > rangeDays) return false;
    }
    
    return true;
  });

  // Group by date
  const groupedByDate = filteredHistory.reduce((acc, entry) => {
    const date = new Date(entry.timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, HistoryEntry[]>);

  // Stats
  const stats = {
    approved: history.filter(h => h.action === 'approved').length,
    rejected: history.filter(h => h.action === 'rejected').length,
    pending: history.filter(h => h.action === 'escalated').length,
    totalValue: history.reduce((sum, h) => sum + (h.metadata?.value || 0), 0),
  };

  if (loading) {
    return (
      <div className={cn('space-y-6', className)} role="status" aria-label="Loading approval history">
        {/* Skeleton for stats */}
        {showFilters && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="p-4 bg-slate-100 rounded-xl animate-pulse">
                <div className="h-8 bg-slate-200 rounded w-16 mb-2" />
                <div className="h-3 bg-slate-200 rounded w-12" />
              </div>
            ))}
          </div>
        )}
        {/* Skeleton for timeline */}
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="pl-8 relative animate-pulse">
              <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-slate-200" />
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="flex items-center gap-2 mt-3">
                  <div className="w-7 h-7 rounded-full bg-slate-200" />
                  <div>
                    <div className="h-3 bg-slate-200 rounded w-24 mb-1" />
                    <div className="h-2 bg-slate-200 rounded w-16" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">Loading approval history...</span>
      </div>
    );
  }

  return (
    <div className={cn('', className)}>
      {showFilters && (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <div className="text-xs text-green-600 font-medium">Approved</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-red-50 to-rose-50 rounded-xl border border-red-200">
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              <div className="text-xs text-red-600 font-medium">Rejected</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <div className="text-xs text-amber-600 font-medium">Escalated</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
              <div className="text-2xl font-bold text-indigo-600">${(stats.totalValue / 1000000).toFixed(1)}M</div>
              <div className="text-xs text-indigo-600 font-medium">Total Value</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-6" role="search" aria-label="Filter approval history">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search history..."
                aria-label="Search approval history"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300"
              />
            </div>

            <div className="flex items-center gap-2" role="group" aria-label="Filter by action type">
              {(['all', 'approved', 'rejected', 'escalated', 'delegated'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  aria-label={`Filter by ${f === 'all' ? 'all actions' : f}`}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-1',
                    filter === f
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              aria-label="Filter by date range"
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300"
            >
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>

            <button 
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              aria-label="Download history as CSV"
              title="Download history"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      {/* Timeline */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-12" role="status" aria-live="polite">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-slate-400" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No history found</h3>
          <p className="text-sm text-slate-500 mb-4">
            {searchQuery || filter !== 'all'
              ? 'Try adjusting your filters'
              : 'Approval history will appear here'}
          </p>
          {(searchQuery || filter !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setFilter('all'); setDateRange('all'); }}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded px-2 py-1"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6" role="list" aria-label="Approval history timeline">
          {Object.entries(groupedByDate).map(([date, entries]) => (
            <div key={date} role="group" aria-label={`Approvals on ${date}`}>
              <div className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" aria-hidden="true" />
                <time dateTime={entries[0] ? new Date(entries[0].timestamp).toISOString() : ''}>{date}</time>
              </div>
              <div className="space-y-0">
                {entries.map(entry => (
                  <HistoryEntryCard
                    key={entry.id}
                    entry={entry}
                    showContract={!contractId}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compact history list for sidebars/panels
 */
export function CompactApprovalHistory({
  contractId,
  limit = 5,
  className,
}: {
  contractId?: string;
  limit?: number;
  className?: string;
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    // Filter mock data
    let filtered = [...mockHistory];
    if (contractId) {
      filtered = filtered.filter(h => h.contractId === contractId);
    }
    setHistory(filtered.slice(0, limit));
  }, [contractId, limit]);

  return (
    <div className={cn('space-y-2', className)}>
      {history.map(entry => {
        const config = actionConfig[entry.action];
        const Icon = config.icon;
        
        return (
          <div
            key={entry.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
              config.bgColor
            )}>
              <Icon className={cn('w-4 h-4', config.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-700 truncate">
                {entry.actor.name}
              </div>
              <div className="text-xs text-slate-400">
                {config.label} • {formatRelativeTime(entry.timestamp)}
              </div>
            </div>
          </div>
        );
      })}
      
      {history.length >= limit && (
        <Link
          href={contractId ? `/contracts/${contractId}/history` : '/workflows?tab=history'}
          className="block text-center text-sm text-indigo-600 hover:text-indigo-800 py-2 font-medium"
        >
          View all history →
        </Link>
      )}
    </div>
  );
}

export default ApprovalHistory;
