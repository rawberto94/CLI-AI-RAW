'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  RefreshCw,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  FileText,
  Building2,
  TrendingUp,
  TrendingDown,
  Zap,
  Bell,
  Mail,
  Play,
  Download,
  Eye,
  Edit,
  Loader2,
  SendHorizonal,
  GitBranch,
  ClipboardCheck,
  FileEdit,
} from 'lucide-react';
import { SubmitForApprovalModal } from '@/components/collaboration/SubmitForApprovalModal';
import { useCrossModuleInvalidation, useRenewals } from '@/hooks/use-queries';
import { RenewalsCalendar } from '@/components/calendar/RenewalsCalendar';

// ============================================================================
// Types
// ============================================================================

interface RenewalContract {
  id: string;
  contractId: string;
  contractName: string;
  supplierName: string;
  currentValue: number;
  projectedValue: number;
  renewalDate: string;
  autoRenewal: boolean;
  noticeDeadline?: string;
  status: 'upcoming' | 'in-progress' | 'completed' | 'lapsed' | 'terminated';
  renewalType: 'auto' | 'manual' | 'negotiated';
  healthScore: number;
  daysUntilRenewal: number;
  lastRenewalDate?: string;
  renewalHistory: RenewalEvent[];
  recommendation: 'renew' | 'renegotiate' | 'terminate' | 'review';
  risks: string[];
  savings?: {
    potential: number;
    realized: number;
  };
  assignee?: {
    name: string;
    email: string;
  };
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'none';
  approvalProgress?: number;
}

