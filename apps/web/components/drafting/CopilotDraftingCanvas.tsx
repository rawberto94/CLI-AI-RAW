'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, MessageSquare, Wand2, AlertTriangle,
  Lightbulb, Save, Eye, Edit3, Sparkles,
  GitBranch, Undo2, Redo2, Bold, Italic, Underline, List,
  Heading1, Heading2, Quote, X, Send, Clock, Zap, Shield, Scale,
  FileCheck, RefreshCw, Loader2, Brain, AlertCircle, Menu,
  Download, FileDown, CheckCircle2, ArrowRight,
  BookOpen, Search, Lock, Unlock, Users, ThumbsUp, ThumbsDown,
  Check, Keyboard,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import DOMPurify from 'isomorphic-dompurify';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';
import { exportDraftAsPDF, exportDraftAsDOCX } from '@/lib/drafting/draft-export';
import { VersionDiffView } from './VersionDiffView';

// ============================================================================
// TYPES
// ============================================================================

interface CopilotSuggestion {
  id: string;
  type: 'clause_improvement' | 'risk_warning' | 'compliance' | 'auto_complete' | 'negotiation';
  triggerText: string;
  originalText?: string;
  suggestedText: string;
  explanation: string;
  confidence: number;
  position: { startOffset: number; endOffset: number };
  source: {
    type: 'playbook' | 'clause_library' | 'ai' | 'historical';
    name?: string;
    clauseId?: string;
    confidence: number;
  };
  riskLevel?: 'critical' | 'high' | 'medium' | 'low';
  category?: string;
}

interface RiskHighlight {
  id: string;
  text: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  explanation: string;
  suggestedFix?: string;
  position: { startOffset: number; endOffset: number };
}

interface AutoCompletion {
  id: string;
  text: string;
  source: 'library' | 'historical' | 'ai';
  matchScore: number;
  clauseId?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  resolved: boolean;
  position: { paragraph: number; offset: number };
  replies: Array<{ id: string; author: string; content: string; timestamp: string }>;
}

interface Version {
  id: string;
  version: string;
  author: string;
  timestamp: string;
  changes: number;
  label?: string;
}

/** Comment from API */
interface ApiComment {
  id: string;
  content: string;
  resolved: boolean;
  anchorPos: Record<string, unknown>;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
  replies: Array<{
    id: string;
    content: string;
    createdAt: string;
    user: { id: string; firstName: string | null; lastName: string | null; email: string };
  }>;
}

/** Version from API */
interface ApiVersion {
  id: string;
  version: number;
  label: string | null;
  changeSummary: string | null;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
  content?: string;
}

/** Clause from library */
interface LibraryClause {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high';
  isStandard: boolean;
  usageCount: number;
}

/** Approval entry */
interface ApprovalEntry {
  userId: string;
  action: 'APPROVED' | 'REJECTED';
  comment?: string;
  reason?: string;
  timestamp: string;
}

interface CopilotDraftingCanvasProps {
  contractId?: string;
  initialContent?: string;
  contractType?: string;
  playbookId?: string;
  templateId?: string;
  draftId?: string;
  isBlankDocument?: boolean;
  onSave?: (content: string) => Promise<void>;
  onLegalReview?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CopilotDraftingCanvas({
  contractId,
  initialContent = '',
  contractType = 'MSA',
  playbookId,
  templateId,
  draftId,
  isBlankDocument,
  onSave,
  onLegalReview,
}: CopilotDraftingCanvasProps) {
  const { data: session } = useSession();

  // Content state — TipTap manages the DOM; we keep a plain-text mirror for AI APIs
  const [content, setContent] = useState(initialContent);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedText, setSelectedText] = useState('');
  const debouncedContent = useDebounce(content, 500);

