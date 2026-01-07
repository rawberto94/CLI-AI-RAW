'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCompare,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  Check,
  X,
  AlertTriangle,
  Plus,
  Minus,
  FileText,
  DollarSign,
  Calendar,
  Users,
  Shield,
  Sparkles,
  Download,
  Copy,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ContractVersion {
  id: string;
  version: string;
  title: string;
  createdAt: Date;
  createdBy: string;
  status: 'draft' | 'active' | 'archived';
}

interface DiffSection {
  id: string;
  title: string;
  category: 'terms' | 'financial' | 'dates' | 'parties' | 'compliance' | 'general';
  changes: DiffChange[];
}

interface DiffChange {
  id: string;
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  significance: 'critical' | 'major' | 'minor' | 'info';
}

interface ContractComparisonProps {
  contractId: string;
  versions: ContractVersion[];
  isOpen: boolean;
  onClose: () => void;
  onSelectVersions?: (leftId: string, rightId: string) => void;
}

// ============================================================================
// Helper Components
// ============================================================================

const categoryIcons: Record<DiffSection['category'], React.ReactNode> = {
  terms: <FileText className="w-4 h-4" />,
  financial: <DollarSign className="w-4 h-4" />,
  dates: <Calendar className="w-4 h-4" />,
  parties: <Users className="w-4 h-4" />,
  compliance: <Shield className="w-4 h-4" />,
  general: <FileText className="w-4 h-4" />,
};

const categoryColors: Record<DiffSection['category'], string> = {
  terms: 'text-blue-600 bg-blue-100',
  financial: 'text-green-600 bg-green-100',
  dates: 'text-purple-600 bg-purple-100',
  parties: 'text-amber-600 bg-amber-100',
  compliance: 'text-rose-600 bg-rose-100',
  general: 'text-slate-600 bg-slate-100',
};

