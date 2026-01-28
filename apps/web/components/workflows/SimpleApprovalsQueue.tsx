'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Search,
  Eye,
  ArrowRight,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Pen,
  Archive,
  Building2,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkApprovalActions } from '@/components/approvals/BulkApprovalActions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ApprovalItem {
  id: string;
  contractId: string;
  title: string;
  supplier: string;
  value: number;
  type: 'contract' | 'amendment' | 'renewal';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'approved' | 'rejected';
  dueDate: string;
  requestedBy: string;
  currentStep: number;
  totalSteps: number;
}

// ============================================================================
// Step Indicator Component
// ============================================================================

function WorkflowStepIndicator({ 
  currentStep, 
  contractStatus 
}: { 
  currentStep: 'review' | 'approve' | 'sign' | 'store';
  contractStatus?: string;
}) {
  const steps = [
    { key: 'review', label: 'Review', icon: Eye },
    { key: 'approve', label: 'Approve', icon: CheckCircle2 },
    { key: 'sign', label: 'Sign', icon: Pen },
    { key: 'store', label: 'Store', icon: Archive },
  ];

  const stepIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isActive = step.key === currentStep;
        const isComplete = idx < stepIndex;
        
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  isActive && "bg-violet-500 text-white shadow-lg shadow-violet-200",
                  isComplete && "bg-green-500 text-white",
                  !isActive && !isComplete && "bg-slate-100 text-slate-400"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span className={cn(
                "text-xs font-medium",
                isActive && "text-violet-600",
                isComplete && "text-green-600",
                !isActive && !isComplete && "text-slate-400"
              )}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn(
                "w-12 h-0.5 mb-5",
                idx < stepIndex ? "bg-green-500" : "bg-slate-200"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============================================================================
// Approval Card Component (Simplified)
// ============================================================================

interface ApprovalCardProps {
  item: ApprovalItem;
  isSelected: boolean;
  onSelect: () => void;
  isMultiSelected: boolean;
  onMultiSelect: (checked: boolean) => void;
}

function ApprovalCard({ item, isSelected, onSelect, isMultiSelected, onMultiSelect }: ApprovalCardProps) {
  const daysUntilDue = Math.ceil(
    (new Date(item.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const priorityColors = {
    urgent: 'bg-red-50 border-red-200 text-red-700',
    high: 'bg-orange-50 border-orange-200 text-orange-700',
    medium: 'bg-amber-50 border-amber-200 text-amber-700',
    low: 'bg-green-50 border-green-200 text-green-700',
  };

  const typeLabels = {
    contract: 'New Contract',
    amendment: 'Amendment',
    renewal: 'Renewal',
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        "p-4 rounded-xl border-2 transition-all relative",
        isSelected
          ? "border-violet-500 bg-violet-50/50 shadow-lg"
          : isMultiSelected
          ? "border-violet-400 bg-violet-50/30 shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
      )}
    >
      {/* Multi-select checkbox */}
      <div className="absolute top-4 left-4 z-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isMultiSelected}
          onCheckedChange={onMultiSelect}
        />
      </div>

      <div className="flex items-start gap-4 cursor-pointer" onClick={onSelect}>
        {/* Icon */}
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center ml-8",
          item.type === 'contract' && "bg-violet-100 text-violet-600",
          item.type === 'amendment' && "bg-purple-100 text-purple-600",
          item.type === 'renewal' && "bg-green-100 text-green-600"
        )}>
          <FileText className="w-6 h-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">
              {typeLabels[item.type]}
            </Badge>
            <Badge className={cn("text-xs capitalize", priorityColors[item.priority])}>
              {item.priority}
            </Badge>
          </div>
          
          <h3 className="font-semibold text-slate-900 truncate mb-1">
            {item.title}
          </h3>
          
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              {item.supplier}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              {item.value.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Right side info */}
        <div className="text-right">
          <div className={cn(
            "text-sm font-medium mb-1",
            daysUntilDue <= 2 ? "text-red-600" :
            daysUntilDue <= 5 ? "text-amber-600" :
            "text-slate-600"
          )}>
            {daysUntilDue <= 0 ? 'Overdue' : 
             daysUntilDue === 1 ? 'Due tomorrow' :
             `${daysUntilDue} days left`}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span>Step {item.currentStep}/{item.totalSteps}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Detail Panel (Simplified with Clear Actions)
// ============================================================================

interface DetailPanelProps {
  item: ApprovalItem;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onProceedToSign: () => void;
  isProcessing: boolean;
}

function DetailPanel({ item, onApprove, onReject, onProceedToSign, isProcessing }: DetailPanelProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    onReject(rejectReason);
    setShowRejectDialog(false);
    setRejectReason('');
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-14 h-14 rounded-xl flex items-center justify-center",
            item.type === 'contract' && "bg-violet-100 text-violet-600",
            item.type === 'amendment' && "bg-purple-100 text-purple-600",
            item.type === 'renewal' && "bg-green-100 text-green-600"
          )}>
            <FileText className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900">{item.title}</h2>
            <p className="text-slate-500 mt-1">
              Requested by {item.requestedBy}
            </p>
          </div>
        </div>

        {/* Workflow Progress */}
        <WorkflowStepIndicator 
          currentStep={item.status === 'approved' ? 'sign' : 'approve'} 
        />
      </div>

      {/* Contract Details */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">Supplier</span>
              </div>
              <p className="font-semibold text-slate-900">{item.supplier}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">Contract Value</span>
              </div>
              <p className="font-semibold text-slate-900">
                ${item.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">Due Date</span>
              </div>
              <p className="font-semibold text-slate-900">{item.dueDate}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">Requested By</span>
              </div>
              <p className="font-semibold text-slate-900">{item.requestedBy}</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link href={`/contracts/${item.contractId}`} className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <Eye className="w-4 h-4" />
                View Contract
              </Button>
            </Link>
            <Link href={`/contracts/${item.contractId}/redline`} className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <FileText className="w-4 h-4" />
                View Redlines
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* What happens next info */}
        <Card className="bg-violet-50 border-violet-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-violet-900 flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              What happens next?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-violet-800">
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>Approve</strong> - You confirm the contract terms are acceptable</li>
              <li><strong>Signatures</strong> - The contract is sent for digital signatures</li>
              <li><strong>Storage</strong> - Signed contract is archived and tracked</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      {item.status === 'pending' && (
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <Button
              onClick={onApprove}
              disabled={isProcessing}
              className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
              size="lg"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ThumbsUp className="w-5 h-5" />
              )}
              Approve & Continue
            </Button>
            <Button
              onClick={() => setShowRejectDialog(true)}
              disabled={isProcessing}
              variant="outline"
              className="flex-1 text-red-600 hover:bg-red-50 hover:text-red-700 gap-2 border-red-200"
              size="lg"
            >
              <ThumbsDown className="w-5 h-5" />
              Reject
            </Button>
          </div>
          <p className="text-xs text-slate-500 text-center mt-3">
            Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">A</kbd> to approve or{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">R</kbd> to reject
          </p>
        </div>
      )}

      {/* Approved state - Next step */}
      {item.status === 'approved' && (
        <div className="p-6 border-t border-slate-200 bg-green-50">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">Contract Approved!</p>
              <p className="text-sm text-green-600">Ready for signatures</p>
            </div>
          </div>
          <Button
            onClick={onProceedToSign}
            className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
            size="lg"
          >
            <Pen className="w-5 h-5" />
            Proceed to Signatures
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Reject Approval
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this contract. This will be sent to the requester.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SimpleApprovalsQueue() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch approvals
  useEffect(() => {
    async function fetchApprovals() {
      try {
        const res = await fetch('/api/approvals');
        const json = await res.json();
        if (json.success && json.data?.items) {
          const mapped: ApprovalItem[] = json.data.items.map((item: any) => ({
            id: item.id,
            contractId: item.contractId || item.id,
            title: item.title || item.contractName || 'Untitled Contract',
            supplier: item.supplierName || item.counterparty || 'Unknown Supplier',
            value: item.contractValue || item.value || 0,
            type: item.type || 'contract',
            priority: item.priority || 'medium',
            status: item.status || 'pending',
            dueDate: item.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            requestedBy: item.requestedBy?.name || 'System',
            currentStep: item.currentStep || 1,
            totalSteps: item.totalSteps || 2,
          }));
          setItems(mapped);
          if (mapped.length > 0 && !selectedId) {
            const firstItem = mapped[0];
            if (firstItem) {
              setSelectedId(firstItem.id);
            }
          }
        }
      } catch {
        // Set demo data if API fails
        setItems([
          {
            id: 'demo-1',
            contractId: 'contract-001',
            title: 'Cloud Services Agreement',
            supplier: 'CloudTech Inc',
            value: 450000,
            type: 'contract',
            priority: 'high',
            status: 'pending',
            dueDate: '2024-03-20',
            requestedBy: 'Sarah Johnson',
            currentStep: 2,
            totalSteps: 3,
          },
          {
            id: 'demo-2',
            contractId: 'contract-002',
            title: 'Software License Renewal',
            supplier: 'TechVendor LLC',
            value: 125000,
            type: 'renewal',
            priority: 'urgent',
            status: 'pending',
            dueDate: '2024-03-15',
            requestedBy: 'Mike Chen',
            currentStep: 1,
            totalSteps: 2,
          },
        ]);
        setSelectedId('demo-1');
      } finally {
        setLoading(false);
      }
    }
    fetchApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedItem = items.find(i => i.id === selectedId);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filter === 'pending' && item.status !== 'pending') return false;
      if (filter === 'approved' && item.status !== 'approved') return false;
      if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [items, filter, searchQuery]);

  const stats = useMemo(() => ({
    pending: items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    urgent: items.filter(i => i.priority === 'urgent' && i.status === 'pending').length,
  }), [items]);

  const handleApprove = async () => {
    if (!selectedId) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', approvalId: selectedId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to approve contract');
      }
      
      setItems(prev => prev.map(i => 
        i.id === selectedId ? { ...i, status: 'approved' as const } : i
      ));
      toast.success('Contract approved!', {
        description: 'Ready for signatures.',
      });
    } catch {
      toast.error('Failed to approve contract', {
        description: 'Please try again or contact support.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedId) return;
    
    setIsProcessing(true);
    try {
      await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', approvalId: selectedId, reason }),
      });
      
      setItems(prev => prev.map(i => 
        i.id === selectedId ? { ...i, status: 'rejected' as const } : i
      ));
      toast.success('Contract rejected', {
        description: 'The requester has been notified.',
      });
    } catch {
      toast.error('Failed to reject');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProceedToSign = () => {
    if (!selectedItem) return;
    toast.success('Proceeding to signatures', {
      description: 'Opening signature workflow...',
    });
    // Navigate to signature page
    window.location.href = `/contracts/${selectedItem.contractId}/sign`;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'j') {
        e.preventDefault();
        const idx = filteredItems.findIndex(i => i.id === selectedId);
        const next = filteredItems[idx + 1];
        if (next) setSelectedId(next.id);
      } else if (e.key === 'k') {
        e.preventDefault();
        const idx = filteredItems.findIndex(i => i.id === selectedId);
        const prev = filteredItems[idx - 1];
        if (prev) setSelectedId(prev.id);
      } else if (e.key === 'a' && selectedItem?.status === 'pending') {
        e.preventDefault();
        handleApprove();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedItem, filteredItems]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-violet-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Simple Header */}
      <div className="flex-none p-6 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Approvals</h1>
            <p className="text-slate-500">Review and approve contracts</p>
          </div>
          <div className="flex items-center gap-4">
            {stats.urgent > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                {stats.urgent} Urgent
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200">
              <Clock className="w-3 h-3" />
              {stats.pending} Pending
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contracts..."
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            {(['pending', 'approved', 'all'] as const).map(f => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
                className="capitalize"
              >
                {f}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* List */}
        <div className="w-[400px] flex-none border-r border-slate-200 bg-white overflow-y-auto p-4 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2">All caught up!</h3>
              <p className="text-slate-500 text-sm">No pending approvals</p>
            </div>
          ) : (
            filteredItems.map(item => (
              <ApprovalCard
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                onSelect={() => setSelectedId(item.id)}
                isMultiSelected={selectedIds.includes(item.id)}
                onMultiSelect={(checked) => {
                  setSelectedIds(prev => 
                    checked ? [...prev, item.id] : prev.filter(id => id !== item.id)
                  );
                }}
              />
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-hidden">
          {selectedItem ? (
            <DetailPanel
              item={selectedItem}
              onApprove={handleApprove}
              onReject={handleReject}
              onProceedToSign={handleProceedToSign}
              isProcessing={isProcessing}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select an item to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <BulkApprovalActions
          selectedIds={selectedIds}
          contracts={items.map(item => ({
            id: item.contractId,
            title: item.title,
            supplier: item.supplier,
          }))}
          onSuccess={() => {
            setSelectedIds([]);
            // Refresh approvals list
            window.location.reload();
          }}
          onClearSelection={() => setSelectedIds([])}
        />
      )}
    </div>
  );
}

export default SimpleApprovalsQueue;
