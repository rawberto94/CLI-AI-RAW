/**
 * Approval Workflow
 * Contract approval process management
 */

'use client';

import { memo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  ArrowRight,
  MessageSquare,
  AlertTriangle,
  Send,
  RotateCcw,
  FileText,
  Calendar,
  User,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

interface Approver {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: ApprovalStatus;
  decidedAt?: Date;
  comment?: string;
  order: number;
}

interface ApprovalRequest {
  id: string;
  contractId: string;
  contractName: string;
  contractType: string;
  requestedBy: {
    id: string;
    name: string;
    avatar?: string;
  };
  requestedAt: Date;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'in_progress' | 'approved' | 'rejected' | 'expired';
  approvers: Approver[];
  currentStep: number;
  notes?: string;
}

// Demo data
const demoApprovers: Approver[] = [
  {
    id: 'a1',
    name: 'Sarah Johnson',
    email: 'sarah@company.com',
    role: 'Legal Counsel',
    status: 'approved',
    decidedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    comment: 'Reviewed all terms. Approved.',
    order: 1,
  },
  {
    id: 'a2',
    name: 'Michael Chen',
    email: 'michael@company.com',
    role: 'Finance Director',
    status: 'approved',
    decidedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    comment: 'Payment terms are acceptable.',
    order: 2,
  },
  {
    id: 'a3',
    name: 'Emily Davis',
    email: 'emily@company.com',
    role: 'VP Operations',
    status: 'pending',
    order: 3,
  },
  {
    id: 'a4',
    name: 'Robert Wilson',
    email: 'robert@company.com',
    role: 'CEO',
    status: 'pending',
    order: 4,
  },
];

const demoRequests: ApprovalRequest[] = [
  {
    id: 'req-1',
    contractId: 'contract-123',
    contractName: 'Enterprise Software License - TechCorp',
    contractType: 'Software License',
    requestedBy: {
      id: 'user-1',
      name: 'John Smith',
    },
    requestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    priority: 'high',
    status: 'in_progress',
    approvers: demoApprovers,
    currentStep: 3,
    notes: 'Urgent approval needed for Q4 implementation.',
  },
  {
    id: 'req-2',
    contractId: 'contract-124',
    contractName: 'Vendor Agreement - SupplyCo',
    contractType: 'Vendor Agreement',
    requestedBy: {
      id: 'user-2',
      name: 'Jane Doe',
    },
    requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    priority: 'medium',
    status: 'in_progress',
    approvers: demoApprovers.slice(0, 2).map((a, i) => ({
      ...a,
      status: i === 0 ? 'approved' : 'pending',
      order: i + 1,
    })),
    currentStep: 2,
  },
  {
    id: 'req-3',
    contractId: 'contract-125',
    contractName: 'NDA - Startup Inc',
    contractType: 'NDA',
    requestedBy: {
      id: 'user-1',
      name: 'John Smith',
    },
    requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    priority: 'low',
    status: 'approved',
    approvers: demoApprovers.slice(0, 1).map(a => ({
      ...a,
      status: 'approved' as ApprovalStatus,
    })),
    currentStep: 1,
  },
];

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'Pending' },
  approved: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-100', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', label: 'Rejected' },
  changes_requested: { icon: RotateCcw, color: 'text-orange-500', bg: 'bg-orange-100', label: 'Changes Requested' },
};

const priorityColors = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-violet-100 text-violet-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

interface ApprovalWorkflowProps {
  contractId?: string;
  onApprovalComplete?: (approved: boolean) => void;
  className?: string;
}

