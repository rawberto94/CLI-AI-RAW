'use client';

import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Calendar,
  Search,
  Eye,
  History,
  ArrowRight,
  Zap,
  Building2,
  DollarSign,
  Send,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  CheckCheck,
  Loader2,
  UserPlus,
  Edit3,
  ExternalLink,
  GitBranch,
  Sparkles,
  RefreshCw,
  TrendingUp,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { getTenantId } from '@/lib/tenant';
import { useDataMode } from '@/contexts/DataModeContext';
// import { useApprovalFlow } from '@/hooks/use-collaboration';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ApprovalNotificationBell } from './ApprovalNotificationBell';
import { DeadlineIndicator } from './DeadlineAlerts';
import { CommentsThread } from './CommentsThread';
import { DelegationRulesModal } from './DelegationRulesModal';
import { MobileApprovalActions } from './MobileApprovalActions';
import { WorkflowProgressBar, SLAIndicator } from './WorkflowProgressStepper';
import { AIRiskBadge, RiskScoreGauge } from './AIRiskAssessment';
import { BulkActionBar } from './BulkActionBar';
import { useCrossModuleInvalidation } from '@/hooks/use-queries';

// ============================================================================
// Types
// ============================================================================

interface SLAMetrics {
  startTime: string;
  targetTime: string;
  percentUsed: number;
  hoursRemaining: number;
  isOverdue: boolean;
  slaStatus: 'on_track' | 'at_risk' | 'critical' | 'overdue';
}

interface ApprovalRequest {
  id: string;
  contractId?: string; // Optional - if different from id
  type: 'contract' | 'amendment' | 'renewal' | 'termination';
  title: string;
  description: string;
  contractName: string;
  supplierName: string;
  requestedBy: {
    name: string;
    email: string;
    avatar?: string;
  };
  requestedAt: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  value?: number;
  currentStep: number;
  totalSteps: number;
  approvers: Approver[];
  comments: Comment[];
  attachments: string[];
  riskFlags?: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  riskScore?: number;
  slaMetrics?: SLAMetrics;
}

