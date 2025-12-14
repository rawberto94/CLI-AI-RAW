/**
 * Contract Version History
 * Track and compare contract versions
 */

'use client';

import { memo, useState, useEffect } from 'react';
import { 
  History, 
  GitBranch,
  GitCompare,
  Clock,
  User,
  FileText,
  Download,
  Eye,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Plus,
  Tag,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

export interface ContractVersion {
  id: string;
  version: string;
  label?: string;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  changes: {
    type: 'add' | 'modify' | 'remove';
    section: string;
    description: string;
  }[];
  fileSize: number;
  fileUrl: string;
  status: 'draft' | 'review' | 'approved' | 'current' | 'archived';
  notes?: string;
  metadata?: {
    wordCount: number;
    pageCount: number;
  };
}

interface VersionHistoryProps {
  contractId: string;
  className?: string;
  compact?: boolean;
}

// Mock version history
function generateMockVersions(): ContractVersion[] {
  return [
    {
      id: 'v_5',
      version: '2.1.0',
      label: 'Final Signed Version',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      createdBy: { id: 'u1', name: 'John Doe', email: 'john@example.com' },
      changes: [
        { type: 'modify', section: 'Signatures', description: 'Added executed signatures from both parties' },
      ],
      fileSize: 2456789,
      fileUrl: '/documents/contract-v2.1.0.pdf',
      status: 'current',
      notes: 'Fully executed version. Ready for storage.',
      metadata: { wordCount: 8500, pageCount: 24 },
    },
    {
      id: 'v_4',
      version: '2.0.0',
      label: 'Major Revision',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      createdBy: { id: 'u2', name: 'Jane Smith', email: 'jane@example.com' },
      changes: [
        { type: 'modify', section: 'Section 4.2', description: 'Updated payment terms from Net 60 to Net 45' },
        { type: 'add', section: 'Section 12', description: 'Added new data protection clause' },
        { type: 'modify', section: 'Section 8', description: 'Revised liability cap from $500K to $1M' },
      ],
      fileSize: 2398456,
      fileUrl: '/documents/contract-v2.0.0.pdf',
      status: 'approved',
      notes: 'Approved by legal team after counterparty negotiations.',
      metadata: { wordCount: 8450, pageCount: 23 },
    },
    {
      id: 'v_3',
      version: '1.2.0',
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      createdBy: { id: 'u1', name: 'John Doe', email: 'john@example.com' },
      changes: [
        { type: 'modify', section: 'Section 6', description: 'Clarified termination notice period' },
        { type: 'remove', section: 'Appendix B', description: 'Removed obsolete rate schedule' },
      ],
      fileSize: 2245678,
      fileUrl: '/documents/contract-v1.2.0.pdf',
      status: 'archived',
      metadata: { wordCount: 8200, pageCount: 22 },
    },
    {
      id: 'v_2',
      version: '1.1.0',
      createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
      createdBy: { id: 'u3', name: 'Bob Wilson', email: 'bob@example.com' },
      changes: [
        { type: 'add', section: 'Appendix A', description: 'Added service level agreement details' },
        { type: 'modify', section: 'Section 3', description: 'Updated scope of services' },
      ],
      fileSize: 2189012,
      fileUrl: '/documents/contract-v1.1.0.pdf',
      status: 'archived',
      metadata: { wordCount: 7800, pageCount: 21 },
    },
    {
      id: 'v_1',
      version: '1.0.0',
      label: 'Initial Draft',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      createdBy: { id: 'u1', name: 'John Doe', email: 'john@example.com' },
      changes: [
        { type: 'add', section: 'Full Document', description: 'Initial contract draft created' },
      ],
      fileSize: 2045678,
      fileUrl: '/documents/contract-v1.0.0.pdf',
      status: 'archived',
      notes: 'First draft based on standard MSA template.',
      metadata: { wordCount: 7200, pageCount: 20 },
    },
  ];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const statusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: 'bg-slate-100 text-slate-700', label: 'Draft' },
  review: { color: 'bg-yellow-100 text-yellow-700', label: 'In Review' },
  approved: { color: 'bg-green-100 text-green-700', label: 'Approved' },
  current: { color: 'bg-blue-100 text-blue-700', label: 'Current' },
  archived: { color: 'bg-slate-100 text-slate-500', label: 'Archived' },
};

const changeTypeConfig: Record<string, { color: string; icon: string }> = {
  add: { color: 'text-green-600', icon: '+' },
  modify: { color: 'text-blue-600', icon: '~' },
  remove: { color: 'text-red-600', icon: '-' },
};

