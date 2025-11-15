'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { History, RotateCcw, Eye, Loader2, AlertCircle, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VersionHistoryPanelProps {
  artifactId: string;
  contractId: string;
  onRevert?: (version: any) => void | Promise<void>;
  onClose?: () => void;
}

export function VersionHistoryPanel({
  artifactId,
  contractId,
  onRevert,
  onClose,
}: VersionHistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen]);

  const loadVersions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/contracts/${contractId}/artifacts/${artifactId}/versions`
      );

      if (!response.ok) {
        throw new Error('Failed to load version history');
      }

      const data = await response.json();
      setVersions(data.versions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevert = async (version: number) => {
    if (!confirm(`Are you sure you want to revert to version ${version}?`)) {
      return;
    }

    setIsReverting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/contracts/${contractId}/artifacts/${artifactId}/revert/${version}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'current-user',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to revert to version');
      }

      setIsOpen(false);
      if (onRevert) {
        await onRevert(version);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert');
    } finally {
      setIsReverting(false);
    }
  };

  const handleViewVersion = (version: any) => {
    setSelectedVersion(version);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        <History className="w-4 h-4 mr-2" />
        Version History
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              View and revert to previous versions of this artifact
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : selectedVersion ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Version {selectedVersion.version}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedVersion(null)}
                >
                  Back to List
                </Button>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Edited by:</span>{' '}
                  {selectedVersion.editedBy}
                </div>
                <div>
                  <span className="font-medium">Edited at:</span>{' '}
                  {new Date(selectedVersion.editedAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Change type:</span>{' '}
                  {(selectedVersion.reason && selectedVersion.reason.includes('AI Improvement')) || 
                   selectedVersion.changeType === 'ai_improvement' ? (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Improvement
                    </Badge>
                  ) : (
                    <Badge variant="outline">{selectedVersion.changeType}</Badge>
                  )}
                </div>
                {selectedVersion.reason && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                    <span className="font-medium text-blue-900">
                      {selectedVersion.reason.includes('AI Improvement') ? 'Improvement Request:' : 'Reason:'}
                    </span>
                    <p className="text-blue-800 mt-1">{selectedVersion.reason}</p>
                  </div>
                )}
                {selectedVersion.previousConfidence !== undefined && selectedVersion.newConfidence !== undefined && (
                  <div className="flex items-center gap-4 text-sm bg-gray-50 p-3 rounded-lg">
                    <div>
                      <span className="text-gray-500">Previous Confidence:</span>
                      <span className="ml-2 font-semibold text-gray-700">
                        {Math.round(selectedVersion.previousConfidence * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center">
                      {selectedVersion.newConfidence > selectedVersion.previousConfidence ? (
                        <TrendingUp className="h-4 w-4 text-green-600 mx-2" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600 mx-2" />
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">New Confidence:</span>
                      <span className="ml-2 font-semibold text-gray-700">
                        {Math.round(selectedVersion.newConfidence * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium mb-2">Changes:</h4>
                <div className="space-y-2">
                  {selectedVersion.changes?.map((change: any, idx: number) => (
                    <div key={idx} className="text-sm">
                      <div className="font-medium text-gray-700">
                        {change.fieldPath}
                      </div>
                      <div className="flex gap-4 mt-1">
                        <div className="flex-1">
                          <span className="text-red-600">Old:</span>{' '}
                          <span className="text-gray-600">
                            {JSON.stringify(change.oldValue)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <span className="text-green-600">New:</span>{' '}
                          <span className="text-gray-600">
                            {JSON.stringify(change.newValue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => handleRevert(selectedVersion.version)}
                disabled={isReverting}
                className="w-full"
              >
                {isReverting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Reverting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Revert to This Version
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No version history available
                </div>
              ) : (
                versions.map((version) => (
                  <div
                    key={version.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            Version {version.version}
                          </span>
                          {((version.reason && version.reason.includes('AI Improvement')) || 
                            version.changeType === 'ai_improvement') && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI Improved
                            </Badge>
                          )}
                          <span className="text-sm text-gray-500">
                            {formatDistanceToNow(new Date(version.editedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Edited by {version.editedBy}
                        </div>
                        {version.reason && (
                          <div className="text-sm bg-blue-50 text-blue-800 mt-2 p-2 rounded border border-blue-200">
                            {version.reason.includes('AI Improvement') ? '🤖' : '📝'} {version.reason}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-2 flex items-center gap-3">
                          <span>{version.changes?.length || 0} changes</span>
                          <span>•</span>
                          <span>{version.changeType}</span>
                          {version.previousConfidence !== undefined && version.newConfidence !== undefined && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                Confidence: {Math.round(version.previousConfidence * 100)}%
                                {version.newConfidence > version.previousConfidence ? (
                                  <TrendingUp className="h-3 w-3 text-green-600" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 text-red-600" />
                                )}
                                {Math.round(version.newConfidence * 100)}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewVersion(version)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevert(version.version)}
                          disabled={isReverting}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
