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
  Copy,
  Printer,
  Share2,
  AlertCircle,
  Send,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link2,
  Highlighter,
  Type,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

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
    sectionId?: string;
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

export interface DocumentSection {
  id: string;
  type: 'title' | 'heading' | 'paragraph';
  content: string;
  level?: number;
}

interface UndoHistoryItem {
  type: 'content' | 'change';
  content?: DocumentSection[];
  changes?: Change[];
  timestamp: Date;
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

const createMockChanges = (): Change[] => [
  {
    id: 'c1',
    type: 'deletion',
    originalText: 'thirty (30)',
    position: { start: 145, end: 156, paragraph: 1, sectionId: 'section-1' },
    author: { id: 'u1', name: 'Sarah Johnson' },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'accepted',
    comments: [],
  },
  {
    id: 'c2',
    type: 'insertion',
    newText: 'sixty (60)',
    position: { start: 145, end: 145, paragraph: 1, sectionId: 'section-1' },
    author: { id: 'u1', name: 'Sarah Johnson' },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'accepted',
    comments: [
      { id: 'cm1', author: { id: 'u2', name: 'Michael Chen' }, content: 'Agreed, 60 days is more reasonable for this type of agreement.', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) },
    ],
  },
  {
    id: 'c3',
    type: 'deletion',
    originalText: 'exclusive',
    position: { start: 320, end: 329, paragraph: 2, sectionId: 'section-2' },
    author: { id: 'u2', name: 'Michael Chen' },
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: 'accepted',
    comments: [],
  },
  {
    id: 'c4',
    type: 'insertion',
    newText: 'non-exclusive',
    position: { start: 320, end: 320, paragraph: 2, sectionId: 'section-2' },
    author: { id: 'u2', name: 'Michael Chen' },
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: 'accepted',
    comments: [],
  },
];

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Time formatting helper
const timeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

// ============================================================================
// Sub Components
// ============================================================================

