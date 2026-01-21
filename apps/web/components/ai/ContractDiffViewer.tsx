"use client";

/**
 * Contract Diff Viewer Component
 * 
 * Visual side-by-side comparison of contract versions.
 * Highlights differences with AI-powered annotations.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Minus,
  Edit,
  ChevronDown,
  ChevronRight,
  FileText,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Filter,
  Download,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Types
interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  lineNumber: { left?: number; right?: number };
  content: { left?: string; right?: string };
  highlight?: {
    left?: Array<{ start: number; end: number }>;
    right?: Array<{ start: number; end: number }>;
  };
}

interface DiffSection {
  id: string;
  title: string;
  lines: DiffLine[];
  summary?: string;
  aiAnnotation?: {
    significance: 'low' | 'medium' | 'high';
    explanation: string;
    recommendation?: string;
  };
}

interface ContractVersion {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  createdBy?: string;
}

interface ContractDiffViewerProps {
  leftVersion: ContractVersion;
  rightVersion: ContractVersion;
  onClose?: () => void;
  showAIAnnotations?: boolean;
  className?: string;
}

interface DiffStats {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

export function ContractDiffViewer({
  leftVersion,
  rightVersion,
  onClose,
  showAIAnnotations = true,
  className = '',
}: ContractDiffViewerProps) {
  const [sections, setSections] = useState<DiffSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'changes' | 'additions' | 'deletions'>('all');
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [fontSize, setFontSize] = useState(14);

  // Compute diff
  useEffect(() => {
    const computeDiff = async () => {
      setIsLoading(true);
      
      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const leftLines = leftVersion.content.split('\n');
      const rightLines = rightVersion.content.split('\n');
      
      // Simple line-by-line diff (in production, use proper diff algorithm)
      const diffSections = computeLineDiff(leftLines, rightLines);
      setSections(diffSections);
      
      // Auto-expand sections with changes
      const sectionsWithChanges = diffSections
        .filter((s) => s.lines.some((l) => l.type !== 'unchanged'))
        .map((s) => s.id);
      setExpandedSections(new Set(sectionsWithChanges));
      
      setIsLoading(false);
      
      // Load AI annotations
      if (showAIAnnotations) {
        await loadAIAnnotations(diffSections);
      }
    };
    
    computeDiff();
  }, [leftVersion, rightVersion, showAIAnnotations]);

  // Load AI annotations for significant changes
  const loadAIAnnotations = async (diffSections: DiffSection[]) => {
    setIsLoadingAnnotations(true);
    
    try {
      // Simulate AI analysis
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const annotatedSections = diffSections.map((section) => {
        const changedLines = section.lines.filter((l) => l.type !== 'unchanged');
        if (changedLines.length === 0) return section;
        
        // Generate mock annotations
        const hasSignificantChanges = changedLines.length > 3;
        return {
          ...section,
          aiAnnotation: {
            significance: hasSignificantChanges ? 'high' : changedLines.length > 1 ? 'medium' : 'low',
            explanation: generateAnnotationText(section, changedLines),
            recommendation: hasSignificantChanges ? 'Review these changes carefully with legal counsel.' : undefined,
          },
        };
      });
      
      setSections(annotatedSections);
    } catch (error) {
      console.error('Failed to load AI annotations:', error);
    } finally {
      setIsLoadingAnnotations(false);
    }
  };

  // Compute statistics
  const stats = useMemo<DiffStats>(() => {
    let added = 0, removed = 0, modified = 0, unchanged = 0;
    
    for (const section of sections) {
      for (const line of section.lines) {
        switch (line.type) {
          case 'added': added++; break;
          case 'removed': removed++; break;
          case 'modified': modified++; break;
          case 'unchanged': unchanged++; break;
        }
      }
    }
    
    return { added, removed, modified, unchanged };
  }, [sections]);

  // Filter sections based on filter type
  const filteredSections = useMemo(() => {
    if (filterType === 'all') return sections;
    
    return sections.map((section) => ({
      ...section,
      lines: section.lines.filter((line) => {
        if (filterType === 'changes') return line.type !== 'unchanged';
        if (filterType === 'additions') return line.type === 'added';
        if (filterType === 'deletions') return line.type === 'removed';
        return true;
      }),
    })).filter((s) => s.lines.length > 0);
  }, [sections, filterType]);

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Export diff report
  const exportDiff = useCallback(() => {
    let report = `CONTRACT DIFF REPORT\n`;
    report += `${'='.repeat(50)}\n\n`;
    report += `Left: ${leftVersion.name} (${formatDate(leftVersion.createdAt)})\n`;
    report += `Right: ${rightVersion.name} (${formatDate(rightVersion.createdAt)})\n\n`;
    report += `Changes: +${stats.added} additions, -${stats.removed} deletions, ~${stats.modified} modifications\n\n`;
    report += `${'='.repeat(50)}\n\n`;
    
    for (const section of sections) {
      if (section.lines.some((l) => l.type !== 'unchanged')) {
        report += `## ${section.title}\n`;
        if (section.aiAnnotation) {
          report += `[${section.aiAnnotation.significance.toUpperCase()}] ${section.aiAnnotation.explanation}\n`;
        }
        report += '\n';
        
        for (const line of section.lines) {
          const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
          const content = line.content.right || line.content.left || '';
          report += `${prefix} ${content}\n`;
        }
        report += '\n';
      }
    }
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diff-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [leftVersion, rightVersion, sections, stats]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-slate-500">Computing differences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <ArrowLeftRight className="w-5 h-5 text-slate-500" />
          <div>
            <h3 className="font-semibold text-slate-800">Contract Comparison</h3>
            <p className="text-sm text-slate-500">
              {leftVersion.name} → {rightVersion.name}
            </p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Plus className="w-3 h-3 mr-1" />
              {stats.added}
            </Badge>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <Minus className="w-3 h-3 mr-1" />
              {stats.removed}
            </Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <Edit className="w-3 h-3 mr-1" />
              {stats.modified}
            </Badge>
          </div>
          
          {showAIAnnotations && isLoadingAnnotations && (
            <div className="flex items-center gap-1 text-sm text-purple-600">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Analyzing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={(v: typeof filterType) => setFilterType(v)}>
            <SelectTrigger className="w-32 h-8">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lines</SelectItem>
              <SelectItem value="changes">Changes Only</SelectItem>
              <SelectItem value="additions">Additions</SelectItem>
              <SelectItem value="deletions">Deletions</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center border border-slate-200 rounded-md">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 text-xs ${viewMode === 'split' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
            >
              Split
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`px-3 py-1.5 text-xs ${viewMode === 'unified' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
            >
              Unified
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setFontSize((s) => Math.max(10, s - 2))}
                  className="p-1.5 hover:bg-slate-100 rounded"
                >
                  <ZoomOut className="w-4 h-4 text-slate-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Decrease font size</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <span className="text-xs text-slate-500">{fontSize}px</span>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setFontSize((s) => Math.min(20, s + 2))}
                  className="p-1.5 hover:bg-slate-100 rounded"
                >
                  <ZoomIn className="w-4 h-4 text-slate-500" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Increase font size</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <Button variant="outline" size="sm" onClick={exportDiff}>
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Diff Content */}
      <ScrollArea className="h-[600px]">
        <div className="p-4">
          {filteredSections.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No differences found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSections.map((section) => (
                <DiffSectionComponent
                  key={section.id}
                  section={section}
                  isExpanded={expandedSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                  viewMode={viewMode}
                  fontSize={fontSize}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Diff Section Component
function DiffSectionComponent({
  section,
  isExpanded,
  onToggle,
  viewMode,
  fontSize,
}: {
  section: DiffSection;
  isExpanded: boolean;
  onToggle: () => void;
  viewMode: 'split' | 'unified';
  fontSize: number;
}) {
  const hasChanges = section.lines.some((l) => l.type !== 'unchanged');
  const changeCount = section.lines.filter((l) => l.type !== 'unchanged').length;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <span className="font-medium text-slate-700">{section.title}</span>
          {hasChanges && (
            <Badge variant="secondary" className="text-xs">
              {changeCount} change{changeCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        {section.aiAnnotation && (
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${
            section.aiAnnotation.significance === 'high'
              ? 'bg-red-100 text-red-700'
              : section.aiAnnotation.significance === 'medium'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            <Sparkles className="w-3 h-3" />
            {section.aiAnnotation.significance}
          </div>
        )}
      </button>

      {/* Section Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* AI Annotation */}
            {section.aiAnnotation && (
              <div className="p-3 bg-purple-50 border-b border-purple-100">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-purple-800">{section.aiAnnotation.explanation}</p>
                    {section.aiAnnotation.recommendation && (
                      <p className="text-xs text-purple-600 mt-1">
                        💡 {section.aiAnnotation.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Diff Lines */}
            <div className="overflow-x-auto">
              {viewMode === 'split' ? (
                <SplitView lines={section.lines} fontSize={fontSize} />
              ) : (
                <UnifiedView lines={section.lines} fontSize={fontSize} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Split View
function SplitView({ lines, fontSize }: { lines: DiffLine[]; fontSize: number }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-slate-200">
      {/* Left side */}
      <div className="overflow-hidden">
        {lines.map((line, i) => (
          <div
            key={`left-${i}`}
            className={`flex ${getLineBackground(line.type, 'left')}`}
            style={{ fontSize }}
          >
            <div className="w-12 px-2 py-1 text-right text-xs text-slate-400 bg-slate-50 border-r border-slate-100 select-none">
              {line.lineNumber.left}
            </div>
            <pre className="flex-1 px-3 py-1 whitespace-pre-wrap font-mono">
              {line.content.left || '\u00A0'}
            </pre>
          </div>
        ))}
      </div>
      
      {/* Right side */}
      <div className="overflow-hidden">
        {lines.map((line, i) => (
          <div
            key={`right-${i}`}
            className={`flex ${getLineBackground(line.type, 'right')}`}
            style={{ fontSize }}
          >
            <div className="w-12 px-2 py-1 text-right text-xs text-slate-400 bg-slate-50 border-r border-slate-100 select-none">
              {line.lineNumber.right}
            </div>
            <pre className="flex-1 px-3 py-1 whitespace-pre-wrap font-mono">
              {line.content.right || '\u00A0'}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

// Unified View
function UnifiedView({ lines, fontSize }: { lines: DiffLine[]; fontSize: number }) {
  return (
    <div>
      {lines.map((line, i) => (
        <div
          key={i}
          className={`flex ${getLineBackground(line.type, 'unified')}`}
          style={{ fontSize }}
        >
          <div className="w-12 px-2 py-1 text-right text-xs text-slate-400 bg-slate-50 border-r border-slate-100 select-none">
            {line.lineNumber.left || line.lineNumber.right}
          </div>
          <div className="w-8 px-2 py-1 text-center text-xs font-bold bg-slate-50 border-r border-slate-100 select-none">
            {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
          </div>
          <pre className="flex-1 px-3 py-1 whitespace-pre-wrap font-mono">
            {line.content.right || line.content.left || '\u00A0'}
          </pre>
        </div>
      ))}
    </div>
  );
}

// Utility functions
function computeLineDiff(leftLines: string[], rightLines: string[]): DiffSection[] {
  const sections: DiffSection[] = [];
  const lines: DiffLine[] = [];
  
  const maxLength = Math.max(leftLines.length, rightLines.length);
  
  for (let i = 0; i < maxLength; i++) {
    const left = leftLines[i];
    const right = rightLines[i];
    
    if (left === right) {
      lines.push({
        type: 'unchanged',
        lineNumber: { left: i + 1, right: i + 1 },
        content: { left, right },
      });
    } else if (left === undefined) {
      lines.push({
        type: 'added',
        lineNumber: { right: i + 1 },
        content: { right },
      });
    } else if (right === undefined) {
      lines.push({
        type: 'removed',
        lineNumber: { left: i + 1 },
        content: { left },
      });
    } else {
      lines.push({
        type: 'modified',
        lineNumber: { left: i + 1, right: i + 1 },
        content: { left, right },
      });
    }
  }
  
  // Group into sections (simplified: one section for demo)
  sections.push({
    id: 'section-1',
    title: 'Full Document',
    lines,
  });
  
  return sections;
}

function getLineBackground(type: DiffLine['type'], side: 'left' | 'right' | 'unified'): string {
  switch (type) {
    case 'added':
      return side === 'left' ? '' : 'bg-green-50';
    case 'removed':
      return side === 'right' ? '' : 'bg-red-50';
    case 'modified':
      return side === 'left' ? 'bg-red-50' : 'bg-green-50';
    default:
      return '';
  }
}

function generateAnnotationText(section: DiffSection, changedLines: DiffLine[]): string {
  const added = changedLines.filter((l) => l.type === 'added').length;
  const removed = changedLines.filter((l) => l.type === 'removed').length;
  const modified = changedLines.filter((l) => l.type === 'modified').length;
  
  const parts: string[] = [];
  if (added > 0) parts.push(`${added} additions`);
  if (removed > 0) parts.push(`${removed} deletions`);
  if (modified > 0) parts.push(`${modified} modifications`);
  
  return `This section contains ${parts.join(', ')}. Review the highlighted changes to understand the impact.`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default ContractDiffViewer;
