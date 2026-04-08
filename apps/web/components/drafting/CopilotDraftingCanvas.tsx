'use client';

import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, MessageSquare, Wand2, AlertTriangle,
  Lightbulb, Save, Eye, Edit3, Sparkles,
  GitBranch, Bold, Italic, Underline, List,
  Heading1, Heading2, Quote, X, Send, Clock, Zap, Shield, Scale,
  RefreshCw, Loader2, Brain, AlertCircle,
  FileDown, CheckCircle2, ArrowRight,
  BookOpen, Search, Lock, Unlock, ThumbsUp, ThumbsDown,
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
// HELPERS
// ============================================================================

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const AI_HTML_SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'a', 'span', 'div', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'mark', 'sub', 'sup'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'data-*'],
};

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function normalizeAiHtml(text: string): string {
  const raw = /^\s*</.test(text) ? text : textToHtml(text);
  return DOMPurify.sanitize(raw, AI_HTML_SANITIZE_OPTIONS);
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function renderSimpleMarkdown(text: string): ReactNode {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];

  const renderInline = (raw: string) => (
    <>
      {raw.split(/\*\*(.+?)\*\*/g).map((part, index) =>
        index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>
      )}
    </>
  );

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^[-•]\s/.test(line)) {
      elements.push(
        <li key={index} className="ml-4 list-disc">
          {renderInline(line.replace(/^[-•]\s/, ''))}
        </li>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={index} className="ml-4 list-decimal">
          {renderInline(line.replace(/^\d+\.\s/, ''))}
        </li>
      );
      continue;
    }

    if (line.trim() === '') {
      elements.push(<div key={index} className="h-2" />);
      continue;
    }

    elements.push(<p key={index}>{renderInline(line)}</p>);
  }

  return <div className="space-y-1">{elements}</div>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AI_QUICK_PROMPTS: Record<string, string[]> = {
  NDA: [
    'Add mutual disclosure terms',
    'Set confidentiality period',
    'Add permitted disclosures',
    'Make more protective',
  ],
  MSA: [
    'Add payment terms',
    'Define scope of services',
    'Add termination clause',
    'Simplify the language',
  ],
  EMPLOYMENT: [
    'Add non-compete clause',
    'Set notice period',
    'Add benefits section',
    'Simplify the language',
  ],
  SOW: [
    'Add deliverables table',
    'Define acceptance criteria',
    'Add milestone payments',
    'Make more protective',
  ],
  SLA: [
    'Define uptime requirements',
    'Add penalty provisions',
    'Set response times',
    'Add escalation process',
  ],
  DEFAULT: [
    'Make more protective',
    'Add a termination clause',
    'Simplify the language',
    'Add compliance notes',
  ],
};

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

interface ChatQuickReply {
  label: string;
  value: string;
}

interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  title?: string;
  draftHtml?: string;
  applyMode?: 'replace_selection' | 'insert_at_cursor' | 'none';
  suggestions?: ChatQuickReply[];
  followUpQuestion?: string;
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

  // Content state — TipTap manages the DOM; we keep refs for AI API payloads
  // to avoid re-rendering the entire component on every keystroke/cursor move.
  const contentRef = useRef(initialContent);
  const cursorPositionRef = useRef(0);
  const selectedTextRef = useRef('');
  // Lightweight state only for the debounce trigger (string length, not full HTML)
  const [contentVersion, setContentVersion] = useState(0);
  const debouncedContentVersion = useDebounce(contentVersion, 500);
  // Expose content length for guards (cheap number comparison, no re-render on text change)
  const contentLengthRef = useRef(0);

  // Copilot state
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [risks, setRisks] = useState<RiskHighlight[]>([]);
  const [autoCompletions, setAutoCompletions] = useState<AutoCompletion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0);
  const [completionPopupPos, setCompletionPopupPos] = useState<{ top: number; left: number }>({ top: 80, left: 32 });

  // UI state
  const [activeTab, setActiveTabRaw] = useState<'copilot' | 'comments' | 'versions' | 'clauses' | 'ai-chat'>(() => {
    if (typeof window === 'undefined') return 'copilot';
    const saved = localStorage.getItem('drafting-sidebar-tab');
    if (saved === 'copilot' || saved === 'comments' || saved === 'versions' || saved === 'clauses' || saved === 'ai-chat') return saved;
    return 'copilot';
  });
  const setActiveTab = useCallback((tab: typeof activeTab | ((prev: typeof activeTab) => typeof activeTab)) => {
    setActiveTabRaw(prev => {
      const next = typeof tab === 'function' ? tab(prev) : tab;
      try { localStorage.setItem('drafting-sidebar-tab', next); } catch { /* quota exceeded */ }
      return next;
    });
  }, []);
  const [aiChatMessages, _setAiChatMessages] = useState<AiChatMessage[]>([]);
  const aiChatMessagesRef = useRef<AiChatMessage[]>([]);
  // Keep ref in sync so sendAiChatMessage reads latest without re-creating
  const setAiChatMessages = useCallback((update: AiChatMessage[] | ((prev: AiChatMessage[]) => AiChatMessage[])) => {
    _setAiChatMessages(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      aiChatMessagesRef.current = next;
      return next;
    });
  }, []);
  const [aiChatInput, setAiChatInput] = useState('');
  const [isAiChatStreaming, setIsAiChatStreaming] = useState(false);
  const aiChatAbortRef = useRef<AbortController | null>(null);
  const aiChatScrollRef = useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
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
  const debouncedClauseSearch = useDebounce(clauseSearch, 300);
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
  const [showApprovalModal, setShowApprovalModal] = useState<'approve' | 'reject' | 'submit_review' | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  // Keyboard shortcut help
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  // Cleanup pending requests on unmount or page navigation
  useEffect(() => {
    const cleanup = () => {
      aiChatAbortRef.current?.abort();
    };
    // Warn about unsaved changes
    const warnUnsaved = (e: BeforeUnloadEvent) => {
      if (contentRef.current !== lastSavedContentRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('beforeunload', warnUnsaved);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      window.removeEventListener('beforeunload', warnUnsaved);
      cleanup();
    };
  }, []);

  useEffect(() => {
    const container = aiChatScrollRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: aiChatMessages.length > 1 ? 'smooth' : 'auto',
    });
  }, [aiChatMessages, isAiChatStreaming]);

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
        placeholder: isBlankDocument 
          ? 'Start drafting your contract here… Press Ctrl+/ to open AI Copilot, or check the Clause Library on the right →'
          : 'Start drafting your contract…',
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
      const html = ed.getHTML();
      contentRef.current = html;
      contentLengthRef.current = html.length;
      // Bump version to trigger debounce — no full HTML in state
      setContentVersion(v => v + 1);

      // trigger auto-completions only when user pauses typing at end of a
      // substantial line (not mid-sentence edits or cursor-only moves)
      const { from } = ed.state.selection;
      cursorPositionRef.current = from;
      const resolvedPos = ed.state.doc.resolve(from);
      const lineEnd = resolvedPos.end();
      const isAtLineEnd = from >= lineEnd - 1; // within 1 char of line end
      const docText = ed.state.doc.textBetween(0, from, '\n');
      const lines = docText.split('\n');
      const currentLine = (lines[lines.length - 1] || '').trim();

      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);

      // Only trigger when: at end-of-line, line is substantial, and line ends
      // with natural pause punctuation or a space (user paused typing)
      if (isAtLineEnd && currentLine.length > 15 && /[\s,;.]$/.test(currentLine)) {
        // Capture cursor coordinates for popup positioning
        try {
          const coords = ed.view.coordsAtPos(from);
          const editorRect = ed.view.dom.getBoundingClientRect();
          const scrollParent = ed.view.dom.closest('.overflow-y-auto, .overflow-auto') || ed.view.dom.parentElement;
          const scrollTop = scrollParent?.scrollTop || 0;
          const rawTop = coords.bottom - editorRect.top + scrollTop + 4;
          const rawLeft = coords.left - editorRect.left;
          // Clamp within visible editor area
          setCompletionPopupPos({
            top: Math.max(0, Math.min(rawTop, editorRect.height - 100)),
            left: Math.max(8, Math.min(rawLeft, editorRect.width - 400)),
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
      cursorPositionRef.current = from;
      const sel = ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to, ' ');
      selectedTextRef.current = sel;
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
    const currentContent = contentRef.current;
    if (!currentContent || currentContent.length < 50) return;

    setIsLoadingSuggestions(true);
    try {
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentContent,
          cursorPosition: cursorPositionRef.current,
          selectedText: selectedTextRef.current,
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
  }, [contractType, playbookId]);

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
          cursorPosition: cursorPositionRef.current,
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
      toast.error('Auto-complete unavailable', { id: 'autocomplete-err' });
    }
  }, [contractType]);

  // Risks are fetched alongside suggestions in fetchSuggestions — no separate poll needed.

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Fetch suggestions when content changes (debounced via contentVersion)
  useEffect(() => {
    if (contentLengthRef.current > 100) {
      fetchSuggestions();
    }
  }, [debouncedContentVersion, fetchSuggestions]);

  // Track last saved content to avoid redundant auto-saves
  const lastSavedContentRef = useRef(initialContent);
  // Lock to prevent concurrent auto-save and manual save
  const saveLockRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save: triggered by content changes (debounced via contentVersion)
  useEffect(() => {
    if (!editor) return;

    const html = editor.getHTML();
    if (html === lastSavedContentRef.current) return;

    const timer = setTimeout(async () => {
      // Skip if a manual save is in progress
      if (saveLockRef.current) return;
      saveLockRef.current = true;
      // Content changed — save via onSave callback or direct API
      setIsSaving(true);
      try {
        if (onSave) {
          await onSave(html);
        } else if (draftId) {
          const csrfCookie = document.cookie.split('; ').find(c => c.startsWith('csrf_token='));
          const csrfToken = csrfCookie?.split('=').slice(1).join('=') || '';
          await fetch(`/api/drafts/${draftId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
            },
            body: JSON.stringify({ content: html }),
          });
        }
        lastSavedContentRef.current = html;
        setLastSaved(new Date());
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
        saveLockRef.current = false;
      }
    }, 5000); // 5s after last debounced content change

    autoSaveTimerRef.current = timer;
    return () => { clearTimeout(timer); autoSaveTimerRef.current = null; };
  }, [debouncedContentVersion, editor, onSave, draftId]);

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
      if (debouncedClauseSearch) params.set('search', debouncedClauseSearch);
      if (clauseCategory && clauseCategory !== 'all') params.set('category', clauseCategory);
      params.set('limit', '30');

      const res = await fetch(`/api/clauses?${params}`);
      if (res.ok) {
        const json = await res.json();
        setClauses(json.clauses || json.data?.clauses || []);
      } else {
        console.warn('Clauses fetch non-OK:', res.status);
        toast.error('Failed to load clause library', { id: 'clauses-err' });
      }
    } catch (err) {
      console.error('Failed to fetch clauses:', err);
      toast.error('Failed to load clause library', { id: 'clauses-err' });
    } finally {
      setIsLoadingClauses(false);
    }
  }, [debouncedClauseSearch, clauseCategory]);

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
        await res.json().catch(() => ({}));
        toast.error(`Failed to ${action} draft`);
      }
    } catch { toast.error(`Failed to ${action} draft`); }
    finally { setIsLocking(false); }
  }, [draftId]);

  // Lock heartbeat — re-acquire lock every 2 minutes to prevent stale-lock expiry
  useEffect(() => {
    if (!draftId || !lockInfo.isLocked || lockInfo.lockedBy !== session?.user?.id) return;
    let failCount = 0;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/drafts/${draftId}/lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'lock' }),
        });
        if (res.ok) {
          failCount = 0; // reset on success
        } else {
          throw new Error(`Lock heartbeat ${res.status}`);
        }
      } catch {
        failCount++;
        if (failCount >= 3) {
          toast.error('Lock lost — another user may take over. Save your work.', { id: 'lock-lost' });
        }
      }
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [draftId, lockInfo.isLocked, lockInfo.lockedBy, session?.user?.id]);

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
        await res.json().catch(() => ({}));
        toast.error('Approval failed');
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
        await res.json().catch(() => ({}));
        toast.error('Rejection failed');
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
    // Ctrl+/ — Toggle AI Chat
    if (isMod && e.key === '/') {
      e.preventDefault();
      setActiveTab((t) => (t === 'ai-chat' ? 'suggestions' : 'ai-chat'));
      return;
    }
    // Ctrl+Space — Manual auto-complete trigger
    if (isMod && e.key === ' ') {
      e.preventDefault();
      if (editor) {
        const { from } = editor.state.selection;
        const docText = editor.state.doc.textBetween(0, from, '\n');
        const lines = docText.split('\n');
        const currentLine = (lines[lines.length - 1] || '').trim();
        if (currentLine.length > 5) {
          fetchAutoCompletions(currentLine);
        }
      }
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
  }, [showCompletionPopup, autoCompletions, selectedCompletionIndex, editor, fetchAutoCompletions]);

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
          setSelectedSuggestion(null);
          setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
          return;
        }
      } else {
        // No original text to search for — insert at cursor
        editor.chain().focus().insertContent(suggestion.suggestedText).run();
        setSelectedSuggestion(null);
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        return;
      }
    }

    // Clamp to valid range as a final safety net
    from = Math.max(0, Math.min(from, docSize));
    to = Math.max(from, Math.min(to, docSize));

    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, suggestion.suggestedText).run();
    setSelectedSuggestion(null);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  }, [editor]);



  const handleSave = useCallback(async () => {
    if (!editor) return;
    if (!onSave && !draftId) return;
    
    // Cancel pending auto-save and acquire lock
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    saveLockRef.current = true;
    setIsSaving(true);
    try {
      const html = editor.getHTML();
      if (onSave) {
        await onSave(html);
      } else if (draftId) {
        const csrfCookie = document.cookie.split('; ').find(c => c.startsWith('csrf_token='));
        const csrfToken = csrfCookie?.split('=').slice(1).join('=') || '';
        const res = await fetch(`/api/drafts/${draftId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
          },
          body: JSON.stringify({ content: html }),
        });
        if (!res.ok) throw new Error('Save failed');
      }
      lastSavedContentRef.current = html;
      setLastSaved(new Date());
      toast.success('Document saved');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Save failed');
    } finally {
      setIsSaving(false);
      saveLockRef.current = false;
    }
  }, [editor, onSave, draftId]);

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

  const applyAiChatDraft = useCallback((message: AiChatMessage) => {
    if (!editor || !message.draftHtml) return;

    const sanitized = normalizeAiHtml(message.draftHtml);
    const { from, to } = editor.state.selection;
    const shouldReplace = message.applyMode === 'replace_selection' && from !== to;

    if (shouldReplace) {
      editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, sanitized).run();
    } else {
      editor.chain().focus().insertContent(sanitized).run();
    }

    toast.success(shouldReplace ? 'AI rewrite applied' : 'AI draft inserted');
  }, [editor]);

  const copyAiChatContent = useCallback(async (message: AiChatMessage) => {
    const text = message.draftHtml ? stripHtml(message.draftHtml) : message.content;
    if (!text) return;

    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }, []);

  // ============================================================================
  // AI CHAT IN SIDEBAR
  // ============================================================================

  const sendAiChatMessage = useCallback(async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isAiChatStreaming) return;

    const assistantMessageId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `assistant-${Date.now()}`;
    const userMessageId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `user-${Date.now()}`;

    const userMsg: AiChatMessage = {
      id: userMessageId,
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date(),
    };
    const assistantMsg: AiChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setAiChatMessages(prev => [...prev, userMsg, assistantMsg]);
    setAiChatInput('');
    setIsAiChatStreaming(true);

    try {
      const controller = new AbortController();
      aiChatAbortRef.current = controller;

      const csrfCookie = document.cookie.split('; ').find(c => c.startsWith('csrf_token='));
      const csrfToken = csrfCookie?.split('=').slice(1).join('=') || '';

      const selectedText = editor?.state?.selection ? 
        editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ') : '';

      // Extract document headings for structural context
      const headings: string[] = [];
      editor?.state?.doc?.descendants?.((node) => {
        if (node.type.name === 'heading' && node.textContent) {
          headings.push(node.textContent);
        }
      });

      const conversationHistory = [...aiChatMessagesRef.current, userMsg].map((chatMessage) => ({
        role: chatMessage.role,
        content: [
          chatMessage.content,
          chatMessage.draftHtml ? `Suggested draft:\n${stripHtml(chatMessage.draftHtml)}` : '',
        ].filter(Boolean).join('\n\n'),
      }));

      const response = await fetch('/api/ai/agents/draft-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({
          message: trimmedMessage,
          conversationHistory,
          context: {
            contractType,
            currentContent: editor?.getText()?.slice(0, 12000) || '',
            selectedText: selectedText || undefined,
            documentSections: headings.length > 0 ? headings : undefined,
            playbookId,
          },
          action: 'editor_assist',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done || controller.signal.aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith('event: ')) continue;
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));

              if ('draftHtml' in parsed || 'applyMode' in parsed || 'title' in parsed || 'followUpQuestion' in parsed) {
                setAiChatMessages(prev => {
                  return prev.map((chatMessage) =>
                    chatMessage.id === assistantMessageId
                      ? {
                          ...chatMessage,
                          content: typeof parsed.content === 'string' ? parsed.content : chatMessage.content,
                          title: typeof parsed.title === 'string' ? parsed.title : chatMessage.title,
                          draftHtml: typeof parsed.draftHtml === 'string' ? parsed.draftHtml : chatMessage.draftHtml,
                          applyMode:
                            parsed.applyMode === 'replace_selection' || parsed.applyMode === 'insert_at_cursor' || parsed.applyMode === 'none'
                              ? parsed.applyMode
                              : chatMessage.applyMode,
                          followUpQuestion:
                            typeof parsed.followUpQuestion === 'string' && parsed.followUpQuestion.trim()
                              ? parsed.followUpQuestion
                              : chatMessage.followUpQuestion,
                          isStreaming: false,
                        }
                      : chatMessage
                  );
                });
                continue;
              }

              if ('suggestions' in parsed && Array.isArray(parsed.suggestions)) {
                setAiChatMessages(prev => prev.map((chatMessage) =>
                  chatMessage.id === assistantMessageId
                    ? {
                        ...chatMessage,
                        suggestions: parsed.suggestions.filter(
                          (suggestion: { label?: unknown; value?: unknown }) =>
                            typeof suggestion?.label === 'string' && typeof suggestion?.value === 'string'
                        ) as ChatQuickReply[],
                      }
                    : chatMessage
                ));
                continue;
              }

              if ('content' in parsed && 'role' in parsed && typeof parsed.content === 'string') {
                setAiChatMessages(prev => prev.map((chatMessage) =>
                  chatMessage.id === assistantMessageId
                    ? { ...chatMessage, content: chatMessage.content + parsed.content }
                    : chatMessage
                ));
                continue;
              }

              if ('error' in parsed && typeof parsed.error === 'string') {
                setAiChatMessages(prev => prev.map((chatMessage) =>
                  chatMessage.id === assistantMessageId
                    ? { ...chatMessage, content: parsed.error, isStreaming: false }
                    : chatMessage
                ));
                continue;
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setAiChatMessages(prev => prev.map((chatMessage) =>
          chatMessage.id === assistantMessageId
            ? { ...chatMessage, isStreaming: false, content: chatMessage.content || 'Request cancelled.' }
            : chatMessage
        ));
        return;
      }

      toast.error('AI chat error. Please try again.');
      setAiChatMessages(prev => prev.map((chatMessage) =>
        chatMessage.id === assistantMessageId
          ? {
              ...chatMessage,
              content: chatMessage.content || 'Sorry, I encountered an error. Please try again.',
              isStreaming: false,
            }
          : chatMessage
      ));
    } finally {
      setIsAiChatStreaming(false);
      setAiChatMessages(prev => prev.map((chatMessage) =>
        chatMessage.id === assistantMessageId
          ? { ...chatMessage, isStreaming: false }
          : chatMessage
      ));
      aiChatAbortRef.current = null;
    }
  }, [isAiChatStreaming, editor, contractType, playbookId]);

  // ============================================================================
  // SIDEBAR CONTENT (shared between desktop and mobile)
  // ============================================================================

  const renderSidebarContent = () => (
    <div className="flex h-full min-h-0 flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 px-3 pt-3 dark:border-slate-700">
        <div className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Sidebar panels">
          {[
            { id: 'copilot', icon: Brain, label: 'Copilot', count: suggestions.length },
            { id: 'ai-chat', icon: MessageSquare, label: 'AI Chat', count: null },
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
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.count !== null && tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeTab === tab.id
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200'
                    : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        {activeTab === 'copilot' && (
          <div id="panel-copilot" role="tabpanel" aria-labelledby="tab-copilot" className="h-full space-y-4 overflow-y-auto pr-1">
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
                  <p className="text-sm font-medium">No suggestions yet</p>
                  <p className="text-xs mt-1 max-w-[200px] mx-auto">Start typing your contract content — AI will analyze and suggest improvements in real time</p>
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

            {/* Negotiation Alternatives */}
            {suggestions.filter(s => s.type === 'negotiation').length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-green-500" />
                  Negotiation Alternatives
                </h4>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                  Alternative clause wordings for different negotiation positions
                </p>
                <div className="space-y-2">
                  {suggestions.filter(s => s.type === 'negotiation').map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20"
                    >
                      <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1">{suggestion.explanation}</p>
                      <div className="p-2 bg-green-100/50 dark:bg-green-900/30 rounded text-xs text-green-700 dark:text-green-300 mb-2">
                        {suggestion.suggestedText.length > 150 ? suggestion.suggestedText.slice(0, 150) + '...' : suggestion.suggestedText}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => applySuggestion(suggestion)}
                          className="flex-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Apply Alternative
                        </button>
                        <button
                          onClick={() => setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))}
                          className="px-3 py-1.5 border border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 text-xs rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai-chat' && (
          <div id="panel-ai-chat" role="tabpanel" aria-labelledby="tab-ai-chat" className="flex h-full min-h-0 flex-col">
            <div className="mb-3 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-3 dark:border-violet-900/60 dark:from-violet-950/30 dark:to-fuchsia-950/20">
              <div className="flex items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Inline Drafting Assistant</p>
                  <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-slate-300">
                    Ask for clause language, rewrite a selected passage, or tighten a risky section. Responses now separate guidance from insertion-ready contract text.
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div ref={aiChatScrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1 pb-3">
              {aiChatMessages.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-slate-400">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">Ready to improve this draft</p>
                  <p className="mt-1 max-w-[240px] mx-auto text-xs">Try a quick action or describe the exact clause, section, or rewrite you want.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {(AI_QUICK_PROMPTS[contractType?.toUpperCase() || ''] || AI_QUICK_PROMPTS.DEFAULT).map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => sendAiChatMessage(prompt)}
                        className="rounded-full bg-violet-100 px-3 py-1.5 text-xs text-violet-700 transition-colors hover:bg-violet-200 dark:bg-violet-900/50 dark:text-violet-300 dark:hover:bg-violet-900/70"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                aiChatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-[94%]">
                      {msg.role === 'user' ? (
                        <div className="rounded-2xl rounded-tr-md bg-violet-600 px-4 py-2.5 text-sm leading-6 text-white shadow-sm">
                          {renderSimpleMarkdown(msg.content)}
                        </div>
                      ) : (
                        <div className="rounded-2xl rounded-tl-md border border-gray-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                              <Brain className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-3">
                              <div>
                                {msg.title && (
                                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
                                    {msg.title}
                                  </p>
                                )}
                                {msg.content ? (
                                  <div className="text-sm leading-6 text-gray-900 dark:text-slate-100">
                                    {renderSimpleMarkdown(msg.content)}
                                  </div>
                                ) : msg.isStreaming ? (
                                  <div className="flex items-center gap-2 py-1 text-sm text-gray-500 dark:text-slate-400">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Drafting a response...
                                  </div>
                                ) : null}
                              </div>

                              {msg.followUpQuestion && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                                  <span className="font-semibold">Need one detail:</span> {msg.followUpQuestion}
                                </div>
                              )}

                              {msg.draftHtml && (
                                <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-800 dark:bg-violet-950/30">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">
                                      Suggested Contract Language
                                    </p>
                                    {msg.applyMode && msg.applyMode !== 'none' && (
                                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-violet-700 shadow-sm dark:bg-slate-800 dark:text-violet-300">
                                        {msg.applyMode === 'replace_selection' ? 'Replace selection' : 'Insert at cursor'}
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className="prose prose-sm mt-3 max-h-64 overflow-y-auto rounded-lg bg-white px-3 py-3 text-gray-900 shadow-inner dark:prose-invert dark:bg-slate-900 dark:text-slate-100"
                                    dangerouslySetInnerHTML={{ __html: normalizeAiHtml(msg.draftHtml) }}
                                  />
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      onClick={() => applyAiChatDraft(msg)}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-700"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      {msg.applyMode === 'replace_selection' ? 'Replace selection' : 'Insert into draft'}
                                    </button>
                                    <button
                                      onClick={() => copyAiChatContent(msg)}
                                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                    >
                                      Copy text
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && !msg.isStreaming && (
                        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {msg.suggestions.map((suggestion) => (
                            <button
                              key={`${msg.id}-${suggestion.value}`}
                              onClick={() => sendAiChatMessage(suggestion.value)}
                              className="shrink-0 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50 dark:border-violet-800 dark:bg-slate-800 dark:text-violet-300 dark:hover:bg-violet-950/30"
                            >
                              {suggestion.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-200 dark:border-slate-700 pt-3 mt-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiChatInput}
                  onChange={(e) => setAiChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendAiChatMessage(aiChatInput)}
                  placeholder="Ask AI to edit your contract..."
                  disabled={isAiChatStreaming}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                />
                {isAiChatStreaming ? (
                  <button
                    onClick={() => aiChatAbortRef.current?.abort()}
                    className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    aria-label="Stop AI response"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => sendAiChatMessage(aiChatInput)}
                    disabled={!aiChatInput.trim()}
                    className="p-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div id="panel-comments" role="tabpanel" aria-labelledby="tab-comments" className="h-full space-y-4 overflow-y-auto pr-1">
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
          <div id="panel-versions" role="tabpanel" aria-labelledby="tab-versions" className="h-full space-y-3 overflow-y-auto pr-1">
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

            {/* Approval History */}
            {approvalHistory.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-violet-500" />
                  Approval History
                </h4>
                <div className="space-y-2">
                  {approvalHistory.map((entry, idx) => (
                    <div
                      key={`approval-${idx}`}
                      className={`p-3 rounded-lg border text-xs ${
                        entry.action === 'APPROVED'
                          ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20'
                          : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {entry.action === 'APPROVED' ? (
                          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        )}
                        <span className={`font-medium ${
                          entry.action === 'APPROVED' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                        }`}>
                          {entry.action === 'APPROVED' ? 'Approved' : 'Rejected'}
                        </span>
                        <span className="text-gray-400 dark:text-slate-500 ml-auto">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {(entry.comment || entry.reason) && (
                        <p className="text-gray-600 dark:text-slate-300 mt-1 pl-6">
                          {entry.comment || entry.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Clause Library Tab */}
        {activeTab === 'clauses' && (
          <div id="panel-clauses" role="tabpanel" aria-labelledby="tab-clauses" className="h-full space-y-4 overflow-y-auto pr-1">
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
                <p className="text-sm font-medium">No clauses found</p>
                <p className="text-xs mt-1 text-gray-400 dark:text-slate-500">
                  {clauseSearch ? `No results for "${clauseSearch}". Try a different search term.` : 'Try changing your category filter or search above.'}
                </p>
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
                {clauses.length >= 30 && (
                  <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 pt-2">
                    Showing first 30 results — refine your search to find specific clauses
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            {/* Left: save status + risk badges */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <Clock className="h-3.5 w-3.5" />
                    <span>Saved {formatTimeSince(lastSaved)}</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5" />
                    <span>Not saved</span>
                  </>
                )}
              </div>

              {/* Risk Summary Badges */}
              {(riskSummary.critical > 0 || riskSummary.high > 0) && (
                <>
                  <div className="h-4 w-px bg-gray-200 dark:bg-slate-600" />
                  <div className="flex items-center gap-1.5">
                    {riskSummary.critical > 0 && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full text-[11px] font-medium">
                        <AlertCircle className="h-3 w-3" />
                        {riskSummary.critical}
                      </span>
                    )}
                    {riskSummary.high > 0 && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-full text-[11px] font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        {riskSummary.high}
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* Lock Indicator */}
              {lockInfo.isLocked && (
                <>
                  <div className="h-4 w-px bg-gray-200 dark:bg-slate-600" />
                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    <Lock className="h-3 w-3" />
                    <span className="hidden sm:inline">Locked{lockInfo.lockedBy ? ` by ${lockInfo.lockedBy}` : ''}</span>
                  </span>
                </>
              )}

              {/* Draft Status Badge */}
              {draftId && draftStatus !== 'DRAFT' && (
                <>
                  <div className="h-4 w-px bg-gray-200 dark:bg-slate-600 hidden sm:block" />
                  <span className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    draftStatus === 'FINALIZED' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                    draftStatus === 'IN_REVIEW' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                    draftStatus === 'APPROVED' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' :
                    draftStatus === 'PENDING_APPROVAL' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                    'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                  }`}>
                    {draftStatus === 'FINALIZED' && <CheckCircle2 className="h-3 w-3" />}
                    {draftStatus.replace('_', ' ')}
                  </span>
                </>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5">
              {/* Mobile Sidebar Toggle */}
              <button
                onClick={() => setShowMobileSidebar(true)}
                className="lg:hidden flex items-center gap-1 px-2 py-1.5 text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                aria-label="Open AI Copilot panel"
              >
                <Brain className="h-3.5 w-3.5" />
              </button>

              {/* Mode Toggle */}
              <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5" role="radiogroup" aria-label="Editor mode">
                <button
                  onClick={() => setIsEditing(true)}
                  role="radio"
                  aria-checked={isEditing}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                    isEditing ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400'
                  }`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  role="radio"
                  aria-checked={!isEditing}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                    !isEditing ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-500 dark:text-slate-400'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              </div>

              {/* Approval Actions — always visible when applicable */}
              {draftId && (draftStatus === 'IN_REVIEW' || draftStatus === 'PENDING_APPROVAL') && (
                <>
                  <button
                    onClick={() => setShowApprovalModal("approve")}
                    className="flex items-center gap-1 px-2 py-1.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg text-xs hover:bg-green-200 dark:hover:bg-green-900 transition-colors"
                    title="Approve this draft"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Approve</span>
                  </button>
                  <button
                    onClick={() => setShowApprovalModal("reject")}
                    className="flex items-center gap-1 px-2 py-1.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-xs hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
                    title="Reject this draft"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reject</span>
                  </button>
                </>
              )}

              {/* Actions dropdown — Export, Lock, Workflow, Shortcuts */}
              <div className="relative">
                <button
                  onClick={() => { setShowActionsMenu(v => !v); setShowExportMenu(false); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Actions</span>
                </button>
                {showActionsMenu && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden py-1">
                    {/* Export */}
                    <button
                      onClick={() => { handleExportPDF(); setShowActionsMenu(false); }}
                      disabled={isExporting}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <FileDown className="h-4 w-4 text-red-500" />
                      Export as PDF
                    </button>
                    <button
                      onClick={() => { handleExportDOCX(); setShowActionsMenu(false); }}
                      disabled={isExporting}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <FileDown className="h-4 w-4 text-blue-500" />
                      Export as DOCX
                    </button>

                    <div className="my-1 border-t border-gray-100 dark:border-slate-700" />

                    {/* Lock */}
                    {draftId && (
                      <button
                        onClick={() => { handleLock(lockInfo.isLocked ? 'unlock' : 'lock'); setShowActionsMenu(false); }}
                        disabled={isLocking}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        {lockInfo.isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        {lockInfo.isLocked ? 'Unlock document' : 'Lock for editing'}
                      </button>
                    )}

                    {/* Workflow Actions */}
                    {draftId && draftStatus === 'DRAFT' && (
                      <button
                        onClick={() => { setShowApprovalModal('submit_review'); setShowActionsMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <ArrowRight className="h-4 w-4" />
                        Submit for Review
                      </button>
                    )}
                    {draftId && (draftStatus === 'APPROVED' || draftStatus === 'IN_REVIEW') && (
                      <button
                        onClick={() => { handleFinalize(); setShowActionsMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Finalize as Contract
                      </button>
                    )}
                    {draftId && draftStatus === 'FINALIZED' && createdContractId && (
                      <button
                        onClick={() => { router.push(`/contracts/${createdContractId}`); setShowActionsMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                      >
                        <ArrowRight className="h-4 w-4" />
                        View Contract
                      </button>
                    )}
                    {draftId && draftStatus === 'REJECTED' && (
                      <button
                        onClick={() => { handleRevertToDraft(); setShowActionsMenu(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                      >
                        <Edit3 className="h-4 w-4" />
                        Revise Draft
                      </button>
                    )}

                    <div className="my-1 border-t border-gray-100 dark:border-slate-700" />

                    {/* Keyboard Shortcuts */}
                    <button
                      onClick={() => { setShowShortcutHelp(v => !v); setShowActionsMenu(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Keyboard className="h-4 w-4" />
                      Keyboard Shortcuts
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </button>
            </div>
          </div>

          {/* Toolbar */}
          {isEditing && (
            <div className="mt-2 flex items-center gap-0.5 pb-2 border-t border-gray-100 dark:border-slate-700 pt-2" role="toolbar" aria-label="Document formatting toolbar">
              <div className="flex items-center gap-0.5" role="group" aria-label="Text formatting">
                <button onClick={() => insertFormatting('bold')} className={`p-1.5 rounded transition-colors ${editor?.isActive('bold') ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400'}`} title="Bold" aria-label="Bold">
                  <Bold className="h-4 w-4" />
                </button>
                <button onClick={() => insertFormatting('italic')} className={`p-1.5 rounded transition-colors ${editor?.isActive('italic') ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400'}`} title="Italic" aria-label="Italic">
                  <Italic className="h-4 w-4" />
                </button>
                <button onClick={() => insertFormatting('underline')} className={`p-1.5 rounded transition-colors ${editor?.isActive('underline') ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400'}`} title="Underline" aria-label="Underline">
                  <Underline className="h-4 w-4" />
                </button>
              </div>
              <div className="h-4 w-px bg-gray-200 dark:bg-slate-700 mx-1" />
              <div className="flex items-center gap-0.5" role="group" aria-label="Headings">
                <button onClick={() => insertFormatting('h1')} className={`p-1.5 rounded transition-colors ${editor?.isActive('heading', { level: 1 }) ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400'}`} title="Heading 1" aria-label="Heading 1">
                  <Heading1 className="h-4 w-4" />
                </button>
                <button onClick={() => insertFormatting('h2')} className={`p-1.5 rounded transition-colors ${editor?.isActive('heading', { level: 2 }) ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400'}`} title="Heading 2" aria-label="Heading 2">
                  <Heading2 className="h-4 w-4" />
                </button>
              </div>
              <div className="h-4 w-px bg-gray-200 dark:bg-slate-700 mx-1" />
              <div className="flex items-center gap-0.5" role="group" aria-label="Block elements">
                <button onClick={() => insertFormatting('list')} className={`p-1.5 rounded transition-colors ${editor?.isActive('bulletList') ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400'}`} title="List" aria-label="List">
                  <List className="h-4 w-4" />
                </button>
                <button onClick={() => insertFormatting('quote')} className={`p-1.5 rounded transition-colors ${editor?.isActive('blockquote') ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400'}`} title="Quote" aria-label="Quote">
                  <Quote className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1" />

              {/* Copilot status + AI Assist */}
              <div className="flex items-center gap-2">
                {isLoadingSuggestions && (
                  <span className="flex items-center gap-1 text-[11px] text-violet-600 dark:text-violet-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </span>
                )}
                {suggestions.length > 0 && (
                  <span className="text-[11px] text-gray-400 dark:text-slate-500 hidden sm:inline tabular-nums">
                    {suggestions.length} suggestions
                  </span>
                )}
                <button
                  onClick={() => setActiveTab('ai-chat')}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 transition-colors"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  AI Assist
                </button>
              </div>
            </div>
          )}

          {/* AI Assist button in preview mode */}
          {!isEditing && (
            <div className="mt-2 flex justify-end pb-2 border-t border-gray-100 dark:border-slate-700 pt-2">
              <button
                onClick={() => setActiveTab('ai-chat')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 transition-colors"
              >
                <Wand2 className="h-3.5 w-3.5" />
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
        <div className="hidden lg:flex w-80 xl:w-96 flex-col bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 min-h-[calc(100vh-120px)]">
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
                <div className="h-[calc(100vh-56px)] min-h-0">
                  {renderSidebarContent()}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ── Approval / Rejection Modal ── */}
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                {showApprovalModal === 'approve' ? 'Approve Draft' : showApprovalModal === 'reject' ? 'Reject Draft' : 'Submit for Review'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                {showApprovalModal === 'approve'
                  ? 'Are you sure you want to approve this draft? You may add an optional comment.'
                  : showApprovalModal === 'reject'
                  ? 'Please provide a reason for rejection.'
                  : 'Once submitted, the draft will be locked for review. Reviewers will be able to approve or request changes.'}
              </p>
              {showApprovalModal !== 'submit_review' && (
              <textarea
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder={showApprovalModal === 'approve' ? 'Optional approval comment...' : 'Reason for rejection...'}
                rows={4}
                className={`w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 ${showApprovalModal === 'approve' ? 'focus:ring-green-500' : 'focus:ring-red-500'} resize-none`}
              />
              )}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => { setShowApprovalModal(null); setApprovalComment(''); }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {showApprovalModal === 'approve' ? (
                  <button
                    onClick={() => { handleApprove(); }}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Approve
                  </button>
                ) : showApprovalModal === 'reject' ? (
                  <button
                    onClick={() => { handleReject(); }}
                    disabled={!approvalComment.trim()}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                ) : (
                  <button
                    onClick={() => { handleStatusChange('IN_REVIEW'); setShowApprovalModal(null); }}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Submit for Review
                  </button>
                )}
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
              className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-[1600px] max-h-[90vh] overflow-auto"
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
                  { keys: 'Ctrl + /', action: 'Toggle AI Chat' },
                  { keys: 'Ctrl + Space', action: 'Trigger auto-complete' },
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
