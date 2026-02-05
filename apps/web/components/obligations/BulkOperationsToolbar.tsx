'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
// import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Calendar,
  Tag,
  AlertTriangle,
  XCircle,
  Pause,
} from 'lucide-react';

export interface BulkAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant?: 'default' | 'destructive';
  requiresConfirm?: boolean;
  fields?: Array<{
    name: string;
    label: string;
    type: 'select' | 'date' | 'text' | 'multiselect';
    options?: Array<{ value: string; label: string }>;
  }>;
}

interface BulkOperationsProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  totalCount: number;
  onAction: (action: string, params: Record<string, unknown>) => Promise<void>;
  isLoading?: boolean;
}

const defaultActions: BulkAction[] = [
  {
    id: 'mark_complete',
    label: 'Mark Complete',
    icon: <CheckCircle2 className="h-4 w-4" />,
    requiresConfirm: true,
  },
  {
    id: 'update_status',
    label: 'Change Status',
    icon: <Clock className="h-4 w-4" />,
    fields: [
      {
        name: 'status',
        label: 'New Status',
        type: 'select',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' },
          { value: 'at_risk', label: 'At Risk' },
          { value: 'waived', label: 'Waived' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    ],
  },
  {
    id: 'assign',
    label: 'Assign To',
    icon: <UserPlus className="h-4 w-4" />,
    fields: [
      {
        name: 'assigneeId',
        label: 'Assign to User',
        type: 'select',
        options: [], // Will be populated dynamically
      },
    ],
  },
  {
    id: 'reschedule',
    label: 'Reschedule',
    icon: <Calendar className="h-4 w-4" />,
    fields: [
      {
        name: 'newDueDate',
        label: 'New Due Date',
        type: 'date',
      },
    ],
  },
  {
    id: 'add_tags',
    label: 'Add Tags',
    icon: <Tag className="h-4 w-4" />,
    fields: [
      {
        name: 'tags',
        label: 'Tags (comma separated)',
        type: 'text',
      },
    ],
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="h-4 w-4" />,
    variant: 'destructive',
    requiresConfirm: true,
  },
];

export function BulkOperationsToolbar({
  selectedIds,
  onSelectionChange,
  totalCount: _totalCount,
  onAction,
  isLoading: _isLoading = false,
}: BulkOperationsProps) {
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [currentAction, setCurrentAction] = useState<BulkAction | null>(null);
  const [actionParams, setActionParams] = useState<Record<string, unknown>>({});
  const [processing, setProcessing] = useState(false);

  const handleActionSelect = (action: BulkAction) => {
    if (selectedIds.length === 0) {
      toast.warning('Please select at least one obligation');
      return;
    }

    if (action.fields && action.fields.length > 0) {
      setCurrentAction(action);
      setActionParams({});
      setShowActionDialog(true);
    } else if (action.requiresConfirm) {
      setCurrentAction(action);
      setShowActionDialog(true);
    } else {
      executeAction(action.id, {});
    }
  };

  const executeAction = async (actionId: string, params: Record<string, unknown>) => {
    setProcessing(true);
    try {
      await onAction(actionId, { ...params, obligationIds: selectedIds });
      toast.success(`Action completed on ${selectedIds.length} obligation(s)`);
      setShowActionDialog(false);
      setCurrentAction(null);
      onSelectionChange([]);
    } catch (_error) {
      toast.error('Failed to complete action');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (currentAction) {
      executeAction(currentAction.id, actionParams);
    }
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl px-6 py-3">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm font-medium">
              {selectedIds.length} selected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectionChange([])}
              className="text-slate-500"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>

          <div className="h-6 border-l border-slate-200 dark:border-slate-700" />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleActionSelect(defaultActions[0])}
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Complete
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Clock className="h-4 w-4 mr-1" />
                  Status
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => executeAction('update_status', { status: 'pending' })}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => executeAction('update_status', { status: 'in_progress' })}>
                  <Clock className="h-4 w-4 mr-2" />
                  In Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => executeAction('update_status', { status: 'at_risk' })}>
                  <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                  At Risk
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => executeAction('update_status', { status: 'waived' })}>
                  Waived
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => executeAction('update_status', { status: 'cancelled' })}>
                  Cancelled
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleActionSelect(defaultActions.find((a) => a.id === 'reschedule')!)}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Reschedule
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleActionSelect(defaultActions.find((a) => a.id === 'assign')!)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign To
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleActionSelect(defaultActions.find((a) => a.id === 'add_tags')!)}>
                  <Tag className="h-4 w-4 mr-2" />
                  Add Tags
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => handleActionSelect(defaultActions.find((a) => a.id === 'delete')!)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {currentAction?.icon}
              {currentAction?.label}
            </DialogTitle>
            <DialogDescription>
              This action will be applied to {selectedIds.length} selected obligation(s).
            </DialogDescription>
          </DialogHeader>

          {currentAction?.fields && currentAction.fields.length > 0 && (
            <div className="space-y-4 py-4">
              {currentAction.fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label>{field.label}</Label>
                  {field.type === 'select' && (
                    <Select
                      value={actionParams[field.name] as string}
                      onValueChange={(v) => setActionParams((prev) => ({ ...prev, [field.name]: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {field.type === 'date' && (
                    <Input
                      type="date"
                      value={actionParams[field.name] as string}
                      onChange={(e) => setActionParams((prev) => ({ ...prev, [field.name]: e.target.value }))}
                    />
                  )}
                  {field.type === 'text' && (
                    <Input
                      value={actionParams[field.name] as string}
                      onChange={(e) => setActionParams((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={field.label}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {currentAction?.requiresConfirm && !currentAction.fields && (
            <div className="py-4">
              {currentAction.id === 'delete' ? (
                <p className="text-red-600">
                  Are you sure you want to delete {selectedIds.length} obligation(s)? This action cannot be undone.
                </p>
              ) : (
                <p>
                  Are you sure you want to {currentAction.label.toLowerCase()} {selectedIds.length} obligation(s)?
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={processing}
              variant={currentAction?.variant === 'destructive' ? 'destructive' : 'default'}
              className={
                currentAction?.variant !== 'destructive'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                  : ''
              }
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {currentAction?.icon}
                  <span className="ml-2">Confirm</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BulkOperationsToolbar;
