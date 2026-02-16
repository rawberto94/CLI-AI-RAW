/**
 * Bulk Actions Panel
 * Perform operations on multiple contracts at once
 */

'use client';

import { memo, useState } from 'react';
import { 
  CheckSquare,
  Trash2,
  Download,
  Tag,
  FolderInput,
  Archive,
  Share2,
  RefreshCw,
  AlertTriangle,
  X,
  Loader2,
  FileText,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from 'sonner';

export interface SelectedContract {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface BulkActionsProps {
  selectedContracts: SelectedContract[];
  onClearSelection: () => void;
  onActionComplete?: (action: string, results: ActionResult[]) => void;
  className?: string;
}

interface ActionResult {
  contractId: string;
  success: boolean;
  error?: string;
}

type BulkAction = 
  | 'delete' 
  | 'archive' 
  | 'export' 
  | 'tag' 
  | 'move' 
  | 'share' 
  | 'reprocess' 
  | 'update_status';

const actionConfig: Record<BulkAction, {
  icon: React.ElementType;
  label: string;
  destructive?: boolean;
  requiresConfirm?: boolean;
}> = {
  delete: { icon: Trash2, label: 'Delete', destructive: true, requiresConfirm: true },
  archive: { icon: Archive, label: 'Archive', requiresConfirm: true },
  export: { icon: Download, label: 'Export' },
  tag: { icon: Tag, label: 'Add Tags' },
  move: { icon: FolderInput, label: 'Move to Folder' },
  share: { icon: Share2, label: 'Share' },
  reprocess: { icon: RefreshCw, label: 'Reprocess AI' },
  update_status: { icon: CheckSquare, label: 'Update Status' },
};

const availableTags = ['important', 'needs-review', 'priority', 'legal-hold', 'external'];
const availableFolders = ['Active Contracts', 'Archived', 'Pending Review', 'Templates', 'Expired'];
const availableStatuses = ['draft', 'pending_review', 'active', 'completed', 'expired', 'terminated'];

export const BulkActionsPanel = memo(function BulkActionsPanel({
  selectedContracts,
  onClearSelection,
  onActionComplete,
  className,
}: BulkActionsProps) {
  const [processing, setProcessing] = useState(false);
  const [currentAction, setCurrentAction] = useState<BulkAction | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ActionResult[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  
  // Action-specific state
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<string>('pdf');

  if (selectedContracts.length === 0) {
    return null;
  }

  const performAction = async (action: BulkAction) => {
    // Check if confirmation needed
    const config = actionConfig[action];
    if (config.requiresConfirm) {
      setPendingAction(action);
      setShowConfirmDialog(true);
      return;
    }

    await executeAction(action);
  };

  const executeAction = async (action: BulkAction) => {
    setCurrentAction(action);
    setProcessing(true);
    setProgress(0);
    setResults([]);
    setShowConfirmDialog(false);

    const actionResults: ActionResult[] = [];
    const total = selectedContracts.length;

    for (let i = 0; i < selectedContracts.length; i++) {
      const contract = selectedContracts[i];
      if (!contract) continue;
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));

      try {
        // Simulate action (in production, this would be API calls)
        const success = Math.random() > 0.1; // 90% success rate for demo
        
        if (!success) {
          throw new Error('Operation failed');
        }

        actionResults.push({ contractId: contract.id, success: true });
      } catch (error) {
        actionResults.push({
          contractId: contract.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      setProgress(Math.round(((i + 1) / total) * 100));
      setResults([...actionResults]);
    }

    setProcessing(false);

    const successCount = actionResults.filter(r => r.success).length;
    const failCount = actionResults.filter(r => !r.success).length;

    if (failCount === 0) {
      toast.success(`${actionConfig[action].label} completed for ${successCount} contracts`);
    } else {
      toast.warning(`${successCount} succeeded, ${failCount} failed`);
    }

    onActionComplete?.(action, actionResults);
  };

  const handleConfirm = () => {
    if (pendingAction) {
      executeAction(pendingAction);
    }
  };

  const closeResults = () => {
    setCurrentAction(null);
    setResults([]);
    setProgress(0);
    onClearSelection();
  };

  // Show progress/results panel
  if (processing || (results.length > 0 && currentAction)) {
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return (
      <div className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'bg-white rounded-lg shadow-xl border p-4 min-w-[400px]',
        className
      )}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold flex items-center gap-2">
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
            ) : successCount === results.length ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            )}
            {processing ? 'Processing...' : 'Complete'}
          </h4>
          {!processing && (
            <Button variant="ghost" size="sm" onClick={closeResults}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Progress value={progress} className="mb-3" />

        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            {processing 
              ? `Processing ${results.length + 1} of ${selectedContracts.length}`
              : `${actionConfig[currentAction!].label} completed`
            }
          </span>
          <div className="flex items-center gap-3">
            <span className="text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {successCount}
            </span>
            {failCount > 0 && (
              <span className="text-red-600 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {failCount}
              </span>
            )}
          </div>
        </div>

        {!processing && failCount > 0 && (
          <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
            {failCount} operation(s) failed. Check individual contract logs for details.
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'bg-slate-900 text-white rounded-lg shadow-xl p-3',
        'flex items-center gap-4',
        className
      )}>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="font-medium">{selectedContracts.length} selected</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="text-slate-400 hover:text-white hover:bg-slate-800 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-slate-700" />

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-slate-800"
            onClick={() => performAction('export')}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-slate-800"
            onClick={() => performAction('archive')}
          >
            <Archive className="h-4 w-4 mr-1" />
            Archive
          </Button>

          {/* Tags dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-slate-800"
              >
                <Tag className="h-4 w-4 mr-1" />
                Tag
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {availableTags.map(tag => (
                <DropdownMenuItem
                  key={tag}
                  onClick={() => {
                    setSelectedTag(tag);
                    performAction('tag');
                  }}
                >
                  <Badge variant="outline" className="mr-2">{tag}</Badge>
                  Add tag
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-slate-800"
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {availableStatuses.map(status => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => {
                    setSelectedStatus(status);
                    performAction('update_status');
                  }}
                >
                  Set to {status.replace('_', ' ')}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Move dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-slate-800"
              >
                <FolderInput className="h-4 w-4 mr-1" />
                Move
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {availableFolders.map(folder => (
                <DropdownMenuItem
                  key={folder}
                  onClick={() => {
                    setSelectedFolder(folder);
                    performAction('move');
                  }}
                >
                  Move to {folder}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-slate-800"
            onClick={() => performAction('reprocess')}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Reprocess
          </Button>
        </div>

        <div className="h-6 w-px bg-slate-700" />

        {/* Delete action */}
        <Button
          variant="ghost"
          size="sm"
          className="text-red-400 hover:text-red-300 hover:bg-red-900/50"
          onClick={() => performAction('delete')}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm {pendingAction && actionConfig[pendingAction].label}
            </DialogTitle>
            <DialogDescription>
              This action will be performed on {selectedContracts.length} contract(s).
              {pendingAction === 'delete' && (
                <span className="block mt-2 text-red-600 font-medium">
                  This action cannot be undone.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-slate-600 mb-2">Affected contracts:</p>
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {selectedContracts.slice(0, 10).map(contract => (
                <div
                  key={contract.id}
                  className="flex items-center gap-2 p-2 bg-slate-50 rounded text-sm"
                >
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{contract.name}</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {contract.type}
                  </Badge>
                </div>
              ))}
              {selectedContracts.length > 10 && (
                <p className="text-sm text-slate-500 text-center py-2">
                  +{selectedContracts.length - 10} more contracts
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              variant={pendingAction === 'delete' ? 'destructive' : 'default'}
              onClick={handleConfirm}
            >
              Confirm {pendingAction && actionConfig[pendingAction].label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
