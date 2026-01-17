/**
 * Bulk Approval Actions Component
 * Allows approving/rejecting multiple contracts at once
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  XCircle, 
  Loader2,
  AlertTriangle,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkApprovalActionsProps {
  selectedIds: string[];
  contracts: Array<{ id: string; title: string }>;
  onSuccess?: () => void;
  onClearSelection?: () => void;
}

export function BulkApprovalActions({ 
  selectedIds, 
  contracts,
  onSuccess,
  onClearSelection
}: BulkApprovalActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [requireComment, setRequireComment] = useState(false);

  if (selectedIds.length === 0) return null;

  const selectedContracts = contracts.filter(c => selectedIds.includes(c.id));

  const handleBulkAction = async () => {
    if (requireComment && !comment.trim()) {
      toast.error('Comment required');
      return;
    }

    setIsProcessing(true);

    try {
      const results = await Promise.allSettled(
        selectedIds.map(contractId =>
          fetch('/api/approvals/quick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contractId,
              action,
              comment: comment.trim() || undefined,
            }),
          }).then(r => r.json())
        )
      );

      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      if (successes > 0) {
        toast.success(`${successes} contract(s) ${action === 'approve' ? 'approved' : 'rejected'}`);
        onSuccess?.();
        onClearSelection?.();
      }

      if (failures > 0) {
        toast.error(`${failures} contract(s) failed to process`);
      }

      setIsOpen(false);
      setComment('');
      setAction(null);
    } catch {
      toast.error('Failed to process bulk action');
    } finally {
      setIsProcessing(false);
    }
  };

  const openDialog = (actionType: 'approve' | 'reject') => {
    setAction(actionType);
    setRequireComment(actionType === 'reject');
    setIsOpen(true);
  };

  return (
    <>
      {/* Selection Summary Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-white border-2 border-slate-200 rounded-xl shadow-2xl p-4 min-w-[400px]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Checkbox checked disabled className="pointer-events-none" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  {selectedIds.length} contract{selectedIds.length > 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-slate-500">
                  Choose bulk action below
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openDialog('approve')}
                className="gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Approve All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openDialog('reject')}
                className="gap-2 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" />
                Reject All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {action === 'approve' ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Approve {selectedIds.length} Contract{selectedIds.length > 1 ? 's' : ''}?
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Reject {selectedIds.length} Contract{selectedIds.length > 1 ? 's' : ''}?
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {action === 'approve' 
                ? 'You are about to approve the following contracts. They will move to the next approval stage or be marked as approved.'
                : 'You are about to reject the following contracts. This action will require the contracts to be revised and resubmitted.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selected Contracts List */}
            <div className="max-h-40 overflow-y-auto space-y-2 px-1">
              {selectedContracts.slice(0, 5).map((contract) => (
                <div 
                  key={contract.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-sm"
                >
                  <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="truncate">{contract.title}</span>
                </div>
              ))}
              {selectedContracts.length > 5 && (
                <p className="text-xs text-slate-500 text-center py-1">
                  + {selectedContracts.length - 5} more
                </p>
              )}
            </div>

            {/* Comment Field */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="bulk-comment" className="flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  Comment {requireComment && <span className="text-red-500">*</span>}
                </Label>
              </div>
              <Textarea
                id="bulk-comment"
                placeholder={
                  action === 'approve'
                    ? 'Optional: Add approval comment...'
                    : 'Required: Explain why these contracts are being rejected...'
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className={cn(
                  requireComment && !comment.trim() && "border-red-300 focus-visible:ring-red-500"
                )}
              />
            </div>

            {action === 'reject' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  Rejected contracts will be returned to the submitter with your comments. 
                  They can revise and resubmit for approval.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setComment('');
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAction}
              disabled={isProcessing || (requireComment && !comment.trim())}
              className={cn(
                action === 'approve' 
                  ? "bg-green-600 hover:bg-green-700" 
                  : "bg-red-600 hover:bg-red-700"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {action === 'approve' ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve {selectedIds.length}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject {selectedIds.length}
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
