/**
 * Artifact Edit History Viewer
 * Shows version history of artifact edits
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Clock, User, FileText, Loader2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ArtifactHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  artifactId: string;
  artifactType: string;
}

interface EditHistory {
  id: string;
  timestamp: string;
  userId: string;
  changes: Record<string, any>;
  reason?: string;
  previousVersion?: any;
  newVersion?: any;
}

export function ArtifactHistory({
  open,
  onOpenChange,
  contractId,
  artifactId,
  artifactType
}: ArtifactHistoryProps) {
  const [history, setHistory] = useState<EditHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && contractId && artifactId) {
      loadHistory();
    }
  }, [open, contractId, artifactId]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/contracts/${contractId}/artifacts/${artifactId}/history`
      );

      if (!response.ok) {
        throw new Error('Failed to load edit history');
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const formatChanges = (changes: Record<string, any>) => {
    return Object.entries(changes).map(([key, value]) => ({
      field: key,
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Edit History - {artifactType}
          </DialogTitle>
          <DialogDescription>
            View all changes made to this artifact
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950 rounded-lg text-red-900 dark:text-red-100">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <FileText className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium">No edit history</p>
            <p className="text-sm">This artifact hasn&apos;t been edited yet</p>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {history.map((edit, index) => (
                <div
                  key={edit.id}
                  className="border-2 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={index === 0 ? 'default' : 'secondary'}>
                        {index === 0 ? 'Latest' : `Version ${history.length - index}`}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(edit.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <User className="h-3 w-3" />
                      <span>{edit.userId || 'Unknown'}</span>
                    </div>
                  </div>

                  {/* Reason */}
                  {edit.reason && (
                    <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm text-blue-900 dark:text-blue-100">
                      <strong>Reason:</strong> {edit.reason}
                    </div>
                  )}

                  {/* Changes */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Changes:
                    </p>
                    {formatChanges(edit.changes).map((change, idx) => (
                      <div
                        key={idx}
                        className="pl-4 border-l-2 border-gray-200 dark:border-gray-700"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {change.field}:
                        </p>
                        <pre className="text-xs text-gray-600 dark:text-gray-400 mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded overflow-x-auto">
                          {change.value}
                        </pre>
                      </div>
                    ))}
                  </div>

                  {/* Timestamp */}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500">
                      {new Date(edit.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