interface Approver {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  respondedAt?: string;
  comment?: string;
  isCurrent: boolean;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const _mockApprovals: ApprovalRequest[] = [
  {
    id: 'a1',
    contractId: 'contract-005', // Link to actual contract
    type: 'contract',
    title: 'Contract Approval - Manufacturing Equipment Supply',
    description: 'Standard approval workflow.',
    contractName: 'Manufacturing Equipment Supply',
    supplierName: 'Unknown',
    requestedBy: { name: 'Sarah Johnson', email: 'sarah@company.com' },
    requestedAt: '2024-03-14T10:30:00',
    dueDate: '2024-03-18',
    priority: 'high',
    status: 'pending',
    value: 450000,
    currentStep: 2,
    totalSteps: 3,
    approvers: [
      { id: 'ap1', name: 'John Smith', email: 'john@company.com', role: 'Procurement Manager', status: 'approved', respondedAt: '2024-03-14T14:00:00', isCurrent: false },
      { id: 'ap2', name: 'Emily Davis', email: 'emily@company.com', role: 'Legal Counsel', status: 'pending', isCurrent: true },
      { id: 'ap3', name: 'Michael Chen', email: 'michael@company.com', role: 'CFO', status: 'pending', isCurrent: false },
    ],
    comments: [
      { id: 'c1', author: 'John Smith', content: 'Reviewed pricing terms. Approved with note to monitor SLA performance.', createdAt: '2024-03-14T14:00:00' },
    ],
    attachments: ['MSA_CloudTech_v2.pdf', 'Pricing_Schedule.xlsx'],
    riskFlags: ['High value contract', 'New supplier'],
  },
  {
    id: 'a2',
    contractId: 'contract-006', // Link to Hardware Procurement contract
    type: 'renewal',
    title: 'Urgent: Auto-Renewal Decision Required',
    description: 'Decision required for GlobalSupply contract renewal. Auto-renewal deadline in 5 days.',
    contractName: 'Procurement Agreement',
    supplierName: 'GlobalSupply Ltd',
    requestedBy: { name: 'System', email: 'system@company.com' },
    requestedAt: '2024-03-10T08:00:00',
    dueDate: '2024-03-15',
    priority: 'urgent',
    status: 'pending',
    value: 780000,
    currentStep: 1,
    totalSteps: 2,
    approvers: [
      { id: 'ap4', name: 'Emily Davis', email: 'emily@company.com', role: 'Legal Counsel', status: 'pending', isCurrent: true },
      { id: 'ap5', name: 'Michael Chen', email: 'michael@company.com', role: 'CFO', status: 'pending', isCurrent: false },
    ],
    comments: [],
    attachments: ['GlobalSupply_Contract.pdf'],
    riskFlags: ['Auto-renewal trap', 'Performance issues', '22% above market rate'],
  },
  {
    id: 'a3',
    type: 'amendment',
    title: 'SLA Amendment - Cloud Services',
    description: 'Amendment to update SLA terms and add new service tiers for the cloud services agreement.',
    contractName: 'Cloud Services SLA',
    supplierName: 'Acme Corporation',
    requestedBy: { name: 'Tom Wilson', email: 'tom@company.com' },
    requestedAt: '2024-03-13T15:45:00',
    dueDate: '2024-03-20',
    priority: 'medium',
    status: 'pending',
    value: 50000,
    currentStep: 1,
    totalSteps: 2,
    approvers: [
      { id: 'ap6', name: 'John Smith', email: 'john@company.com', role: 'Procurement Manager', status: 'pending', isCurrent: true },
      { id: 'ap7', name: 'Emily Davis', email: 'emily@company.com', role: 'Legal Counsel', status: 'pending', isCurrent: false },
    ],
    comments: [],
    attachments: ['SLA_Amendment_v1.pdf'],
  },
  {
    id: 'a4',
    type: 'termination',
    title: 'Contract Termination Request',
    description: 'Request to terminate maintenance contract due to consistent service quality issues.',
    contractName: 'Maintenance Agreement',
    supplierName: 'TechSupport Inc',
    requestedBy: { name: 'Lisa Park', email: 'lisa@company.com' },
    requestedAt: '2024-03-12T09:00:00',
    dueDate: '2024-03-22',
    priority: 'low',
    status: 'approved',
    value: 35000,
    currentStep: 2,
    totalSteps: 2,
    approvers: [
      { id: 'ap8', name: 'John Smith', email: 'john@company.com', role: 'Procurement Manager', status: 'approved', respondedAt: '2024-03-13T10:00:00', isCurrent: false },
      { id: 'ap9', name: 'Emily Davis', email: 'emily@company.com', role: 'Legal Counsel', status: 'approved', respondedAt: '2024-03-14T11:00:00', isCurrent: false },
    ],
    comments: [
      { id: 'c2', author: 'John Smith', content: 'Confirmed performance issues. Approved termination.', createdAt: '2024-03-13T10:00:00' },
      { id: 'c3', author: 'Emily Davis', content: 'No legal concerns with termination per Section 11.2.', createdAt: '2024-03-14T11:00:00' },
    ],
    attachments: ['Termination_Notice.pdf'],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

const getPriorityConfig = (priority: ApprovalRequest['priority']) => {
  switch (priority) {
    case 'urgent': return { 
      color: 'bg-gradient-to-r from-red-100 to-red-50 text-red-700 border-red-200/50', 
      icon: AlertTriangle,
      glow: 'shadow-red-100'
    };
    case 'high': return { 
      color: 'bg-gradient-to-r from-orange-100 to-orange-50 text-orange-700 border-orange-200/50', 
      icon: AlertTriangle,
      glow: 'shadow-orange-100'
    };
    case 'medium': return { 
      color: 'bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border-amber-200/50', 
      icon: Clock,
      glow: 'shadow-amber-100'
    };
    case 'low': return { 
      color: 'bg-gradient-to-r from-violet-100 to-purple-50 text-green-700 border-green-200/50', 
      icon: Clock,
      glow: 'shadow-green-100'
    };
    default: return { 
      color: 'bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 border-slate-200/50', 
      icon: Clock,
      glow: 'shadow-slate-100'
    };
  }
};

const getTypeConfig = (type: ApprovalRequest['type']) => {
  switch (type) {
    case 'contract': return { 
      color: 'bg-gradient-to-br from-violet-500 to-purple-600', 
      badgeColor: 'bg-violet-100/80 text-violet-700',
      label: 'New Contract', 
      icon: FileText 
    };
    case 'amendment': return { 
      color: 'bg-gradient-to-br from-violet-500 to-fuchsia-600', 
      badgeColor: 'bg-violet-100/80 text-violet-700',
      label: 'Amendment', 
      icon: FileText 
    };
    case 'renewal': return { 
      color: 'bg-gradient-to-br from-violet-500 to-violet-600', 
      badgeColor: 'bg-green-100/80 text-green-700',
      label: 'Renewal', 
      icon: RotateCcw 
    };
    case 'termination': return { 
      color: 'bg-gradient-to-br from-red-500 to-rose-600', 
      badgeColor: 'bg-red-100/80 text-red-700',
      label: 'Termination', 
      icon: XCircle 
    };
    default: return { 
      color: 'bg-gradient-to-br from-slate-500 to-slate-600', 
      badgeColor: 'bg-slate-100/80 text-slate-700',
      label: type || 'Unknown', 
      icon: FileText 
    };
  }
};

const getStatusConfig = (status: ApprovalRequest['status']) => {
  switch (status) {
    case 'pending': return { 
      color: 'bg-amber-100/80 text-amber-700 border border-amber-200/50', 
      icon: Clock, 
      label: 'Pending' 
    };
    case 'approved': return { 
      color: 'bg-green-100/80 text-green-700 border border-green-200/50', 
      icon: CheckCircle2, 
      label: 'Approved' 
    };
    case 'rejected': return { 
      color: 'bg-red-100/80 text-red-700 border border-red-200/50', 
      icon: XCircle, 
      label: 'Rejected' 
    };
    case 'escalated': return { 
      color: 'bg-violet-100/80 text-violet-700 border border-violet-200/50', 
      icon: ArrowRight, 
      label: 'Escalated' 
    };
    default: return { 
      color: 'bg-slate-100/80 text-slate-700 border border-slate-200/50', 
      icon: Clock, 
      label: status || 'Unknown' 
    };
  }
};

const getDaysUntilDue = (dueDate: string) => {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
};

// ============================================================================
// Approval Card Component
// ============================================================================

interface ApprovalCardProps {
  approval: ApprovalRequest;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onToggleCheck: (e: React.MouseEvent) => void;
}

const ApprovalCard = memo<ApprovalCardProps>(function ApprovalCard({ approval, isSelected, isChecked, onSelect, onToggleCheck }) {
  const priority = getPriorityConfig(approval.priority);
  const type = getTypeConfig(approval.type);
  const status = getStatusConfig(approval.status);
  const TypeIcon = type.icon;
  const StatusIcon = status.icon;
  const _daysUntilDue = getDaysUntilDue(approval.dueDate);

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 backdrop-blur-sm ${
        isSelected
          ? 'border-indigo-400 bg-gradient-to-r from-violet-50/80 to-purple-50/80 shadow-lg shadow-violet-100/50 ring-2 ring-indigo-200/50'
          : approval.priority === 'urgent'
          ? 'border-red-200/50 bg-gradient-to-r from-red-50/50 to-rose-50/30 hover:border-red-300/70 hover:shadow-md hover:shadow-red-100/50'
          : 'border-slate-200/50 bg-white/80 hover:border-indigo-200 hover:shadow-md hover:shadow-violet-100/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox for bulk selection */}
        {approval.status === 'pending' && (
          <button
            onClick={onToggleCheck}
            className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all mt-2.5 ${
              isChecked
                ? 'bg-gradient-to-br from-violet-500 to-purple-600 border-transparent text-white shadow-sm'
                : 'border-slate-300 hover:border-indigo-400 hover:bg-violet-50'
            }`}
          >
            {isChecked && <CheckCircle2 className="w-3 h-3" />}
          </button>
        )}
        
        <div className={`w-11 h-11 rounded-xl ${type.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
          <TypeIcon className="w-5 h-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium backdrop-blur-sm ${type.badgeColor}`}>
              {type.label}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium capitalize backdrop-blur-sm ${priority.color}`}>
              {approval.priority}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1 ${status.color}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
            {/* AI Risk Badge */}
            {approval.riskLevel && (
              <AIRiskBadge riskLevel={approval.riskLevel} size="sm" />
            )}
          </div>

          <h3 className="font-semibold text-slate-900 truncate leading-snug">{approval.title}</h3>
          <p className="text-sm text-slate-500 flex items-center gap-2 mt-1.5">
            <span className="flex items-center gap-1.5 bg-slate-100/60 px-2 py-0.5 rounded-md">
              <Building2 className="w-3 h-3" />
              {approval.supplierName}
            </span>
            {approval.value && (
              <span className="flex items-center gap-1 bg-violet-50/80 text-violet-700 px-2 py-0.5 rounded-md">
                <DollarSign className="w-3 h-3" />
                {approval.value.toLocaleString()}
              </span>
            )}
          </p>
          
          {/* SLA Progress Bar */}
          {approval.slaMetrics && approval.status === 'pending' && (
            <div className="mt-2">
              <SLAIndicator
                startTime={new Date(approval.slaMetrics.startTime)}
                targetTime={new Date(approval.slaMetrics.targetTime)}
                label="SLA"
              />
            </div>
          )}
        </div>

        <div className="text-right flex flex-col items-end gap-1.5">
          <DeadlineIndicator dueDate={new Date(approval.dueDate)} size="sm" />
          
          {/* Workflow Progress */}
          <div className="w-24">
            <WorkflowProgressBar
              currentStep={approval.currentStep}
              totalSteps={approval.totalSteps}
              status={approval.status === 'pending' ? 'in_progress' : approval.status === 'approved' ? 'completed' : 'rejected'}
            />
          </div>
          
          {/* Risk Score Gauge (if available) */}
          {approval.riskScore !== undefined && (
            <div className="mt-1">
              <RiskScoreGauge score={approval.riskScore} size="sm" showLabel={false} />
            </div>
          )}
          
          {/* Approver Avatars */}
          <div className="flex items-center justify-end mt-1 -space-x-2">
            {approval.approvers.slice(0, 3).map((approver, _idx) => (
              <div
                key={approver.id}
                className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium shadow-sm transition-transform hover:scale-110 hover:z-10 ${
                  approver.status === 'approved' ? 'bg-gradient-to-br from-violet-400 to-violet-500 text-white' :
                  approver.status === 'rejected' ? 'bg-gradient-to-br from-red-400 to-rose-500 text-white' :
                  approver.isCurrent ? 'bg-gradient-to-br from-violet-400 to-purple-500 text-white ring-2 ring-indigo-200' :
                  'bg-slate-200 text-slate-600'
                }`}
                title={`${approver.name} - ${approver.status}`}
              >
                {approver.name.charAt(0)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Flags */}
      {approval.riskFlags && approval.riskFlags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
          {approval.riskFlags.map((flag, idx) => (
            <span key={idx} className="px-2 py-0.5 bg-gradient-to-r from-red-50 to-rose-50 text-red-600 text-xs rounded-full flex items-center gap-1 border border-red-100/50">
              <AlertTriangle className="w-3 h-3" />
              {flag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
});

// ============================================================================
// Detail Panel Component
// ============================================================================

interface DetailPanelProps {
  approval: ApprovalRequest;
  onApprove: () => void;
  onReject: () => void;
  onEscalate: () => void;
  onDelegate: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ approval, onApprove, onReject, onEscalate, onDelegate }) => {
  const [comment, setComment] = useState('');
  const type = getTypeConfig(approval.type);
  const TypeIcon = type.icon;

  const currentApprover = approval.approvers.find(a => a.isCurrent);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-purple-50/20">
      {/* Header */}
      <div className="p-6 bg-white/80 backdrop-blur-sm border-b border-slate-200/50">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-xl ${type.color} flex items-center justify-center shadow-lg`}>
            <TypeIcon className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">{approval.title}</h2>
            <p className="text-slate-500 mt-1">{approval.description}</p>
          </div>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/50">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 uppercase font-medium">Supplier</span>
            </div>
            <div className="font-semibold text-slate-900">{approval.supplierName}</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50/50 rounded-xl border border-violet-200/50">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-violet-500" />
              <span className="text-xs text-violet-600 uppercase font-medium">Value</span>
            </div>
            <div className="font-semibold text-violet-700">${approval.value?.toLocaleString() || 'N/A'}</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-xl border border-amber-200/50">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-amber-600 uppercase font-medium">Due Date</span>
            </div>
            <div className="font-semibold text-amber-700">{approval.dueDate}</div>
          </div>
        </div>

        {/* Contract Actions */}
        <div className="flex items-center gap-2 mt-5 flex-wrap">
          <Link href={`/contracts/${approval.contractId || approval.id}`}>
            <button className="px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-200 transition-all font-medium flex items-center gap-2 text-sm">
              <Eye className="w-4 h-4" />
              View Contract
            </button>
          </Link>
          <Link href={`/contracts/${approval.contractId || approval.id}/redline`}>
            <button className="px-4 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-200 transition-all font-medium flex items-center gap-2 text-sm">
              <Edit3 className="w-4 h-4" />
              Redline / Edit
            </button>
          </Link>
          <Link href={`/contracts/${approval.contractId || approval.id}/workflow`}>
            <button className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:shadow-lg hover:shadow-amber-200 transition-all font-medium flex items-center gap-2 text-sm">
              <GitBranch className="w-4 h-4" />
              Edit Workflow
            </button>
          </Link>
          <Link href={`/contracts/${approval.contractId || approval.id}`} target="_blank">
            <button className="px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-1 text-sm">
              <ExternalLink className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>

      {/* Approval Timeline */}
      <div className="p-6 border-b border-slate-200/50 bg-white/50">
        <h3 className="text-sm font-semibold text-slate-700 uppercase mb-4 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-violet-500" />
          Approval Workflow
        </h3>
        <div className="space-y-4">
          {approval.approvers.map((approver, idx) => (
            <motion.div 
              key={approver.id} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-semibold shadow-md transition-all ${
                approver.status === 'approved' ? 'bg-gradient-to-br from-violet-400 to-violet-500 text-white' :
                approver.status === 'rejected' ? 'bg-gradient-to-br from-red-400 to-rose-500 text-white' :
                approver.isCurrent ? 'bg-gradient-to-br from-violet-400 to-purple-500 text-white ring-4 ring-indigo-200/50' :
                'bg-slate-100 text-slate-400'
              }`}>
                {approver.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> :
                 approver.status === 'rejected' ? <XCircle className="w-5 h-5" /> :
                 approver.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{approver.name}</span>
                  {approver.isCurrent && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 text-xs rounded-full font-medium">
                      Current Approver
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">{approver.role}</div>
              </div>
              <div className="text-right">
                {approver.respondedAt ? (
                  <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                    {new Date(approver.respondedAt).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-sm text-slate-400 italic">Pending</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Comments Thread */}
      <div className="flex-1 p-6 overflow-y-auto">
        <CommentsThread 
          approvalId={approval.id}
          currentUserName="You"
        />
      </div>

      {/* Actions */}
      {approval.status === 'pending' && currentApprover && (
        <div className="p-6 border-t border-slate-200/50 bg-gradient-to-r from-slate-50 to-purple-50/30">
          <div className="mb-4">
            <label className="text-sm font-medium text-slate-600 mb-2 block">Add a comment (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write your comment here..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-indigo-300 transition-all bg-white/80 backdrop-blur-sm"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={onApprove}
              className="flex-1 min-w-[140px] px-5 py-3 bg-gradient-to-r from-violet-500 to-violet-600 text-white rounded-xl hover:shadow-lg hover:shadow-green-200 transition-all font-semibold flex items-center justify-center gap-2 text-sm"
            >
              <ThumbsUp className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={onReject}
              className="flex-1 min-w-[140px] px-5 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl hover:shadow-lg hover:shadow-red-200 transition-all font-semibold flex items-center justify-center gap-2 text-sm"
            >
              <ThumbsDown className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={onDelegate}
              className="px-5 py-3 bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 rounded-xl hover:shadow-md transition-all font-semibold flex items-center gap-2 text-sm border border-indigo-200/50"
            >
              <UserPlus className="w-4 h-4" />
              Delegate
            </button>
            <button
              onClick={onEscalate}
              className="px-5 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-semibold flex items-center gap-2 text-sm border border-slate-200/50"
            >
              <ArrowRight className="w-4 h-4" />
              Escalate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ApprovalsQueue: React.FC = () => {
  const { isMockData: _isMockData } = useDataMode();
  const crossModule = useCrossModuleInvalidation();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [delegateModalOpen, setDelegateModalOpen] = useState(false);
  const [delegationRulesOpen, setDelegationRulesOpen] = useState(false);
  const [delegateTarget, setDelegateTarget] = useState('');
  const [delegateNote, setDelegateNote] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // ENHANCED: Sorting state
  const [sortBy, setSortBy] = useState<'urgency' | 'value' | 'age' | 'risk' | 'dueDate'>('urgency');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Rejection dialog state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<'single' | 'bulk'>('single');
  // Approve confirmation state
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Refresh approvals function
  const refreshApprovals = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/approvals', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data?.items) {
        const mapped = json.data.items.map((item: any) => ({
          id: item.id,
          contractId: item.contractId,
          type: item.type || 'contract',
          title: item.title || `${item.type || 'Contract'} Approval`,
          description: item.description || '',
          contractName: item.contractName || item.title || 'Unknown Contract',
          supplierName: item.supplierName || item.counterparty || item.vendor || 'Unknown',
          requestedBy: { 
            name: item.requestedBy?.name || 'System', 
            email: item.requestedBy?.email || 'system@company.com' 
          },
          requestedAt: item.requestedAt || item.createdAt || new Date().toISOString(),
          dueDate: item.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          priority: item.priority || 'medium',
          status: item.status || 'pending',
          value: item.contractValue || item.value || 0,
          currentStep: item.currentStep || 1,
          totalSteps: item.totalSteps || 2,
          approvers: item.approvers || [],
          comments: item.comments || [],
          attachments: item.attachments || [],
          riskFlags: item.riskFlags || [],
          riskLevel: item.riskLevel,
          riskScore: item.riskScore,
          slaMetrics: item.slaMetrics,
        }));
        setApprovals(mapped);
        setLastUpdated(new Date());
        toast.success('Approvals refreshed');
      }
    } catch {
      toast.error('Failed to refresh approvals');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Toggle single item selection for bulk actions
  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all pending approvals
  const selectAllPending = () => {
    const pendingIds = filteredApprovals.filter(a => a.status === 'pending').map(a => a.id);
    setSelectedIds(new Set(pendingIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Mock team members for delegation
  const teamMembers = [
    { id: 'sarah', name: 'Sarah Johnson', email: 'sarah@company.com', role: 'Legal Counsel' },
    { id: 'mike', name: 'Mike Chen', email: 'mike@company.com', role: 'Finance Director' },
    { id: 'emily', name: 'Emily Davis', email: 'emily@company.com', role: 'Procurement Manager' },
    { id: 'james', name: 'James Wilson', email: 'james@company.com', role: 'VP Operations' },
    { id: 'alex', name: 'Alex Williams', email: 'alex@company.com', role: 'CFO' },
  ];

  // Fetch approvals from API - always use real data
  useEffect(() => {
    async function fetchApprovals() {
      try {
        const res = await fetch('/api/approvals');
        const json = await res.json();
        if (json.success && json.data?.items?.length > 0) {
          // Map API data to ApprovalRequest format
          const mapped = json.data.items.map((item: any) => ({
            id: item.id,
            contractId: item.contractId,
            type: item.type || 'contract',
            title: item.title || `${item.type || 'Contract'} Approval`,
            description: item.description || '',
            contractName: item.contractName || item.title || 'Unknown Contract',
            supplierName: item.supplierName || item.counterparty || item.vendor || 'Unknown',
            requestedBy: { 
              name: item.requestedBy?.name || 'System', 
              email: item.requestedBy?.email || 'system@company.com' 
            },
            requestedAt: item.requestedAt || item.createdAt || new Date().toISOString(),
            dueDate: item.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            priority: item.priority || 'medium',
            status: item.status || 'pending',
            value: item.contractValue || item.value || 0,
            currentStep: item.currentStep || 1,
            totalSteps: item.totalSteps || 2,
            approvers: item.approvers || [],
            comments: item.comments || [],
            attachments: item.attachments || [],
            riskFlags: item.riskFlags || [],
            riskLevel: item.riskLevel,
            riskScore: item.riskScore,
            slaMetrics: item.slaMetrics,
          }));
          setApprovals(mapped);
          if (mapped.length > 0) setSelectedId(mapped[0].id);
        } else {
          // No approvals in database
          setApprovals([]);
          setSelectedId(null);
        }
      } catch {
        setApprovals([]);
        setSelectedId(null);
      } finally {
        setLoading(false);
      }
    }
    fetchApprovals();
     
  }, []);

  // Derive these before the keyboard effect uses them
  const selectedApproval = approvals.find(a => a.id === selectedId);

  // ENHANCED: Filter and sort approvals
  const filteredApprovals = useMemo(() => {
    // First filter
    let result = approvals.filter(a => {
      if (filter === 'pending' && a.status !== 'pending') return false;
      if (filter === 'completed' && a.status === 'pending') return false;
      if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !a.supplierName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    // Then sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'urgency': {
          // Urgency: priority first, then days until due
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
          if (priorityDiff !== 0) {
            comparison = priorityDiff;
          } else {
            // Same priority, sort by due date
            const dueDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            comparison = dueDiff;
          }
          break;
        }
        case 'value': {
          comparison = (b.value || 0) - (a.value || 0);
          break;
        }
        case 'age': {
          // Age: oldest first (most overdue)
          comparison = new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
          break;
        }
        case 'risk': {
          // Risk: highest risk score first
          const aRisk = a.riskScore || (a.riskLevel === 'critical' ? 100 : a.riskLevel === 'high' ? 75 : a.riskLevel === 'medium' ? 50 : 25);
          const bRisk = b.riskScore || (b.riskLevel === 'critical' ? 100 : b.riskLevel === 'high' ? 75 : b.riskLevel === 'medium' ? 50 : 25);
          comparison = bRisk - aRisk;
          break;
        }
        case 'dueDate': {
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        }
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [approvals, filter, searchQuery, sortBy, sortDirection]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Show shortcuts help with ?
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        return;
      }

      // Navigation: j/k for up/down
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const currentIndex = filteredApprovals.findIndex(a => a.id === selectedId);
        let nextIndex: number;
        
        if (e.key === 'j') {
          // Next item
          nextIndex = currentIndex < filteredApprovals.length - 1 ? currentIndex + 1 : 0;
        } else {
          // Previous item
          nextIndex = currentIndex > 0 ? currentIndex - 1 : filteredApprovals.length - 1;
        }
        
        const nextApproval = filteredApprovals[nextIndex];
        if (nextApproval) {
          setSelectedId(nextApproval.id);
        }
        return;
      }

      // Actions (only if an item is selected and pending)
      if (selectedId && selectedApproval?.status === 'pending') {
        // Approve with 'a' - shows confirmation for important items
        if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          openApproveConfirm();
          return;
        }
        
        // Reject with 'r' - opens dialog
        if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          openRejectModal();
          return;
        }
        
        // Escalate with 'e'
        if (e.key === 'e' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handleEscalate();
          return;
        }
        
        // Delegate with 'd'
        if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          openDelegateModal();
          return;
        }
      }

      // Search with '/'
      if (e.key === '/') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
        return;
      }

      // Escape to clear selection or close modals (in priority order)
      if (e.key === 'Escape') {
        if (rejectModalOpen) {
          setRejectModalOpen(false);
          setRejectReason('');
        } else if (approveConfirmOpen) {
          setApproveConfirmOpen(false);
        } else if (delegateModalOpen) {
          setDelegateModalOpen(false);
        } else if (showShortcuts) {
          setShowShortcuts(false);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    
  }, [selectedId, selectedApproval, filteredApprovals, showShortcuts, delegateModalOpen, rejectModalOpen, approveConfirmOpen]);

  const stats = useMemo(() => ({
    total: approvals.length,
    pending: approvals.filter(a => a.status === 'pending').length,
    urgent: approvals.filter(a => a.priority === 'urgent' && a.status === 'pending').length,
    approved: approvals.filter(a => a.status === 'approved').length,
    rejected: approvals.filter(a => a.status === 'rejected').length,
  }), [approvals]);

  // Send email notification for approval actions
  const sendNotification = async (
    type: 'approval_completed' | 'approval_rejected' | 'approval_escalated' | 'approval_reminder',
    approval: ApprovalRequest,
    message?: string
  ) => {
    try {
      await fetch('/api/approvals/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          contractId: approval.id,
          contractTitle: approval.title,
          recipientEmail: approval.requestedBy.email,
          recipientName: approval.requestedBy.name,
          senderName: 'Current User', // In production, get from session
          stepName: approval.approvers.find(a => a.isCurrent)?.role,
          dueDate: approval.dueDate,
          priority: approval.priority,
          message,
          actionUrl: `/approvals?id=${approval.id}`,
        }),
      });
    } catch {
      // Don't block the main action if notification fails
    }
  };

  // Open approval confirmation for high-value items
  const openApproveConfirm = () => {
    if (!selectedId || !selectedApproval) return;
    
    // For high-value or critical items, show confirmation
    const isHighValue = (selectedApproval.value || 0) > 100000;
    const isCritical = selectedApproval.priority === 'urgent' || selectedApproval.priority === 'high';
    
    if (isHighValue || isCritical) {
      setApproveConfirmOpen(true);
    } else {
      handleApprove();
    }
  };

  const handleApprove = async () => {
    if (!selectedId) return;
    
    setIsApproving(true);
    setApproveConfirmOpen(false);
    const selectedApprovalTitle = selectedApproval?.title || 'Approval';
    
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({
          action: 'approve',
          approvalId: selectedId,
          comment: 'Approved via approvals queue',
        }),
      });

      if (!response.ok) throw new Error('Failed to approve');
      
      const result = await response.json();
      if (result.success) {
        // Update local state
        setApprovals(prev => prev.map(a => 
          a.id === selectedId ? { ...a, status: 'approved' as const } : a
        ));
        // Invalidate related caches for seamless data flow
        crossModule.onApprovalComplete(selectedApproval?.contractId);
        // Send notification to requester
        if (selectedApproval) {
          sendNotification('approval_completed', selectedApproval, 'Approved via approvals queue');
        }
        toast.success('Approval completed', {
          description: `"${selectedApprovalTitle}" has been approved successfully.`,
        });
      }
    } catch {
      // Fallback to local state update
      setApprovals(prev => prev.map(a => 
        a.id === selectedId ? { ...a, status: 'approved' as const } : a
      ));
      // Invalidate related caches for seamless data flow
      crossModule.onApprovalComplete(selectedApproval?.contractId);
      // Still send notification
      if (selectedApproval) {
        sendNotification('approval_completed', selectedApproval, 'Approved via approvals queue');
      }
      toast.success('Approval completed', {
        description: `"${selectedApprovalTitle}" has been approved.`,
      });
    } finally {
      setIsApproving(false);
    }
  };

  // Open rejection dialog instead of window.prompt
  const openRejectModal = () => {
    setRejectTarget('single');
    setRejectReason('');
    setRejectModalOpen(true);
  };

  // Submit rejection with reason from dialog
  const handleRejectSubmit = async () => {
    if (rejectTarget === 'bulk') {
      await handleBulkRejectSubmit();
      return;
    }
    
    if (!selectedId || !rejectReason.trim()) {
      toast.error('Rejection reason required', {
        description: 'Please provide a reason for the rejection.',
      });
      return;
    }
    
    setIsRejecting(true);
    const selectedApprovalTitle = selectedApproval?.title || 'Approval';
    
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({
          action: 'reject',
          approvalId: selectedId,
          reason: rejectReason,
        }),
      });

      if (!response.ok) throw new Error('Failed to reject');
      
      const result = await response.json();
      if (result.success) {
        // Update local state
        setApprovals(prev => prev.map(a => 
          a.id === selectedId ? { ...a, status: 'rejected' as const } : a
        ));
        // Invalidate related caches for seamless data flow
        crossModule.onApprovalComplete(selectedApproval?.contractId);
        // Send notification to requester
        if (selectedApproval) {
          sendNotification('approval_rejected', selectedApproval, rejectReason);
        }
        toast.success('Approval rejected', {
          description: `"${selectedApprovalTitle}" has been rejected.`,
        });
        setRejectModalOpen(false);
        setRejectReason('');
      }
    } catch {
      // Fallback to local state update
      setApprovals(prev => prev.map(a => 
        a.id === selectedId ? { ...a, status: 'rejected' as const } : a
      ));
      // Invalidate related caches for seamless data flow
      crossModule.onApprovalComplete(selectedApproval?.contractId);
      // Still send notification
      if (selectedApproval) {
        sendNotification('approval_rejected', selectedApproval, rejectReason);
      }
      toast.success('Approval rejected', {
        description: `"${selectedApprovalTitle}" has been rejected.`,
      });
      setRejectModalOpen(false);
      setRejectReason('');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleEscalate = async () => {
    if (!selectedId) return;
    
    const selectedApprovalTitle = selectedApproval?.title || 'Approval';
    
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({
          action: 'escalate',
          approvalId: selectedId,
        }),
      });

      if (!response.ok) throw new Error('Failed to escalate');
      
      const result = await response.json();
      if (result.success) {
        setApprovals(prev => prev.map(a => 
          a.id === selectedId ? { ...a, status: 'escalated' as const } : a
        ));
        // Send notification about escalation
        if (selectedApproval) {
          sendNotification('approval_escalated', selectedApproval, 'Escalated to next approval level');
        }
        toast.success('Approval escalated', {
          description: `"${selectedApprovalTitle}" has been escalated to the next level.`,
        });
      }
    } catch {
      toast.error('Escalation failed', {
        description: 'Unable to escalate the approval. Please try again.',
      });
    }
  };

  const openDelegateModal = () => {
    setDelegateModalOpen(true);
    setDelegateTarget('');
    setDelegateNote('');
  };

  const handleDelegate = async () => {
    if (!selectedId || !delegateTarget) {
      toast.error('Delegation failed', {
        description: 'Please select a team member to delegate to.',
      });
      return;
    }
    
    const selectedApprovalTitle = selectedApproval?.title || 'Approval';
    const targetMember = teamMembers.find(m => m.id === delegateTarget);
    
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({
          action: 'delegate',
          approvalId: selectedId,
          delegateTo: delegateTarget,
          note: delegateNote,
        }),
      });

      if (!response.ok) throw new Error('Failed to delegate');
      
      const result = await response.json();
      if (result.success) {
        toast.success('Approval delegated', {
          description: `"${selectedApprovalTitle}" has been delegated to ${targetMember?.name || delegateTarget}.`,
        });
        setDelegateModalOpen(false);
      }
    } catch {
      toast.error('Delegation failed', {
        description: 'Unable to delegate the approval. Please try again.',
      });
    }
  };

  // Bulk approve selected items
  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({
          action: 'approve',
          approvalIds: ids,
          comment: 'Bulk approved via approvals queue',
        }),
      });

      if (!response.ok) throw new Error('Failed to bulk approve');
      
      // Update local state
      setApprovals(prev => prev.map(a => 
        selectedIds.has(a.id) ? { ...a, status: 'approved' as const } : a
      ));
      
      // Invalidate all related caches after bulk operation
      crossModule.onApprovalComplete();
      
      toast.success(`${ids.length} approvals completed`, {
        description: `Successfully approved ${ids.length} items.`,
      });
      
      clearSelection();
    } catch {
      // Fallback to local state update
      setApprovals(prev => prev.map(a => 
        selectedIds.has(a.id) ? { ...a, status: 'approved' as const } : a
      ));
      // Invalidate all related caches after bulk operation
      crossModule.onApprovalComplete();
      toast.success(`${ids.length} approvals completed`, {
        description: `Approved ${ids.length} items.`,
      });
      clearSelection();
    } finally {
      setBulkProcessing(false);
    }
  };

