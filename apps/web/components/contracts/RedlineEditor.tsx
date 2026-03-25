'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
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
// Content Parser & Helpers
// ============================================================================

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
                compareMode && compareSelection.includes(version.id) && "bg-violet-50 border-l-2 border-violet-500"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {compareMode && (
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5",
                      compareSelection.includes(version.id)
                        ? "border-violet-500 bg-violet-500"
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
  versions = [],
  changes: initialChanges,
  currentUser,
  readOnly = false,
  onSave,
  onAcceptChange,
  onRejectChange,
  onAddComment,
  className,
}: RedlineEditorProps) {
  const [changes, setChanges] = useState<Change[]>(initialChanges || []);
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
  
  const editorRef = useRef<HTMLDivElement>(null);

  // Convert plain text initialContent to HTML for TipTap
  const contentToHtml = useCallback((text: string): string => {
    if (!text) return '<p></p>';
    if (text.startsWith('<')) return text; // already HTML
    return text.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.match(/^\d+\.\s+/)) return `<h2>${trimmed}</h2>`;
      return `<p>${trimmed}</p>`;
    }).filter(Boolean).join('');
  }, []);

  const [originalHtml] = useState(() => contentToHtml(initialContent));

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      UnderlineExt,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start editing the contract...' }),
    ],
    content: contentToHtml(initialContent),
    editable: mode !== 'view' && !readOnly,
    editorProps: {
      attributes: {
        class: 'tiptap-redline prose prose-slate max-w-none focus:outline-none min-h-[400px] px-2 py-1',
        style: 'font-family: Georgia, "Times New Roman", serif',
      },
    },
    onUpdate: ({ editor: ed }) => {
      setHasUnsavedChanges(true);
      // Track changes by comparing with original
      const currentText = ed.getText();
      const originalText = new DOMParser()
        .parseFromString(originalHtml, 'text/html')
        .body.textContent || '';
      if (currentText !== originalText) {
        const existingAutoChange = changes.find(c => c.id === 'auto-tracked');
        const change: Change = {
          id: 'auto-tracked',
          type: 'replacement',
          originalText: originalText.slice(0, 200),
          newText: currentText.slice(0, 200),
          position: { start: 0, end: currentText.length, paragraph: 0 },
          author: currentUser,
          timestamp: new Date(),
          status: mode === 'suggest' ? 'pending' : 'accepted',
          comments: existingAutoChange?.comments || [],
        };
        setChanges(prev => {
          const filtered = prev.filter(c => c.id !== 'auto-tracked');
          return [...filtered, change];
        });
      }
    },
  });

  // Update editor editable state when mode changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(mode !== 'view' && !readOnly);
    }
  }, [editor, mode, readOnly]);

  // Handle undo
  const handleUndo = useCallback(() => {
    if (editor) editor.chain().focus().undo().run();
  }, [editor]);

  // Handle redo
  const handleRedo = useCallback(() => {
    if (editor) editor.chain().focus().redo().run();
  }, [editor]);

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
    
    // If rejecting, restore original content via editor
    if (change?.originalText && editor) {
      editor.commands.setContent(contentToHtml(change.originalText));
    }
    
    setChanges(prev => prev.map(c => 
      c.id === changeId ? { ...c, status: 'rejected' as const } : c
    ));
    onRejectChange?.(changeId);
    setHasUnsavedChanges(true);
    toast.success('Change rejected');
  }, [changes, onRejectChange, editor, contentToHtml]);

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
    
    // Revert to original content
    if (editor) {
      editor.commands.setContent(contentToHtml(initialContent));
    }
    
    setChanges(prev => prev.map(c => 
      c.status === 'pending' ? { ...c, status: 'rejected' as const } : c
    ));
    setHasUnsavedChanges(true);
    toast.success(`${pendingChanges.length} changes rejected`);
  }, [changes, editor, contentToHtml, initialContent]);

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

  // AI Suggestions handler — calls the copilot API and creates tracked changes
  const [isAISuggesting, setIsAISuggesting] = useState(false);
  const handleAISuggestions = useCallback(async () => {
    setIsAISuggesting(true);
    try {
      const fullContent = editor?.getText() || '';
      const response = await fetch('/api/copilot/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullContent.slice(0, 8000),
          context: 'Suggest improvements for this contract text. Focus on legal precision, risk mitigation, and clarity. Return specific text replacements.',
          type: 'contract-review',
        }),
      });

      if (!response.ok) throw new Error('AI request failed');
      const result = await response.json();
      const suggestion = result?.data?.completion || result?.completion || result?.data?.text || '';

      if (!suggestion) {
        toast.info('No AI suggestions at this time');
        return;
      }

      // Switch to suggest mode so AI changes are tracked 
      setMode('suggest');

      // Apply AI suggestion as a tracked change
      const newChange: Change = {
        id: generateId(),
        type: 'replacement',
        originalText: fullContent.slice(0, 200),
        newText: suggestion.slice(0, 200),
        position: {
          start: 0,
          end: fullContent.length,
          paragraph: 0,
        },
        author: {
          id: 'ai-copilot',
          name: 'AI Copilot',
          avatar: undefined,
        },
        timestamp: new Date(),
        status: 'pending',
        comments: [],
      };
      setChanges(prev => [...prev, newChange]);
      editor?.commands.setContent(contentToHtml(suggestion));
      setHasUnsavedChanges(true);
      toast.success('AI suggestions added as tracked changes', {
        description: 'Review and accept or reject them in the changes panel.',
      });
    } catch (err) {
      console.error('AI suggestions failed:', err);
      toast.error('Failed to get AI suggestions');
    } finally {
      setIsAISuggesting(false);
    }
  }, [editor, contentToHtml]);

  // Formatting helpers for the text editor
  const applyFormatting = useCallback((format: 'bold' | 'italic' | 'underline' | 'highlight') => {
    if (!editor) return;
    switch (format) {
      case 'bold': editor.chain().focus().toggleBold().run(); break;
      case 'italic': editor.chain().focus().toggleItalic().run(); break;
      case 'underline': editor.chain().focus().toggleUnderline().run(); break;
      case 'highlight': editor.chain().focus().toggleHighlight().run(); break;
    }
  }, [editor]);

  const handleSave = useCallback(() => {
    if (!editor) return;
    const content = editor.getHTML();
    
    onSave?.(content, changes);
    setHasUnsavedChanges(false);
    setLastSaved(new Date());
    toast.success('Document saved successfully');
  }, [editor, changes, onSave]);

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
                        <button onClick={() => applyFormatting('bold')} className={cn(
                          "p-2 rounded transition-colors",
                          editor?.isActive('bold') ? "bg-violet-100 text-violet-700" : "text-slate-600 hover:bg-slate-100"
                        )}>
                          <Bold className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Bold (⌘B)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => applyFormatting('italic')} className={cn(
                          "p-2 rounded transition-colors",
                          editor?.isActive('italic') ? "bg-violet-100 text-violet-700" : "text-slate-600 hover:bg-slate-100"
                        )}>
                          <Italic className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Italic (⌘I)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => applyFormatting('underline')} className={cn(
                          "p-2 rounded transition-colors",
                          editor?.isActive('underline') ? "bg-violet-100 text-violet-700" : "text-slate-600 hover:bg-slate-100"
                        )}>
                          <Underline className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Underline (⌘U)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => applyFormatting('highlight')} className={cn(
                          "p-2 rounded transition-colors",
                          editor?.isActive('highlight') ? "bg-violet-100 text-violet-700" : "text-slate-600 hover:bg-slate-100"
                        )}>
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
                      disabled={!editor?.can().undo()}
                      className={cn(
                        "p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors",
                        !editor?.can().undo() && "opacity-50 cursor-not-allowed"
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
                      disabled={!editor?.can().redo()}
                      className={cn(
                        "p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors",
                        !editor?.can().redo() && "opacity-50 cursor-not-allowed"
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
                      <DropdownMenuItem onClick={() => {
                        const content = editor?.getHTML() || '';
                        const blob = new Blob([content], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${documentId}-redlined.html`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success('Exported with redlines');
                      }}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export with redlines
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        const content = editor?.getText() || '';
                        const blob = new Blob([content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${documentId}-clean.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success('Exported clean copy');
                      }}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export clean copy
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        window.print();
                        toast.success('Print dialog opened for PDF export');
                      }}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem onClick={() => {
                    navigator.clipboard.writeText(editor?.getText() || '');
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
                  <DropdownMenuItem onClick={handleAISuggestions} disabled={isAISuggesting}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {isAISuggesting ? 'Getting AI suggestions...' : 'AI suggestions'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    editor?.commands.setContent(contentToHtml(initialContent));
                    setChanges([]);
                    setHasUnsavedChanges(true);
                    toast.success('Restored to original version');
                  }}>
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
            <div ref={editorRef} className="max-w-3xl mx-auto">
              {/* Mode indicator */}
              {mode !== 'view' && (
                <div className={cn(
                  "mb-6 p-3 rounded-lg flex items-center gap-2 text-sm",
                  mode === 'edit' ? "bg-violet-50 text-violet-700" : "bg-yellow-50 text-yellow-700"
                )}>
                  {mode === 'edit' ? (
                    <>
                      <Edit3 className="w-4 h-4" />
                      <span><strong>Edit Mode:</strong> Edit directly in the document. Formatting is preserved.</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      <span><strong>Suggest Mode:</strong> Your edits will be tracked as suggestions for review.</span>
                    </>
                  )}
                </div>
              )}
              {/* TipTap Editor */}
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Side Panel */}
          <AnimatePresence mode="wait">
            {showChanges && (
              <motion.div key="changes"
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
            <span>{editor?.getText().split(/\s+/).filter(Boolean).length || 0} words</span>
            <span>•</span>
            <span>
              {lastSaved 
                ? `Last saved ${timeAgo(lastSaved)}`
                : hasUnsavedChanges 
                  ? 'Not saved yet'
                  : 'No changes'
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3" />
            <span>{new Set(changes.map(c => c.author.id)).size || 1} collaborator{new Set(changes.map(c => c.author.id)).size !== 1 ? 's' : ''}</span>
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
