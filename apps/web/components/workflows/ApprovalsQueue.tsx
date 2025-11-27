'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  User,
  Calendar,
  ChevronRight,
  Filter,
  Search,
  MoreHorizontal,
  MessageSquare,
  Eye,
  History,
  ArrowRight,
  Zap,
  Users,
  Building2,
  DollarSign,
  Send,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Bell,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';

// ============================================================================
// Types
// ============================================================================

interface ApprovalRequest {
  id: string;
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

const mockApprovals: ApprovalRequest[] = [
  {
    id: 'a1',
    type: 'contract',
    title: 'New Master Agreement Approval',
    description: 'Review and approve the new master services agreement with CloudTech Solutions for enterprise software licensing.',
    contractName: 'Master Services Agreement',
    supplierName: 'CloudTech Solutions',
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
    case 'urgent': return { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle };
    case 'high': return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle };
    case 'medium': return { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock };
    case 'low': return { color: 'bg-green-100 text-green-700 border-green-200', icon: Clock };
  }
};

const getTypeConfig = (type: ApprovalRequest['type']) => {
  switch (type) {
    case 'contract': return { color: 'bg-blue-100 text-blue-700', label: 'New Contract', icon: FileText };
    case 'amendment': return { color: 'bg-purple-100 text-purple-700', label: 'Amendment', icon: FileText };
    case 'renewal': return { color: 'bg-green-100 text-green-700', label: 'Renewal', icon: RotateCcw };
    case 'termination': return { color: 'bg-red-100 text-red-700', label: 'Termination', icon: XCircle };
  }
};

