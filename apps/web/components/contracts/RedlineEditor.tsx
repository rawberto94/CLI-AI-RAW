'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit3,
  Eye,
  Check,
  X,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  User,
  Clock,
  Undo2,
  Redo2,
  History,
  FileText,
  CheckCircle2,
  XCircle,
  Filter,
  Download,
  Upload,
  Users,
  ArrowLeftRight,
  RotateCcw,
  Save,
  Trash2,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface Change {
  id: string;
  type: 'insertion' | 'deletion' | 'replacement' | 'format';
  originalText?: string;
  newText?: string;
  position: {
    start: number;
    end: number;
    paragraph: number;
  };
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected';
  comments: ChangeComment[];
}

export interface ChangeComment {
  id: string;
  author: {
    id: string;
    name: string;
  };
  content: string;
  timestamp: Date;
  replyTo?: string;
}

export interface DocumentVersion {
  id: string;
  version: number;
  name: string;
  author: string;
  createdAt: Date;
  changeCount: number;
  status: 'draft' | 'review' | 'final';
}

interface RedlineEditorProps {
  documentId: string;
  initialContent: string;
  versions?: DocumentVersion[];
  changes?: Change[];
  currentUser: {
    id: string;
    name: string;
    avatar?: string;
  };
  readOnly?: boolean;
  onSave?: (content: string, changes: Change[]) => void;
  onAcceptChange?: (changeId: string) => void;
  onRejectChange?: (changeId: string) => void;
  onAddComment?: (changeId: string, comment: string) => void;
  className?: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockVersions: DocumentVersion[] = [
  { id: 'v1', version: 1, name: 'Original Draft', author: 'John Smith', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), changeCount: 0, status: 'draft' },
  { id: 'v2', version: 2, name: 'Legal Review', author: 'Sarah Johnson', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), changeCount: 12, status: 'review' },
  { id: 'v3', version: 3, name: 'Final Edits', author: 'Michael Chen', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), changeCount: 5, status: 'review' },
];

const mockChanges: Change[] = [
  {
    id: 'c1',
    type: 'deletion',
    originalText: 'thirty (30)',
    position: { start: 145, end: 156, paragraph: 1 },
    author: { id: 'u1', name: 'Sarah Johnson' },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'pending',
    comments: [],
  },
  {
    id: 'c2',
    type: 'insertion',
    newText: 'sixty (60)',
    position: { start: 145, end: 145, paragraph: 1 },
    author: { id: 'u1', name: 'Sarah Johnson' },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'pending',
    comments: [
      { id: 'cm1', author: { id: 'u2', name: 'Michael Chen' }, content: 'Agreed, 60 days is more reasonable for this type of agreement.', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) },
    ],
  },
  {
    id: 'c3',
    type: 'deletion',
    originalText: 'exclusive',
    position: { start: 320, end: 329, paragraph: 2 },
    author: { id: 'u2', name: 'Michael Chen' },
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: 'pending',
    comments: [],
  },
  {
    id: 'c4',
    type: 'insertion',
    newText: 'non-exclusive',
    position: { start: 320, end: 320, paragraph: 2 },
    author: { id: 'u2', name: 'Michael Chen' },
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: 'pending',
    comments: [],
  },
];

// ============================================================================
// Sub Components
// ============================================================================

interface ChangeMarkerProps {
  change: Change;
  isSelected: boolean;
  onClick: () => void;
  onAccept: () => void;
  onReject: () => void;
}

function ChangeMarker({ change, isSelected, onClick, onAccept, onReject }: ChangeMarkerProps) {
  const isInsertion = change.type === 'insertion';
  const isDeletion = change.type === 'deletion';
  
  return (
    <span
      onClick={onClick}
      className={cn(
        "relative cursor-pointer transition-all",
        isInsertion && "bg-green-100 text-green-800 border-b-2 border-green-500",
        isDeletion && "bg-red-100 text-red-800 line-through decoration-red-500 decoration-2",
        isSelected && "ring-2 ring-blue-500 ring-offset-1",
        change.status === 'accepted' && "opacity-50",
        change.status === 'rejected' && "opacity-30 grayscale"
      )}
    >
      {isDeletion ? change.originalText : change.newText}
      
      {/* Quick action buttons on hover */}
      {isSelected && change.status === 'pending' && (
        <span className="absolute -top-8 left-0 flex items-center gap-1 bg-white rounded-lg shadow-lg p-1 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onAccept(); }}
            className="p-1 text-green-600 hover:bg-green-50 rounded"
            title="Accept change"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReject(); }}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Reject change"
          >
            <X className="w-4 h-4" />
          </button>
        </span>
      )}
      
      {/* Comment indicator */}
      {change.comments.length > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
          {change.comments.length}
        </span>
      )}
    </span>
  );
}