const significanceStyles: Record<DiffChange['significance'], { color: string; label: string }> = {
  critical: { color: 'text-red-600 bg-red-50 border-red-200', label: 'Critical' },
  major: { color: 'text-amber-600 bg-amber-50 border-amber-200', label: 'Major' },
  minor: { color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Minor' },
  info: { color: 'text-slate-600 bg-slate-50 border-slate-200', label: 'Info' },
};

function ChangeTypeBadge({ type }: { type: DiffChange['changeType'] }) {
  const styles = {
    added: { icon: Plus, color: 'text-green-700 bg-green-100', label: 'Added' },
    removed: { icon: Minus, color: 'text-red-700 bg-red-100', label: 'Removed' },
    modified: { icon: ArrowLeftRight, color: 'text-amber-700 bg-amber-100', label: 'Modified' },
    unchanged: { icon: Check, color: 'text-slate-500 bg-slate-100', label: 'Unchanged' },
  };

  const style = styles[type];
  const Icon = style.icon;

  return (
    <Badge className={cn("gap-1 text-xs", style.color)}>
      <Icon className="w-3 h-3" />
      {style.label}
    </Badge>
  );
}

function DiffLine({
  change,
  showDetails,
}: {
  change: DiffChange;
  showDetails: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (change.changeType === 'unchanged' && !showDetails) {
    return null;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "rounded-lg border p-3 transition-all",
        significanceStyles[change.significance].color
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{change.field}</span>
            <ChangeTypeBadge type={change.changeType} />
            {change.significance !== 'info' && (
              <Badge variant="outline" className="text-xs">
                {significanceStyles[change.significance].label}
              </Badge>
            )}
          </div>

          {change.changeType === 'modified' && (
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="p-2 rounded bg-red-50 border border-red-200">
                <div className="text-xs text-red-500 mb-1 font-medium">Previous</div>
                <div className="text-sm text-red-700 line-through">
                  {change.oldValue || '(empty)'}
                </div>
              </div>
              <div className="p-2 rounded bg-green-50 border border-green-200">
                <div className="text-xs text-green-500 mb-1 font-medium">Current</div>
                <div className="text-sm text-green-700">
                  {change.newValue || '(empty)'}
                </div>
              </div>
            </div>
          )}

          {change.changeType === 'added' && (
            <div className="mt-2 p-2 rounded bg-green-50 border border-green-200">
              <div className="text-sm text-green-700">{change.newValue}</div>
            </div>
          )}

          {change.changeType === 'removed' && (
            <div className="mt-2 p-2 rounded bg-red-50 border border-red-200">
              <div className="text-sm text-red-700 line-through">{change.oldValue}</div>
            </div>
          )}

          {change.changeType === 'unchanged' && (
            <div className="mt-2 p-2 rounded bg-slate-50 border border-slate-200">
              <div className="text-sm text-slate-600">{change.newValue}</div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContractComparison({
  contractId,
  versions,
  isOpen,
  onClose,
  onSelectVersions,
}: ContractComparisonProps) {
  const [leftVersion, setLeftVersion] = useState<string>(versions[1]?.id || '');
  const [rightVersion, setRightVersion] = useState<string>(versions[0]?.id || '');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'financial'>('all');
  const [diffSections, setDiffSections] = useState<DiffSection[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch comparison data from API
  React.useEffect(() => {
    if (!isOpen || !leftVersion || !rightVersion || leftVersion === rightVersion) {
      return;
    }

    const fetchComparison = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/contracts/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractId1: leftVersion,
            contractId2: rightVersion,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to compare: ${response.status}`);
        }

        const data = await response.json();
        
        // Transform API response to DiffSection format
        const sections: DiffSection[] = [];
        
        if (data.differences) {
          // Map API differences to our section format
          const categoryMap: Record<string, DiffSection['category']> = {
            'terms': 'terms',
            'financial': 'financial',
            'dates': 'dates',
            'parties': 'parties',
            'compliance': 'compliance',
          };

          Object.entries(data.differences).forEach(([category, diffs]: [string, any]) => {
            if (Array.isArray(diffs) && diffs.length > 0) {
              sections.push({
                id: category,
                title: category.charAt(0).toUpperCase() + category.slice(1),
                category: categoryMap[category] || 'general',
                changes: diffs.map((diff: any, idx: number) => ({
                  id: `${category}-${idx}`,
                  field: diff.field || diff.key || 'Unknown',
                  oldValue: diff.oldValue ?? diff.value1 ?? null,
                  newValue: diff.newValue ?? diff.value2 ?? null,
                  changeType: determineChangeType(diff.oldValue ?? diff.value1, diff.newValue ?? diff.value2),
                  significance: determineSignificance(category, diff),
                })),
              });
            }
          });
        }

        setDiffSections(sections);
      } catch (err) {
        console.error('Error fetching comparison:', err);
        setError(err instanceof Error ? err.message : 'Failed to load comparison');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparison();
  }, [isOpen, leftVersion, rightVersion]);

  // Helper to determine change type
  const determineChangeType = (oldVal: any, newVal: any): DiffChange['changeType'] => {
    if (oldVal === null || oldVal === undefined) return 'added';
    if (newVal === null || newVal === undefined) return 'removed';
    if (oldVal === newVal) return 'unchanged';
    return 'modified';
  };

  // Helper to determine significance
  const determineSignificance = (category: string, diff: any): DiffChange['significance'] => {
    if (category === 'financial' || diff.field?.toLowerCase().includes('liability')) return 'critical';
    if (category === 'terms' || category === 'compliance') return 'major';
    if (category === 'dates') return 'minor';
    return 'info';
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const allChanges = diffSections.flatMap(s => s.changes);
    return {
      total: allChanges.length,
      added: allChanges.filter(c => c.changeType === 'added').length,
      removed: allChanges.filter(c => c.changeType === 'removed').length,
      modified: allChanges.filter(c => c.changeType === 'modified').length,
      critical: allChanges.filter(c => c.significance === 'critical').length,
      major: allChanges.filter(c => c.significance === 'major').length,
    };
  }, [diffSections]);

  // Filter sections based on active tab
  const filteredSections = useMemo(() => {
    if (activeTab === 'all') return diffSections;
    if (activeTab === 'critical') {
      return diffSections.map(section => ({
        ...section,
        changes: section.changes.filter(c => c.significance === 'critical' || c.significance === 'major'),
      })).filter(s => s.changes.length > 0);
    }
    if (activeTab === 'financial') {
      return diffSections.filter(s => s.category === 'financial');
    }
    return diffSections;
  }, [diffSections, activeTab]);

  const handleSwapVersions = () => {
    const temp = leftVersion;
    setLeftVersion(rightVersion);
    setRightVersion(temp);
  };

  const handleVersionChange = (side: 'left' | 'right', versionId: string) => {
    if (side === 'left') {
      setLeftVersion(versionId);
    } else {
      setRightVersion(versionId);
    }
    onSelectVersions?.(
      side === 'left' ? versionId : leftVersion,
      side === 'right' ? versionId : rightVersion
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 p-6 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <GitCompare className="w-6 h-6" />
              </div>
              Contract Comparison
            </DialogTitle>
            <DialogDescription className="text-indigo-100">
              Compare changes between contract versions
            </DialogDescription>
          </DialogHeader>

          {/* Version Selectors */}
          <div className="flex items-center gap-4 mt-6">
            <div className="flex-1">
              <label className="text-xs text-indigo-200 mb-1 block">Previous Version</label>
              <Select value={leftVersion} onValueChange={(v) => handleVersionChange('left', v)}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id} disabled={v.id === rightVersion}>
                      {v.version} - {v.createdAt.toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwapVersions}
              className="mt-5 text-white hover:bg-white/20"
            >
              <ArrowLeftRight className="w-5 h-5" />
            </Button>

            <div className="flex-1">
              <label className="text-xs text-indigo-200 mb-1 block">Current Version</label>
              <Select value={rightVersion} onValueChange={(v) => handleVersionChange('right', v)}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id} disabled={v.id === leftVersion}>
                      {v.version} - {v.createdAt.toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-5 gap-3 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-indigo-200">Total Changes</div>
            </div>
            <div className="bg-green-500/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-300">{stats.added}</div>
              <div className="text-xs text-green-200">Added</div>
            </div>
            <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-red-300">{stats.removed}</div>
              <div className="text-xs text-red-200">Removed</div>
            </div>
            <div className="bg-amber-500/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-amber-300">{stats.modified}</div>
              <div className="text-xs text-amber-200">Modified</div>
            </div>
            <div className="bg-rose-500/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-rose-300">{stats.critical}</div>
              <div className="text-xs text-rose-200">Critical</div>
            </div>
          </div>
        </div>

        {/* Tabs & Content */}
        <div className="p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-slate-100">
                <TabsTrigger value="all" className="gap-1.5">
                  <Eye className="w-4 h-4" />
                  All Changes
                </TabsTrigger>
                <TabsTrigger value="critical" className="gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Critical & Major
                </TabsTrigger>
                <TabsTrigger value="financial" className="gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  Financial
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUnchanged(!showUnchanged)}
                  className={cn(showUnchanged && "bg-slate-100")}
                >
                  {showUnchanged ? 'Hide' : 'Show'} Unchanged
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1.5" />
                  Export
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              {/* Loading State */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
                  <p className="text-sm text-slate-600">Analyzing differences...</p>
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <AlertTriangle className="w-12 h-12 text-amber-600 mb-4" />
                  <p className="text-sm text-slate-600 mb-4">{error}</p>
                  <Button variant="outline" size="sm" onClick={() => {
                    setError(null);
                    // Trigger refetch by toggling versions
                    const temp = leftVersion;
                    setLeftVersion(rightVersion);
                    setRightVersion(temp);
                  }}>
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Retry
                  </Button>
                </div>
              )}

              {/* Content */}
              {!isLoading && !error && (
                <div className="space-y-6">
                  <AnimatePresence mode="popLayout">
                    {filteredSections.map((section) => (
                      <motion.div
                        key={section.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <Card className="shadow-sm border-slate-200">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <div className={cn("p-1.5 rounded-lg", categoryColors[section.category])}>
                                {categoryIcons[section.category]}
                              </div>
                              {section.title}
                              <Badge variant="outline" className="ml-auto">
                                {section.changes.filter(c => c.changeType !== 'unchanged' || showUnchanged).length} changes
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {section.changes
                              .filter(c => c.changeType !== 'unchanged' || showUnchanged)
                              .map((change) => (
                                <DiffLine
                                  key={change.id}
                                  change={change}
                                  showDetails={true}
                                />
                              ))}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {filteredSections.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <GitCompare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No changes found in this view</p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </Tabs>
        </div>

        {/* Footer Actions */}
        <div className="border-t bg-slate-50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI-powered change detection
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <Copy className="w-4 h-4 mr-1.5" />
              Copy Summary
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Compact Comparison Button
// ============================================================================

interface CompareButtonProps {
  onClick: () => void;
  versionsCount: number;
  className?: string;
}

export function CompareButton({ onClick, versionsCount, className }: CompareButtonProps) {
  if (versionsCount < 2) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn("gap-1.5", className)}
    >
      <GitCompare className="w-4 h-4" />
      Compare Versions
      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
        {versionsCount}
      </Badge>
    </Button>
  );
}

export default ContractComparison;