interface RenewalEvent {
  id: string;
  type: 'renewal' | 'amendment' | 'notification' | 'action';
  description: string;
  date: string;
  actor?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getStatusConfig = (status: RenewalContract['status']) => {
  switch (status) {
    case 'upcoming': return { color: 'bg-violet-100 text-violet-700', icon: Calendar, label: 'Upcoming' };
    case 'in-progress': return { color: 'bg-amber-100 text-amber-700', icon: RefreshCw, label: 'In Progress' };
    case 'completed': return { color: 'bg-green-100 text-green-700', icon: CheckCircle2, label: 'Completed' };
    case 'lapsed': return { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Lapsed' };
    case 'terminated': return { color: 'bg-slate-100 text-slate-700', icon: XCircle, label: 'Terminated' };
    default: return { color: 'bg-slate-100 text-slate-700', icon: Clock, label: 'Unknown' };
  }
};

const getRecommendationConfig = (rec: RenewalContract['recommendation']) => {
  switch (rec) {
    case 'renew': return { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2, label: 'Renew' };
    case 'renegotiate': return { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Edit, label: 'Renegotiate' };
    case 'terminate': return { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, label: 'Terminate' };
    case 'review': return { color: 'bg-violet-100 text-violet-700 border-violet-200', icon: Eye, label: 'Review' };
    default: return { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Eye, label: 'Unknown' };
  }
};

const getUrgencyColor = (days: number, hasAutoRenewal: boolean, noticeDeadline?: string) => {
  if (noticeDeadline) {
    const deadlineDays = Math.ceil((new Date(noticeDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (deadlineDays <= 5) return 'text-red-600 bg-red-50';
    if (deadlineDays <= 14) return 'text-amber-600 bg-amber-50';
  }
  if (days <= 30) return 'text-red-600 bg-red-50';
  if (days <= 60) return 'text-amber-600 bg-amber-50';
  if (days <= 90) return 'text-violet-600 bg-violet-50';
  return 'text-slate-600 bg-slate-50';
};

// ============================================================================
// Renewal Card Component
// ============================================================================

interface RenewalCardProps {
  renewal: RenewalContract;
  isSelected: boolean;
  onSelect: () => void;
  onSubmitForApproval: (renewal: RenewalContract) => void;
}

const getApprovalStatusConfig = (status?: RenewalContract['approvalStatus']) => {
  switch (status) {
    case 'pending': return { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock, label: 'Pending Approval' };
    case 'approved': return { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2, label: 'Approved' };
    case 'rejected': return { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, label: 'Rejected' };
    default: return null;
  }
};

const RenewalCard: React.FC<RenewalCardProps> = ({ renewal, isSelected, onSelect, onSubmitForApproval }) => {
  const status = getStatusConfig(renewal.status);
  const StatusIcon = status.icon;
  const rec = getRecommendationConfig(renewal.recommendation);
  const RecIcon = rec.icon;
  const urgencyClass = getUrgencyColor(renewal.daysUntilRenewal, renewal.autoRenewal, renewal.noticeDeadline);
  const valueChange = renewal.projectedValue - renewal.currentValue;
  const valueChangePercent = renewal.currentValue > 0 ? (valueChange / renewal.currentValue) * 100 : 0;
  const approvalConfig = getApprovalStatusConfig(renewal.approvalStatus);

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -2 }}
      onClick={onSelect}
      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 backdrop-blur-sm ${
        isSelected
          ? 'border-green-500 bg-gradient-to-br from-violet-50/80 to-violet-50/50 shadow-xl shadow-green-200/40'
          : renewal.daysUntilRenewal <= 30 || (renewal.noticeDeadline && new Date(renewal.noticeDeadline).getTime() - new Date().getTime() <= 7 * 24 * 60 * 60 * 1000)
          ? 'border-red-200/70 bg-gradient-to-br from-red-50/50 to-rose-50/30 hover:border-red-300 hover:shadow-lg hover:shadow-red-200/30'
          : 'border-slate-200/50 bg-white/90 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Health Score Ring */}
        <div className="relative w-12 h-12 flex-shrink-0">
          <svg className="w-12 h-12 -rotate-90">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#E2E8F0" strokeWidth="4" />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke={renewal.healthScore >= 70 ? '#22C55E' : renewal.healthScore >= 50 ? '#F59E0B' : '#EF4444'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(renewal.healthScore / 100) * 126} 126`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">
            {renewal.healthScore}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {renewal.autoRenewal && (
              <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded text-xs font-medium flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Auto-Renew
              </span>
            )}
            <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 border ${rec.color}`}>
              <RecIcon className="w-3 h-3" />
              {rec.label}
            </span>
          </div>

          <h3 className="font-semibold text-slate-900 truncate">{renewal.contractName}</h3>
          <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
            <Building2 className="w-3 h-3" />
            {renewal.supplierName}
          </p>
        </div>

        <div className="text-right">
          <div className={`px-2 py-1 rounded text-sm font-medium ${urgencyClass}`}>
            {renewal.daysUntilRenewal}d
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {renewal.renewalDate}
          </div>
        </div>
      </div>

      {/* Value & Savings */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="p-2 bg-slate-50 rounded-lg">
          <div className="text-xs text-slate-500">Current Value</div>
          <div className="font-semibold text-slate-900">${renewal.currentValue.toLocaleString()}</div>
        </div>
        <div className="p-2 bg-slate-50 rounded-lg">
          <div className="text-xs text-slate-500">Projected</div>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-900">${renewal.projectedValue.toLocaleString()}</span>
            {valueChange !== 0 && (
              <span className={`text-xs flex items-center ${valueChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {valueChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(valueChangePercent).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Risks & Notice Deadline */}
      {(renewal.risks.length > 0 || renewal.noticeDeadline) && (
        <div className="mt-3 space-y-2">
          {renewal.noticeDeadline && (
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-700 font-medium">
                Notice deadline: {renewal.noticeDeadline}
              </span>
            </div>
          )}
          {renewal.risks.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {renewal.risks.slice(0, 2).map((risk, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
                  {risk}
                </span>
              ))}
              {renewal.risks.length > 2 && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                  +{renewal.risks.length - 2} more
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Approval Status & Actions */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between">
          {approvalConfig ? (
            <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border ${approvalConfig.color}`}>
              <approvalConfig.icon className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{approvalConfig.label}</span>
              {renewal.approvalStatus === 'pending' && renewal.approvalProgress !== undefined && (
                <div className="w-12 h-1.5 bg-amber-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-600 rounded-full transition-all" 
                    style={{ width: `${renewal.approvalProgress}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400">No approval workflow</span>
          )}
          
          <div className="flex items-center gap-1">
            {/* Start Renewal Wizard - Primary Action */}
            {(renewal.status === 'upcoming' || renewal.status === 'in-progress') && (
              <Link
                href={`/contracts/${renewal.contractId}/renew`}
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Start renewal wizard"
              >
                <Play className="w-4 h-4" />
              </Link>
            )}
            {/* Draft Renewal in AI Copilot */}
            {(renewal.status === 'upcoming' || renewal.status === 'in-progress') && (
              <Link
                href={`/generate?create=renewal&from=${renewal.contractId}`}
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Draft renewal with AI Copilot"
              >
                <FileEdit className="w-4 h-4" />
              </Link>
            )}
            {(!renewal.approvalStatus || renewal.approvalStatus === 'none' || renewal.approvalStatus === 'rejected') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSubmitForApproval(renewal);
                }}
                className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                title="Submit for approval"
              >
                <SendHorizonal className="w-4 h-4" />
              </button>
            )}
            {renewal.approvalStatus === 'pending' && (
              <Link
                href="/approvals"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                title="View in approvals"
              >
                <ClipboardCheck className="w-4 h-4" />
              </Link>
            )}
            <Link
              href={`/contracts/${renewal.contractId}`}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="View contract"
            >
              <Eye className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const RenewalManager: React.FC = () => {
  const crossModule = useCrossModuleInvalidation();
  const { data: rawRenewals = [], isLoading: loading } = useRenewals();

  // Map API data to RenewalContract shape
  const renewals: RenewalContract[] = useMemo(() => {
    return rawRenewals.map((item: any) => ({
      id: item.id || item.contractId,
      contractId: item.contractId || item.id?.replace('renewal-', '') || item.id,
      contractName: item.contractName || item.name || 'Unknown Contract',
      supplierName: item.supplier || item.counterparty || item.vendor || 'Unknown',
      currentValue: item.currentValue || item.contractValue || item.value || 0,
      projectedValue: item.projectedValue || item.currentValue || item.contractValue || 0,
      renewalDate: item.expiryDate || item.endDate || item.renewalDate,
      autoRenewal: item.autoRenewal ?? false,
      noticeDeadline: item.noticeDeadline,
      status: item.status || 'upcoming',
      renewalType: item.autoRenewal ? 'auto' : 'manual',
      healthScore: item.healthScore || 75,
      daysUntilRenewal: item.daysUntilExpiry ?? item.daysUntilRenewal ?? Math.max(0, Math.round((new Date(item.expiryDate || item.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
      lastRenewalDate: item.lastRenewalDate,
      renewalHistory: item.history || [],
      recommendation: item.recommendation || (item.daysUntilExpiry <= 30 ? 'review' : 'renew'),
      risks: item.risks || (item.riskLevel === 'high' || item.riskLevel === 'critical' ? ['High risk score'] : []),
      savings: item.savings,
      assignee: item.assignedTo,
    }));
  }, [rawRenewals]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'auto-renew' | 'action-needed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'list' | 'calendar' | 'timeline'>('list');
  
  // Approval modal state
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [renewalForApproval, setRenewalForApproval] = useState<RenewalContract | null>(null);
  const [initiateModalOpen, setInitiateModalOpen] = useState(false);
  const [selectedRenewalForInitiate, setSelectedRenewalForInitiate] = useState<RenewalContract | null>(null);
  
  const handleSubmitForApproval = (renewal: RenewalContract) => {
    setRenewalForApproval(renewal);
    setApprovalModalOpen(true);
  };
  
  const handleInitiateRenewal = () => {
    // If a specific renewal is selected, use that; otherwise, show picker
    if (selectedRenewal) {
      setSelectedRenewalForInitiate(selectedRenewal);
      setInitiateModalOpen(true);
    } else if (filteredRenewals.length > 0) {
      // Auto-select the most urgent renewal
      const mostUrgent = filteredRenewals[0];
      if (mostUrgent) {
        setSelectedRenewalForInitiate(mostUrgent);
        setInitiateModalOpen(true);
      }
    } else {
      toast.error('No renewals available', {
        description: 'Please add contracts with upcoming renewals first',
      });
    }
  };
  
  const handleConfirmInitiateRenewal = () => {
    if (selectedRenewalForInitiate) {
      // Invalidate related caches – the server updates the status
      crossModule.onRenewalChange(selectedRenewalForInitiate.contractId);
      
      toast.success('Renewal initiated', {
        description: `${selectedRenewalForInitiate.contractName} renewal process started`,
      });
      
      // Automatically open approval modal after initiating
      setInitiateModalOpen(false);
      setRenewalForApproval(selectedRenewalForInitiate);
      setApprovalModalOpen(true);
      setSelectedRenewalForInitiate(null);
    }
  };
  
  const handleApprovalSubmit = () => {
    if (renewalForApproval) {
      // Invalidate approvals and related caches — server persists the change
      crossModule.onRenewalChange(renewalForApproval.contractId);
      
      toast.success('Renewal submitted for approval', {
        description: `${renewalForApproval.contractName} has been sent for review`,
      });
    }
    setApprovalModalOpen(false);
    setRenewalForApproval(null);
  };

  // Fetch renewals from API via React Query (useRenewals hook above)

  const selectedRenewal = renewals.find(r => r.id === selectedId);

  const filteredRenewals = useMemo(() => {
    return renewals.filter(r => {
      if (filter === 'urgent' && r.daysUntilRenewal > 30) return false;
      if (filter === 'auto-renew' && !r.autoRenewal) return false;
      if (filter === 'action-needed' && r.recommendation === 'renew' && !r.risks.length) return false;
      if (searchQuery && !r.contractName.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !r.supplierName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }).sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);
  }, [renewals, filter, searchQuery]);

  const stats = useMemo(() => {
    const totalValue = renewals.reduce((sum, r) => sum + r.currentValue, 0);
    const potentialSavings = renewals.reduce((sum, r) => sum + (r.savings?.potential || 0), 0);
    return {
      total: renewals.length,
      urgent: renewals.filter(r => r.daysUntilRenewal <= 30).length,
      autoRenewal: renewals.filter(r => r.autoRenewal).length,
      totalValue,
      potentialSavings,
      atRisk: renewals.filter(r => r.recommendation === 'terminate' || r.recommendation === 'renegotiate').length,
    };
  }, [renewals]);

  // Group by month for timeline
  const renewalsByMonth = useMemo(() => {
    const grouped: Record<string, RenewalContract[]> = {};
    filteredRenewals.forEach(r => {
      const month = new Date(r.renewalDate).toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(r);
    });
    return grouped;
  }, [filteredRenewals]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-600">Loading renewals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-green-50/20 to-violet-50/10">
      {/* Header */}
      <div className="flex-none p-6 bg-white/80 backdrop-blur-sm border-b border-slate-200/50 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-lg shadow-green-500/30">
                <RefreshCw className="w-5 h-5" />
              </div>
              Renewal Manager
            </h1>
            <p className="text-sm text-slate-500 mt-1">Track and manage upcoming contract renewals</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.info('Export coming soon')}
              className="px-3 py-2 bg-white/80 backdrop-blur-sm text-slate-700 rounded-xl border border-slate-200/50 hover:bg-white hover:shadow-md transition-all duration-200 font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => toast.info('Notification preferences coming soon')}
              className="px-3 py-2 bg-white/80 backdrop-blur-sm text-slate-700 rounded-xl border border-slate-200/50 hover:bg-white hover:shadow-md transition-all duration-200 font-medium flex items-center gap-2"
            >
              <Bell className="w-4 h-4" />
              Notifications
            </button>
            <button 
              onClick={handleInitiateRenewal}
              className="px-4 py-2 bg-gradient-to-r from-violet-500 to-violet-600 text-white rounded-xl hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all duration-200 font-medium flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Initiate Renewal
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-6 gap-4">
          <div className="group p-3 bg-gradient-to-br from-slate-50 to-slate-100/70 rounded-xl text-center border border-slate-200/50 shadow-md hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
            <div className="text-xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500 font-medium">Total Renewals</div>
          </div>
          <div className="group p-3 bg-gradient-to-br from-red-50 to-rose-100/70 rounded-xl text-center border border-red-200/50 shadow-md hover:shadow-lg hover:shadow-red-200/50 transition-all duration-300">
            <div className="text-xl font-bold text-red-600">{stats.urgent}</div>
            <div className="text-xs text-red-600 font-medium">Due in 30 Days</div>
          </div>
          <div className="group p-3 bg-gradient-to-br from-violet-50 to-purple-100/70 rounded-xl text-center border border-violet-200/50 shadow-md hover:shadow-lg hover:shadow-violet-200/50 transition-all duration-300">
            <div className="text-xl font-bold text-violet-600">{stats.autoRenewal}</div>
            <div className="text-xs text-violet-600 font-medium">Auto-Renewal</div>
          </div>
          <div className="group p-3 bg-gradient-to-br from-amber-50 to-orange-100/70 rounded-xl text-center border border-amber-200/50 shadow-md hover:shadow-lg hover:shadow-amber-200/50 transition-all duration-300">
            <div className="text-xl font-bold text-amber-600">{stats.atRisk}</div>
            <div className="text-xs text-amber-600 font-medium">Action Needed</div>
          </div>
          <div className="group p-3 bg-gradient-to-br from-violet-50 to-purple-100/70 rounded-xl text-center border border-violet-200/50 shadow-md hover:shadow-lg hover:shadow-violet-200/50 transition-all duration-300">
            <div className="text-xl font-bold text-violet-600">${(stats.totalValue / 1000000).toFixed(1)}M</div>
            <div className="text-xs text-violet-600 font-medium">Total Value</div>
          </div>
          <div className="group p-3 bg-gradient-to-br from-violet-50 to-violet-100/70 rounded-xl text-center border border-green-200/50 shadow-md hover:shadow-lg hover:shadow-green-200/50 transition-all duration-300">
            <div className="text-xl font-bold text-green-600">${(stats.potentialSavings / 1000).toFixed(0)}K</div>
            <div className="text-xs text-green-600 font-medium">Potential Savings</div>
          </div>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex-none p-4 bg-white/80 backdrop-blur-sm border-b border-slate-100/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search renewals..."
              className="pl-10 pr-4 py-2 border border-slate-200/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 w-64 bg-white/80 backdrop-blur-sm shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2 p-1 bg-slate-100/50 rounded-xl">
            {(['all', 'urgent', 'auto-renew', 'action-needed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 capitalize ${
                  filter === f
                    ? 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md shadow-green-500/30'
                    : 'text-slate-600 hover:bg-white hover:shadow-sm'
                }`}
              >
                {f.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 border border-slate-200/50 rounded-xl p-1 bg-white/80 backdrop-blur-sm shadow-sm">
          {(['list', 'calendar', 'timeline'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 capitalize ${
                view === v 
                  ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {view === 'list' ? (
          <div className="grid grid-cols-2 gap-4">
            {filteredRenewals.map(renewal => (
              <RenewalCard
                key={renewal.id}
                renewal={renewal}
                isSelected={selectedId === renewal.id}
                onSelect={() => setSelectedId(selectedId === renewal.id ? null : renewal.id)}
                onSubmitForApproval={handleSubmitForApproval}
              />
            ))}
          </div>
        ) : view === 'calendar' ? (
          <RenewalsCalendar
            renewals={filteredRenewals}
            selectedId={selectedId}
            onSelect={(renewal) => setSelectedId(selectedId === renewal.id ? null : renewal.id)}
          />
        ) : (
          <div className="space-y-8">
            {Object.entries(renewalsByMonth).map(([month, monthRenewals]) => (
              <div key={month}>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  {month}
                  <span className="text-sm font-normal text-slate-500">
                    ({monthRenewals.length} renewal{monthRenewals.length !== 1 ? 's' : ''})
                  </span>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {monthRenewals.map(renewal => (
                    <RenewalCard
                      key={renewal.id}
                      renewal={renewal}
                      isSelected={selectedId === renewal.id}
                      onSelect={() => setSelectedId(selectedId === renewal.id ? null : renewal.id)}
                      onSubmitForApproval={handleSubmitForApproval}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions Bar */}
      <div className="flex-none p-4 bg-white border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Showing {filteredRenewals.length} of {renewals.length} renewals
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/approvals"
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              View Approvals
            </Link>
            <button
              onClick={() => toast.info('Bulk reminders coming soon')}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Send Reminders
            </button>
            <button
              onClick={() => toast.info('Bulk actions coming soon')}
              className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors font-medium flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Bulk Actions
            </button>
          </div>
        </div>
      </div>
      
      {/* Submit for Approval Modal */}
      {renewalForApproval && (
        <SubmitForApprovalModal
          isOpen={approvalModalOpen}
          onClose={() => {
            setApprovalModalOpen(false);
            setRenewalForApproval(null);
          }}
          contractId={renewalForApproval.contractId}
          contractTitle={`Renewal: ${renewalForApproval.contractName}`}
          onSuccess={handleApprovalSubmit}
        />
      )}
      
      {/* Initiate Renewal Modal */}
      <AnimatePresence>
        {initiateModalOpen && selectedRenewalForInitiate && (
          <motion.div key="initiate-modal-open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setInitiateModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-green-50 to-violet-50 px-6 py-4 border-b border-green-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Play className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Initiate Renewal</h3>
                    <p className="text-sm text-slate-500">Start the renewal process</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="p-4 bg-slate-50 rounded-lg mb-4">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">{selectedRenewalForInitiate.contractName}</p>
                      <p className="text-sm text-slate-500">{selectedRenewalForInitiate.supplierName}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="text-slate-500">Current Value:</div>
                    <div className="font-medium text-slate-900">${selectedRenewalForInitiate.currentValue.toLocaleString()}</div>
                    <div className="text-slate-500">Renewal Date:</div>
                    <div className="font-medium text-slate-900">{selectedRenewalForInitiate.renewalDate}</div>
                  </div>
                </div>
                
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg mb-4">
                  <div className="flex items-start gap-2">
                    <GitBranch className="w-4 h-4 text-violet-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-violet-900">Auto-submit for Approval</p>
                      <p className="text-violet-700">This will start the approval workflow automatically after initiating the renewal.</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setInitiateModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmInitiateRenewal}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Initiate & Submit
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RenewalManager;