interface ChangesPanelProps {
  changes: Change[];
  selectedChangeId: string | null;
  onSelectChange: (id: string) => void;
  onAcceptChange: (id: string) => void;
  onRejectChange: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  filter: 'all' | 'pending' | 'accepted' | 'rejected';
  onFilterChange: (filter: 'all' | 'pending' | 'accepted' | 'rejected') => void;
}

function ChangesPanel({
  changes,
  selectedChangeId,
  onSelectChange,
  onAcceptChange,
  onRejectChange,
  onAcceptAll,
  onRejectAll,
  filter,
  onFilterChange,
}: ChangesPanelProps) {
  const filteredChanges = useMemo(() => {
    if (filter === 'all') return changes;
    return changes.filter(c => c.status === filter);
  }, [changes, filter]);

  const stats = useMemo(() => ({
    total: changes.length,
    pending: changes.filter(c => c.status === 'pending').length,
    accepted: changes.filter(c => c.status === 'accepted').length,
    rejected: changes.filter(c => c.status === 'rejected').length,
    insertions: changes.filter(c => c.type === 'insertion').length,
    deletions: changes.filter(c => c.type === 'deletion').length,
  }), [changes]);

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Changes</h3>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
            {stats.pending} pending
          </span>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="text-center p-2 bg-slate-50 rounded">
            <div className="font-bold text-slate-900">{stats.total}</div>
            <div className="text-slate-500">Total</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="font-bold text-green-600">+{stats.insertions}</div>
            <div className="text-green-600">Added</div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded">
            <div className="font-bold text-red-600">-{stats.deletions}</div>
            <div className="text-red-600">Deleted</div>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="font-bold text-blue-600">{stats.accepted}</div>
            <div className="text-blue-600">Accepted</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-slate-100 flex items-center gap-2">
        {(['all', 'pending', 'accepted', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={cn(
              "px-2 py-1 text-xs rounded-full capitalize transition-colors",
              filter === f
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Bulk Actions */}
      {stats.pending > 0 && (
        <div className="p-3 border-b border-slate-100 flex items-center gap-2">
          <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={onAcceptAll}>
            <CheckCircle2 className="w-3 h-3 text-green-600" />
            Accept All
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={onRejectAll}>
            <XCircle className="w-3 h-3 text-red-600" />
            Reject All
          </Button>
        </div>
      )}

      {/* Changes List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChanges.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Edit3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No changes to show</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredChanges.map(change => (
              <div
                key={change.id}
                onClick={() => onSelectChange(change.id)}
                className={cn(
                  "p-3 cursor-pointer hover:bg-slate-50 transition-colors",
                  selectedChangeId === change.id && "bg-blue-50 border-l-2 border-blue-500"
                )}
              >
                <div className="flex items-start gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                    change.type === 'insertion' && "bg-green-100",
                    change.type === 'deletion' && "bg-red-100"
                  )}>
                    {change.type === 'insertion' ? (
                      <Plus className="w-3 h-3 text-green-600" />
                    ) : (
                      <Trash2 className="w-3 h-3 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-slate-700">
                        {change.author.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {timeAgo(change.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm">
                      {change.type === 'deletion' && (
                        <span className="text-red-600 line-through">
                          {change.originalText}
                        </span>
                      )}
                      {change.type === 'insertion' && (
                        <span className="text-green-600">
                          {change.newText}
                        </span>
                      )}
                    </div>
                    {change.comments.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                        <MessageSquare className="w-3 h-3" />
                        {change.comments.length} comment{change.comments.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  {change.status === 'pending' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onAcceptChange(change.id); }}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRejectChange(change.id); }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {change.status !== 'pending' && (
                    <span className={cn(
                      "px-2 py-0.5 text-xs rounded-full",
                      change.status === 'accepted' && "bg-green-100 text-green-700",
                      change.status === 'rejected' && "bg-red-100 text-red-700"
                    )}>
                      {change.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface VersionHistoryPanelProps {
  versions: DocumentVersion[];
  currentVersion: number;
  onSelectVersion: (id: string) => void;
  onCompareVersions: (v1: string, v2: string) => void;
}

function VersionHistoryPanel({
  versions,
  currentVersion,
  onSelectVersion,
  onCompareVersions,
}: VersionHistoryPanelProps) {
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);

  const handleVersionClick = (versionId: string) => {
    if (compareMode) {
      if (compareSelection.includes(versionId)) {
        setCompareSelection(prev => prev.filter(v => v !== versionId));
      } else if (compareSelection.length < 2) {
        setCompareSelection(prev => [...prev, versionId]);
      }
    } else {
      onSelectVersion(versionId);
    }
  };

  const handleCompare = () => {
    if (compareSelection.length === 2) {
      onCompareVersions(compareSelection[0], compareSelection[1]);
      setCompareMode(false);
      setCompareSelection([]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4" />
            Version History
          </h3>
          <Button
            size="sm"
            variant={compareMode ? "default" : "outline"}
            onClick={() => {
              if (compareMode && compareSelection.length === 2) {
                handleCompare();
              } else {
                setCompareMode(!compareMode);
                setCompareSelection([]);
              }
            }}
            className="gap-1"
          >
            <ArrowLeftRight className="w-3 h-3" />
            {compareMode ? (compareSelection.length === 2 ? 'Compare' : 'Cancel') : 'Compare'}
          </Button>
        </div>
        
        {compareMode && (
          <p className="text-xs text-slate-500">
            Select 2 versions to compare ({compareSelection.length}/2 selected)
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-slate-100">
          {versions.map(version => (
            <div
              key={version.id}
              onClick={() => handleVersionClick(version.id)}
              className={cn(
                "p-4 cursor-pointer hover:bg-slate-50 transition-colors",
                currentVersion === version.version && "bg-blue-50 border-l-2 border-blue-500",
                compareMode && compareSelection.includes(version.id) && "bg-purple-50 border-l-2 border-purple-500"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {compareMode && (
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5",
                      compareSelection.includes(version.id)
                        ? "border-purple-500 bg-purple-500"
                        : "border-slate-300"
                    )}>
                      {compareSelection.includes(version.id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        v{version.version}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 text-xs rounded-full",
                        version.status === 'draft' && "bg-slate-100 text-slate-600",
                        version.status === 'review' && "bg-amber-100 text-amber-700",
                        version.status === 'final' && "bg-green-100 text-green-700"
                      )}>
                        {version.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{version.name}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {version.author}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {version.createdAt.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                {version.changeCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {version.changeCount} changes
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RedlineEditor({
  documentId,
  initialContent,
  versions = mockVersions,
  changes: initialChanges = mockChanges,
  currentUser,
  readOnly = false,
  onSave,
  onAcceptChange,
  onRejectChange,
  onAddComment,
  className,
}: RedlineEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [changes, setChanges] = useState<Change[]>(initialChanges);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [showChanges, setShowChanges] = useState(true);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit' | 'suggest'>('view');
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [currentVersionId, setCurrentVersionId] = useState(versions[versions.length - 1]?.id);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleAcceptChange = useCallback((changeId: string) => {
    setChanges(prev => prev.map(c => 
      c.id === changeId ? { ...c, status: 'accepted' as const } : c
    ));
    onAcceptChange?.(changeId);
    toast.success('Change accepted');
  }, [onAcceptChange]);

  const handleRejectChange = useCallback((changeId: string) => {
    setChanges(prev => prev.map(c => 
      c.id === changeId ? { ...c, status: 'rejected' as const } : c
    ));
    onRejectChange?.(changeId);
    toast.success('Change rejected');
  }, [onRejectChange]);

  const handleAcceptAll = useCallback(() => {
    const pendingCount = changes.filter(c => c.status === 'pending').length;
    setChanges(prev => prev.map(c => 
      c.status === 'pending' ? { ...c, status: 'accepted' as const } : c
    ));
    toast.success(`${pendingCount} changes accepted`);
  }, [changes]);

  const handleRejectAll = useCallback(() => {
    const pendingCount = changes.filter(c => c.status === 'pending').length;
    setChanges(prev => prev.map(c => 
      c.status === 'pending' ? { ...c, status: 'rejected' as const } : c
    ));
    toast.success(`${pendingCount} changes rejected`);
  }, [changes]);

  const handleSelectVersion = useCallback((versionId: string) => {
    setCurrentVersionId(versionId);
    // In real implementation, fetch version content
    toast.info(`Viewing version ${versions.find(v => v.id === versionId)?.version}`);
  }, [versions]);

  const handleCompareVersions = useCallback((v1: string, v2: string) => {
    const ver1 = versions.find(v => v.id === v1);
    const ver2 = versions.find(v => v.id === v2);
    toast.info(`Comparing v${ver1?.version} with v${ver2?.version}`);
    // In real implementation, show diff view
  }, [versions]);

  const handleSave = useCallback(() => {
    onSave?.(content, changes);
    toast.success('Document saved');
  }, [content, changes, onSave]);

  // Render content with change markers
  const renderContent = () => {
    // This is a simplified rendering - in production you'd use a proper rich text editor
    // with integrated change tracking (like ProseMirror or TipTap with collaboration plugins)
    
    const paragraphs = content.split('\n\n');
    
    return (
      <div className="prose prose-slate max-w-none">
        {paragraphs.map((para, idx) => (
          <p key={idx} className="mb-4 text-slate-700 leading-relaxed">
            {para}
          </p>
        ))}
        
        {/* Demo change markers overlay */}
        {showChanges && changes.filter(c => c.status !== 'rejected').map(change => (
          <div 
            key={change.id}
            className={cn(
              "inline",
              selectedChangeId === change.id && "ring-2 ring-blue-500 rounded"
            )}
          >
            {/* Changes would be rendered inline in actual implementation */}
          </div>
        ))}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className={cn("h-full flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden", className)}>
        {/* Toolbar */}
        <div className="flex-none p-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Mode Toggle */}
              <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200">
                {[
                  { mode: 'view' as const, icon: Eye, label: 'View' },
                  { mode: 'edit' as const, icon: Edit3, label: 'Edit' },
                  { mode: 'suggest' as const, icon: MessageSquare, label: 'Suggest' },
                ].map(({ mode: m, icon: Icon, label }) => (
                  <Tooltip key={m}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setMode(m)}
                        disabled={readOnly && m !== 'view'}
                        className={cn(
                          "p-2 rounded transition-colors",
                          mode === m
                            ? "bg-blue-500 text-white"
                            : "text-slate-600 hover:bg-slate-100",
                          readOnly && m !== 'view' && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>

              <div className="w-px h-6 bg-slate-200" />

              {/* Undo/Redo */}
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors">
                      <Undo2 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Undo (⌘Z)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors">
                      <Redo2 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
                </Tooltip>
              </div>

              <div className="w-px h-6 bg-slate-200" />

              {/* Toggle Changes Panel */}
              <Button
                size="sm"
                variant={showChanges ? "default" : "outline"}
                onClick={() => { setShowChanges(!showChanges); setShowVersionHistory(false); }}
                className="gap-1"
              >
                <Edit3 className="w-3 h-3" />
                Changes
                {changes.filter(c => c.status === 'pending').length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {changes.filter(c => c.status === 'pending').length}
                  </span>
                )}
              </Button>

              {/* Toggle Version History */}
              <Button
                size="sm"
                variant={showVersionHistory ? "default" : "outline"}
                onClick={() => { setShowVersionHistory(!showVersionHistory); setShowChanges(false); }}
                className="gap-1"
              >
                <History className="w-3 h-3" />
                Versions
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Current user */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                  {currentUser.name.charAt(0)}
                </div>
                <span className="text-sm text-slate-700">{currentUser.name}</span>
              </div>

              {/* Save */}
              <Button size="sm" onClick={handleSave} className="gap-1">
                <Save className="w-3 h-3" />
                Save
              </Button>

              {/* More Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Download className="w-4 h-4 mr-2" />
                    Export with changes
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FileText className="w-4 h-4 mr-2" />
                    Export clean copy
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore version
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor */}
          <div className="flex-1 overflow-y-auto p-8">
            <div 
              ref={editorRef}
              className={cn(
                "max-w-3xl mx-auto",
                mode === 'edit' && "cursor-text"
              )}
              contentEditable={mode === 'edit'}
              suppressContentEditableWarning
            >
              {/* Document Title */}
              <h1 className="text-2xl font-bold text-slate-900 mb-6">
                Master Services Agreement
              </h1>

              {/* Sample content with inline redline markers */}
              <div className="prose prose-slate max-w-none">
                <p className="mb-4 text-slate-700 leading-relaxed">
                  This Master Services Agreement (the "Agreement") is entered into as of the Effective Date by and between the parties identified below. This Agreement shall govern all services provided.
                </p>

                <h2 className="text-lg font-semibold text-slate-900 mt-6 mb-3">1. Term and Termination</h2>
                <p className="mb-4 text-slate-700 leading-relaxed">
                  The initial term of this Agreement shall be one (1) year from the Effective Date. Either party may terminate this Agreement upon{' '}
                  <span 
                    className={cn(
                      "bg-red-100 text-red-800 line-through decoration-red-500 decoration-2 cursor-pointer px-0.5",
                      selectedChangeId === 'c1' && "ring-2 ring-blue-500"
                    )}
                    onClick={() => setSelectedChangeId('c1')}
                  >
                    thirty (30)
                  </span>
                  <span 
                    className={cn(
                      "bg-green-100 text-green-800 border-b-2 border-green-500 cursor-pointer px-0.5",
                      selectedChangeId === 'c2' && "ring-2 ring-blue-500"
                    )}
                    onClick={() => setSelectedChangeId('c2')}
                  >
                    sixty (60)
                  </span>
                  {' '}days prior written notice to the other party.
                </p>

                <h2 className="text-lg font-semibold text-slate-900 mt-6 mb-3">2. License Grant</h2>
                <p className="mb-4 text-slate-700 leading-relaxed">
                  Subject to the terms and conditions of this Agreement, Provider grants Client a{' '}
                  <span 
                    className={cn(
                      "bg-red-100 text-red-800 line-through decoration-red-500 decoration-2 cursor-pointer px-0.5",
                      selectedChangeId === 'c3' && "ring-2 ring-blue-500"
                    )}
                    onClick={() => setSelectedChangeId('c3')}
                  >
                    exclusive
                  </span>
                  <span 
                    className={cn(
                      "bg-green-100 text-green-800 border-b-2 border-green-500 cursor-pointer px-0.5",
                      selectedChangeId === 'c4' && "ring-2 ring-blue-500"
                    )}
                    onClick={() => setSelectedChangeId('c4')}
                  >
                    non-exclusive
                  </span>
                  {' '}license to use the Services during the Term.
                </p>

                <h2 className="text-lg font-semibold text-slate-900 mt-6 mb-3">3. Confidentiality</h2>
                <p className="mb-4 text-slate-700 leading-relaxed">
                  Each party agrees to maintain in confidence all Confidential Information disclosed by the other party and to use such information only for purposes of this Agreement.
                </p>

                <h2 className="text-lg font-semibold text-slate-900 mt-6 mb-3">4. Limitation of Liability</h2>
                <p className="mb-4 text-slate-700 leading-relaxed">
                  IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO THIS AGREEMENT.
                </p>
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <AnimatePresence mode="wait">
            {showChanges && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-none"
              >
                <ChangesPanel
                  changes={changes}
                  selectedChangeId={selectedChangeId}
                  onSelectChange={setSelectedChangeId}
                  onAcceptChange={handleAcceptChange}
                  onRejectChange={handleRejectChange}
                  onAcceptAll={handleAcceptAll}
                  onRejectAll={handleRejectAll}
                  filter={filter}
                  onFilterChange={setFilter}
                />
              </motion.div>
            )}
            
            {showVersionHistory && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-none"
              >
                <VersionHistoryPanel
                  versions={versions}
                  currentVersion={versions.find(v => v.id === currentVersionId)?.version || 1}
                  onSelectVersion={handleSelectVersion}
                  onCompareVersions={handleCompareVersions}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status Bar */}
        <div className="flex-none px-4 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>Version {versions.find(v => v.id === currentVersionId)?.version || 1}</span>
            <span>•</span>
            <span>{changes.filter(c => c.status === 'pending').length} pending changes</span>
            <span>•</span>
            <span>Last saved 2 minutes ago</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3" />
            <span>3 collaborators</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default RedlineEditor;