  // Open bulk reject modal
  const openBulkRejectModal = () => {
    if (selectedIds.size === 0) return;
    setRejectTarget('bulk');
    setRejectReason('');
    setRejectModalOpen(true);
  };

  // Bulk reject submit handler (called from dialog)
  const handleBulkRejectSubmit = async () => {
    if (selectedIds.size === 0) return;
    
    if (!rejectReason.trim()) {
      toast.error('Rejection reason required', {
        description: 'Please provide a reason for the rejection.',
      });
      return;
    }
    
    setIsRejecting(true);
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    
    try {
      // In a real app, you'd send all at once or batch
      for (const id of ids) {
        await fetch('/api/approvals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': getTenantId(),
          },
          body: JSON.stringify({
            action: 'reject',
            approvalId: id,
            reason: rejectReason,
          }),
        });
      }
      
      // Update local state
      setApprovals(prev => prev.map(a => 
        selectedIds.has(a.id) ? { ...a, status: 'rejected' as const } : a
      ));
      
      // Invalidate all related caches after bulk rejection
      crossModule.onApprovalComplete();
      
      toast.success(`${ids.length} approvals rejected`, {
        description: `Successfully rejected ${ids.length} items.`,
      });
      
      clearSelection();
      setRejectModalOpen(false);
      setRejectReason('');
    } catch {
      toast.error('Some rejections failed', {
        description: 'Please try again or reject individually.',
      });
    } finally {
      setIsRejecting(false);
      setBulkProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/20">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-200/50">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <p className="text-slate-600 font-medium">Loading workflow queue...</p>
          <p className="text-sm text-slate-400 mt-1">Fetching pending approvals</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/10">
      {/* Header */}
      <div className="flex-none p-6 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-200/50">
              <CheckCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-2">
                Workflow Queue
                <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full font-medium">
                  <Sparkles className="w-3 h-3 inline mr-1" />
                  AI-Powered
                </span>
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">Review and action pending approval requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ApprovalNotificationBell />
            {/* Refresh Button */}
            <button
              onClick={refreshApprovals}
              disabled={refreshing}
              className="p-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all border border-slate-200/50 disabled:opacity-50"
              title="Refresh approvals"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => setDelegationRulesOpen(true)}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-medium flex items-center gap-2 border border-slate-200/50"
            >
              <UserPlus className="w-4 h-4" />
              Delegation
            </button>
            <button className="px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-200 transition-all font-medium flex items-center gap-2">
              <History className="w-4 h-4" />
              History
            </button>
          </div>
        </div>
        
        {/* Last Updated Indicator */}
        {lastUpdated && (
          <div className="flex items-center justify-end mb-2 text-xs text-slate-400">
            <Clock className="w-3 h-3 mr-1" />
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}

        {/* Enhanced Stats */}
        <div className="grid grid-cols-5 gap-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/80 rounded-xl text-center border border-slate-200/50 hover:shadow-md transition-all"
          >
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Total</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/80 rounded-xl text-center border border-amber-200/50 hover:shadow-md hover:shadow-amber-100 transition-all"
          >
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-xs text-amber-600 font-medium mt-1">Pending</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 bg-gradient-to-br from-red-50 to-rose-50/80 rounded-xl text-center border border-red-200/50 ring-1 ring-red-100 hover:shadow-md hover:shadow-red-100 transition-all"
          >
            <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
              <AlertTriangle className="w-5 h-5" />
              {stats.urgent}
            </div>
            <div className="text-xs text-red-600 font-medium mt-1">Urgent</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-4 bg-gradient-to-br from-violet-50 to-violet-50/80 rounded-xl text-center border border-green-200/50 hover:shadow-md hover:shadow-green-100 transition-all"
          >
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-xs text-green-600 font-medium mt-1">Approved</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl text-center border border-slate-200/50 hover:shadow-md transition-all"
          >
            <div className="text-2xl font-bold text-slate-600">{stats.rejected}</div>
            <div className="text-xs text-slate-600 font-medium mt-1">Rejected</div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* List Panel */}
        <div className="w-[460px] flex-none border-r border-slate-200/50 bg-white/60 backdrop-blur-sm flex flex-col">
          {/* Filters */}
          <div className="p-4 border-b border-slate-100/80 bg-white/80">
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                data-search-input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search approvals... (press /)"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-indigo-300 bg-white/80 backdrop-blur-sm transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {(['all', 'pending', 'completed'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                    filter === f
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-200/50'
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-800'
                  }`}
                >
                  {f}
                </button>
              ))}
              </div>
              <div className="flex items-center gap-2">
                {/* ENHANCED: Sort dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-800 transition-all">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Sort: {sortBy === 'urgency' ? 'Urgency' : sortBy === 'value' ? 'Value' : sortBy === 'age' ? 'Age' : sortBy === 'risk' ? 'Risk' : 'Due Date'}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    <DropdownMenuItem onClick={() => setSortBy('urgency')} className={sortBy === 'urgency' ? 'bg-violet-50' : ''}>
                      <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
                      By Urgency
                      {sortBy === 'urgency' && <CheckCircle2 className="w-4 h-4 ml-auto text-violet-600" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('value')} className={sortBy === 'value' ? 'bg-violet-50' : ''}>
                      <DollarSign className="w-4 h-4 mr-2 text-green-500" />
                      By Value
                      {sortBy === 'value' && <CheckCircle2 className="w-4 h-4 ml-auto text-violet-600" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('dueDate')} className={sortBy === 'dueDate' ? 'bg-violet-50' : ''}>
                      <Calendar className="w-4 h-4 mr-2 text-amber-500" />
                      By Due Date
                      {sortBy === 'dueDate' && <CheckCircle2 className="w-4 h-4 ml-auto text-violet-600" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('risk')} className={sortBy === 'risk' ? 'bg-violet-50' : ''}>
                      <Shield className="w-4 h-4 mr-2 text-violet-500" />
                      By Risk Score
                      {sortBy === 'risk' && <CheckCircle2 className="w-4 h-4 ml-auto text-violet-600" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('age')} className={sortBy === 'age' ? 'bg-violet-50' : ''}>
                      <Clock className="w-4 h-4 mr-2 text-violet-500" />
                      By Age (Oldest)
                      {sortBy === 'age' && <CheckCircle2 className="w-4 h-4 ml-auto text-violet-600" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      {sortDirection === 'desc' ? 'Ascending' : 'Descending'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  onClick={() => setShowShortcuts(true)}
                  className="text-xs text-slate-400 hover:text-violet-600 flex items-center gap-1.5 transition-colors"
                  title="Keyboard shortcuts"
                >
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono border border-slate-200">?</kbd>
                  <span className="hidden sm:inline">Shortcuts</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 border-b border-indigo-200/50 bg-gradient-to-r from-violet-50 to-purple-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-indigo-800">
                    {selectedIds.size} selected
                  </span>
                  <button
                    onClick={selectAllPending}
                    className="text-xs text-violet-600 hover:text-indigo-800 underline font-medium"
                  >
                    Select all
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-xs text-violet-600 hover:text-indigo-800 underline font-medium"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkApprove}
                    disabled={bulkProcessing}
                    className="px-3 py-1.5 bg-gradient-to-r from-violet-500 to-violet-600 text-white text-sm rounded-lg hover:shadow-lg hover:shadow-green-200 transition-all font-medium flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {bulkProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ThumbsUp className="w-3.5 h-3.5" />
                    )}
                    Approve All
                  </button>
                  <button
                    onClick={openBulkRejectModal}
                    disabled={bulkProcessing}
                    className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm rounded-lg hover:shadow-lg hover:shadow-red-200 transition-all font-medium flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {bulkProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ThumbsDown className="w-3.5 h-3.5" />
                    )}
                    Reject All
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredApprovals.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-100/50">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {filter === 'pending' ? 'All caught up!' : 'No approvals found'}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto">
                    {filter === 'pending' 
                      ? 'You have no pending approvals at the moment. New requests will appear here.'
                      : searchQuery 
                        ? `No approvals match "${searchQuery}". Try a different search.`
                        : 'No approvals match the current filter.'}
                  </p>
                  {filter !== 'all' && (
                    <button
                      onClick={() => { setFilter('all'); setSearchQuery(''); }}
                      className="mt-5 text-sm text-violet-600 hover:text-violet-700 font-semibold flex items-center gap-1.5 mx-auto"
                    >
                      View all approvals
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredApprovals.map((approval, index) => (
                  <motion.div
                    key={approval.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <ApprovalCard
                      approval={approval}
                      isSelected={selectedId === approval.id}
                      isChecked={selectedIds.has(approval.id)}
                      onSelect={() => setSelectedId(approval.id)}
                      onToggleCheck={(e) => toggleSelection(approval.id, e)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-hidden hidden md:block">
          {selectedApproval ? (
            <DetailPanel
              approval={selectedApproval}
              onApprove={openApproveConfirm}
              onReject={openRejectModal}
              onEscalate={handleEscalate}
              onDelegate={openDelegateModal}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/20">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center p-8"
              >
                <div className="w-24 h-24 bg-white rounded-2xl shadow-xl shadow-violet-100/50 flex items-center justify-center mx-auto mb-6 border border-slate-100">
                  <FileText className="w-12 h-12 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-2">No Approval Selected</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto mb-6">
                  Select an approval from the list to view details and take action.
                </p>
                <div className="flex flex-col items-center gap-3 text-xs text-slate-400 bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-100">
                  <p className="font-medium text-slate-500 mb-1">Quick keyboard shortcuts</p>
                  <div className="flex items-center gap-3">
                    <kbd className="px-2.5 py-1.5 bg-slate-100 rounded-lg shadow-sm font-mono text-slate-600 border border-slate-200">j</kbd>
                    <kbd className="px-2.5 py-1.5 bg-slate-100 rounded-lg shadow-sm font-mono text-slate-600 border border-slate-200">k</kbd>
                    <span className="text-slate-500">Navigate list</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <kbd className="px-2.5 py-1.5 bg-green-100 rounded-lg shadow-sm font-mono text-green-700 border border-green-200">a</kbd>
                    <span className="text-slate-500">Approve</span>
                    <kbd className="px-2.5 py-1.5 bg-red-100 rounded-lg shadow-sm font-mono text-red-700 border border-red-200">r</kbd>
                    <span className="text-slate-500">Reject</span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Approval Actions - Fixed at bottom */}
      {selectedApproval && selectedApproval.status === 'pending' && (
        <MobileApprovalActions
          onApprove={openApproveConfirm}
          onReject={openRejectModal}
          onDelegate={openDelegateModal}
          onEscalate={handleEscalate}
          isProcessing={isApproving || isRejecting}
        />
      )}

      {/* Delegation Modal */}
      <Dialog open={delegateModalOpen} onOpenChange={setDelegateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-violet-600" />
              Delegate Approval
            </DialogTitle>
            <DialogDescription>
              Select a team member to delegate this approval to. They will receive a notification to review.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Delegate to</label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {teamMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setDelegateTarget(member.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      delegateTarget === member.id
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-slate-900">{member.name}</p>
                      <p className="text-sm text-slate-500">{member.role}</p>
                    </div>
                    {delegateTarget === member.id && (
                      <CheckCircle2 className="w-5 h-5 text-violet-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Note (optional)</label>
              <textarea
                value={delegateNote}
                onChange={(e) => setDelegateNote(e.target.value)}
                placeholder="Add a note for the delegate..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setDelegateModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelegate}
              disabled={!delegateTarget}
              className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Delegate
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Keyboard Shortcuts Help Modal */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div key="shortcuts"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Keyboard Shortcuts
              </h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-2">Navigation</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Next item</span>
                      <kbd className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono">j</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Previous item</span>
                      <kbd className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono">k</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Search</span>
                      <kbd className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono">/</kbd>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-2">Actions</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Approve</span>
                      <kbd className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-mono">a</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Reject</span>
                      <kbd className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-mono">r</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Escalate</span>
                      <kbd className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-mono">e</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Delegate</span>
                      <kbd className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-mono">d</kbd>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-2">General</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Show shortcuts</span>
                      <kbd className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono">?</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Close / Cancel</span>
                      <kbd className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono">Esc</kbd>
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => setShowShortcuts(false)}
                className="mt-6 w-full py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
              >
                Close (Esc)
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Delegation Rules Modal */}
      <DelegationRulesModal
        isOpen={delegationRulesOpen}
        onClose={() => setDelegationRulesOpen(false)}
      />
      
      {/* Rejection Reason Dialog */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              {rejectTarget === 'bulk' 
                ? `Reject ${selectedIds.size} Approval${selectedIds.size > 1 ? 's' : ''}`
                : 'Reject Approval'}
            </DialogTitle>
            <DialogDescription>
              {rejectTarget === 'bulk'
                ? `You are about to reject ${selectedIds.size} approval${selectedIds.size > 1 ? 's' : ''}. This action cannot be undone.`
                : 'Please provide a reason for the rejection. This will be shared with the requester.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter the reason for rejection..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300 transition-all"
              rows={4}
              autoFocus
              aria-label="Rejection reason"
              aria-required="true"
            />
            <p className="text-xs text-slate-400 mt-2">
              Provide a clear reason to help the requester understand the decision.
            </p>
          </div>
          
          {/* Common rejection reasons quick buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-slate-500">Quick reasons:</span>
            {[
              'Missing documentation',
              'Budget not approved',
              'Terms not acceptable',
              'Duplicate request',
            ].map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setRejectReason(reason)}
                className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                {reason}
              </button>
            ))}
          </div>
          
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => {
                setRejectModalOpen(false);
                setRejectReason('');
              }}
              disabled={isRejecting}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRejectSubmit}
              disabled={!rejectReason.trim() || isRejecting}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg hover:shadow-lg hover:shadow-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isRejecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <ThumbsDown className="w-4 h-4" />
                  {rejectTarget === 'bulk' ? `Reject ${selectedIds.size} Items` : 'Reject'}
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Approval Confirmation Dialog - For high-value/critical items */}
      <Dialog open={approveConfirmOpen} onOpenChange={setApproveConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              Confirm Approval
            </DialogTitle>
            <DialogDescription>
              {selectedApproval && (
                <>
                  You are about to approve <strong>&ldquo;{selectedApproval.title}&rdquo;</strong>
                  {selectedApproval.value && selectedApproval.value > 100000 && (
                    <span className="block mt-2 text-amber-600 font-medium">
                      ⚠️ High-value item: ${selectedApproval.value.toLocaleString()}
                    </span>
                  )}
                  {(selectedApproval.priority === 'urgent' || selectedApproval.priority === 'high') && (
                    <span className="block mt-1 text-amber-600 font-medium">
                      ⚠️ Priority: {selectedApproval.priority.toUpperCase()}
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-800">
                By approving, you confirm that you have reviewed the contract terms, pricing, 
                and compliance requirements.
              </p>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setApproveConfirmOpen(false)}
              disabled={isApproving}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving}
              className="px-4 py-2 bg-gradient-to-r from-violet-500 to-violet-600 text-white rounded-lg hover:shadow-lg hover:shadow-green-200 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isApproving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <ThumbsUp className="w-4 h-4" />
                  Confirm Approval
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={filteredApprovals.filter(a => a.status === 'pending').length}
        onApprove={handleBulkApprove}
        onReject={openBulkRejectModal}
        onSelectAll={selectAllPending}
        onClearSelection={clearSelection}
        isProcessing={bulkProcessing}
        processingAction={bulkProcessing ? 'Processing' : undefined}
      />
    </div>
  );
};

export default ApprovalsQueue;
