'use client';

import React, { use, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { VersionCompare, DocumentVersion } from '@/components/contracts/VersionCompare';
import { VersionTimeline, ContractVersion } from '@/components/contracts/VersionTimeline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FileText, History, GitBranch, Clock, Sparkles, GitCompare, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';

interface ApiVersion {
  id: string;
  versionNumber: number;
  uploadedBy: string;
  uploadedAt: string;
  isActive: boolean;
  summary?: string;
  changes?: Record<string, unknown>;
  fileUrl?: string;
}

interface VersionsResponse {
  success: boolean;
  versions?: ApiVersion[];
  error?: string;
}

function useVersions(contractId: string) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [timelineVersions, setTimelineVersions] = useState<ApiVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/contracts/${contractId}/versions`);
      const json: VersionsResponse = await response.json();

      if (json.success && json.versions) {
        // Store raw versions for timeline
        setTimelineVersions(json.versions);

        // Transform to DocumentVersion format for compare view
        const docVersions: DocumentVersion[] = json.versions.map((v) => ({
          id: v.id,
          version: `v${v.versionNumber}.0`,
          author: { id: v.id, name: v.uploadedBy },
          timestamp: new Date(v.uploadedAt),
          changes: v.changes ? Object.keys(v.changes).length : 0,
          label: v.summary,
          content: '', // Content would need to be fetched separately for full comparison
        }));
        setVersions(docVersions);
        setError(null);
      } else {
        setVersions([]);
        setTimelineVersions([]);
        setError(json.error || 'Failed to fetch versions');
      }
    } catch (err) {
      console.error('Error fetching versions:', err);
      setVersions([]);
      setTimelineVersions([]);
      setError('Failed to fetch versions');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return { versions, timelineVersions, loading, error, refetch: fetchVersions };
}

export default function VersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'compare' | 'timeline'>('timeline');
  
  // Fetch real version data
  const { versions, timelineVersions, loading, error, refetch } = useVersions(id);
  
  const handleAcceptVersion = async (versionId: string) => {
    const version = versions.find((v) => v.id === versionId);
    toast.success(`Version ${version?.version || versionId} accepted`, {
      description: 'The selected version has been set as the current version.',
    });
  };

  const handleMergeVersions = (leftId: string, rightId: string) => {
    toast.info('Merge initiated', {
      description: 'Opening merge editor to combine versions...',
    });
  };
  
  const handleTimelineCompare = (versionA: number, versionB: number) => {
    router.push(`/contracts/${id}/versions/compare?a=${versionA}&b=${versionB}`);
  };

  const latestVersion = timelineVersions.length > 0 
    ? timelineVersions[timelineVersions.length - 1] 
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-violet-50/20">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-violet-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <Link href={`/contracts/${id}`}>
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Contract
                </Button>
              </Link>
              <div className="h-6 w-px bg-white/30" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <History className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    Version History
                  </h1>
                  <div className="flex items-center gap-3 mt-0.5 text-sm text-purple-100">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Contract Document
                    </span>
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />
                      {timelineVersions.length} version{timelineVersions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-3">
              {/* Refresh Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={refetch}
                disabled={loading}
                className="text-white/80 hover:text-white hover:bg-white/20 gap-1"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              
              {/* View Mode Toggle */}
              <div className="flex items-center bg-white/10 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('timeline')}
                  className={`text-white/80 hover:text-white hover:bg-white/20 gap-1 ${viewMode === 'timeline' ? 'bg-white/20' : ''}`}
                >
                  <History className="w-4 h-4" />
                  Timeline
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('compare')}
                  className={`text-white/80 hover:text-white hover:bg-white/20 gap-1 ${viewMode === 'compare' ? 'bg-white/20' : ''}`}
                >
                  <GitCompare className="w-4 h-4" />
                  Compare
                </Button>
              </div>
              {latestVersion && (
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-4 py-2">
                  <Clock className="w-4 h-4 mr-2" />
                  Last updated {new Date(latestVersion.uploadedAt).toLocaleDateString()}
                </Badge>
              )}
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-4 py-2">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Comparison
              </Badge>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-7xl mx-auto px-6 py-6"
      >
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
            <h3 className="font-semibold mb-2">Failed to load versions</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </Card>
        ) : timelineVersions.length === 0 ? (
          <Card className="p-12 text-center">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No versions yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This contract has no version history. Upload a new version to start tracking changes.
            </p>
          </Card>
        ) : viewMode === 'timeline' ? (
          <div className="space-y-6">
            {/* Visual Timeline */}
            <VersionTimeline
              versions={timelineVersions as ContractVersion[]}
              contractId={id}
              onCompare={handleTimelineCompare}
              onRevert={(versionId) => {
                toast.info('Reverting...', { description: `Reverting to version ${versionId}` });
              }}
              onView={(versionId) => {
                setViewMode('compare');
              }}
              onCreateSnapshot={() => {
                toast.success('Snapshot created');
              }}
            />
          </div>
        ) : (
          <VersionCompare
            documentId={id}
            versions={versions}
            onAcceptVersion={handleAcceptVersion}
            onMergeVersions={handleMergeVersions}
            className="h-[calc(100vh-180px)]"
          />
        )}
      </motion.div>
    </div>
  );
}
