'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCompare,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  FileText,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Download,
  Printer,
  Merge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Types
interface DocumentVersion {
  id: string;
  version: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  timestamp: Date;
  changes: number;
  content: string;
  label?: string;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  leftContent?: string;
  rightContent?: string;
  leftLineNumber?: number;
  rightLineNumber?: number;
}

interface VersionCompareProps {
  documentId: string;
  versions: DocumentVersion[];
  onAcceptVersion?: (versionId: string) => void;
  onMergeVersions?: (leftId: string, rightId: string) => void;
  className?: string;
}

// Diff algorithm
function computeDiff(left: string, right: string): DiffLine[] {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const diffLines: DiffLine[] = [];

  // Simple LCS-based diff
  const lcs = computeLCS(leftLines, rightLines);
  let li = 0, ri = 0, lcsIdx = 0;
  let leftLineNum = 1, rightLineNum = 1;

  while (li < leftLines.length || ri < rightLines.length) {
    if (lcsIdx < lcs.length && li < leftLines.length && leftLines[li] === lcs[lcsIdx]) {
      if (ri < rightLines.length && rightLines[ri] === lcs[lcsIdx]) {
        // Common line
        diffLines.push({
          type: 'unchanged',
          leftContent: leftLines[li],
          rightContent: rightLines[ri],
          leftLineNumber: leftLineNum++,
          rightLineNumber: rightLineNum++,
        });
        li++;
        ri++;
        lcsIdx++;
      } else if (ri < rightLines.length) {
        // Right has an added line
        diffLines.push({
          type: 'added',
          rightContent: rightLines[ri],
          rightLineNumber: rightLineNum++,
        });
        ri++;
      }
    } else if (lcsIdx < lcs.length && ri < rightLines.length && rightLines[ri] === lcs[lcsIdx]) {
      // Left has a removed line
      diffLines.push({
        type: 'removed',
        leftContent: leftLines[li],
        leftLineNumber: leftLineNum++,
      });
      li++;
    } else {
      // Both differ
      if (li < leftLines.length && ri < rightLines.length) {
        diffLines.push({
          type: 'modified',
          leftContent: leftLines[li],
          rightContent: rightLines[ri],
          leftLineNumber: leftLineNum++,
          rightLineNumber: rightLineNum++,
        });
        li++;
        ri++;
      } else if (li < leftLines.length) {
        diffLines.push({
          type: 'removed',
          leftContent: leftLines[li],
          leftLineNumber: leftLineNum++,
        });
        li++;
      } else if (ri < rightLines.length) {
        diffLines.push({
          type: 'added',
          rightContent: rightLines[ri],
          rightLineNumber: rightLineNum++,
        });
        ri++;
      }
    }
  }

  return diffLines;
}

function computeLCS(left: string[], right: string[]): string[] {
  const m = left.length;
  const n = right.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [];
    for (let j = 0; j <= n; j++) {
      dp[i]![j] = 0;
    }
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (left[i - 1] === right[j - 1]) {
        dp[i]![j] = (dp[i - 1]?.[j - 1] ?? 0) + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]?.[j] ?? 0, dp[i]?.[j - 1] ?? 0);
      }
    }
  }

  // Backtrack
  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      lcs.unshift(left[i - 1] ?? '');
      i--;
      j--;
    } else if ((dp[i - 1]?.[j] ?? 0) > (dp[i]?.[j - 1] ?? 0)) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