  // Copilot state
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [risks, setRisks] = useState<RiskHighlight[]>([]);
  const [autoCompletions, setAutoCompletions] = useState<AutoCompletion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0);
  const [completionPopupPos, setCompletionPopupPos] = useState<{ top: number; left: number }>({ top: 80, left: 32 });

  // UI state
  const [activeTab, setActiveTab] = useState<'copilot' | 'comments' | 'versions' | 'clauses'>('copilot');
  const [isEditing, setIsEditing] = useState(true);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'DRAFT' | 'IN_REVIEW' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'FINALIZED'>('DRAFT');
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const router = useRouter();

  // Comments & versions — now wired to API
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showDiffView, setShowDiffView] = useState(false);
  const [diffVersions, setDiffVersions] = useState<Array<{ version: number; content: string; author: string; timestamp: string; label?: string }>>([]);

  // Clause library state
  const [clauseSearch, setClauseSearch] = useState('');
  const [clauseCategory, setClauseCategory] = useState('all');
  const [clauses, setClauses] = useState<LibraryClause[]>([]);
  const [isLoadingClauses, setIsLoadingClauses] = useState(false);

  // Locking / collaboration state
  const [lockInfo, setLockInfo] = useState<{ isLocked: boolean; lockedBy: string | null; lockedAt: string | null }>({
    isLocked: false, lockedBy: null, lockedAt: null,
  });
  const [isLocking, setIsLocking] = useState(false);

  // Approval workflow state
  const [approvalHistory, setApprovalHistory] = useState<ApprovalEntry[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState<'approve' | 'reject' | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  // Keyboard shortcut help
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  // ============================================================================
  // TIPTAP EDITOR
  // ============================================================================

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({}),
      UnderlineExt,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        placeholder: 'Start drafting your contract…',
      }),
    ],
    content: initialContent || '',
    editable: isEditing,
    editorProps: {
      attributes: {
        class: 'tiptap-editor prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[550px] md:min-h-[750px] font-serif leading-relaxed text-base md:text-lg',
        style: 'font-family: Georgia, serif',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const text = ed.getText();
      setContent(ed.getHTML());

      // trigger auto-completions only when user pauses typing at end of a
      // substantial line (not mid-sentence edits or cursor-only moves)
      const { from } = ed.state.selection;
      const resolvedPos = ed.state.doc.resolve(from);
      const lineEnd = resolvedPos.end();
      const isAtLineEnd = from >= lineEnd - 1; // within 1 char of line end
      const docText = ed.state.doc.textBetween(0, from, '\n');
      const lines = docText.split('\n');
      const currentLine = (lines[lines.length - 1] || '').trim();

      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);

      // Only trigger when: at end-of-line, line is substantial, and line ends
      // with natural pause punctuation or a space (user paused typing)
      if (isAtLineEnd && currentLine.length > 30 && /[\s,;.]$/.test(currentLine)) {
        // Capture cursor coordinates for popup positioning
        try {
          const coords = ed.view.coordsAtPos(from);
          const editorRect = ed.view.dom.getBoundingClientRect();
          setCompletionPopupPos({
            top: coords.bottom - editorRect.top + 4,
            left: Math.min(coords.left - editorRect.left, editorRect.width - 400),
          });
        } catch { /* use previous position */ }

        completionTimerRef.current = setTimeout(() => {
          fetchAutoCompletions(currentLine);
        }, 1200);
      } else {
        // Dismiss if user keeps typing or moves away
        setShowCompletionPopup(false);
      }
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from } = ed.state.selection;
      setCursorPosition(from);
      const sel = ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to, ' ');
      setSelectedText(sel);
      // Dismiss auto-complete when user moves cursor (avoids stale popups)
      if (showCompletionPopup) setShowCompletionPopup(false);
    },
  });

  // Sync editable flag when mode toggles
  useEffect(() => {
    if (editor) editor.setEditable(isEditing);
  }, [isEditing, editor]);

  // ============================================================================
  // COPILOT API CALLS
  // ============================================================================

  const fetchSuggestions = useCallback(async () => {
    if (!content || content.length < 50) return;

    setIsLoadingSuggestions(true);
    try {
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          cursorPosition,
          selectedText,
          contractType,
          playbookId,
          mode: 'realtime',
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const data = json.data || json;
        setSuggestions(data.suggestions || []);
        setRisks(data.risks || []);
      } else {
        const errorBody = await response.json().catch(() => null);
        console.warn('Copilot suggestions non-OK:', response.status, errorBody?.error || response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      toast.error('Failed to fetch AI suggestions');
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [content, cursorPosition, selectedText, contractType, playbookId]);

  const fetchAutoCompletions = useCallback(async (text: string) => {
    if (!text || text.length < 10) {
      setAutoCompletions([]);
      setShowCompletionPopup(false);
      return;
    }

    try {
      const response = await fetch('/api/copilot/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          cursorPosition,
          contractType,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const data = json.data || json;
        setAutoCompletions(data.completions || []);
        setShowCompletionPopup(data.completions?.length > 0);
        setSelectedCompletionIndex(0);
      } else {
        console.warn('Auto-complete non-OK:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch completions:', error);
    }
  }, [cursorPosition, contractType]);

  const fetchRisks = useCallback(async () => {
    if (!content || content.length < 100) return;

    try {
      const response = await fetch('/api/copilot/risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          contractType,
          playbook: playbookId ? { id: playbookId } : undefined,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const data = json.data || json;
        setRisks(data.risks || []);
      } else {
        console.warn('Risk analysis non-OK:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch risks:', error);
      toast.error('Failed to analyze risks');
    }
  }, [content, contractType, playbookId]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Fetch suggestions when content changes (debounced)
  useEffect(() => {
    if (debouncedContent.length > 100) {
      fetchSuggestions();
    }
  }, [debouncedContent, fetchSuggestions]);

  // Fetch risks periodically (only when actively editing)
  useEffect(() => {
    if (!isEditing) return;
    const interval = setInterval(() => {
      if (content.length > 200) {
        fetchRisks();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [content, fetchRisks, isEditing]);

  // Track last saved content to avoid redundant auto-saves
  const lastSavedContentRef = useRef(initialContent);

  // Auto-save
  useEffect(() => {
    const autoSave = setInterval(async () => {
      if (editor && onSave) {
        const html = editor.getHTML();
        if (html !== lastSavedContentRef.current) {
          setIsSaving(true);
          try {
            await onSave(html);
            lastSavedContentRef.current = html;
            setLastSaved(new Date());
          } catch (error) {
            console.error('Auto-save failed:', error);
            toast.error('Auto-save failed');
          } finally {
            setIsSaving(false);
          }
        }
      }
    }, 60000); // Every minute

    return () => clearInterval(autoSave);
  }, [editor, onSave]);

  // ====================================================================
  // FETCH COMMENTS, VERSIONS, CLAUSES, LOCK INFO from API
  // ====================================================================

  const fetchComments = useCallback(async () => {
    if (!draftId) return;
    try {
      const res = await fetch(`/api/drafts/${draftId}/comments`);
      if (res.ok) {
        const json = await res.json();
        setComments(json.data?.comments || []);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  }, [draftId]);

  const fetchVersions = useCallback(async () => {
    if (!draftId) return;
    try {
      const res = await fetch(`/api/drafts/${draftId}/versions`);
      if (res.ok) {
        const json = await res.json();
        setVersions(json.data?.versions || []);
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  }, [draftId]);

  const fetchClauses = useCallback(async () => {
    setIsLoadingClauses(true);
    try {
      const params = new URLSearchParams();
      if (clauseSearch) params.set('search', clauseSearch);
      if (clauseCategory && clauseCategory !== 'all') params.set('category', clauseCategory);
      params.set('limit', '30');

      const res = await fetch(`/api/clauses?${params}`);
      if (res.ok) {
        const json = await res.json();
        setClauses(json.clauses || json.data?.clauses || []);
      }
    } catch (err) {
      console.error('Failed to fetch clauses:', err);
    } finally {
      setIsLoadingClauses(false);
    }
  }, [clauseSearch, clauseCategory]);

  const fetchDraftMeta = useCallback(async () => {
    if (!draftId) return;
    try {
      const res = await fetch(`/api/drafts/${draftId}`);
      if (res.ok) {
        const json = await res.json();
        const d = json.data?.draft;
        if (d) {
          setDraftStatus(d.status || 'DRAFT');
          setLockInfo({ isLocked: d.isLocked, lockedBy: d.lockedBy, lockedAt: d.lockedAt });
          setApprovalHistory(Array.isArray(d.approvalWorkflow) ? d.approvalWorkflow : []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch draft meta:', err);
    }
  }, [draftId]);

  // On mount: fetch draft metadata, comments, versions
  useEffect(() => {
    if (draftId) {
      fetchDraftMeta();
      fetchComments();
      fetchVersions();
    }
  }, [draftId, fetchDraftMeta, fetchComments, fetchVersions]);

  // Fetch clauses when tab is opened or search changes
  useEffect(() => {
    if (activeTab === 'clauses') {
      fetchClauses();
    }
  }, [activeTab, fetchClauses]);

  // Poll lock status every 30s
  useEffect(() => {
    if (!draftId) return;
    const interval = setInterval(() => {
      fetchDraftMeta();
    }, 30000);
    return () => clearInterval(interval);
  }, [draftId, fetchDraftMeta]);

  // ====================================================================
  // COMMENT HANDLERS
  // ====================================================================

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !draftId) return;
    try {
      const res = await fetch(`/api/drafts/${draftId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (res.ok) {
        setNewComment('');
        fetchComments();
        toast.success('Comment added');
      }
    } catch { toast.error('Failed to add comment'); }
  }, [newComment, draftId, fetchComments]);

  const handleReply = useCallback(async (parentId: string) => {
    if (!replyContent.trim() || !draftId) return;
    try {
      const res = await fetch(`/api/drafts/${draftId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent.trim(), parentId }),
      });
      if (res.ok) {
        setReplyContent('');
        setReplyTarget(null);
        fetchComments();
      }
    } catch { toast.error('Failed to reply'); }
  }, [replyContent, draftId, fetchComments]);

  const handleResolveComment = useCallback(async (commentId: string, resolved: boolean) => {
    if (!draftId) return;
    try {
      await fetch(`/api/drafts/${draftId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved }),
      });
      fetchComments();
    } catch { toast.error('Failed to update comment'); }
  }, [draftId, fetchComments]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!draftId) return;
    try {
      await fetch(`/api/drafts/${draftId}/comments/${commentId}`, { method: 'DELETE' });
      fetchComments();
      toast.success('Comment deleted');
    } catch { toast.error('Failed to delete comment'); }
  }, [draftId, fetchComments]);

  // ====================================================================
  // VERSION DIFF HANDLERS
  // ====================================================================

  const handleOpenDiff = useCallback(async () => {
    if (!draftId || versions.length < 1) return;
    // Fetch content for each version
    try {
      const fullVersions = await Promise.all(
        versions.slice(0, 10).map(async (v) => {
          const res = await fetch(`/api/drafts/${draftId}/versions?version=${v.version}`);
          if (!res.ok) return null;
          const json = await res.json();
          const vdata = json.data?.version;
          return vdata ? {
            version: vdata.version,
            content: vdata.content || '',
            author: [vdata.user?.firstName, vdata.user?.lastName].filter(Boolean).join(' ') || vdata.user?.email || 'Unknown',
            timestamp: new Date(vdata.createdAt).toLocaleString(),
            label: vdata.label || undefined,
          } : null;
        }),
      );
      // Add current version
      const currentContent = editor?.getHTML() || '';
      const allVersions = [
        ...fullVersions.filter(Boolean) as Array<{ version: number; content: string; author: string; timestamp: string; label?: string }>,
        { version: (versions[0]?.version || 0) + 1, content: currentContent, author: 'Current', timestamp: 'Now', label: 'Current' },
      ].sort((a, b) => a.version - b.version);

      setDiffVersions(allVersions);
      setShowDiffView(true);
    } catch (err) {
      console.error('Failed to load versions for diff:', err);
      toast.error('Failed to load version content');
    }
  }, [draftId, versions, editor]);

  // ====================================================================
  // CLAUSE LIBRARY HANDLER
  // ====================================================================

  const handleInsertClause = useCallback((clause: LibraryClause) => {
    if (!editor) return;
    const rawHtml = clause.content.startsWith('<') ? clause.content : `<p>${clause.content}</p>`;
    // Sanitize clause content before inserting (library clauses may contain arbitrary HTML)
    const sanitized = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'a', 'span', 'div', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'mark', 'sub', 'sup'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
    });
    editor.chain().focus().insertContent(sanitized).run();
    setContent(editor.getHTML());
    toast.success(`Inserted clause: ${clause.title}`);
  }, [editor]);

  // ====================================================================
  // LOCK HANDLERS
  // ====================================================================

  const handleLock = useCallback(async (action: 'lock' | 'unlock') => {
    if (!draftId) return;
    setIsLocking(true);
    try {
      const res = await fetch(`/api/drafts/${draftId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const json = await res.json();
        setLockInfo(json.data?.draft || { isLocked: false, lockedBy: null, lockedAt: null });
        toast.success(action === 'lock' ? 'Draft locked for editing' : 'Draft unlocked');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Failed to ${action} draft`);
      }
    } catch { toast.error(`Failed to ${action} draft`); }
    finally { setIsLocking(false); }
  }, [draftId]);

  // ====================================================================
  // APPROVAL HANDLERS
  // ====================================================================

  const handleApprove = useCallback(async () => {
    if (!draftId) return;
    try {
      const res = await fetch(`/api/drafts/${draftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: approvalComment }),
      });
      if (res.ok) {
        setDraftStatus('APPROVED');
        setShowApprovalModal(null);
        setApprovalComment('');
        fetchDraftMeta();
        toast.success('Draft approved!');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Approval failed');
      }
    } catch { toast.error('Approval failed'); }
  }, [draftId, approvalComment, fetchDraftMeta]);

  const handleReject = useCallback(async () => {
    if (!draftId || !approvalComment.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      const res = await fetch(`/api/drafts/${draftId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: approvalComment }),
      });
      if (res.ok) {
        setDraftStatus('REJECTED');
        setShowApprovalModal(null);
        setApprovalComment('');
        fetchDraftMeta();
        toast.success('Draft rejected — returned to author');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Rejection failed');
      }
    } catch { toast.error('Rejection failed'); }
  }, [draftId, approvalComment, fetchDraftMeta]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  // Auto-completion debounce ref
  const completionTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Ref to always call the latest handleSave (avoids stale closure since it's defined later)
  const handleSaveRef = useRef<() => void>(() => {});

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // ── Global keyboard shortcuts ──
    const isMod = e.ctrlKey || e.metaKey;

    // Ctrl+S — Save
    if (isMod && e.key === 's') {
      e.preventDefault();
      handleSaveRef.current();
      return;
    }
    // Ctrl+Shift+E — Export menu
    if (isMod && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      setShowExportMenu((v) => !v);
      return;
    }
    // Ctrl+/ — Toggle AI panel
    if (isMod && e.key === '/') {
      e.preventDefault();
      setShowAIPanel((v) => !v);
      return;
    }
    // Ctrl+Shift+? — Show shortcut help
    if (isMod && e.shiftKey && e.key === '?') {
      e.preventDefault();
      setShowShortcutHelp((v) => !v);
      return;
    }

    // Handle auto-completion navigation
    if (showCompletionPopup && autoCompletions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCompletionIndex(i => Math.min(i + 1, autoCompletions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCompletionIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        if (autoCompletions[selectedCompletionIndex]) {
          e.preventDefault();
          applyCompletion(autoCompletions[selectedCompletionIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowCompletionPopup(false);
      }
    }
  }, [showCompletionPopup, autoCompletions, selectedCompletionIndex]);

  const applyCompletion = useCallback((completion: AutoCompletion) => {
    if (!editor) return;
    // Replace from start-of-current line to cursor with the completion text
    editor.chain().focus().insertContent(completion.text).run();
    setShowCompletionPopup(false);
  }, [editor]);

  const applySuggestion = useCallback((suggestion: CopilotSuggestion) => {
    if (!editor) return;

    const docSize = editor.state.doc.content.size;
    let from = suggestion.position.startOffset;
    let to = suggestion.position.endOffset;

    // If positions are out of range (document changed since analysis), fall back
    // to searching for the original text in the document.
    if (from >= docSize || to > docSize || from < 0 || to < from) {
      const docText = editor.state.doc.textContent;
      const original = suggestion.originalText;
      if (original) {
        const idx = docText.indexOf(original);
        if (idx !== -1) {
          // Convert text offset to ProseMirror position (+1 for the doc node)
          from = idx + 1;
          to = from + original.length;
        } else {
          // Can't locate the text — insert at current cursor instead
          editor.chain().focus().insertContent(suggestion.suggestedText).run();
          setContent(editor.getHTML());
          setSelectedSuggestion(null);
          setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
          return;
        }
      } else {
        // No original text to search for — insert at cursor
        editor.chain().focus().insertContent(suggestion.suggestedText).run();
        setContent(editor.getHTML());
        setSelectedSuggestion(null);
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        return;
      }
    }

    // Clamp to valid range as a final safety net
    from = Math.max(0, Math.min(from, docSize));
    to = Math.max(from, Math.min(to, docSize));

    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, suggestion.suggestedText).run();
    setContent(editor.getHTML());
    setSelectedSuggestion(null);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  }, [editor]);

  const handleAIAssist = useCallback(async () => {
    if (!aiPrompt.trim() || !editor) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: editor.getHTML(),
          cursorPosition,
          selectedText,
          contractType,
          playbookId,
          mode: 'assist',
          prompt: aiPrompt,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const data = json.data || json;
        if (data.generatedText) {
          // Sanitize AI-generated HTML before inserting
          const sanitized = DOMPurify.sanitize(data.generatedText, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'a', 'span', 'div', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'mark', 'sub', 'sup'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'data-*'],
          });
          editor.chain().focus().insertContent(sanitized).run();
          setContent(editor.getHTML());
        }
        if (data.suggestions) {
          setSuggestions(prev => [...data.suggestions, ...prev]);
        }
      } else {
        const errorBody = await response.json().catch(() => null);
        toast.error(errorBody?.error || 'AI generation returned an error');
      }
    } catch (error) {
      console.error('AI assist failed:', error);
      toast.error('AI generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
      setAiPrompt('');
      setShowAIPanel(false);
    }
  }, [aiPrompt, editor, cursorPosition, selectedText, contractType, playbookId]);

  const handleSave = useCallback(async () => {
    if (!onSave || !editor) return;
    
    setIsSaving(true);
    try {
      const html = editor.getHTML();
      await onSave(html);
      lastSavedContentRef.current = html;
      setLastSaved(new Date());
      toast.success('Document saved');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [editor, onSave]);

  // Keep ref in sync so handleKeyDown (Ctrl+S) always calls latest handler
  handleSaveRef.current = handleSave;

  // ============================================================================
  // FORMATTING HELPERS — TipTap commands
  // ============================================================================

  const insertFormatting = useCallback((format: string) => {
    if (!editor) return;

    switch (format) {
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'underline':
        editor.chain().focus().toggleUnderline().run();
        break;
      case 'h1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'h2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'list':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'quote':
        editor.chain().focus().toggleBlockquote().run();
        break;
    }
  }, [editor]);

  const handleUndo = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().undo().run();
  }, [editor]);

  const handleRedo = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().redo().run();
  }, [editor]);

  // ============================================================================
  // EXPORT HANDLERS
  // ============================================================================

  const handleExportPDF = useCallback(async () => {
    if (!editor) return;
    setIsExporting(true);
    try {
      await exportDraftAsPDF({
        title: `${contractType} Contract`,
        content: editor.getHTML(),
        contractType,
        author: session?.user?.name || 'Unknown',
      });
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('PDF export failed');
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  }, [editor, contractType, session]);

  const handleExportDOCX = useCallback(async () => {
    if (!editor) return;
    setIsExporting(true);
    try {
      await exportDraftAsDOCX({
        title: `${contractType} Contract`,
        content: editor.getHTML(),
        contractType,
        author: session?.user?.name || 'Unknown',
      });
      toast.success('DOCX exported successfully');
    } catch (error) {
      console.error('DOCX export failed:', error);
      toast.error('DOCX export failed');
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  }, [editor, contractType, session]);

  // ============================================================================
  // FINALIZATION HANDLERS
  // ============================================================================

  const handleStatusChange = useCallback(async (newStatus: typeof draftStatus) => {
    if (!draftId) {
      toast.error('Save the draft first before changing status');
      return;
    }

    try {
      const response = await fetch(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Status update failed');

      setDraftStatus(newStatus);
      toast.success(`Draft status updated to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      console.error('Status change failed:', error);
      toast.error('Failed to update draft status');
    }
  }, [draftId]);

  const handleFinalize = useCallback(async () => {
    if (!draftId) return;

    try {
      const response = await fetch(`/api/drafts/${draftId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || err.data?.error || 'Finalization failed');
      }

      const result = await response.json();
      const contractId = result?.data?.data?.contract?.id || result?.data?.contract?.id;

      setDraftStatus('FINALIZED');
      setCreatedContractId(contractId || null);

      if (contractId) {
        toast.success('Draft finalized! Redirecting to contract...', { duration: 2000 });
        // Short delay for the user to see the success state, then navigate
        setTimeout(() => {
          router.push(`/contracts/${contractId}`);
        }, 1500);
      } else {
        toast.success('Draft finalized successfully!');
      }
    } catch (error) {
      console.error('Finalization failed:', error);
      toast.error(error instanceof Error ? error.message : 'Finalization failed');
    }
  }, [draftId, router]);

  const handleRevertToDraft = useCallback(async () => {
    if (!draftId) return;
    try {
      const response = await fetch(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT' }),
      });
      if (!response.ok) throw new Error('Failed to revert to draft');
      setDraftStatus('DRAFT');
      toast.success('Draft reverted — you can now edit and re-submit.');
    } catch (error) {
      console.error('Revert failed:', error);
      toast.error('Failed to revert draft status');
    }
  }, [draftId]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const riskSummary = useMemo(() => {
    return {
      critical: risks.filter(r => r.riskLevel === 'critical').length,
      high: risks.filter(r => r.riskLevel === 'high').length,
      medium: risks.filter(r => r.riskLevel === 'medium').length,
      low: risks.filter(r => r.riskLevel === 'low').length,
    };
  }, [risks]);

  const getSuggestionIcon = (type: CopilotSuggestion['type']) => {
    switch (type) {
      case 'risk_warning': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'compliance': return <Shield className="h-4 w-4 text-violet-500" />;
      case 'clause_improvement': return <Sparkles className="h-4 w-4 text-violet-500" />;
      case 'auto_complete': return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'negotiation': return <Scale className="h-4 w-4 text-green-500" />;
      default: return <Lightbulb className="h-4 w-4 text-gray-500 dark:text-slate-400" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'low': return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      default: return 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-600';
    }
  };

  // ============================================================================
  // SIDEBAR CONTENT (shared between desktop and mobile)
  // ============================================================================

  const renderSidebarContent = () => (
    <>
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-slate-700" role="tablist" aria-label="Sidebar panels">
        {[
          { id: 'copilot', icon: Brain, label: 'Copilot', count: suggestions.length },
          { id: 'comments', icon: MessageSquare, label: 'Comments', count: comments.length },
          { id: 'versions', icon: History, label: 'History', count: versions.length },
          { id: 'clauses', icon: BookOpen, label: 'Clauses', count: clauses.length },
        ].map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-violet-600 dark:text-violet-400 border-violet-600 dark:border-violet-400'
                : 'text-gray-500 dark:text-slate-400 border-transparent hover:text-gray-700 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden xl:inline">{tab.label}</span>
            {tab.count !== null && tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
        {activeTab === 'copilot' && (
          <div id="panel-copilot" role="tabpanel" aria-labelledby="tab-copilot" className="space-y-4">
            {/* Risk Summary */}
            {risks.length > 0 && (
              <div className="p-3 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 rounded-lg border border-red-100 dark:border-red-800">
                <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-500" />
                  Risk Analysis
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Critical', value: riskSummary.critical, color: 'text-red-600 dark:text-red-400' },
                    { label: 'High', value: riskSummary.high, color: 'text-orange-600 dark:text-orange-400' },
                    { label: 'Medium', value: riskSummary.medium, color: 'text-yellow-600 dark:text-yellow-400' },
                    { label: 'Low', value: riskSummary.low, color: 'text-green-600 dark:text-green-400' },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100">AI Suggestions</h4>
                <button
                  onClick={() => fetchSuggestions()}
                  aria-label="Refresh AI suggestions"
                  className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>

              {isLoadingSuggestions && suggestions.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No suggestions yet</p>
                  <p className="text-xs mt-1">Keep typing to get AI recommendations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((suggestion) => (
                    <motion.div
                      key={suggestion.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      tabIndex={0}
                      role="button"
                      aria-expanded={selectedSuggestion === suggestion.id}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                        selectedSuggestion === suggestion.id
                          ? 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/30'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                      onClick={() => setSelectedSuggestion(selectedSuggestion === suggestion.id ? null : suggestion.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedSuggestion(selectedSuggestion === suggestion.id ? null : suggestion.id)}
                    >
                      <div className="flex items-start gap-2">
                        {getSuggestionIcon(suggestion.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{suggestion.explanation}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              suggestion.source.type === 'playbook' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                              suggestion.source.type === 'clause_library' ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' :
                              suggestion.source.type === 'historical' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                              'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                            }`}>
                              {suggestion.source.type}
                            </span>
                            {suggestion.riskLevel && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${getRiskColor(suggestion.riskLevel)}`}>
                                {suggestion.riskLevel}
                              </span>
                            )}
                          </div>

                          <AnimatePresence>
                            {selectedSuggestion === suggestion.id && (
                              <motion.div key="selected-suggestion"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 space-y-2"
                              >
                                <div className="p-2 bg-red-50 dark:bg-red-950/50 rounded text-xs text-red-700 dark:text-red-300 line-through">
                                  {suggestion.triggerText.length > 100 ? suggestion.triggerText.slice(0, 100) + '...' : suggestion.triggerText}
                                </div>
                                <div className="p-2 bg-green-50 dark:bg-green-950/50 rounded text-xs text-green-700 dark:text-green-300">
                                  {suggestion.suggestedText.length > 150 ? suggestion.suggestedText.slice(0, 150) + '...' : suggestion.suggestedText}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      applySuggestion(suggestion);
                                    }}
                                    className="flex-1 px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 transition-colors"
                                  >
                                    Apply
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
                                      setSelectedSuggestion(null);
                                    }}
                                    className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="text-xs text-gray-400 dark:text-slate-500">
                          {Math.round(suggestion.confidence * 100)}%
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Risks List */}
            {risks.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Detected Risks
                </h4>
                <div className="space-y-2">
                  {risks.slice(0, 5).map((risk) => (
                    <div
                      key={risk.id}
                      className={`p-2 rounded-lg border ${getRiskColor(risk.riskLevel)}`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium">{risk.category}</p>
                          <p className="text-xs mt-0.5 opacity-80">{risk.explanation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div id="panel-comments" role="tabpanel" aria-labelledby="tab-comments" className="space-y-4">
            {/* New comment input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  placeholder="Add a comment..."
                  aria-label="Add a comment"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="p-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                  aria-label="Submit comment"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            {comments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No comments yet</p>
                <p className="text-xs mt-1 text-gray-400 dark:text-slate-500">Comments will appear here during review</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className={`p-3 rounded-lg border ${comment.resolved ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-full bg-violet-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                      {(comment.user?.firstName?.[0] || '') + (comment.user?.lastName?.[0] || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          {comment.user?.firstName} {comment.user?.lastName}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                        {comment.resolved && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                            Resolved
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">{comment.content}</p>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => setReplyTarget(replyTarget === comment.id ? null : comment.id)}
                          className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                        >
                          Reply
                        </button>
                        {!comment.resolved && (
                          <button
                            onClick={() => handleResolveComment(comment.id, true)}
                            className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-0.5"
                          >
                            <Check className="h-3 w-3" /> Resolve
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>

                      {/* Reply input */}
                      {replyTarget === comment.id && (
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleReply(comment.id)}
                            placeholder="Write a reply..."
                            className="flex-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                          <button
                            onClick={() => handleReply(comment.id)}
                            disabled={!replyContent.trim()}
                            className="px-2 py-1 bg-violet-600 text-white text-xs rounded hover:bg-violet-700 disabled:opacity-50"
                          >
                            Send
                          </button>
                        </div>
                      )}

                      {/* Threaded replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-3 space-y-2 pl-3 border-l-2 border-gray-200 dark:border-slate-600">
                          {comment.replies.map((reply: ApiComment) => (
                            <div key={reply.id} className="text-xs">
                              <span className="font-medium text-gray-800 dark:text-slate-200">
                                {reply.user?.firstName} {reply.user?.lastName}
                              </span>
                              <span className="text-gray-400 dark:text-slate-500 ml-2">
                                {new Date(reply.createdAt).toLocaleString()}
                              </span>
                              <p className="text-gray-600 dark:text-slate-300 mt-0.5">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'versions' && (
          <div id="panel-versions" role="tabpanel" aria-labelledby="tab-versions" className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 dark:text-slate-100">Version History</h3>
              <button
                onClick={handleOpenDiff}
                disabled={versions.length < 1}
                className="flex items-center gap-1 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors disabled:opacity-40"
                aria-label="Compare versions"
              >
                <GitBranch className="h-4 w-4" />
                Compare
              </button>
            </div>
            {versions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No versions yet</p>
                <p className="text-xs mt-1 text-gray-400 dark:text-slate-500">Save to create a version</p>
              </div>
            ) : (
              versions.map((version, index) => (
                <div
                  key={version.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    index === 0 ? 'border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/30' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-slate-100">v{version.version}</span>
                        {version.label && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            index === 0 ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                          }`}>
                            {version.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        {version.user?.firstName} {version.user?.lastName}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                        {new Date(version.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {version.changeSummary && (
                      <div className="text-xs text-gray-500 dark:text-slate-400 max-w-[120px] truncate">{version.changeSummary}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Clause Library Tab */}
        {activeTab === 'clauses' && (
          <div id="panel-clauses" role="tabpanel" aria-labelledby="tab-clauses" className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={clauseSearch}
                  onChange={(e) => setClauseSearch(e.target.value)}
                  placeholder="Search clauses..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <select
                value={clauseCategory}
                onChange={(e) => setClauseCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">All Categories</option>
                <option value="liability">Liability</option>
                <option value="indemnification">Indemnification</option>
                <option value="termination">Termination</option>
                <option value="ip">Intellectual Property</option>
                <option value="confidentiality">Confidentiality</option>
                <option value="payment">Payment Terms</option>
                <option value="governance">Governance</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>

            {isLoadingClauses ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              </div>
            ) : clauses.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No clauses found</p>
                <p className="text-xs mt-1 text-gray-400 dark:text-slate-500">Try changing your search or category</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clauses.map((clause) => (
                  <div
                    key={clause.id}
                    className="p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-300 dark:hover:border-violet-600 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{clause.title}</h5>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">
                            {clause.category}
                          </span>
                          {clause.riskLevel && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getRiskColor(clause.riskLevel)}`}>
                              {clause.riskLevel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {clause.content?.slice(0, 120)}...
                        </p>
                      </div>
                      <button
                        onClick={() => handleInsertClause(clause)}
                        className="flex-shrink-0 p-1.5 bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 rounded hover:bg-violet-200 dark:hover:bg-violet-900 transition-colors"
                        title="Insert clause into document"
                        aria-label={`Insert ${clause.title} clause`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Brain className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                <div>
                  <h1 className="font-semibold text-gray-900 dark:text-slate-100">AI Copilot Editor</h1>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{contractType} • Real-time AI assistance</p>
                </div>
              </div>
              <div className="h-6 w-px bg-gray-200 dark:bg-slate-600" />
              <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400">
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <Clock className="h-4 w-4" />
                    <span>Saved {lastSaved.toLocaleTimeString()}</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    <span>Not saved yet</span>
                  </>
                )}
              </div>

              {/* Risk Summary Badge */}
              {(riskSummary.critical > 0 || riskSummary.high > 0) && (
                <>
                  <div className="h-6 w-px bg-gray-200 dark:bg-slate-600 hidden sm:block" />
                  <div className="flex items-center gap-2">
                    {riskSummary.critical > 0 && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full text-xs font-medium">
                        <AlertCircle className="h-3 w-3" />
                        {riskSummary.critical} Critical
                      </span>
                    )}
                    {riskSummary.high > 0 && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        {riskSummary.high} High
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Lock Indicator */}
              {lockInfo.isLocked && (
                <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
                  <Lock className="h-3 w-3" />
                  <span className="hidden sm:inline">Locked{lockInfo.lockedBy ? ` by ${lockInfo.lockedBy}` : ''}</span>
                </span>
              )}

              {/* Lock/Unlock Button */}
              {draftId && (
                <button
                  onClick={() => handleLock(lockInfo.isLocked ? 'unlock' : 'lock')}
                  disabled={isLocking}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    lockInfo.isLocked
                      ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                  title={lockInfo.isLocked ? 'Unlock document' : 'Lock document for editing'}
                >
                  {isLocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : lockInfo.isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                </button>
              )}

              {/* Approval Actions */}
              {draftId && (draftStatus === 'IN_REVIEW' || draftStatus === 'PENDING_APPROVAL') && (
                <>
                  <button
                    onClick={handleApprove}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg text-xs hover:bg-green-200 dark:hover:bg-green-900 transition-colors"
                    title="Approve this draft"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Approve</span>
                  </button>
                  <button
                    onClick={() => setShowApprovalModal("reject")}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-xs hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
                    title="Reject this draft"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reject</span>
                  </button>
                </>
              )}

              {/* Keyboard Shortcuts Help */}
              <button
                onClick={() => setShowShortcutHelp((v) => !v)}
                className="hidden sm:flex items-center p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                title="Keyboard shortcuts (Ctrl+Shift+?)"
              >
                <Keyboard className="h-4 w-4" />
              </button>

              {/* Mobile Sidebar Toggle */}
              <button
                onClick={() => setShowMobileSidebar(true)}
                className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-sm text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                aria-label="Open AI Copilot panel"
              >
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Copilot</span>
              </button>

              {/* Mode Toggle */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1" role="radiogroup" aria-label="Editor mode">
                <button
                  onClick={() => setIsEditing(true)}
                  role="radio"
                  aria-checked={isEditing}
                  aria-label="Switch to edit mode"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isEditing ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Edit3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  role="radio"
                  aria-checked={!isEditing}
                  aria-label="Switch to preview mode"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    !isEditing ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              </div>

              <div className="h-6 w-px bg-gray-200 dark:bg-slate-600 hidden sm:block" />

              {/* Draft Status Badge */}
              {draftId && (
                <span className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  draftStatus === 'FINALIZED' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                  draftStatus === 'IN_REVIEW' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                  draftStatus === 'APPROVED' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' :
                  draftStatus === 'PENDING_APPROVAL' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                  'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                }`}>
                  {draftStatus === 'FINALIZED' && <CheckCircle2 className="h-3 w-3" />}
                  {draftStatus.replace('_', ' ')}
                </span>
              )}

              {/* Export Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={isExporting}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden">
                    <button
                      onClick={handleExportPDF}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <FileDown className="h-4 w-4 text-red-500" />
                      Export as PDF
                    </button>
                    <button
                      onClick={handleExportDOCX}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <FileDown className="h-4 w-4 text-blue-500" />
                      Export as DOCX
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              {onLegalReview && (
                <button
                  onClick={onLegalReview}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                >
                  <FileCheck className="h-4 w-4" />
                  Legal Review
                </button>
              )}

              {/* Finalization Actions */}
              {draftId && draftStatus === 'DRAFT' && (
                <button
                  onClick={() => handleStatusChange('IN_REVIEW')}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                  Submit for Review
                </button>
              )}
              {draftId && (draftStatus === 'APPROVED' || draftStatus === 'IN_REVIEW') && (
                <button
                  onClick={handleFinalize}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Finalize
                </button>
              )}
              {draftId && draftStatus === 'FINALIZED' && createdContractId && (
                <button
                  onClick={() => router.push(`/contracts/${createdContractId}`)}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                  View Contract
                </button>
              )}
              {draftId && draftStatus === 'REJECTED' && (
                <button
                  onClick={handleRevertToDraft}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                  Revise &amp; Re-submit
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>

          {/* Toolbar */}
          {isEditing && (
            <div className="mt-3 flex flex-wrap items-center gap-1 pb-2 border-b border-gray-100 dark:border-slate-700" role="toolbar" aria-label="Document formatting toolbar">
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 dark:bg-slate-700" role="group" aria-label="History controls">
                <button onClick={handleUndo} disabled={!editor?.can().undo()} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-30" title="Undo (Ctrl+Z)" aria-label="Undo last action">
                  <Undo2 className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
                <button onClick={handleRedo} disabled={!editor?.can().redo()} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-30" title="Redo (Ctrl+Y)" aria-label="Redo last action">
                  <Redo2 className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 dark:bg-slate-600 mx-1" />
              <div className="flex items-center gap-1" role="group" aria-label="Text formatting">
                <button onClick={() => insertFormatting('bold')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="Bold (**text**)" aria-label="Bold text">
                  <Bold className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
                <button onClick={() => insertFormatting('italic')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="Italic (*text*)" aria-label="Italic text">
                  <Italic className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
                <button onClick={() => insertFormatting('underline')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="Underline (__text__)" aria-label="Underline text">
                  <Underline className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 dark:bg-slate-600 mx-1" />
              <div className="flex items-center gap-1" role="group" aria-label="Headings">
                <button onClick={() => insertFormatting('h1')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="Heading 1 (# )" aria-label="Insert heading level 1">
                  <Heading1 className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
                <button onClick={() => insertFormatting('h2')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="Heading 2 (## )" aria-label="Insert heading level 2">
                  <Heading2 className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 dark:bg-slate-600 mx-1" />
              <div className="flex items-center gap-1" role="group" aria-label="Block elements">
                <button onClick={() => insertFormatting('list')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="List (- item)" aria-label="Insert list">
                  <List className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
                <button onClick={() => insertFormatting('quote')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="Quote (> text)" aria-label="Insert quote">
                  <Quote className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
              </div>
              <div className="flex-1" />
              
              {/* Copilot Status */}
              <div className="flex items-center gap-2 mr-2">
                {isLoadingSuggestions && (
                  <span className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="hidden sm:inline">Analyzing...</span>
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-slate-400 hidden sm:inline">
                  {suggestions.length} suggestions
                </span>
              </div>

              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg hover:from-violet-600 hover:to-purple-600 transition-colors text-sm"
              >
                <Wand2 className="h-4 w-4" />
                AI Assist
              </button>
            </div>
          )}

          {/* AI Assist button visible in preview mode */}
          {!isEditing && (
            <div className="mt-3 flex justify-end pb-2 border-b border-gray-100 dark:border-slate-700">
              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg hover:from-violet-600 hover:to-purple-600 transition-colors text-sm"
              >
                <Wand2 className="h-4 w-4" />
                AI Assist
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex relative">
        {/* Editor */}
        <div className="flex-1 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            {/* AI Panel */}
            <AnimatePresence>
              {showAIPanel && (
                <motion.div key="a-i-panel"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 rounded-xl p-4 border border-violet-100 dark:border-violet-800">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                        <Brain className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-2">AI Copilot Assistant</h3>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAIAssist()}
                            placeholder="Ask AI to help... (e.g., 'Strengthen the liability clause', 'Add GDPR compliance language')"
                            aria-label="AI prompt input"
                            className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          />
                          <button
                            onClick={handleAIAssist}
                            disabled={isGenerating || !aiPrompt.trim()}
                            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                          >
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            'Strengthen liability cap',
                            'Add GDPR clause',
                            'Improve termination terms',
                            'Add indemnification',
                            'Clarify IP ownership',
                            'Add force majeure',
                          ].map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => setAiPrompt(suggestion)}
                              className="px-3 py-1 text-sm bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-300 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors border border-violet-200 dark:border-violet-700"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => setShowAIPanel(false)} className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300" aria-label="Close AI panel">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Document Content */}
            <div className="relative">
              <div
                className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 md:p-8 min-h-[600px] md:min-h-[800px] ${
                  isEditing ? 'focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent' : ''
                }`}
                onKeyDown={handleKeyDown}
              >
                {editor ? (
                  <EditorContent editor={editor} />
                ) : (
                  <div className="flex items-center justify-center min-h-[550px]">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                  </div>
                )}
              </div>

              {/* Auto-completion Popup */}
              <AnimatePresence>
                {showCompletionPopup && autoCompletions.length > 0 && (
                  <motion.div key="completion-popup"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-20 w-[calc(100%-2rem)] md:w-auto max-w-[600px] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden"
                    style={{ top: completionPopupPos.top, left: Math.max(16, completionPopupPos.left) }}
                    role="listbox"
                    aria-label="Auto-complete suggestions"
                  >
                    <div className="px-3 py-2 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Auto-complete suggestions</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">Tab to accept</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {autoCompletions.map((completion, index) => (
                        <button
                          key={completion.id}
                          role="option"
                          aria-selected={index === selectedCompletionIndex}
                          onClick={() => applyCompletion(completion)}
                          className={`w-full px-4 py-3 text-left hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors border-b border-gray-100 dark:border-slate-700 last:border-0 ${
                            index === selectedCompletionIndex ? 'bg-violet-50 dark:bg-violet-900/30' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 px-1.5 py-0.5 rounded text-xs ${
                              completion.source === 'library' ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' :
                              completion.source === 'historical' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                              'bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-slate-300'
                            }`}>
                              {completion.source}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-900 dark:text-slate-100 line-clamp-2">{completion.text}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500 dark:text-slate-400">
                                  {Math.round(completion.matchScore * 100)}% match
                                </span>
                                {completion.riskLevel && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${getRiskColor(completion.riskLevel)}`}>
                                    {completion.riskLevel} risk
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Copilot Panel (Desktop) */}
        <div className="hidden lg:block w-80 xl:w-96 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 min-h-[calc(100vh-120px)]">
          {renderSidebarContent()}
        </div>

        {/* Mobile Sidebar Drawer */}
        <AnimatePresence>
          {showMobileSidebar && (
            <>
              <motion.div
                key="sidebar-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setShowMobileSidebar(false)}
              />
              <motion.div
                key="sidebar-drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed right-0 top-0 bottom-0 w-[85vw] max-w-[400px] bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 z-50 lg:hidden shadow-2xl"
              >
                <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-700">
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100">AI Copilot</h3>
                  <button
                    onClick={() => setShowMobileSidebar(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Close sidebar"
                  >
                    <X className="h-5 w-5 text-gray-500 dark:text-slate-400" />
                  </button>
                </div>
                <div className="overflow-y-auto h-[calc(100vh-56px)]">
                  {renderSidebarContent()}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ── Rejection Modal ── */}
      <AnimatePresence>
        {showApprovalModal && (
          <motion.div
            key="approval-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowApprovalModal(null)}
          >
            <motion.div
              key="approval-modal"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Reject Draft</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Please provide a reason for rejection.</p>
              <textarea
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder="Reason for rejection..."
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => { setShowApprovalModal(null); setApprovalComment(''); }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { handleReject(); setShowApprovalModal(null); }}
                  disabled={!approvalComment.trim()}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Version Diff Overlay ── */}
      <AnimatePresence>
        {showDiffView && diffVersions.length > 0 && (
          <motion.div
            key="diff-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              key="diff-panel"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-auto"
            >
              <VersionDiffView
                versions={diffVersions}
                onClose={() => setShowDiffView(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Keyboard Shortcut Help Modal ── */}
      <AnimatePresence>
        {showShortcutHelp && (
          <motion.div
            key="shortcut-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowShortcutHelp(false)}
          >
            <motion.div
              key="shortcut-panel"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <Keyboard className="h-5 w-5 text-violet-500" />
                  Keyboard Shortcuts
                </h3>
                <button
                  onClick={() => setShowShortcutHelp(false)}
                  className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { keys: 'Ctrl + S', action: 'Save draft' },
                  { keys: 'Ctrl + Shift + E', action: 'Toggle export menu' },
                  { keys: 'Ctrl + /', action: 'Toggle AI assistant' },
                  { keys: 'Ctrl + Shift + ?', action: 'Show this help' },
                  { keys: 'Ctrl + Z', action: 'Undo' },
                  { keys: 'Ctrl + Y', action: 'Redo' },
                  { keys: 'Ctrl + B', action: 'Bold text' },
                  { keys: 'Ctrl + I', action: 'Italic text' },
                ].map((shortcut) => (
                  <div key={shortcut.keys} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-slate-300">{shortcut.action}</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded border border-gray-200 dark:border-slate-600">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CopilotDraftingCanvas;