export const ApprovalWorkflow = memo(function ApprovalWorkflow({
  contractId,
  onApprovalComplete,
  className,
}: ApprovalWorkflowProps) {
  const [requests, setRequests] = useState<ApprovalRequest[]>(demoRequests);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [showNewRequestDialog, setShowNewRequestDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | 'request_changes' | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter to specific contract if provided
  const filteredRequests = contractId
    ? requests.filter(r => r.contractId === contractId)
    : requests;

  const pendingMyApproval = requests.filter(r => 
    r.status === 'in_progress' && 
    r.approvers[r.currentStep - 1]?.status === 'pending'
  );

  const handleApprovalAction = async () => {
    if (!selectedRequest || !approvalAction) return;

    setSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const newStatus: ApprovalStatus = 
      approvalAction === 'approve' ? 'approved' :
      approvalAction === 'reject' ? 'rejected' : 'changes_requested';

    setRequests(prev => prev.map(r => {
      if (r.id !== selectedRequest.id) return r;

      const updatedApprovers = r.approvers.map((a, i) => {
        if (i === r.currentStep - 1) {
          return {
            ...a,
            status: newStatus,
            decidedAt: new Date(),
            comment: approvalComment,
          };
        }
        return a;
      });

      const allApproved = updatedApprovers.every(a => a.status === 'approved');
      const anyRejected = updatedApprovers.some(a => a.status === 'rejected');

      return {
        ...r,
        approvers: updatedApprovers,
        currentStep: newStatus === 'approved' ? r.currentStep + 1 : r.currentStep,
        status: allApproved ? 'approved' : anyRejected ? 'rejected' : 'in_progress',
      };
    }));

    setSubmitting(false);
    setShowApprovalDialog(false);
    setApprovalComment('');
    setApprovalAction(null);
    setSelectedRequest(null);

    toast.success(
      approvalAction === 'approve' ? 'Contract approved' :
      approvalAction === 'reject' ? 'Contract rejected' : 'Changes requested'
    );

    if (approvalAction === 'approve' || approvalAction === 'reject') {
      onApprovalComplete?.(approvalAction === 'approve');
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      {!contractId && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-violet-600" />
              Approval Workflows
            </h2>
            <p className="text-slate-600 mt-1">
              Manage contract approval requests
            </p>
          </div>
          <Button onClick={() => setShowNewRequestDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>
      )}

      {/* Pending My Approval Alert */}
      {pendingMyApproval.length > 0 && !contractId && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-yellow-800">
                  {pendingMyApproval.length} contract(s) awaiting your approval
                </p>
                <p className="text-sm text-yellow-700">
                  Please review and take action on pending requests
                </p>
              </div>
              <Button 
                variant="outline" 
                className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                onClick={() => setSelectedRequest(pendingMyApproval[0] ?? null)}
              >
                Review Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.map(request => {
          const approvedCount = request.approvers.filter(a => a.status === 'approved').length;
          const currentApprover = request.approvers[request.currentStep - 1];

          return (
            <Card 
              key={request.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedRequest(request)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                    request.status === 'approved' ? 'bg-green-100' :
                    request.status === 'rejected' ? 'bg-red-100' :
                    request.status === 'expired' ? 'bg-slate-100' : 'bg-violet-100'
                  )}>
                    <FileText className={cn(
                      'h-5 w-5',
                      request.status === 'approved' ? 'text-green-600' :
                      request.status === 'rejected' ? 'text-red-600' :
                      request.status === 'expired' ? 'text-slate-500' : 'text-violet-600'
                    )} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium truncate">{request.contractName}</h4>
                        <p className="text-sm text-slate-500">{request.contractType}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={priorityColors[request.priority]}>
                          {request.priority}
                        </Badge>
                        <Badge variant={
                          request.status === 'approved' ? 'default' :
                          request.status === 'rejected' ? 'destructive' : 'outline'
                        }>
                          {request.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>

                    {/* Approval Progress */}
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-slate-500">
                          Progress: {approvedCount}/{request.approvers.length}
                        </span>
                        {request.dueDate && (
                          <>
                            <span className="text-xs text-slate-300">•</span>
                            <span className={cn(
                              'text-xs',
                              new Date(request.dueDate) < new Date() ? 'text-red-500' : 'text-slate-500'
                            )}>
                              Due {formatDistanceToNow(request.dueDate, { addSuffix: true })}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Approval Steps */}
                      <div className="flex items-center gap-1">
                        {request.approvers.map((approver, i) => {
                          const StatusIcon = statusConfig[approver.status].icon;
                          const isActive = i === request.currentStep - 1;

                          return (
                            <div key={approver.id} className="flex items-center">
                              <div 
                                className={cn(
                                  'h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all',
                                  approver.status === 'approved' && 'border-green-500 bg-green-50',
                                  approver.status === 'rejected' && 'border-red-500 bg-red-50',
                                  approver.status === 'changes_requested' && 'border-orange-500 bg-orange-50',
                                  approver.status === 'pending' && isActive && 'border-violet-500 bg-violet-50 animate-pulse',
                                  approver.status === 'pending' && !isActive && 'border-slate-200 bg-slate-50',
                                )}
                                title={`${approver.name} - ${approver.role}`}
                              >
                                <StatusIcon className={cn(
                                  'h-4 w-4',
                                  statusConfig[approver.status].color
                                )} />
                              </div>
                              {i < request.approvers.length - 1 && (
                                <div className={cn(
                                  'w-4 h-0.5 mx-0.5',
                                  approver.status === 'approved' ? 'bg-green-500' : 'bg-slate-200'
                                )} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Current Approver */}
                    {currentApprover && request.status === 'in_progress' && (
                      <p className="text-xs text-slate-500 mt-2">
                        Waiting on: <span className="font-medium">{currentApprover.name}</span> ({currentApprover.role})
                      </p>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredRequests.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No approval requests</p>
          <p className="text-sm mt-1">Create a new request to start the approval process</p>
        </div>
      )}

      {/* Request Detail Dialog */}
      <Dialog open={!!selectedRequest && !showApprovalDialog} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRequest.contractName}</DialogTitle>
                <DialogDescription>
                  {selectedRequest.contractType} • Requested {formatDistanceToNow(selectedRequest.requestedAt, { addSuffix: true })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Requested By</p>
                    <p className="font-medium">{selectedRequest.requestedBy.name}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Due Date</p>
                    <p className="font-medium">
                      {selectedRequest.dueDate 
                        ? format(selectedRequest.dueDate, 'MMM d, yyyy')
                        : 'No due date'
                      }
                    </p>
                  </div>
                </div>

                {selectedRequest.notes && (
                  <div className="p-3 bg-violet-50 rounded-lg">
                    <p className="text-sm text-violet-700">{selectedRequest.notes}</p>
                  </div>
                )}

                {/* Approvers Timeline */}
                <div>
                  <h4 className="font-medium mb-3">Approval Chain</h4>
                  <div className="space-y-4">
                    {selectedRequest.approvers.map((approver, i) => {
                      const StatusIcon = statusConfig[approver.status].icon;
                      const isActive = i === selectedRequest.currentStep - 1;

                      return (
                        <div key={approver.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              'h-10 w-10 rounded-full flex items-center justify-center',
                              statusConfig[approver.status].bg
                            )}>
                              <StatusIcon className={cn('h-5 w-5', statusConfig[approver.status].color)} />
                            </div>
                            {i < selectedRequest.approvers.length - 1 && (
                              <div className={cn(
                                'w-0.5 flex-1 mt-2',
                                approver.status === 'approved' ? 'bg-green-300' : 'bg-slate-200'
                              )} />
                            )}
                          </div>
                          <div className={cn(
                            'flex-1 pb-4',
                            isActive && 'animate-pulse'
                          )}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{approver.name}</p>
                                <p className="text-sm text-slate-500">{approver.role}</p>
                              </div>
                              <Badge className={statusConfig[approver.status].bg}>
                                {statusConfig[approver.status].label}
                              </Badge>
                            </div>
                            {approver.decidedAt && (
                              <p className="text-xs text-slate-500 mt-1">
                                {format(approver.decidedAt, 'MMM d, yyyy h:mm a')}
                              </p>
                            )}
                            {approver.comment && (
                              <div className="mt-2 p-2 bg-slate-50 rounded text-sm">
                                <MessageSquare className="h-3 w-3 inline mr-1" />
                                {approver.comment}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                  Close
                </Button>
                {selectedRequest.status === 'in_progress' && (
                  <>
                    <Button
                      variant="outline"
                      className="text-orange-600"
                      onClick={() => {
                        setApprovalAction('request_changes');
                        setShowApprovalDialog(true);
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Request Changes
                    </Button>
                    <Button
                      variant="outline"
                      className="text-red-600"
                      onClick={() => {
                        setApprovalAction('reject');
                        setShowApprovalDialog(true);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => {
                        setApprovalAction('approve');
                        setShowApprovalDialog(true);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Action Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' && 'Approve Contract'}
              {approvalAction === 'reject' && 'Reject Contract'}
              {approvalAction === 'request_changes' && 'Request Changes'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.contractName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {approvalAction === 'reject' && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-700">This action is final</p>
                    <p className="text-sm text-red-600">
                      Rejecting will end the approval workflow. A new request will need to be created.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="comment">
                Comment {approvalAction !== 'approve' && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="comment"
                placeholder={
                  approvalAction === 'approve' 
                    ? 'Add an optional comment...' 
                    : 'Please provide a reason...'
                }
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowApprovalDialog(false);
                setApprovalComment('');
                setApprovalAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={approvalAction === 'reject' ? 'destructive' : 'default'}
              onClick={handleApprovalAction}
              disabled={submitting || (approvalAction !== 'approve' && !approvalComment)}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {approvalAction === 'approve' && 'Approve'}
              {approvalAction === 'reject' && 'Reject'}
              {approvalAction === 'request_changes' && 'Request Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default ApprovalWorkflow;