// Version selector component
function VersionSelector({
  versions,
  selectedVersion,
  onSelect,
  label,
  position,
}: {
  versions: DocumentVersion[];
  selectedVersion: DocumentVersion | undefined;
  onSelect: (version: DocumentVersion) => void;
  label: string;
  position: 'left' | 'right';
}) {
  if (!selectedVersion) return null;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors w-full',
          position === 'left'
            ? 'border-red-200 bg-red-50 hover:bg-red-100'
            : 'border-green-200 bg-green-50 hover:bg-green-100'
        )}
      >
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
            position === 'left' ? 'bg-red-500' : 'bg-green-500'
          )}
        >
          {selectedVersion.author.avatar ? (
            <img
              src={selectedVersion.author.avatar}
              alt={selectedVersion.author.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            selectedVersion.author.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 text-left">
          <div className="text-xs font-medium text-slate-500 uppercase">{label}</div>
          <div className="font-medium text-slate-900">{selectedVersion.version}</div>
          <div className="text-xs text-slate-500">
            {selectedVersion.author.name} • {selectedVersion.timestamp.toLocaleDateString()}
          </div>
        </div>
        <ChevronDown className={cn('w-5 h-5 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-slate-200 z-20 overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto">
              {versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => {
                    onSelect(version);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left',
                    version.id === selectedVersion.id && 'bg-slate-100'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-medium">
                    {version.author.avatar ? (
                      <img
                        src={version.author.avatar}
                        alt={version.author.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      version.author.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{version.version}</span>
                      {version.label && (
                        <Badge variant="secondary" className="text-xs">
                          {version.label}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {version.author.name} • {version.changes} changes
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {version.timestamp.toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Diff line component
function DiffLineRow({ line, showLineNumbers }: { line: DiffLine; showLineNumbers: boolean }) {
  const getLineStyles = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'bg-green-50';
      case 'removed':
        return 'bg-red-50';
      case 'modified':
        return 'bg-yellow-50';
      default:
        return '';
    }
  };

  return (
    <div className={cn('flex', getLineStyles(line.type))}>
      {/* Left side */}
      <div className="flex-1 flex border-r border-slate-200">
        {showLineNumbers && (
          <div className="w-12 flex-shrink-0 text-xs text-slate-400 text-right pr-2 py-1 bg-slate-100 border-r border-slate-200 select-none">
            {line.leftLineNumber || ''}
          </div>
        )}
        <div className="flex-1 px-3 py-1 font-mono text-sm">
          {line.type === 'removed' || line.type === 'modified' || line.type === 'unchanged' ? (
            <span className={cn(line.type === 'removed' && 'text-red-700 line-through', line.type === 'modified' && 'text-amber-700')}>
              {line.leftContent}
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex-1 flex">
        {showLineNumbers && (
          <div className="w-12 flex-shrink-0 text-xs text-slate-400 text-right pr-2 py-1 bg-slate-100 border-r border-slate-200 select-none">
            {line.rightLineNumber || ''}
          </div>
        )}
        <div className="flex-1 px-3 py-1 font-mono text-sm">
          {line.type === 'added' || line.type === 'modified' || line.type === 'unchanged' ? (
            <span className={cn(line.type === 'added' && 'text-green-700 font-medium', line.type === 'modified' && 'text-amber-700')}>
              {line.rightContent}
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Main component
export function VersionCompare({
  documentId,
  versions,
  onAcceptVersion,
  onMergeVersions,
  className,
}: VersionCompareProps) {
  const [leftVersion, setLeftVersion] = useState<DocumentVersion | undefined>(versions[versions.length > 1 ? versions.length - 2 : 0]);
  const [rightVersion, setRightVersion] = useState<DocumentVersion | undefined>(versions[versions.length - 1]);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');

  const diff = useMemo(
    () => leftVersion && rightVersion ? computeDiff(leftVersion.content, rightVersion.content) : [],
    [leftVersion, rightVersion]
  );

  const stats = useMemo(() => {
    return {
      added: diff.filter((l) => l.type === 'added').length,
      removed: diff.filter((l) => l.type === 'removed').length,
      modified: diff.filter((l) => l.type === 'modified').length,
      unchanged: diff.filter((l) => l.type === 'unchanged').length,
    };
  }, [diff]);

  return (
    <div className={cn('flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden', isFullscreen && 'fixed inset-0 z-50', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <GitCompare className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-slate-900">Version Comparison</h3>
          <Badge variant="secondary" className="gap-1">
            <span className="text-green-600">+{stats.added}</span>
            <span className="text-slate-400">/</span>
            <span className="text-red-600">-{stats.removed}</span>
            <span className="text-slate-400">/</span>
            <span className="text-amber-600">~{stats.modified}</span>
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('split')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                viewMode === 'split' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              Split
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                viewMode === 'unified' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              Unified
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className="gap-1"
          >
            {showLineNumbers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            Lines
          </Button>

          <Button variant="ghost" size="sm" className="gap-1">
            <Download className="w-4 h-4" />
            Export
          </Button>

          <Button variant="ghost" size="sm" className="gap-1">
            <Printer className="w-4 h-4" />
            Print
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Version selectors */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-white border-b border-slate-200">
        <VersionSelector
          versions={versions}
          selectedVersion={leftVersion}
          onSelect={setLeftVersion}
          label="Base Version (Before)"
          position="left"
        />
        <VersionSelector
          versions={versions}
          selectedVersion={rightVersion}
          onSelect={setRightVersion}
          label="Current Version (After)"
          position="right"
        />
      </div>

      {/* Diff view */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'split' ? (
          <div className="divide-y divide-slate-100">
            {diff.map((line, index) => (
              <DiffLineRow key={index} line={line} showLineNumbers={showLineNumbers} />
            ))}
          </div>
        ) : (
          // Unified view
          <div className="divide-y divide-slate-100">
            {diff.map((line, index) => (
              <div
                key={index}
                className={cn(
                  'flex font-mono text-sm',
                  line.type === 'added' && 'bg-green-50',
                  line.type === 'removed' && 'bg-red-50',
                  line.type === 'modified' && 'bg-yellow-50'
                )}
              >
                {showLineNumbers && (
                  <>
                    <div className="w-12 flex-shrink-0 text-xs text-slate-400 text-right pr-2 py-1 bg-slate-100 border-r border-slate-200 select-none">
                      {line.leftLineNumber || ''}
                    </div>
                    <div className="w-12 flex-shrink-0 text-xs text-slate-400 text-right pr-2 py-1 bg-slate-100 border-r border-slate-200 select-none">
                      {line.rightLineNumber || ''}
                    </div>
                  </>
                )}
                <div className="w-6 flex-shrink-0 flex items-center justify-center text-xs font-mono bg-slate-100 border-r border-slate-200">
                  {line.type === 'added' && <span className="text-green-600">+</span>}
                  {line.type === 'removed' && <span className="text-red-600">-</span>}
                  {line.type === 'modified' && <span className="text-amber-600">~</span>}
                </div>
                <div className="flex-1 px-3 py-1">
                  {line.type === 'removed' && (
                    <span className="text-red-700 line-through">{line.leftContent}</span>
                  )}
                  {line.type === 'added' && (
                    <span className="text-green-700">{line.rightContent}</span>
                  )}
                  {line.type === 'modified' && (
                    <>
                      <span className="text-red-700 line-through mr-2">{line.leftContent}</span>
                      <span className="text-green-700">{line.rightContent}</span>
                    </>
                  )}
                  {line.type === 'unchanged' && (
                    <span className="text-slate-700">{line.leftContent}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>{stats.unchanged} unchanged lines</span>
          <span className="text-green-600">+{stats.added} additions</span>
          <span className="text-red-600">-{stats.removed} deletions</span>
          <span className="text-amber-600">~{stats.modified} modifications</span>
        </div>

        <div className="flex items-center gap-2">
          {onMergeVersions && leftVersion && rightVersion && (
            <Button
              variant="outline"
              onClick={() => onMergeVersions(leftVersion.id, rightVersion.id)}
              className="gap-2"
            >
              <Merge className="w-4 h-4" />
              Merge Versions
            </Button>
          )}
          {onAcceptVersion && rightVersion && (
            <Button
              onClick={() => onAcceptVersion(rightVersion.id)}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4" />
              Accept Current Version
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Export for use in other components
export type { DocumentVersion, DiffLine };