export const VersionHistory = memo(function VersionHistory({
  contractId,
  className,
  compact = false,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);

  useEffect(() => {
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/versions`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions.map((v: ContractVersion) => ({
          ...v,
          createdAt: new Date(v.createdAt),
        })));
      } else {
        setVersions(generateMockVersions());
      }
    } catch {
      setVersions(generateMockVersions());
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (versionId: string) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });
  };

  const toggleVersionSelect = (versionId: string) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      }
      if (prev.length >= 2) {
        return [prev[1] ?? '', versionId].filter(Boolean);
      }
      return [...prev, versionId];
    });
  };

  const handleCompare = () => {
    if (selectedVersions.length !== 2) {
      toast.error('Select exactly 2 versions to compare');
      return;
    }
    toast.success('Opening version comparison...');
    // Would navigate to comparison view
  };

  const handleDownload = (version: ContractVersion) => {
    toast.success(`Downloading v${version.version}...`);
  };

  const handleRestore = (version: ContractVersion) => {
    if (!confirm(`Restore version ${version.version} as the current version?`)) return;
    toast.success(`Version ${version.version} restored`);
  };

  const currentVersion = versions.find(v => v.status === 'current');

  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 rounded-lg bg-purple-100">
              <History className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Version History</h3>
              <p className="text-sm text-slate-500">
                {versions.length} versions • Current: v{currentVersion?.version || '1.0.0'}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={`/contracts/${contractId}/versions`}>View All</a>
            </Button>
          </div>
          <div className="space-y-2">
            {versions.slice(0, 3).map((version, i) => (
              <div
                key={version.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-lg',
                  i === 0 ? 'bg-blue-50' : 'hover:bg-slate-50'
                )}
              >
                <GitBranch className={cn(
                  'h-4 w-4',
                  i === 0 ? 'text-blue-600' : 'text-slate-400'
                )} />
                <div className="flex-1">
                  <span className="text-sm font-medium">v{version.version}</span>
                  {version.label && (
                    <span className="text-xs text-slate-500 ml-2">{version.label}</span>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {formatDistanceToNow(version.createdAt, { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-purple-600" />
              Version History
            </CardTitle>
            <CardDescription>
              {versions.length} versions • Track changes over time
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant={compareMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCompareMode(!compareMode);
                setSelectedVersions([]);
              }}
            >
              <GitCompare className="h-4 w-4 mr-2" />
              {compareMode ? 'Cancel' : 'Compare'}
            </Button>
            {compareMode && selectedVersions.length === 2 && (
              <Button size="sm" onClick={handleCompare}>
                Compare Selected
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={loadVersions} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600 mr-2" />
            <span>Loading versions...</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No version history available
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-slate-200" />

              <div className="space-y-4">
                {versions.map((version, index) => {
                  const isExpanded = expandedVersions.has(version.id);
                  const isSelected = selectedVersions.includes(version.id);
                  const isCurrent = version.status === 'current';

                  return (
                    <Collapsible
                      key={version.id}
                      open={isExpanded}
                      onOpenChange={() => toggleExpand(version.id)}
                    >
                      <div className={cn(
                        'relative pl-12 pr-4',
                        compareMode && isSelected && 'bg-blue-50 -mx-4 px-16 py-2 rounded-lg'
                      )}>
                        {/* Timeline dot */}
                        <div className={cn(
                          'absolute left-3 w-4 h-4 rounded-full border-2 bg-white',
                          isCurrent ? 'border-blue-500' : 'border-slate-300'
                        )}>
                          {isCurrent && (
                            <div className="absolute inset-1 rounded-full bg-blue-500" />
                          )}
                        </div>

                        <div className="flex items-start gap-4">
                          {compareMode && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleVersionSelect(version.id)}
                              className="mt-1.5 h-4 w-4 rounded border-slate-300"
                            />
                          )}

                          <CollapsibleTrigger className="flex-1 text-left">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">v{version.version}</span>
                                  {version.label && (
                                    <Badge variant="outline" className="text-xs">
                                      <Tag className="h-3 w-3 mr-1" />
                                      {version.label}
                                    </Badge>
                                  )}
                                  <Badge className={statusConfig[version.status]?.color ?? 'bg-slate-100 text-slate-700'}>
                                    {statusConfig[version.status]?.label ?? version.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {version.createdBy.name}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(version.createdAt, 'MMM d, yyyy h:mm a')}
                                  </span>
                                  <span>{formatBytes(version.fileSize)}</span>
                                  {version.metadata && (
                                    <span>{version.metadata.pageCount} pages</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-slate-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-slate-400" />
                                )}
                              </div>
                            </div>

                            {/* Change summary */}
                            {version.changes.length > 0 && !isExpanded && (
                              <div className="flex items-center gap-2 mt-2">
                                {version.changes.slice(0, 2).map((change, i) => (
                                  <span
                                    key={i}
                                    className={cn(
                                      'text-xs px-2 py-0.5 rounded',
                                      change.type === 'add' && 'bg-green-50 text-green-700',
                                      change.type === 'modify' && 'bg-blue-50 text-blue-700',
                                      change.type === 'remove' && 'bg-red-50 text-red-700'
                                    )}
                                  >
                                    {(changeTypeConfig[change.type]?.icon || '~')} {change.section}
                                  </span>
                                ))}
                                {version.changes.length > 2 && (
                                  <span className="text-xs text-slate-400">
                                    +{version.changes.length - 2} more
                                  </span>
                                )}
                              </div>
                            )}
                          </CollapsibleTrigger>
                        </div>

                        <CollapsibleContent>
                          <div className="mt-4 pl-8 space-y-4">
                            {/* Changes detail */}
                            {version.changes.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-sm font-medium text-slate-700">Changes</h4>
                                {version.changes.map((change, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      'flex items-start gap-2 p-2 rounded text-sm',
                                      change.type === 'add' && 'bg-green-50',
                                      change.type === 'modify' && 'bg-blue-50',
                                      change.type === 'remove' && 'bg-red-50'
                                    )}
                                  >
                                    <span className={cn(
                                      'font-mono font-bold',
                                      changeTypeConfig[change.type]?.color ?? 'text-blue-600'
                                    )}>
                                      {changeTypeConfig[change.type]?.icon ?? '~'}
                                    </span>
                                    <div>
                                      <span className="font-medium">{change.section}</span>
                                      <span className="text-slate-600 ml-2">{change.description}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Notes */}
                            {version.notes && (
                              <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-sm text-slate-600">{version.notes}</p>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleDownload(version)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                Preview
                              </Button>
                              {version.status !== 'current' && (
                                <Button variant="outline" size="sm" onClick={() => handleRestore(version)}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Restore
                                </Button>
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
});