const getStatusConfig = (status: ApprovalRequest['status']) => {
  switch (status) {
    case 'pending': return { color: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Pending' };
    case 'approved': return { color: 'bg-green-100 text-green-700', icon: CheckCircle2, label: 'Approved' };
    case 'rejected': return { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Rejected' };
    case 'escalated': return { color: 'bg-purple-100 text-purple-700', icon: ArrowRight, label: 'Escalated' };
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
  onSelect: () => void;
}

const ApprovalCard: React.FC<ApprovalCardProps> = ({ approval, isSelected, onSelect }) => {
  const priority = getPriorityConfig(approval.priority);
  const type = getTypeConfig(approval.type);
  const status = getStatusConfig(approval.status);
  const TypeIcon = type.icon;
  const StatusIcon = status.icon;
  const daysUntilDue = getDaysUntilDue(approval.dueDate);

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50/50 shadow-lg'
          : approval.priority === 'urgent'
          ? 'border-red-200 bg-red-50/30 hover:border-red-300'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${type.color} flex items-center justify-center flex-shrink-0`}>
          <TypeIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${type.color}`}>
              {type.label}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priority.color} capitalize`}>
              {approval.priority}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${status.color}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
          </div>

          <h3 className="font-semibold text-slate-900 truncate">{approval.title}</h3>
          <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
            <Building2 className="w-3 h-3" />
            {approval.supplierName}
            {approval.value && (
              <>
                <span className="text-slate-300">•</span>
                <DollarSign className="w-3 h-3" />
                ${approval.value.toLocaleString()}
              </>
            )}
          </p>
        </div>

        <div className="text-right">
          <div className={`text-sm font-medium ${daysUntilDue <= 2 ? 'text-red-600' : daysUntilDue <= 5 ? 'text-amber-600' : 'text-slate-600'}`}>
            {daysUntilDue === 0 ? 'Due today' : daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : `${daysUntilDue}d left`}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Step {approval.currentStep}/{approval.totalSteps}
          </div>
          
          {/* Approver Avatars */}
          <div className="flex items-center justify-end mt-2 -space-x-2">
            {approval.approvers.slice(0, 3).map((approver, idx) => (
              <div
                key={approver.id}
                className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium ${
                  approver.status === 'approved' ? 'bg-green-500 text-white' :
                  approver.status === 'rejected' ? 'bg-red-500 text-white' :
                  approver.isCurrent ? 'bg-blue-500 text-white' :
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
        <div className="mt-3 flex flex-wrap gap-1">
          {approval.riskFlags.map((flag, idx) => (
            <span key={idx} className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {flag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ============================================================================
// Detail Panel Component
// ============================================================================

interface DetailPanelProps {
  approval: ApprovalRequest;
  onApprove: () => void;
  onReject: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ approval, onApprove, onReject }) => {
  const [comment, setComment] = useState('');
  const type = getTypeConfig(approval.type);
  const TypeIcon = type.icon;

  const currentApprover = approval.approvers.find(a => a.isCurrent);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl ${type.color} flex items-center justify-center`}>
            <TypeIcon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-900">{approval.title}</h2>
            <p className="text-slate-500 mt-1">{approval.description}</p>
          </div>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-xs text-slate-500 uppercase mb-1">Supplier</div>
            <div className="font-medium text-slate-900">{approval.supplierName}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-xs text-slate-500 uppercase mb-1">Contract Value</div>
            <div className="font-medium text-slate-900">${approval.value?.toLocaleString() || 'N/A'}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-xs text-slate-500 uppercase mb-1">Due Date</div>
            <div className="font-medium text-slate-900">{approval.dueDate}</div>
          </div>
        </div>
      </div>

      {/* Approval Timeline */}
      <div className="p-6 border-b border-slate-200">
        <h3 className="text-sm font-medium text-slate-500 uppercase mb-4">Approval Workflow</h3>
        <div className="space-y-4">
          {approval.approvers.map((approver, idx) => (
            <div key={approver.id} className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                approver.status === 'approved' ? 'bg-green-100 text-green-700' :
                approver.status === 'rejected' ? 'bg-red-100 text-red-700' :
                approver.isCurrent ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-2' :
                'bg-slate-100 text-slate-500'
              }`}>
                {approver.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> :
                 approver.status === 'rejected' ? <XCircle className="w-5 h-5" /> :
                 approver.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{approver.name}</span>
                  {approver.isCurrent && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Current</span>
                  )}
                </div>
                <div className="text-sm text-slate-500">{approver.role}</div>
              </div>
              <div className="text-right">
                {approver.respondedAt ? (
                  <span className="text-sm text-slate-500">
                    {new Date(approver.respondedAt).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-sm text-slate-400">Pending</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comments */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h3 className="text-sm font-medium text-slate-500 uppercase mb-4">Comments & History</h3>
        {approval.comments.length > 0 ? (
          <div className="space-y-4">
            {approval.comments.map(c => (
              <div key={c.id} className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-900">{c.author}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{c.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2" />
            <p>No comments yet</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {approval.status === 'pending' && currentApprover && (
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="mb-4">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment (optional)..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onApprove}
              className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <ThumbsUp className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={onReject}
              className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <ThumbsDown className="w-4 h-4" />
              Reject
            </button>
            <button className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium flex items-center gap-2">
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
  const { isMockData } = useDataMode();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch approvals from API or use mock data based on mode
  useEffect(() => {
    async function fetchApprovals() {
      // If in demo mode, always use mock data
      if (isMockData) {
        setApprovals(mockApprovals);
        setSelectedId(mockApprovals[0]?.id ?? null);
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch('/api/approvals');
        const json = await res.json();
        if (json.success && json.data?.items?.length > 0) {
          // Map API data to ApprovalRequest format
          const mapped = json.data.items.map((item: any) => ({
            id: item.id,
            type: item.type || 'contract',
            title: item.title || `${item.type || 'Contract'} Approval`,
            description: item.description || '',
            contractName: item.contractName || item.title || 'Unknown Contract',
            supplierName: item.counterparty || item.vendor || 'Unknown',
            requestedBy: { 
              name: item.requestedBy?.name || 'System', 
              email: item.requestedBy?.email || 'system@company.com' 
            },
            requestedAt: item.createdAt || new Date().toISOString(),
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
          }));
          setApprovals(mapped);
          if (mapped.length > 0) setSelectedId(mapped[0].id);
        } else {
          // Fallback to mock data
          setApprovals(mockApprovals);
          setSelectedId(mockApprovals[0]?.id ?? null);
        }
      } catch (error) {
        console.log('Using mock approvals data');
        setApprovals(mockApprovals);
        setSelectedId(mockApprovals[0]?.id ?? null);
      } finally {
        setLoading(false);
      }
    }
    fetchApprovals();
  }, [isMockData]);

  const selectedApproval = approvals.find(a => a.id === selectedId);

  const filteredApprovals = useMemo(() => {
    return approvals.filter(a => {
      if (filter === 'pending' && a.status !== 'pending') return false;
      if (filter === 'completed' && a.status === 'pending') return false;
      if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !a.supplierName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [approvals, filter, searchQuery]);

  const stats = useMemo(() => ({
    total: approvals.length,
    pending: approvals.filter(a => a.status === 'pending').length,
    urgent: approvals.filter(a => a.priority === 'urgent' && a.status === 'pending').length,
    approved: approvals.filter(a => a.status === 'approved').length,
    rejected: approvals.filter(a => a.status === 'rejected').length,
  }), [approvals]);

  const handleApprove = () => {
    if (!selectedId) return;
    setApprovals(prev => prev.map(a => 
      a.id === selectedId ? { ...a, status: 'approved' as const } : a
    ));
  };

  const handleReject = () => {
    if (!selectedId) return;
    setApprovals(prev => prev.map(a => 
      a.id === selectedId ? { ...a, status: 'rejected' as const } : a
    ));
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-600">Loading approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex-none p-6 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <CheckCheck className="w-5 h-5 text-blue-500" />
              Approvals Queue
            </h1>
            <p className="text-sm text-slate-500 mt-1">Review and action pending approval requests</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors relative">
              <Bell className="w-5 h-5" />
              {stats.urgent > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {stats.urgent}
                </span>
              )}
            </button>
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center gap-2">
              <History className="w-4 h-4" />
              History
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg text-center">
            <div className="text-xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500">Total</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg text-center">
            <div className="text-xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-xs text-amber-600">Pending</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-center border border-red-200">
            <div className="text-xl font-bold text-red-600">{stats.urgent}</div>
            <div className="text-xs text-red-600">Urgent</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <div className="text-xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-xs text-green-600">Approved</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-lg text-center">
            <div className="text-xl font-bold text-slate-600">{stats.rejected}</div>
            <div className="text-xs text-slate-600">Rejected</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* List Panel */}
        <div className="w-[450px] flex-none border-r border-slate-200 bg-white flex flex-col">
          {/* Filters */}
          <div className="p-4 border-b border-slate-100">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search approvals..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              {(['all', 'pending', 'completed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                    filter === f
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredApprovals.map(approval => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                isSelected={selectedId === approval.id}
                onSelect={() => setSelectedId(approval.id)}
              />
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-hidden">
          {selectedApproval ? (
            <DetailPanel
              approval={selectedApproval}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-3" />
                <p>Select an approval to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalsQueue;
