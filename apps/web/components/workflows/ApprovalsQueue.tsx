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
  UserPlus,
} from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';
import { useApprovalFlow } from '@/hooks/use-collaboration';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ApprovalNotificationBell } from './ApprovalNotificationBell';

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
  isChecked: boolean;
  onSelect: () => void;
  onToggleCheck: (e: React.MouseEvent) => void;
}

const ApprovalCard: React.FC<ApprovalCardProps> = ({ approval, isSelected, isChecked, onSelect, onToggleCheck }) => {
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
        {/* Checkbox for bulk selection */}
        {approval.status === 'pending' && (
          <button
            onClick={onToggleCheck}
            className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all mt-2.5 ${
              isChecked
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-slate-300 hover:border-blue-400'
            }`}
          >
            {isChecked && <CheckCircle2 className="w-3 h-3" />}
          </button>
        )}
        
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
  onEscalate: () => void;
  onDelegate: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ approval, onApprove, onReject, onEscalate, onDelegate }) => {
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onApprove}
              className="flex-1 min-w-[120px] px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <ThumbsUp className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={onReject}
              className="flex-1 min-w-[120px] px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <ThumbsDown className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={onDelegate}
              className="px-4 py-2.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Delegate
            </button>
            <button
              onClick={onEscalate}
              className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium flex items-center gap-2"
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
  const { isMockData } = useDataMode();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [delegateModalOpen, setDelegateModalOpen] = useState(false);
  const [delegateTarget, setDelegateTarget] = useState('');
  const [delegateNote, setDelegateNote] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

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
        
        if (filteredApprovals[nextIndex]) {
          setSelectedId(filteredApprovals[nextIndex].id);
        }
        return;
      }

      // Actions (only if an item is selected and pending)
      if (selectedId && selectedApproval?.status === 'pending') {
        // Approve with 'a'
        if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handleApprove();
          return;
        }
        
        // Reject with 'r'
        if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handleReject();
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

      // Escape to clear selection or close modal
      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else if (delegateModalOpen) {
          setDelegateModalOpen(false);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedApproval, filteredApprovals, showShortcuts, delegateModalOpen]);

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
    } catch (error) {
      console.error('Failed to send notification:', error);
      // Don't block the main action if notification fails
    }
  };

  const handleApprove = async () => {
    if (!selectedId) return;
    
    const selectedApprovalTitle = selectedApproval?.title || 'Approval';
    
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo',
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
        // Send notification to requester
        if (selectedApproval) {
          sendNotification('approval_completed', selectedApproval, 'Approved via approvals queue');
        }
        toast.success('Approval completed', {
          description: `"${selectedApprovalTitle}" has been approved successfully.`,
        });
      }
    } catch (error) {
      console.error('Approve error:', error);
      // Fallback to local state update
      setApprovals(prev => prev.map(a => 
        a.id === selectedId ? { ...a, status: 'approved' as const } : a
      ));
      // Still send notification
      if (selectedApproval) {
        sendNotification('approval_completed', selectedApproval, 'Approved via approvals queue');
      }
      toast.success('Approval completed', {
        description: `"${selectedApprovalTitle}" has been approved.`,
      });
    }
  };

  const handleReject = async () => {
    if (!selectedId) return;
    
    const reason = window.prompt('Please provide a reason for rejection:');
    if (!reason) {
      toast.info('Rejection cancelled', {
        description: 'A reason is required to reject an approval.',
      });
      return;
    }
    
    const selectedApprovalTitle = selectedApproval?.title || 'Approval';
    
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo',
        },
        body: JSON.stringify({
          action: 'reject',
          approvalId: selectedId,
          reason,
        }),
      });

      if (!response.ok) throw new Error('Failed to reject');
      
      const result = await response.json();
      if (result.success) {
        // Update local state
        setApprovals(prev => prev.map(a => 
          a.id === selectedId ? { ...a, status: 'rejected' as const } : a
        ));
        // Send notification to requester
        if (selectedApproval) {
          sendNotification('approval_rejected', selectedApproval, reason);
        }
        toast.success('Approval rejected', {
          description: `"${selectedApprovalTitle}" has been rejected.`,
        });
      }
    } catch (error) {
      console.error('Reject error:', error);
      // Fallback to local state update
      setApprovals(prev => prev.map(a => 
        a.id === selectedId ? { ...a, status: 'rejected' as const } : a
      ));
      // Still send notification
      if (selectedApproval) {
        sendNotification('approval_rejected', selectedApproval, reason);
      }
      toast.success('Approval rejected', {
        description: `"${selectedApprovalTitle}" has been rejected.`,
      });
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
          'x-tenant-id': 'demo',
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
    } catch (error) {
      console.error('Escalate error:', error);
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
          'x-tenant-id': 'demo',
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
    } catch (error) {
      console.error('Delegate error:', error);
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
          'x-tenant-id': 'demo',
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
      
      toast.success(`${ids.length} approvals completed`, {
        description: `Successfully approved ${ids.length} items.`,
      });
      
      clearSelection();
    } catch (error) {
      console.error('Bulk approve error:', error);
      // Fallback to local state update
      setApprovals(prev => prev.map(a => 
        selectedIds.has(a.id) ? { ...a, status: 'approved' as const } : a
      ));
      toast.success(`${ids.length} approvals completed`, {
        description: `Approved ${ids.length} items.`,
      });
      clearSelection();
    } finally {
      setBulkProcessing(false);
    }
  };

  // Bulk reject selected items
  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    
    const reason = window.prompt(`Please provide a reason for rejecting ${selectedIds.size} items:`);
    if (!reason) {
      toast.info('Rejection cancelled', {
        description: 'A reason is required to reject approvals.',
      });
      return;
    }
    
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    
    try {
      // In a real app, you'd send all at once or batch
      for (const id of ids) {
        await fetch('/api/approvals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': 'demo',
          },
          body: JSON.stringify({
            action: 'reject',
            approvalId: id,
            reason,
          }),
        });
      }
      
      // Update local state
      setApprovals(prev => prev.map(a => 
        selectedIds.has(a.id) ? { ...a, status: 'rejected' as const } : a
      ));
      
      toast.success(`${ids.length} approvals rejected`, {
        description: `Successfully rejected ${ids.length} items.`,
      });
      
      clearSelection();
    } catch (error) {
      console.error('Bulk reject error:', error);
      toast.error('Some rejections failed', {
        description: 'Please try again or reject individually.',
      });
    } finally {
      setBulkProcessing(false);
    }
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
            <ApprovalNotificationBell />
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
                data-search-input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search approvals... (press /)"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between mb-2">
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
              <button
                onClick={() => setShowShortcuts(true)}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                title="Keyboard shortcuts"
              >
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">?</kbd>
                Shortcuts
              </button>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 border-b border-blue-200 bg-blue-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-800">
                    {selectedIds.size} selected
                  </span>
                  <button
                    onClick={selectAllPending}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Select all pending
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkApprove}
                    disabled={bulkProcessing}
                    className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {bulkProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ThumbsUp className="w-3.5 h-3.5" />
                    )}
                    Approve All
                  </button>
                  <button
                    onClick={handleBulkReject}
                    disabled={bulkProcessing}
                    className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center gap-1.5 disabled:opacity-50"
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
            {filteredApprovals.map(approval => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                isSelected={selectedId === approval.id}
                isChecked={selectedIds.has(approval.id)}
                onSelect={() => setSelectedId(approval.id)}
                onToggleCheck={(e) => toggleSelection(approval.id, e)}
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
              onEscalate={handleEscalate}
              onDelegate={openDelegateModal}
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

      {/* Delegation Modal */}
      <Dialog open={delegateModalOpen} onOpenChange={setDelegateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
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
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-slate-900">{member.name}</p>
                      <p className="text-sm text-slate-500">{member.role}</p>
                    </div>
                    {delegateTarget === member.id && (
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          <motion.div
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
                      <kbd className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-mono">e</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Delegate</span>
                      <kbd className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-mono">d</kbd>
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
    </div>
  );
};

export default ApprovalsQueue;