interface ChangesPanelProps {
  changes: Change[];
  selectedChangeId: string | null;
  onSelectChange: (id: string) => void;
  onAcceptChange: (id: string) => void;
  onRejectChange: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onAddComment: (changeId: string, comment: string) => void;
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
  onAddComment,
  filter,
  onFilterChange,
}: ChangesPanelProps) {
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

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

  const handleSubmitComment = (changeId: string) => {
    if (commentText.trim()) {
      onAddComment(changeId, commentText.trim());
      setCommentText('');
      setCommentingOn(null);
    }
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
          <div className="text-center p-2 bg-violet-50 rounded">
            <div className="font-bold text-violet-600">{stats.accepted}</div>
            <div className="text-violet-600">Accepted</div>
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
                ? "bg-violet-100 text-violet-700"
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
                className={cn(
                  "cursor-pointer hover:bg-slate-50 transition-colors",
                  selectedChangeId === change.id && "bg-violet-50 border-l-2 border-violet-500"
                )}
              >
                <div 
                  onClick={() => onSelectChange(change.id)}
                  className="p-3"
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
                      
                      {/* Comments */}
                      {change.comments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {change.comments.map(comment => (
                            <div key={comment.id} className="bg-slate-50 rounded p-2 text-xs">
                              <div className="flex items-center gap-1 mb-1">
                                <span className="font-medium text-slate-700">{comment.author.name}</span>
                                <span className="text-slate-400">{timeAgo(comment.timestamp)}</span>
                              </div>
                              <p className="text-slate-600">{comment.content}</p>
                            </div>
                          ))}
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

                {/* Add comment input */}
                {selectedChangeId === change.id && (
                  <div className="px-3 pb-3">
                    {commentingOn === change.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Add a comment..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment(change.id)}
                          className="flex-1 h-8 text-sm"
                          autoFocus
                        />
                        <Button 
                          size="sm" 
                          onClick={() => handleSubmitComment(change.id)}
                          disabled={!commentText.trim()}
                        >
                          <Send className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => { setCommentingOn(null); setCommentText(''); }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCommentingOn(change.id)}
                        className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Add comment
                      </button>
                    )}
                  </div>
                )}
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
    if (compareSelection.length === 2 && compareSelection[0] && compareSelection[1]) {
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
                currentVersion === version.version && "bg-violet-50 border-l-2 border-violet-500",
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
                  <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full">
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
  changes: initialChanges,
  currentUser,
  readOnly = false,
  onSave,
  onAcceptChange,
  onRejectChange,
  onAddComment,
  className,
}: RedlineEditorProps) {
  // Initialize state with parsed sections
  const parseContentToSections = (content: string): DocumentSection[] => {
    const lines = content.split('\n');
    const sections: DocumentSection[] = [];
    let currentParagraph = '';
    let sectionIndex = 0;
    
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      if (trimmed.match(/^\d+\.\s+/)) {
        // It's a heading
        if (currentParagraph) {
          sections.push({
            id: `section-p-${sectionIndex++}`,
            type: 'paragraph',
            content: currentParagraph.trim(),
          });
          currentParagraph = '';
        }
        sections.push({
          id: `section-h-${sectionIndex++}`,
          type: 'heading',
          content: trimmed,
          level: 2,
        });
      } else if (trimmed === '') {
        if (currentParagraph) {
          sections.push({
            id: `section-p-${sectionIndex++}`,
            type: 'paragraph',
            content: currentParagraph.trim(),
          });
          currentParagraph = '';
        }
      } else {
        currentParagraph += (currentParagraph ? ' ' : '') + trimmed;
      }
    });
    
    if (currentParagraph) {
      sections.push({
        id: `section-p-${sectionIndex++}`,
        type: 'paragraph',
        content: currentParagraph.trim(),
      });
    }
    
    return sections;
  };

  const [sections, setSections] = useState<DocumentSection[]>(() => parseContentToSections(initialContent));
  const [originalSections] = useState<DocumentSection[]>(() => parseContentToSections(initialContent));
  const [changes, setChanges] = useState<Change[]>(initialChanges || createMockChanges());
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [showChanges, setShowChanges] = useState(true);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit' | 'suggest'>('edit');
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [currentVersionId, setCurrentVersionId] = useState(versions[versions.length - 1]?.id);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<string>('');
  const [undoStack, setUndoStack] = useState<UndoHistoryItem[]>([]);
  const [redoStack, setRedoStack] = useState<UndoHistoryItem[]>([]);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // Track if text has changed in a section
  const handleSectionEdit = useCallback((sectionId: string, newContent: string) => {
    const originalSection = originalSections.find(s => s.id === sectionId);
    const currentSection = sections.find(s => s.id === sectionId);
    
    if (!currentSection) return;
    
    // Save to undo stack
    setUndoStack(prev => [...prev, { type: 'content', content: [...sections], timestamp: new Date() }]);
    setRedoStack([]);
    
    // Update section
    setSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, content: newContent } : s
    ));
    
    // Track as a change if content differs from original
    if (originalSection && originalSection.content !== newContent && mode === 'suggest') {
      const existingChangeForSection = changes.find(
        c => c.position.sectionId === sectionId && c.status === 'pending' && c.author.id === currentUser.id
      );
      
      if (existingChangeForSection) {
        // Update existing change
        setChanges(prev => prev.map(c => 
          c.id === existingChangeForSection.id 
            ? { ...c, newText: newContent, originalText: originalSection.content, timestamp: new Date() }
            : c
        ));
      } else {
        // Create new change
        const newChange: Change = {
          id: generateId(),
          type: 'replacement',
          originalText: originalSection.content,
          newText: newContent,
          position: {
            start: 0,
            end: originalSection.content.length,
            paragraph: sections.findIndex(s => s.id === sectionId),
            sectionId,
          },
          author: {
            id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
          },
          timestamp: new Date(),
          status: 'pending',
          comments: [],
        };
        setChanges(prev => [...prev, newChange]);
      }
    }
    
    setHasUnsavedChanges(true);
  }, [sections, originalSections, changes, currentUser, mode]);

  // Start editing a section
  const handleStartEdit = useCallback((sectionId: string) => {
    if (mode === 'view' || readOnly) return;
    
    const section = sections.find(s => s.id === sectionId);
    if (section) {
      setEditingSection(sectionId);
      setEditBuffer(section.content);
    }
  }, [sections, mode, readOnly]);

  // Finish editing a section
  const handleFinishEdit = useCallback((save: boolean = true) => {
    if (editingSection && save && editBuffer !== sections.find(s => s.id === editingSection)?.content) {
      handleSectionEdit(editingSection, editBuffer);
    }
    setEditingSection(null);
    setEditBuffer('');
  }, [editingSection, editBuffer, sections, handleSectionEdit]);

  // Detect text changes when user types
  const handleTextChange = useCallback((sectionId: string, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditBuffer(e.target.value);
    setHasUnsavedChanges(true);
  }, []);

  // Handle undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    const lastItem = undoStack[undoStack.length - 1];
    if (lastItem?.content) {
      setRedoStack(prev => [...prev, { type: 'content', content: [...sections], timestamp: new Date() }]);
      setSections(lastItem.content);
      setUndoStack(prev => prev.slice(0, -1));
      toast.info('Undone');
    }
  }, [undoStack, sections]);

  // Handle redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const lastItem = redoStack[redoStack.length - 1];
    if (lastItem?.content) {
      setUndoStack(prev => [...prev, { type: 'content', content: [...sections], timestamp: new Date() }]);
      setSections(lastItem.content);
      setRedoStack(prev => prev.slice(0, -1));
      toast.info('Redone');
    }
  }, [redoStack, sections]);

  const handleAcceptChange = useCallback((changeId: string) => {
    setChanges(prev => prev.map(c => 
      c.id === changeId ? { ...c, status: 'accepted' as const } : c
    ));
    onAcceptChange?.(changeId);
    setHasUnsavedChanges(true);
    toast.success('Change accepted');
  }, [onAcceptChange]);

  const handleRejectChange = useCallback((changeId: string) => {
    const change = changes.find(c => c.id === changeId);
    
    // If rejecting, revert the content to original
    if (change?.position.sectionId && change.originalText) {
      setSections(prev => prev.map(s => 
        s.id === change.position.sectionId ? { ...s, content: change.originalText! } : s
      ));
    }
    
    setChanges(prev => prev.map(c => 
      c.id === changeId ? { ...c, status: 'rejected' as const } : c
    ));
    onRejectChange?.(changeId);
    setHasUnsavedChanges(true);
    toast.success('Change rejected');
  }, [changes, onRejectChange]);

  const handleAcceptAll = useCallback(() => {
    const pendingCount = changes.filter(c => c.status === 'pending').length;
    setChanges(prev => prev.map(c => 
      c.status === 'pending' ? { ...c, status: 'accepted' as const } : c
    ));
    setHasUnsavedChanges(true);
    toast.success(`${pendingCount} changes accepted`);
  }, [changes]);

  const handleRejectAll = useCallback(() => {
    const pendingChanges = changes.filter(c => c.status === 'pending');
    
    // Revert all pending changes
    let updatedSections = [...sections];
    pendingChanges.forEach(change => {
      if (change.position.sectionId && change.originalText) {
        updatedSections = updatedSections.map(s => 
          s.id === change.position.sectionId ? { ...s, content: change.originalText! } : s
        );
      }
    });
    setSections(updatedSections);
    
    setChanges(prev => prev.map(c => 
      c.status === 'pending' ? { ...c, status: 'rejected' as const } : c
    ));
    setHasUnsavedChanges(true);
    toast.success(`${pendingChanges.length} changes rejected`);
  }, [changes, sections]);

  const handleAddComment = useCallback((changeId: string, content: string) => {
    const newComment: ChangeComment = {
      id: generateId(),
      author: {
        id: currentUser.id,
        name: currentUser.name,
      },
      content,
      timestamp: new Date(),
    };
    
    setChanges(prev => prev.map(c => 
      c.id === changeId 
        ? { ...c, comments: [...c.comments, newComment] }
        : c
    ));
    toast.success('Comment added');
  }, [currentUser]);

  const handleSelectVersion = useCallback((versionId: string) => {
    setCurrentVersionId(versionId);
    toast.info(`Viewing version ${versions.find(v => v.id === versionId)?.version}`);
  }, [versions]);

  const handleCompareVersions = useCallback((v1: string, v2: string) => {
    const ver1 = versions.find(v => v.id === v1);
    const ver2 = versions.find(v => v.id === v2);
    toast.info(`Comparing v${ver1?.version} with v${ver2?.version}`);
  }, [versions]);

  const handleSave = useCallback(() => {
    // Convert sections back to content string
    const content = sections.map(s => {
      if (s.type === 'heading') return `\n${s.content}\n`;
      return s.content;
    }).join('\n\n');
    
    onSave?.(content, changes);
    setHasUnsavedChanges(false);
    setLastSaved(new Date());
    toast.success('Document saved successfully');
  }, [sections, changes, onSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleUndo, handleRedo]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  // Render editable section
  const renderSection = (section: DocumentSection, index: number) => {
    const isEditing = editingSection === section.id;
    const change = changes.find(c => 
      c.position.sectionId === section.id && c.status === 'pending'
    );
    
    if (section.type === 'heading') {
      return (
        <h2 
          key={section.id}
          className="text-lg font-semibold text-slate-900 mt-6 mb-3"
        >
          {section.content}
        </h2>
      );
    }
    
    if (isEditing) {
      return (
        <div key={section.id} className="relative mb-4">
          <textarea
            ref={(el) => {
              if (el) {
                textareaRefs.current.set(section.id, el);
                adjustTextareaHeight(el);
              }
            }}
            value={editBuffer}
            onChange={(e) => {
              handleTextChange(section.id, e);
              adjustTextareaHeight(e.target);
            }}
            onBlur={() => handleFinishEdit(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleFinishEdit(false);
              }
            }}
            className={cn(
              "w-full p-3 text-slate-700 leading-relaxed bg-violet-50 border-2 border-violet-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-500",
              mode === 'suggest' && "bg-yellow-50 border-yellow-300"
            )}
            autoFocus
          />
          <div className="absolute -top-2 -right-2 flex items-center gap-1">
            <span className={cn(
              "px-2 py-0.5 text-xs rounded-full",
              mode === 'edit' ? "bg-violet-500 text-white" : "bg-yellow-500 text-white"
            )}>
              {mode === 'edit' ? 'Editing' : 'Suggesting'}
            </span>
          </div>
        </div>
      );
    }
    
    return (
      <p
        key={section.id}
        onClick={() => handleStartEdit(section.id)}
        className={cn(
          "mb-4 text-slate-700 leading-relaxed transition-all cursor-text",
          mode !== 'view' && "hover:bg-slate-50 hover:ring-2 hover:ring-slate-200 rounded p-2 -m-2",
          change && "bg-yellow-50 ring-2 ring-yellow-300 rounded p-2 -m-2"
        )}
      >
        {section.content}
        {change && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-yellow-600">
            <AlertCircle className="w-3 h-3" />
            Pending change
          </span>
        )}
      </p>
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
                        onClick={() => {
                          setMode(m);
                          setEditingSection(null);
                        }}
                        disabled={readOnly && m !== 'view'}
                        className={cn(
                          "p-2 rounded transition-colors",
                          mode === m
                            ? "bg-violet-500 text-white"
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

              {/* Formatting toolbar (visible in edit mode) */}
              {mode === 'edit' && (
                <>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors">
                          <Bold className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Bold (⌘B)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors">
                          <Italic className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Italic (⌘I)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors">
                          <Underline className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Underline (⌘U)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors">
                          <Highlighter className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Highlight</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="w-px h-6 bg-slate-200" />
                </>
              )}

              {/* Undo/Redo */}
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      className={cn(
                        "p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors",
                        undoStack.length === 0 && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Undo (⌘Z)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={handleRedo}
                      disabled={redoStack.length === 0}
                      className={cn(
                        "p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors",
                        redoStack.length === 0 && "opacity-50 cursor-not-allowed"
                      )}
                    >
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
              {/* Unsaved indicator */}
              {hasUnsavedChanges && (
                <Badge variant="outline" className="gap-1 border-amber-300 text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  Unsaved changes
                </Badge>
              )}

              {/* Current user */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-medium">
                  {currentUser.name.charAt(0)}
                </div>
                <span className="text-sm text-slate-700">{currentUser.name}</span>
              </div>

              {/* Save */}
              <Button 
                size="sm" 
                onClick={handleSave} 
                className="gap-1"
                disabled={!hasUnsavedChanges}
              >
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
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Share document
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => toast.success('Exported with changes')}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export with redlines
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success('Exported clean copy')}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export clean copy
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.success('Exported as PDF')}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem onClick={() => {
                    navigator.clipboard.writeText(sections.map(s => s.content).join('\n\n'));
                    toast.success('Content copied to clipboard');
                  }}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy all text
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.print()}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI suggestions
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => toast.info('Restoring previous version...')}>
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
            >
              {/* Document Title */}
              <h1 className="text-2xl font-bold text-slate-900 mb-6">
                Master Services Agreement
              </h1>

              {/* Mode indicator */}
              {mode !== 'view' && (
                <div className={cn(
                  "mb-6 p-3 rounded-lg flex items-center gap-2 text-sm",
                  mode === 'edit' ? "bg-violet-50 text-violet-700" : "bg-yellow-50 text-yellow-700"
                )}>
                  {mode === 'edit' ? (
                    <>
                      <Edit3 className="w-4 h-4" />
                      <span><strong>Edit Mode:</strong> Click on any paragraph to edit. Changes are applied directly.</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      <span><strong>Suggest Mode:</strong> Click on any paragraph to suggest changes. Your edits will be tracked for review.</span>
                    </>
                  )}
                </div>
              )}

              {/* Document content */}
              <div className="prose prose-slate max-w-none">
                {sections.map((section, index) => renderSection(section, index))}
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
                  onAddComment={handleAddComment}
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
            <span>
              {lastSaved 
                ? `Last saved ${timeAgo(lastSaved)}`
                : hasUnsavedChanges 
                  ? 'Not saved yet'
                  : 'Last saved 2 minutes ago'
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3" />
            <span>3 collaborators</span>
          </div>
        </div>

        {/* Share Dialog */}
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Document</DialogTitle>
              <DialogDescription>
                Invite others to view or edit this document.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email addresses</label>
                <Input placeholder="Enter email addresses, separated by commas" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Permission</label>
                <select className="w-full p-2 border border-slate-200 rounded-lg">
                  <option value="view">Can view</option>
                  <option value="comment">Can comment</option>
                  <option value="edit">Can edit</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message (optional)</label>
                <Textarea placeholder="Add a message..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowShareDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                toast.success('Invitation sent');
                setShowShareDialog(false);
              }}>
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default RedlineEditor;
