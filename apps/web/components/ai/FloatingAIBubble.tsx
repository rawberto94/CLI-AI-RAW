/**
 * Floating AI Bubble - Next-Gen AI Assistant Interface
 * Production-ready floating chatbot with complete feature set
 * 
 * Now with database-backed conversation persistence!
 */

"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  X,
  Sparkles,
  FileText,
  TrendingUp,
  Calendar,
  Search,
  Loader2,
  Minimize2,
  Maximize2,
  Bot,
  Zap,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  Download,
  Settings,
  Keyboard,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  ExternalLink,
  Shield,
  DollarSign,
  RefreshCw,
  Building2,
  History,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useChatPersistence } from "@/hooks/useChatPersistence";
import { toast } from "sonner";

// Enhanced AI Features - Round 2 Integration
import { AIErrorBoundary } from "@/components/ai/AIErrorBoundary";
import { MarkdownContent } from "@/components/ai/MarkdownContent";
import { useOfflineQueue } from "@/lib/ai/offline-queue.service";
import { ExportChatDialog } from "@/components/ai/ExportChatDialog";
import { InlineUsageIndicator } from "@/components/ai/AIUsageQuotaWidget";
import { ChatHistorySearch } from "@/components/ai/ChatHistorySearch";
import { OfflineStatusIndicator } from "@/components/ai/OfflineStatusIndicator";

// Round 3 Enhancements
import { AIFeedbackDialog } from "@/components/ai/AIFeedbackDialog";
import { ConversationHistoryPanel } from "@/components/ai/ConversationHistoryPanel";
import { AICostWidget, calculateCost } from "@/components/ai/AICostWidget";
import { useVoiceInput } from "@/hooks/useVoiceInput";

// Types
interface ContractPreviewCard {
  id: string;
  name: string;
  supplier?: string;
  status?: string;
  value?: number;
  expirationDate?: string;
  daysUntilExpiry?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  type?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  suggestions?: string[];
  actions?: ActionButton[];
  status?: "sending" | "sent" | "error";
  reaction?: "like" | "dislike";
  contractPreviews?: ContractPreviewCard[];
  clarificationNeeded?: boolean;
  clarificationPrompts?: string[];
  toolProgress?: ToolProgressEntry[];
  toolPreviews?: ToolPreviewEntry[];
  planSteps?: PlanStep[];
  selfCritique?: { score: number; note: string; grounded: boolean };
  metadata?: {
    source?: string;
    confidence?: number;
    processingTime?: number;
    ragSources?: RAGSource[];
    usedRAG?: boolean;
    intent?: string;
    isError?: boolean;
    toolsUsed?: string[];
  };
}

interface ToolPreviewEntry {
  toolName: string;
  preview: {
    type: string;
    title?: string;
    items?: Array<Record<string, unknown>>;
    count?: number;
    [key: string]: unknown;
  };
}

interface PlanStep {
  step: number;
  description: string;
  status?: string;
}

interface ToolProgressEntry {
  toolName: string;
  status: 'running' | 'done' | 'error';
  summary?: string;
  navigation?: { url: string; label: string };
  executionTimeMs?: number;
}

interface RAGSource {
  contractId: string;
  contractName: string;
  score: number;
  snippet?: string;
  heading?: string;
  section?: string;
  startOffset?: number;
  endOffset?: number;
  matchType?: string;
}

interface ActionButton {
  label: string;
  action: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "primary" | "danger";
}

interface ConversationContext {
  lastTopic?: string;
  mentionedContracts?: string[];
  userIntent?: string;
}

// Constants
const QUICK_ACTIONS = [
  {
    icon: FileText,
    label: "Contract Summary",
    query: "Give me a summary of my contracts",
    color: "from-violet-500 to-purple-500",
    description: "Overview of all contracts",
  },
  {
    icon: Calendar,
    label: "Renewals",
    query: "What contracts are expiring soon?",
    color: "from-orange-500 to-amber-500",
    description: "Upcoming renewal dates",
  },
  {
    icon: TrendingUp,
    label: "Insights",
    query: "Show me portfolio insights",
    color: "from-blue-500 to-indigo-500",
    description: "Analytics & trends",
  },
  {
    icon: Search,
    label: "Search",
    query: "Help me find a specific contract",
    color: "from-cyan-500 to-blue-500",
    description: "Find contracts quickly",
  },
];

const KEYBOARD_SHORTCUTS = [
  { key: "⌘/Ctrl + /", action: "Open AI Assistant" },
  { key: "Escape", action: "Close chat" },
  { key: "⌘/Ctrl + Enter", action: "Send message" },
  { key: "⌘/Ctrl + L", action: "Clear chat" },
];

// Example prompts to show users what's possible
const EXAMPLE_PROMPTS = [
  {
    category: "Analysis",
    icon: TrendingUp,
    prompts: [
      "Summarize all Deloitte contracts from 2024",
      "What's our total contract value by supplier?",
    ],
  },
  {
    category: "Compare",
    icon: DollarSign,
    prompts: [
      "Compare Deloitte vs Accenture contracts",
      "Compare payment terms in IBM and Oracle contracts",
    ],
  },
  {
    category: "Risk & Renewals",
    icon: Shield,
    prompts: [
      "What contracts expire in the next 30 days?",
      "Which contracts are high risk?",
    ],
  },
];

const INITIAL_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "👋 Hi! I'm **ConTigo AI**, your contract assistant.\n\nI can **search**, **analyze**, **compare** contracts, and flag **risks** or **renewals**.\n\nTry asking a question or click a suggestion below!",
  timestamp: new Date(),
  suggestions: ["📊 Contract summary", "⏰ Expiring soon", "🔄 Compare suppliers"],
  metadata: {
    confidence: 1,
    source: "system",
  },
};

// Slash commands: typed as "/cmd " expand to a templated prompt.
const SLASH_COMMANDS: Array<{ cmd: string; label: string; prompt: string }> = [
  { cmd: "/summarize", label: "Summarize", prompt: "Summarize this contract in 5 concise bullet points covering parties, scope, term, value, and key risks." },
  { cmd: "/risks", label: "Top risks", prompt: "Identify the top 5 risks in this contract, ranked by severity, with a one-line explanation and suggested mitigation for each." },
  { cmd: "/clauses", label: "Clause list", prompt: "List every material clause in this contract grouped by category (commercial, legal, IP, data, termination, other)." },
  { cmd: "/obligations", label: "Obligations", prompt: "List every obligation for each party, including deadlines, deliverables, and penalties for non-performance." },
  { cmd: "/dates", label: "Key dates", prompt: "Extract all key dates and deadlines (effective date, term, renewal, milestones, payment due, termination notice)." },
  { cmd: "/parties", label: "Parties", prompt: "Who are the parties to this contract, their legal entities, roles, and any affiliates referenced?" },
  { cmd: "/financial", label: "Financial terms", prompt: "Summarize all financial terms: total value, payment schedule, invoicing, price escalation, penalties, and any caps or credits." },
  { cmd: "/compare", label: "Benchmark", prompt: "Compare this contract's key terms to market standards for its category and flag any terms that deviate significantly." },
];

// Utility to format markdown-like content with XSS protection
const sanitizeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatContent = (content: string) => {
  const sanitized = sanitizeHtml(content);
  return sanitized
    // Convert markdown links [text](/path) to clickable links
    .replace(/\[([^\]]+)\]\(\/contracts\/([^)]+)\)/g, 
      '<a href="/contracts/$2" class="text-violet-600 hover:text-violet-800 underline font-medium" target="_blank" rel="noopener noreferrer">$1</a>')
    // Convert other markdown links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, 
      '<a href="$2" class="text-violet-600 hover:text-violet-800 underline" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\n/g, "<br />");
};

/** Format a snake_case tool name into a human-friendly label */
function formatToolName(name: string): string {
  const labels: Record<string, string> = {
    search_contracts: '🔍 Searching contracts',
    get_contract_details: '📄 Loading contract',
    list_expiring_contracts: '📅 Checking expirations',
    get_spend_analysis: '💰 Analyzing spend',
    get_risk_assessment: '🔴 Assessing risk',
    get_supplier_info: '🏢 Looking up supplier',
    start_workflow: '▶️ Starting workflow',
    list_workflows: '📋 Loading workflows',
    get_pending_approvals: '⏳ Checking approvals',
    approve_or_reject_step: '✅ Processing approval',
    create_contract: '📝 Creating contract',
    update_contract: '✏️ Updating contract',
    navigate_to_page: '🔗 Navigating',
    get_compliance_summary: '✅ Checking compliance',
    get_contract_stats: '📊 Loading statistics',
    get_intelligence_insights: '🧠 Loading AI insights',
  };
  return labels[name] || name.replace(/_/g, ' ');
}

// Get page context for better RAG targeting
function getPageContext(pathname: string | null): string {
  if (!pathname) return 'dashboard';
  
  if (pathname.includes('/contigo-labs')) return 'contigo-labs';
  if (pathname.includes('/intelligence/graph')) return 'intelligence-knowledge-graph';
  if (pathname.includes('/intelligence/health')) return 'intelligence-health-scores';
  if (pathname.includes('/intelligence/search')) return 'intelligence-rag-search';
  if (pathname.includes('/intelligence/negotiate')) return 'intelligence-negotiation';
  if (pathname.includes('/intelligence')) return 'intelligence-hub';
  if (pathname.includes('/self-service')) return 'self-service';
  if (pathname.includes('/ecosystem')) return 'ecosystem';
  if (pathname.includes('/governance') || pathname === '/compliance' || pathname === '/risk') return 'governance';
  if (pathname === '/admin') return 'administration';
  if (pathname.includes('/contracts/') && pathname.includes('/redline')) return 'contract-redline';
  if (pathname.includes('/contracts/') && pathname.includes('/sign')) return 'contract-signatures';
  if (pathname.includes('/contracts/') && pathname.includes('/store')) return 'contract-storage';
  if (pathname.includes('/contracts/') && pathname.includes('/versions')) return 'contract-versions';
  if (pathname.match(/\/contracts\/[^\/]+$/)) return 'contract-detail';
  if (pathname === '/contracts') return 'contracts-list';
  if (pathname === '/workflows') return 'workflows';
  if (pathname === '/renewals') return 'renewals';
  if (pathname === '/analytics') return 'analytics';
  if (pathname === '/suppliers') return 'suppliers';
  if (pathname === '/templates') return 'templates';
  if (pathname === '/settings') return 'settings';
  
  return 'dashboard';
}

// Format time ago for artifact sync display
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  return `${Math.floor(hours / 24)}d ago`;
}
const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

function toSuperscriptNumber(value: number): string {
  return String(value)
    .split("")
    .map((digit) => SUPERSCRIPT_DIGITS[digit] ?? digit)
    .join("");
}

interface FloatingAIBubbleProps {
  mode?: 'floating' | 'embedded';
}

export function FloatingAIBubble({ mode = 'floating' }: FloatingAIBubbleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEmbedded = mode === 'embedded';
  
  // Contract ID override from openAIChatbot events (e.g. contracts list "Ask AI")
  const [eventContractId, setEventContractId] = useState<string | null>(null);

  // Extract contract ID from current page URL
  const urlContractId = useMemo(() => {
    // Check if we're on a contract detail page: /contracts/[id]
    const contractMatch = pathname?.match(/\/contracts\/([^\/]+)/);
    if (contractMatch) return contractMatch[1];
    
    // Check query params for contractId
    const queryContractId = searchParams?.get('contractId');
    if (queryContractId) return queryContractId;
    
    return null;
  }, [pathname, searchParams]);

  // URL contract takes precedence; event-provided contractId used as fallback
  const currentContractId = urlContractId || eventContractId;

  // Clear event contractId when navigating to a different page
  useEffect(() => {
    if (urlContractId) setEventContractId(null);
  }, [urlContractId]);

  // Chat persistence - database-backed with localStorage fallback
  const persistence = useChatPersistence({
    context: currentContractId || undefined,
    contextType: currentContractId ? 'contract' : 'global',
  });

  // Conversation persistence key (for backward compatibility)
  const STORAGE_KEY = 'contigo-chat-history';
  const MAX_STORED_MESSAGES = 50; // Limit stored messages to prevent storage bloat
  
  // Core state
  const [isOpen, setIsOpen] = useState(isEmbedded);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  // Slash commands (Round 7): expand /cmd into templated prompts
  const [slashIndex, setSlashIndex] = useState(0);
  // Conversation history panel - implemented in Round 3
  
  // Draggable position state
  const [position, setPosition] = useState({ x: 0, y: 0 }); // Offset from default position (bottom-right)
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  
  // Enhanced features state
  const [isListening, setIsListening] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [conversationContext, setConversationContext] = useState<ConversationContext>({});
  const [isTyping, setIsTyping] = useState(false);
  
  // Artifact context state - for real-time updates
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [lastArtifactUpdate, setLastArtifactUpdate] = useState<Date | null>(null);
  
  // Enhanced features - Round 2
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [activeCitationPreview, setActiveCitationPreview] = useState<{ source: RAGSource; index: number } | null>(null);

  const buildCitationHref = useCallback((citation: { source: RAGSource; index: number }) => {
    const isCurrentContractPage = pathname === `/contracts/${citation.source.contractId}`;
    const next = new URLSearchParams(isCurrentContractPage ? (searchParams?.toString() || "") : "");

    next.set("tab", "details");
    next.set("cite", "1");
    next.set("citeIndex", String(citation.index));

    if (citation.source.heading) next.set("citeHeading", citation.source.heading);
    else next.delete("citeHeading");

    if (citation.source.section) next.set("citeSection", citation.source.section);
    else next.delete("citeSection");

    if (typeof citation.source.startOffset === "number") next.set("citeStart", String(citation.source.startOffset));
    else next.delete("citeStart");

    if (typeof citation.source.endOffset === "number") next.set("citeEnd", String(citation.source.endOffset));
    else next.delete("citeEnd");

    if (citation.source.snippet) next.set("citeSnippet", citation.source.snippet.slice(0, 320));
    else next.delete("citeSnippet");

    return `/contracts/${citation.source.contractId}?${next.toString()}`;
  }, [pathname, searchParams]);

  const openCitationInContract = useCallback((citation: { source: RAGSource; index: number }) => {
    router.push(buildCitationHref(citation));
    setActiveCitationPreview(null);
    if (!isEmbedded) setIsOpen(false);
  }, [buildCitationHref, isEmbedded, router]);

  const handleInlineCitationClick = useCallback((
    href: string,
    sources: RAGSource[] | undefined,
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    if (!sources?.length) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

    const url = new URL(href, window.location.origin);
    if (url.searchParams.get('cite') !== '1') return false;

    const index = Number.parseInt(url.searchParams.get('citeIndex') ?? '', 10);
    if (!Number.isFinite(index) || index < 1 || index > sources.length) return false;

    setActiveCitationPreview({ source: sources[index - 1], index });
    return true;
  }, []);
  
  // Round 3 Enhancements - New State
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);
  // Round 4 Enhancements - Model picker, title rename
  const [chatMode, setChatMode] = useState<'fast' | 'balanced' | 'deep'>(() => {
    if (typeof window === 'undefined') return 'balanced';
    const saved = window.localStorage.getItem('contigo-chat-mode');
    return (saved === 'fast' || saved === 'deep' || saved === 'balanced') ? saved : 'balanced';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('contigo-chat-mode', chatMode);
    }
  }, [chatMode]);
  const [persona, setPersona] = useState<'default' | 'analyst' | 'counsel' | 'executive'>(() => {
    if (typeof window === 'undefined') return 'default';
    const saved = window.localStorage.getItem('contigo-chat-persona');
    return (saved === 'analyst' || saved === 'counsel' || saved === 'executive') ? saved : 'default';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('contigo-chat-persona', persona);
  }, [persona]);
  const [perspective, setPerspective] = useState<'self' | 'counterparty'>(() => {
    if (typeof window === 'undefined') return 'self';
    const saved = window.localStorage.getItem('contigo-chat-perspective');
    return saved === 'counterparty' ? 'counterparty' : 'self';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('contigo-chat-perspective', perspective);
  }, [perspective]);
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set());
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false);
  const LONG_MESSAGE_THRESHOLD = 1200;
  const toggleMessageExpanded = useCallback((messageId: string) => {
    setExpandedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);
  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`chat-msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-violet-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-violet-400'), 1800);
    }
  }, []);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem('contigo-chat-bookmarks');
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });
  const toggleBookmark = useCallback((messageId: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
        toast.success('Bookmark removed');
      } else {
        next.add(messageId);
        toast.success('Message bookmarked');
      }
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('contigo-chat-bookmarks', JSON.stringify(Array.from(next)));
        } catch { /* quota exceeded */ }
      }
      return next;
    });
  }, []);

  // Safety appeal: captured when server returns 400 with guardrail: true
  const [safetyAppeal, setSafetyAppeal] = useState<{
    reason: string;
    category?: string;
    originalMessage: string;
  } | null>(null);
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const submitSafetyAppeal = useCallback(async (notes: string) => {
    if (!safetyAppeal) return;
    setAppealSubmitting(true);
    try {
      await fetch('/api/ai/safety-appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalMessage: safetyAppeal.originalMessage,
          reason: safetyAppeal.reason,
          category: safetyAppeal.category,
          userNotes: notes,
        }),
      }).catch(() => {
        // Endpoint may not exist yet; fall back to console
        console.warn('[SafetyAppeal] /api/ai/safety-appeal not reachable');
      });
      toast.success('Appeal submitted — our team will review it.');
      setSafetyAppeal(null);
    } catch (err) {
      toast.error('Failed to submit appeal');
    } finally {
      setAppealSubmitting(false);
    }
  }, [safetyAppeal]);
  const toggleReadAloud = useCallback((messageId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Speech not supported in this browser');
      return;
    }
    const synth = window.speechSynthesis;
    if (speakingMessageId === messageId) {
      synth.cancel();
      setSpeakingMessageId(null);
      return;
    }
    synth.cancel();
    // Strip markdown for cleaner TTS
    const clean = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[*_#>`[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.0;
    u.pitch = 1.0;
    u.onend = () => setSpeakingMessageId((cur) => (cur === messageId ? null : cur));
    u.onerror = () => setSpeakingMessageId((cur) => (cur === messageId ? null : cur));
    setSpeakingMessageId(messageId);
    synth.speak(u);
  }, [speakingMessageId]);
  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);
  const [currentTokenUsage, setCurrentTokenUsage] = useState<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model: string;
    cost: number;
  } | null>(null);
  const [useStreaming, setUseStreaming] = useState(true);
  
  // Voice input hook - enhanced version
  const voiceInput = useVoiceInput({
    onTranscriptChange: (transcript) => {
      if (transcript && transcript.trim()) {
        setInput(transcript);
      }
    },
    continuous: false,
  });
  
  // Offline queue integration
  const offlineQueue = useOfflineQueue();
  
  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const pendingAutoMessageRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Accessibility: detect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Accessibility: focus trap when chat is open
  useEffect(() => {
    if (!isOpen || isEmbedded) return;
    const panel = chatPanelRef.current;
    if (!panel) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener("keydown", handleKeyDown);
    // Focus the input when opening
    setTimeout(() => inputRef.current?.focus(), 100);
    return () => panel.removeEventListener("keydown", handleKeyDown);
  }, [isEmbedded, isOpen]);

  // Abort in-flight SSE stream on component unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);
  
  // Request cancellation support
  const cancelCurrentRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setIsTyping(false);
    }
  }, []);

  // Sync messages with persistence hook
  useEffect(() => {
    if (persistence.messages.length > 0 && !persistence.isLoading) {
      // Convert persistence messages to local Message format
      const restoredMessages = persistence.messages.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
        suggestions: m.suggestions || [],
        actions: m.actions || [],
      })) as Message[];
      
      // Add initial welcome message if not present
      const hasWelcome = restoredMessages.some(m => m.id === 'welcome' || m.id === 'initial');
      if (!hasWelcome) {
        setMessages([INITIAL_MESSAGE, ...restoredMessages]);
      } else {
        setMessages(restoredMessages);
      }
      
      // Restore conversation context from last messages
      const lastUserMessage = restoredMessages.filter((m) => m.role === 'user').slice(-1)[0];
      if (lastUserMessage) {
        setConversationContext(prev => ({
          ...prev,
          lastTopic: lastUserMessage.content?.slice(0, 100),
        }));
      }
    }
  }, [persistence.messages, persistence.isLoading]);

  // Fallback: Load conversation history from localStorage on mount (for offline/unauthenticated)
  useEffect(() => {
    if (!persistence.isAuthenticated && persistence.messages.length === 0) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Restore messages, converting timestamps back to Date objects
            const restoredMessages = parsed.map((m: Message) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            }));
            // Keep initial message if history was cleared, or append restored history
            // Filter out both 'initial' and 'welcome' to avoid duplicate welcome messages
            setMessages([INITIAL_MESSAGE, ...restoredMessages.filter((m: Message) => m.id !== 'initial' && m.id !== 'welcome')]);
            
            // Restore conversation context from last messages
            const lastUserMessage = restoredMessages.filter((m: Message) => m.role === 'user').slice(-1)[0];
            if (lastUserMessage) {
              setConversationContext(prev => ({
                ...prev,
                lastTopic: lastUserMessage.content?.slice(0, 100),
              }));
            }
          }
        }
      } catch {
        // Failed to restore chat history, starting fresh
      }
    }
  }, [persistence.isAuthenticated, persistence.messages.length]);

  // Save conversation history to localStorage when messages change (fallback for unauthenticated)
  useEffect(() => {
    if (!persistence.isAuthenticated) {
      try {
        // Only save non-initial messages, and limit to MAX_STORED_MESSAGES
        const toStore = messages
          .filter(m => m.id !== 'initial' && m.id !== 'welcome')
          .slice(-MAX_STORED_MESSAGES);
        
        if (toStore.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
        }
      } catch {
        // Failed to save chat history
      }
    }
  }, [messages, persistence.isAuthenticated]);

  // Listen for artifact updates and refresh context
  useEffect(() => {
    const handleArtifactUpdate = (event: CustomEvent) => {
      const { contractId: updatedContractId, type: artifactType } = event.detail || {};
      
      // If we're viewing the same contract that was updated, refresh our context
      if (currentContractId && updatedContractId === currentContractId) {
        setArtifactVersion(v => v + 1);
        setLastArtifactUpdate(new Date());
        
        // Add a system message to notify user of updated data
        const updateMessage: Message = {
          id: `system-update-${Date.now()}`,
          role: 'system',
          content: `📊 **Contract data updated!** ${artifactType ? `The ${artifactType.toLowerCase()} analysis has been refreshed.` : 'New analysis available.'} My responses now include the latest extracted information.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, updateMessage]);
      }
    };
    
    // Listen for real-time artifact updates
    const realtimeHandler = ((e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === 'artifact:updated') {
        handleArtifactUpdate(customEvent);
      }
    }) as EventListener;
    
    window.addEventListener('realtime-event', realtimeHandler);
    
    // Also listen for custom artifact update events
    window.addEventListener('artifact-updated', handleArtifactUpdate as EventListener);
    
    return () => {
      window.removeEventListener('realtime-event', realtimeHandler);
      window.removeEventListener('artifact-updated', handleArtifactUpdate as EventListener);
    };
  }, [currentContractId]);

  // Scroll to bottom on new messages — but respect user scroll-up
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  useEffect(() => {
    if (scrollRef.current && !isScrolledUp) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isScrolledUp]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsScrolledUp(distFromBottom > 120);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isOpen]);
  const jumpToLatest = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      setIsScrolledUp(false);
    }
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Cmd/Ctrl + /
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        if (isEmbedded) {
          inputRef.current?.focus();
          return;
        }
        setIsOpen((prev) => !prev);
      }
      // Close with Escape
      if (!isEmbedded && e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setIsExpanded(false);
      }
      // Clear with Cmd/Ctrl + L
      if ((e.metaKey || e.ctrlKey) && e.key === "l" && isOpen) {
        e.preventDefault();
        handleClearChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    
  }, [isEmbedded, isOpen]);

  // Draggable functionality - handlers for mouse/touch events
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Don't start drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, input, a, [role="button"]')) {
      return;
    }
    
    e.preventDefault();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    // Calculate new position (negative because we're offsetting from bottom-right)
    const newX = dragStartRef.current.posX - deltaX;
    const newY = dragStartRef.current.posY - deltaY;
    
    // Clamp to screen bounds with some padding
    const maxX = window.innerWidth - 100;
    const maxY = window.innerHeight - 100;
    
    setPosition({
      x: Math.max(-maxX + 80, Math.min(maxX - 80, newX)),
      y: Math.max(-maxY + 80, Math.min(maxY - 80, newY)),
    });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach global drag listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Reset position when expanded (fullscreen mode)
  useEffect(() => {
    if (isExpanded) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isExpanded]);

  // Listen for custom event to open chatbot from other components
  useEffect(() => {
    const handleOpenChatbot = (event: Event) => {
      const customEvent = event as CustomEvent<{ autoMessage?: string; section?: string; contractId?: string }>;
      
      // If an autoMessage is provided, store it and trigger when chat opens
      if (customEvent.detail?.autoMessage) {
        pendingAutoMessageRef.current = customEvent.detail.autoMessage;
      }
      
      // Capture contractId from event so the chatbot has contract context
      // even when not on the contract detail page (e.g. from contracts list)
      if (customEvent.detail?.contractId) {
        setEventContractId(customEvent.detail.contractId);
      }
      
      setIsOpen(true);
    };

    window.addEventListener("openAIChatbot", handleOpenChatbot);
    return () => window.removeEventListener("openAIChatbot", handleOpenChatbot);
  }, []);

  // Process pending auto-message when chat opens — auto-send it
  useEffect(() => {
    if (isOpen && pendingAutoMessageRef.current && !isLoading) {
      const autoMessage = pendingAutoMessageRef.current;
      pendingAutoMessageRef.current = null; // Clear the ref
      
      // Small delay to ensure chat is fully rendered, then send
      const timer = setTimeout(() => {
        if (sendMsgRef.current) {
          sendMsgRef.current(autoMessage);
        } else {
          setInput(autoMessage);
        }
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, isLoading]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionAPI) return;
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? '')
          .join("");
        setInput(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Play sound effect
  const playSound = useCallback((_type: "send" | "receive" | "error") => {
    if (!isSoundEnabled) return;
    // Sound effects would be implemented here with Web Audio API
  }, [isSoundEnabled]);

  // Toggle voice input - using enhanced useVoiceInput hook
  const toggleVoiceInput = useCallback(() => {
    if (voiceInput.isListening) {
      voiceInput.stopListening();
      setIsListening(false);
    } else {
      voiceInput.startListening();
      setIsListening(true);
    }
  }, [voiceInput]);

  // Sync voice input listening state
  useEffect(() => {
    setIsListening(voiceInput.isListening);
  }, [voiceInput.isListening]);

  const { copy } = useCopyToClipboard({ successMessage: 'Message copied!' });

  // Copy message to clipboard
  const copyMessage = useCallback(async (id: string, content: string) => {
    const success = await copy(content);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, [copy]);

  // React to message
  const reactToMessage = useCallback((id: string, reaction: "like" | "dislike") => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id
          ? { ...msg, reaction: msg.reaction === reaction ? undefined : reaction }
          : msg
      )
    );
    // Persist reaction to database
    persistence.updateMessage(id, { reaction: reaction });
  }, [persistence]);

  // Clear chat (including localStorage and database)
  const handleClearChat = useCallback(async () => {
    setMessages([INITIAL_MESSAGE]);
    setConversationContext({});
    localStorage.removeItem(STORAGE_KEY);
    // Create new conversation in database
    if (persistence.isAuthenticated) {
      await persistence.createConversation();
    }
  }, [persistence]);

  // Export chat (legacy - kept for reference, now uses ExportChatDialog)
  const _exportChat = useCallback(() => {
    const chatContent = messages
      .map((m) => `[${m.timestamp.toLocaleString()}] ${m.role}: ${m.content}`)
      .join("\n\n");
    
    const blob = new Blob([chatContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  // Forward ref for handleSendMessage (declared below due to hook ordering)
  const sendMsgRef = useRef<(content?: string) => void>(() => {});

  // Safe wrapper — prevents concurrent requests when an action triggers while loading
  const safeSendMsg = useCallback((content: string) => {
    if (isLoading) return; // Prevent overlapping requests from action buttons
    sendMsgRef.current(content);
  }, [isLoading]);

  // Handle action button clicks — routes all action types from response-builder
  const handleAction = useCallback((action: string) => {
    // Handle dynamic contract-specific actions (e.g., "view-contract:abc-123")
    if (action.startsWith("view-contract:")) {
      const contractId = action.replace("view-contract:", "");
      router.push(`/contracts/${contractId}`);
      if (!isEmbedded) setIsOpen(false);
      return;
    }

    if (action.startsWith("navigate:")) {
      const target = action.slice("navigate:".length).trim();
      if (target) {
        router.push(target);
        if (!isEmbedded) setIsOpen(false);
      }
      return;
    }

    switch (action) {
      // Navigation actions
      case "view-contracts":
      case "search-contracts":
        router.push("/contracts");
        if (!isEmbedded) setIsOpen(false);
        break;
      case "view-renewals":
        router.push("/renewals");
        if (!isEmbedded) setIsOpen(false);
        break;
      case "view-analytics":
      case "supplier-analytics":
      case "view-dashboard":
        router.push("/analytics");
        if (!isEmbedded) setIsOpen(false);
        break;

      // Chat-driven actions — re-send as a message to the AI
      case "set-reminder":
      case "set-reminders":
        safeSendMsg("Set a reminder for upcoming renewals");
        break;
      case "start-renewal":
        safeSendMsg("Start the renewal process for expiring contracts");
        break;
      case "notify-stakeholders":
        safeSendMsg("Notify relevant stakeholders about upcoming contract renewals");
        break;
      case "deep-analysis":
        safeSendMsg("Perform a deep analysis on the contracts we just discussed");
        break;
      case "generate-report":
        safeSendMsg("Generate a detailed report on this analysis");
        break;
      case "refine-search":
        safeSendMsg("Help me refine my search with more specific criteria");
        break;
      case "export-list":
        safeSendMsg("Export the list of contracts we just discussed");
        break;

      default:
        // Unknown action — try sending it as a natural language query
        if (action) {
          safeSendMsg(action.replace(/-/g, " "));
        }
        break;
    }
  }, [isEmbedded, router, safeSendMsg]);

  // Constants for request handling
  const REQUEST_TIMEOUT_MS = 60000; // 60 seconds
  const MAX_RETRIES = 2;

  // Send message handler with streaming support, timeout, retry, and model failover
  const handleSendMessage = useCallback(async (content?: string, retryCount = 0) => {
    const messageContent = content || input.trim();
    if (!messageContent || isLoading) return;

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
      status: "sending",
    };

    // Only add user message on first attempt
    if (retryCount === 0) {
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
    }
    
    setIsLoading(true);
    setIsTyping(true);
    
    if (retryCount === 0) {
      playSound("send");
    }

    // User message persistence is handled server-side in the streaming route
    // to avoid duplicate writes and orphan conversations.

    // Update message status
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === userMessage.id ? { ...m, status: "sent" } : m))
      );
    }, 300);

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, REQUEST_TIMEOUT_MS);

    try {
      const startTime = Date.now();
      const pageContext = getPageContext(pathname);
      
      // Create a placeholder message for streaming
      const assistantMessageId = (Date.now() + 1).toString();
      
      if (useStreaming) {
        // Use streaming endpoint for real-time response
        const response = await fetch('/api/ai/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal, // Add abort signal for timeout/cancellation
          body: JSON.stringify({
            message: messageContent,
            conversationHistory: messages
              .filter(m => m.role === 'user' || m.role === 'assistant')
              .slice(-10)
              .map(m => ({
                role: m.role,
                content: m.content,
              })),
            context: {
              ...conversationContext,
              conversationId: persistence.conversationId || undefined,
              contractId: currentContractId,
              context: currentContractId ? 'contract-detail' : 'global',
              pageContext,
              currentPage: pathname,
              artifactVersion,
              forceRefresh: artifactVersion > 0,
              mode: chatMode,
              persona: persona === 'default' ? undefined : persona,
              perspective: perspective === 'self' ? undefined : perspective,
            },
            useRAG: true,
          }),
        });

        if (!response.ok) {
          // Try to parse error body for specific error types
          let errorBody: { error?: string; message?: string; guardrail?: boolean; category?: string } | null = null;
          try {
            errorBody = await response.clone().json();
          } catch { /* ignore parse errors */ }

          // Guardrail (safety filter) — surface the appeal modal
          if (errorBody?.guardrail) {
            setSafetyAppeal({
              reason: errorBody.error || errorBody.message || 'Message blocked by safety filter.',
              category: errorBody.category,
              originalMessage: messageContent,
            });
            // Reset loading state without throwing
            setIsLoading(false);
            setIsTyping(false);
            return;
          }

          // Don't retry non-transient errors (AI not configured, bad request, etc.)
          const isNonTransient = response.status === 503 || response.status === 400 ||
            errorBody?.error === 'AI_NOT_CONFIGURED';

          if (!isNonTransient && response.status >= 500 && retryCount < MAX_RETRIES) {
            clearTimeout(timeoutId);
            const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 5000);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            return await handleSendMessage(messageContent, retryCount + 1);
          }

          // Use server-provided message if available
          const errorMessage = errorBody?.message || errorBody?.error || `Stream request failed: ${response.status}`;
          throw new Error(errorMessage);
        }

        // Add placeholder for streaming message
        setMessages((prev) => [...prev, {
          id: assistantMessageId,
          role: "assistant" as const,
          content: "",
          timestamp: new Date(),
          metadata: { source: "streaming", confidence: 0.95 },
        }]);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let finalMetadata: Record<string, unknown> = {};
        // Buffer for incomplete SSE lines split across ReadableStream chunks
        let lineBuffer = "";
        // Flag for server-sent error events — checked after loop
        let streamError: string | null = null;

        if (reader) {
          setIsTyping(false); // Start showing streaming content
          
          try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              clearTimeout(timeoutId);
              break;
            }

            // Append new data to any leftover from previous chunk
            const chunk = lineBuffer + decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            // Last element may be incomplete — save it for next chunk
            lineBuffer = lines.pop() || "";

            for (const line of lines) {
              if (streamError) break; // Stop processing if server sent error
              if (line.startsWith('data: ')) {
                let data: Record<string, unknown>;
                try {
                  data = JSON.parse(line.slice(6));
                } catch {
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('[FloatingAIBubble] Malformed SSE:', line.slice(0, 100));
                  }
                  continue;
                }

                try {
                  if (data.type === 'content') {
                    accumulatedContent += (data.content as string);
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: accumulatedContent }
                          : m
                      )
                    );
                  } else if (data.type === 'tool_start') {
                    // Show tool execution in progress
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? {
                              ...m,
                              toolProgress: [
                                ...(m.toolProgress || []),
                                { toolName: data.toolName as string, status: 'running' as const },
                              ],
                            } as Message
                          : m
                      )
                    );
                  } else if (data.type === 'tool_done') {
                    // Update tool progress to done
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? ({
                              ...m,
                              toolProgress: (m.toolProgress || []).map((tp) =>
                                tp.toolName === data.toolName
                                  ? {
                                      ...tp,
                                      status: (data.success ? 'done' : 'error') as 'done' | 'error',
                                      summary: data.summary as string | undefined,
                                      navigation: data.navigation as { route: string; label: string } | undefined,
                                      executionTimeMs: data.executionTimeMs as number | undefined,
                                    }
                                  : tp
                              ),
                            } as Message)
                          : m
                      )
                    );
                    // If tool returned navigation, add to suggested actions
                    if (data.suggestedActions) {
                      finalMetadata.suggestedActions = [
                        ...((finalMetadata.suggestedActions as Array<{ label: string; action: string }>) || []),
                        ...(data.suggestedActions as Array<{ label: string; action: string }>),
                      ];
                    }
                  } else if (data.type === 'tool_preview') {
                    // Store structured tool preview for rich rendering
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? ({
                              ...m,
                              toolPreviews: [
                                ...(m.toolPreviews || []),
                                { toolName: data.toolName as string, preview: data.preview as Record<string, unknown> },
                              ],
                            } as Message)
                          : m
                      )
                    );
                  } else if (data.type === 'plan') {
                    // Store ReAct plan steps for visualization
                    // Server sends `steps` as a number (iteration count) and
                    // `reasoning` as string[]. Normalize into plan step objects.
                    const reasoningArr = Array.isArray(data.reasoning) ? data.reasoning as string[] : [];
                    const stepCount = typeof data.steps === 'number' ? data.steps : 0;
                    const planSteps = reasoningArr.length > 0
                      ? reasoningArr.map((r: string, i: number) => ({
                          step: i + 1,
                          description: r,
                          status: 'planned',
                        }))
                      : Array.from({ length: stepCount }, (_, i) => ({
                          step: i + 1,
                          description: `Step ${i + 1}`,
                          status: 'planned',
                        }));
                    if (planSteps.length > 0) {
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === assistantMessageId
                            ? { ...m, planSteps }
                            : m
                        )
                      );
                    }
                  } else if (data.type === 'metadata') {
                    finalMetadata = data || {};
                    // Update token usage for cost widget
                    if ((data.metadata as Record<string, unknown>)?.usage) {
                      const usage = (data.metadata as Record<string, unknown>).usage as Record<string, number>;
                      setCurrentTokenUsage({
                        promptTokens: usage.prompt_tokens || 0,
                        completionTokens: usage.completion_tokens || 0,
                        totalTokens: usage.total_tokens || 0,
                        model: ((data.metadata as Record<string, unknown>).model as string) || 'gpt-4o-mini',
                        cost: calculateCost(
                          ((data.metadata as Record<string, unknown>).model as string) || 'gpt-4o-mini',
                          usage.prompt_tokens || 0,
                          usage.completion_tokens || 0
                        ),
                      });
                    }
                  } else if (data.type === 'done') {
                    const processingTime = Date.now() - startTime;

                    // Capture server-created conversationId to prevent orphan conversations
                    if (data.conversationId && !persistence.conversationId) {
                      persistence.linkConversationId(data.conversationId as string);
                    }
                    
                    // Finalize the message with full metadata including tools
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? ({
                              ...m,
                              content: accumulatedContent || (
                                (data.toolsUsed as string[])?.length > 0
                                  ? "I've completed the requested actions. Check the tool results above for details."
                                  : accumulatedContent
                              ),
                              suggestions: data.suggestions as string[] | undefined,
                              actions: ((data.suggestedActions || finalMetadata.suggestedActions) as Array<{ label: string; action: string }> | undefined)?.map((a: { label: string; action: string }) => ({
                                label: a.label,
                                action: a.action,
                              })),
                              selfCritique: data.selfCritique as { score: number; note: string; grounded: boolean } | undefined,
                              metadata: {
                                confidence: (data.confidence as number) || (finalMetadata.confidence as number) || 0.95,
                                processingTime,
                                source: "ai-stream-v2",
                                usedRAG: ((finalMetadata.sources as string[])?.length || 0) > 0,
                                ragSources: finalMetadata.ragSources as RAGSource[],
                                toolsUsed: data.toolsUsed as string[],
                              },
                            } as Message)
                          : m
                      )
                    );
                  } else if (data.type === 'error') {
                    // Server sent an explicit error — flag it for propagation
                    streamError = (data.message as string) || (data.error as string) || 'Stream error';
                  }
                } catch {
                  // Non-critical event handling error — skip this event
                }
              }
            }
            // Exit the reader loop immediately if server sent an error event
            if (streamError) break;
          }
          } finally {
            reader.releaseLock();
          }
        }

        // If server sent an error event, propagate it to the outer catch handler
        if (streamError) {
          throw new Error(streamError);
        }

        playSound("receive");
        
        // Server-side persistence handles message saving in the streaming route
        // to avoid duplicate writes. The server returns conversationId in the done event
        // which is captured above via linkConversationId.
        
      } else {
        // Fallback to non-streaming endpoint
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageContent,
            conversationHistory: messages
              .filter(m => m.role === 'user' || m.role === 'assistant')
              .slice(-10)
              .map(m => ({
                role: m.role,
                content: m.content,
              })),
            context: {
              ...conversationContext,
              conversationId: persistence.conversationId || undefined,
              contractId: currentContractId,
              context: currentContractId ? 'contract-detail' : 'global',
              pageContext,
              currentPage: pathname,
              artifactVersion,
              forceRefresh: artifactVersion > 0,
              mode: chatMode,
              persona: persona === 'default' ? undefined : persona,
              perspective: perspective === 'self' ? undefined : perspective,
            },
            conversationId: persistence.conversationId || undefined,
            useRAG: true,
            useMock: false,
          }),
        });

        const data = await response.json();
        const processingTime = Date.now() - startTime;

        // Update context based on query
        updateContext(messageContent);

        // Check if it's an error response — handle both legacy (error: true)
        // and standardized ({ success: false, error: { code, message } }) formats
        const isErrorResponse = data.success === false || 
          data.error === true || 
          (data.error && typeof data.error === 'object' && !data.response);

        // Extract error message safely — data.error can be boolean, string, or object
        const errorMessage = typeof data.error === 'string' 
          ? data.error 
          : (data.error?.message || data.error?.code || null);

        // Parse actions from API response
        const actions: ActionButton[] = data.suggestedActions?.map((a: any) => ({
          label: a.label,
          action: a.action,
          variant: a.action.includes('view') ? 'primary' : isErrorResponse ? 'secondary' : 'default',
        })) || [];

        // Parse RAG sources from API response
        const ragSources: RAGSource[] = data.ragResults?.map((r: any) => ({
          contractId: r.contractId,
          contractName: r.contractName,
          score: r.score,
          snippet: r.snippet || r.text?.slice(0, 320),
          heading: r.heading,
          section: r.section,
          startOffset: r.startOffset,
          endOffset: r.endOffset,
          matchType: r.matchType,
        })) || [];

        // Parse contract previews from API response
        const contractPreviews: ContractPreviewCard[] = data.contractPreviews?.map((c: any) => ({
          id: c.id,
          name: c.name,
          supplier: c.supplier,
          status: c.status,
          value: c.value,
          expirationDate: c.expirationDate,
          daysUntilExpiry: c.daysUntilExpiry,
          riskLevel: c.riskLevel,
          type: c.type,
        })) || [];

        // Update token usage for cost widget
        if (data.usage) {
          setCurrentTokenUsage({
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
            model: data.model || 'gpt-4o-mini',
            cost: calculateCost(
              data.model || 'gpt-4o-mini',
              data.usage.prompt_tokens || 0,
              data.usage.completion_tokens || 0
            ),
          });
        }

        // ENHANCED: Handle clarification prompts from the API
        const clarificationNeeded = data.clarificationNeeded || false;
        const clarificationPrompts = data.clarificationPrompts || [];

        const assistantMessage: Message = {
          id: assistantMessageId,
          role: "assistant",
          content: data.response || errorMessage || "I couldn't process that request.",
          timestamp: new Date(),
          suggestions: clarificationNeeded ? clarificationPrompts : data.suggestions,
          clarificationNeeded,
          clarificationPrompts,
          actions: actions.length > 0 ? actions : undefined,
          contractPreviews: contractPreviews.length > 0 ? contractPreviews : undefined,
          metadata: {
            confidence: isErrorResponse ? 0 : (data.confidence || 0.95),
            processingTime,
            source: isErrorResponse ? "error-recovery" : (data.sources?.[0] || "ai"),
            ragSources: ragSources.length > 0 ? ragSources : undefined,
            usedRAG: data.usedRAG || ragSources.length > 0,
            intent: data.intent?.type,
            isError: isErrorResponse,
          },
        };

        setMessages((prev) => [...prev, assistantMessage]);
        playSound("receive");
        
        // Server-side persistence handles message saving in the non-streaming route
        // (conversationMemoryService.addMessage) — no duplicate client-side write needed.
      }
      
      if (!isOpen) setHasNewMessage(true);
      updateContext(messageContent);
    } catch (error) {
      // Clear timeout on any error
      clearTimeout(timeoutId);

      // Flip the user's message status from "sent" (optimistically set 300ms
      // after dispatch) back to "error". Without this, a failed request
      // leaves the checkmark showing next to the user's bubble, implying the
      // server accepted and processed it when it actually never did.
      // AbortError is still an "error" from the user's POV (their message
      // didn't get a reply) — they can retry from the error UI.
      setMessages((prev) =>
        prev.map((m) => (m.id === userMessage.id ? { ...m, status: "error" } : m))
      );

      // Check if request was aborted (timeout or user cancel)
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "⏱️ **Request timed out**\n\nThe request took too long to complete. This could be due to a slow connection or high server load.\n\n💡 **What you can do:**\n• Try asking a simpler question\n• Check your internet connection\n• Wait a moment and try again",
          timestamp: new Date(),
          suggestions: ["Try again", "Simplify question"],
          actions: [
            { label: "🔄 Retry", action: `retry:${messageContent}` },
            { label: "✏️ Simplify", action: "simplify-question" },
          ],
          metadata: {
            confidence: 1,
            processingTime: 0,
            source: "timeout",
            isError: true,
          },
        };
        setMessages((prev) => [...prev, timeoutMessage]);
        playSound("receive");
        return;
      }
      
      // Retry on transient errors (if not already retrying)
      if (retryCount < MAX_RETRIES && error instanceof Error && 
          (error.message.includes('network') || error.message.includes('fetch'))) {
        const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 5000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return await handleSendMessage(messageContent, retryCount + 1);
      }
      
      // Check if we're offline and queue the request
      if (!offlineQueue.isOnline) {
        // Queue the message for later
        offlineQueue.enqueue('chat', {
          message: messageContent,
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
          context: conversationContext,
          contractId: currentContractId,
        }, 'normal');
        
        const queuedMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "📴 **You're currently offline**\n\nYour message has been queued and will be sent when you're back online. I've saved it so you won't lose it!\n\n💡 In the meantime, you can continue chatting and your messages will sync automatically.",
          timestamp: new Date(),
          suggestions: ["View queued messages", "Try again"],
          metadata: {
            confidence: 1,
            processingTime: 0,
            source: "offline-queue",
          },
        };
        setMessages((prev) => [...prev, queuedMessage]);
        playSound("receive");
      } else {
        // Fallback to local response on API failure
        const response = generateAIResponse(messageContent, conversationContext);
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.content,
          timestamp: new Date(),
          suggestions: response.suggestions,
          actions: response.actions,
          metadata: {
            confidence: response.confidence || 0.85,
            processingTime: 0,
            source: "fallback",
          },
        };
        setMessages((prev) => [...prev, assistantMessage]);
        playSound("receive");
      }
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setIsLoading(false);
      setIsTyping(false);
    }
    
  }, [input, isLoading, conversationContext, isOpen, playSound, messages, cancelCurrentRequest]);

  // Keep forward ref in sync for handleAction
  sendMsgRef.current = handleSendMessage;

  // Regenerate: drop the last assistant message and re-send the preceding user message
  const handleRegenerate = useCallback(() => {
    if (isLoading) return;
    // Find last assistant msg and the user msg that preceded it
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].id !== 'welcome') {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;
    let precedingUser: Message | undefined;
    for (let i = lastAssistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        precedingUser = messages[i];
        break;
      }
    }
    if (!precedingUser) return;
    // Drop the last assistant message optimistically, then re-send
    setMessages((prev) => prev.filter((m) => m.id !== messages[lastAssistantIdx].id));
    // Use a microtask to ensure state is applied before send picks up `messages`
    setTimeout(() => handleSendMessage(precedingUser!.content), 0);
  }, [isLoading, messages, handleSendMessage]);

  // Edit last user message: load it into input, remove it and its assistant reply
  const handleEditLastUser = useCallback(() => {
    if (isLoading) return;
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;
    const userMsg = messages[lastUserIdx];
    setInput(userMsg.content);
    // Drop the user msg + anything after (their replies)
    setMessages((prev) => prev.slice(0, lastUserIdx));
    inputRef.current?.focus();
  }, [isLoading, messages]);

  // Rename the current conversation title
  const handleRenameSave = useCallback(async () => {
    const next = titleDraft.trim();
    setIsRenamingTitle(false);
    if (!next) return;
    if (persistence.conversationId) {
      await persistence.renameConversation(persistence.conversationId, next);
    }
  }, [persistence, titleDraft]);

  const conversationTitle = useMemo(() => {
    const id = persistence.conversationId;
    if (!id) return null;
    const match = persistence.conversations.find((c) => c.id === id);
    return match?.title || null;
  }, [persistence.conversationId, persistence.conversations]);

  // Update conversation context
  const updateContext = (query: string) => {
    const lowerQuery = query.toLowerCase();
    
    setConversationContext((prev) => ({
      ...prev,
      lastTopic: lowerQuery.includes("renewal") ? "renewals" :
                 lowerQuery.includes("contract") ? "contracts" :
                 lowerQuery.includes("risk") ? "risk" :
                 lowerQuery.includes("cost") ? "costs" : prev.lastTopic,
    }));
  };

  // Fallback AI response generator — used ONLY when API is unreachable
  // All responses are guidance-oriented (no fake data)
  const generateAIResponse = (
    query: string,
    context: ConversationContext
  ): {
    content: string;
    suggestions?: string[];
    actions?: ActionButton[];
    confidence?: number;
    source?: string;
  } => {
    const lowerQuery = query.toLowerCase();

    // Help queries
    if (lowerQuery.includes("help") || lowerQuery.includes("what can") || lowerQuery.includes("how to")) {
      return {
        content:
          "🤖 **How I Can Help You**\n\n" +
          "I'm your AI contract assistant! Here's what I can do:\n\n" +
          "**📊 Analytics & Reports** — Summaries, spend analysis, trends\n" +
          "**📅 Tracking & Alerts** — Renewals, deadlines, compliance\n" +
          "**🔍 Search & Discovery** — Find contracts, compare vendors, extract clauses\n" +
          "**💡 Recommendations** — Negotiation strategies, best practices\n\n" +
          "Just ask me anything in natural language!",
        suggestions: ["Contract summary", "Renewals", "Cost analysis", "Compliance"],
        confidence: 1.0,
        source: "help-system",
      };
    }

    // Navigation-oriented fallback for specific topics
    if (lowerQuery.includes("expir") || lowerQuery.includes("renewal")) {
      return {
        content:
          "📅 **Contract Renewals**\n\n" +
          "I couldn't reach the AI service right now. You can view your renewal information directly:\n\n" +
          "Click **View Renewals** below, or try your question again in a moment.",
        suggestions: ["Show expiring contracts", "View all contracts"],
        actions: [
          { label: "View Renewals", action: "view-renewals", icon: Calendar, variant: "primary" },
          { label: "View Contracts", action: "view-contracts", icon: FileText },
        ],
        confidence: 0.5,
        source: "fallback-offline",
      };
    }

    if (lowerQuery.includes("analytics") || lowerQuery.includes("spend") || lowerQuery.includes("cost") || lowerQuery.includes("budget")) {
      return {
        content:
          "📊 **Analytics**\n\n" +
          "I couldn't reach the AI service right now. You can view live analytics directly:\n\n" +
          "Click **View Analytics** below, or try your question again in a moment.",
        suggestions: ["View analytics", "Show contracts"],
        actions: [
          { label: "View Analytics", action: "view-analytics", icon: TrendingUp, variant: "primary" },
        ],
        confidence: 0.5,
        source: "fallback-offline",
      };
    }

    if (lowerQuery.includes("complian") || lowerQuery.includes("risk")) {
      return {
        content:
          "🛡️ **Compliance & Risk**\n\n" +
          "I couldn't reach the AI service to analyze your contracts right now.\n\n" +
          "You can view compliance data on the **Analytics** page, or try again in a moment.",
        suggestions: ["View analytics", "Show contracts"],
        actions: [
          { label: "View Analytics", action: "view-analytics", icon: TrendingUp, variant: "primary" },
        ],
        confidence: 0.5,
        source: "fallback-offline",
      };
    }

    // Default fallback — honest and helpful
    return {
      content:
        "⚠️ **AI service temporarily unavailable**\n\n" +
        "I couldn't process your request right now. You can:\n\n" +
        "• **Try again** in a few moments\n" +
        "• **Browse contracts** directly using the button below\n" +
        "• **Check the dashboard** for real-time metrics\n\n" +
        "The AI service usually recovers quickly.",
      suggestions: ["Try again", "Show contracts", "View dashboard"],
      actions: [
        { label: "View Contracts", action: "view-contracts", icon: FileText, variant: "primary" },
        { label: "View Dashboard", action: "view-dashboard", icon: TrendingUp },
      ],
      confidence: 0.3,
      source: "fallback-offline",
    };
  };

  // Toggle open state
  const toggleOpen = useCallback(() => {
    if (isEmbedded) {
      inputRef.current?.focus();
      return;
    }
    setIsOpen(!isOpen);
    if (!isOpen) setHasNewMessage(false);
  }, [isEmbedded, isOpen]);

  // Memoized unread count
  const unreadCount = useMemo(() => {
    return hasNewMessage ? 1 : 0;
  }, [hasNewMessage]);

  return (
    <TooltipProvider>
      <>
        {/* Floating Bubble Button - Draggable with better animations */}
        <AnimatePresence>
          {!isEmbedded && !isOpen && (
            <motion.div key="FloatingAIBubble-ap-1"
              initial={{ scale: 0, opacity: 0, rotate: -180 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0, rotate: 180 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              className="fixed z-50"
              style={{
                bottom: `${24 + position.y}px`,
                right: `${24 + position.x}px`,
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    onClick={() => {
                      // Only toggle if not dragging
                      if (!isDragging) toggleOpen();
                    }}
                    className="relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 rounded-full"
                    whileHover={{ scale: isDragging ? 1 : 1.08, rotate: isDragging ? 0 : 5 }}
                    whileTap={{ scale: isDragging ? 1 : 0.92 }}
                    aria-label="Open AI Assistant (⌘/) - Drag to move"
                  >
                    {/* Single breathing glow ring */}
                    <motion.span 
                      className="absolute inset-0 rounded-full bg-violet-500/30"
                      animate={{ 
                        scale: [1, 1.25, 1],
                        opacity: [0.4, 0, 0.4]
                      }}
                      transition={{ 
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />

                    {/* Main bubble - clean and premium */}
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-2xl shadow-black/15 flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:shadow-black/25">
                      {/* Subtle top highlight */}
                      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/15 to-transparent" />
                      
                      {/* Icon - only animates on hover */}
                      <Sparkles className="relative z-10 w-7 h-7 text-white drop-shadow-sm" />
                    </div>

                    {/* Notification badge with bounce */}
                    <AnimatePresence>
                      {unreadCount > 0 && (
                        <motion.span key="unread-count"
                          initial={{ scale: 0, y: 10 }}
                          animate={{ scale: 1, y: 0 }}
                          exit={{ scale: 0, y: 10 }}
                          transition={{ type: "spring", damping: 10, stiffness: 300 }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-md ring-2 ring-white"
                        >
                          {unreadCount}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Keyboard shortcut hint - improved visibility */}
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      className="absolute -left-24 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none"
                    >
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-xl">
                        <kbd className="text-xs font-mono text-gray-300">⌘/</kbd>
                        <span className="text-xs text-gray-400">open</span>
                      </div>
                    </motion.div>
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="left" className="bg-gray-900/95 backdrop-blur-sm text-white border-gray-700 shadow-xl px-3 py-2">
                  <p className="font-semibold text-sm">AI Assistant</p>
                  <p className="text-xs text-gray-400 mt-0.5">Press ⌘/ or Ctrl+/</p>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Panel - Draggable with glassmorphism and better visual hierarchy */}
        <AnimatePresence>
          {isOpen && (
            <motion.div key="open"
              role={isEmbedded ? 'region' : 'dialog'}
              aria-modal={isEmbedded ? undefined : true}
              aria-label="ConTigo AI Chat"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 30 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 30 }}
              transition={prefersReducedMotion ? { duration: 0.15 } : { type: "spring", damping: 20, stiffness: 280 }}
              className={`${isEmbedded ? 'relative h-full w-full' : 'fixed z-50'} ${
                !isEmbedded && isExpanded
                  ? "inset-2 md:inset-4 lg:inset-8"
                  : isEmbedded
                    ? 'h-full w-full'
                    : "w-[min(560px,calc(100vw-32px))] h-[min(780px,calc(100vh-80px))] sm:w-[90vw] sm:max-w-[560px] md:w-[560px]"
              }`}
              style={!isEmbedded && !isExpanded ? {
                bottom: `${16 + position.y}px`,
                right: `${16 + position.x}px`,
              } : undefined}
            >
              <div ref={chatPanelRef} className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl shadow-black/10 border border-gray-200 backdrop-blur-sm">
                {/* White background */}
                <div className="absolute inset-0 bg-white" />
                
                {/* Accent bar at top - also serves as drag handle */}
                <motion.div 
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 ${isEmbedded ? '' : 'cursor-grab active:cursor-grabbing'}`}
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  onMouseDown={isEmbedded ? undefined : handleDragStart}
                  onTouchStart={isEmbedded ? undefined : handleDragStart}
                />

                {/* Content */}
                <div className="relative h-full flex flex-col">
                  {/* Header - Clean glassmorphism design */}
                  <div 
                    className={`flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-md select-none ${isEmbedded ? '' : 'cursor-grab active:cursor-grabbing'}`}
                    onMouseDown={isEmbedded ? undefined : handleDragStart}
                    onTouchStart={isEmbedded ? undefined : handleDragStart}
                  >
                    <div className="flex items-center gap-3.5 pointer-events-none">
                      <div className="relative">
                        <div 
                          className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md"
                        >
                          <Bot className="w-5.5 h-5.5 text-white" />
                        </div>
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white"
                        />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                          {isRenamingTitle ? (
                            <input
                              autoFocus
                              value={titleDraft}
                              onChange={(e) => setTitleDraft(e.target.value)}
                              onBlur={handleRenameSave}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleRenameSave(); }
                                if (e.key === 'Escape') { e.preventDefault(); setIsRenamingTitle(false); }
                              }}
                              className="bg-white border border-violet-300 rounded-md px-2 py-0.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 max-w-[220px] pointer-events-auto"
                            />
                          ) : (
                            <button
                              type="button"
                              className="text-left truncate max-w-[180px] hover:underline focus:outline-none focus-visible:underline pointer-events-auto"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!persistence.conversationId) return;
                                setTitleDraft(conversationTitle || 'ConTigo AI');
                                setIsRenamingTitle(true);
                              }}
                              title={persistence.conversationId ? 'Click to rename conversation' : undefined}
                            >
                              {conversationTitle || 'ConTigo AI'}
                            </button>
                          )}
                          <Badge className="bg-violet-50 text-violet-700 text-[10px] border-violet-200/50 px-2 py-0.5 font-medium">
                            <Zap className="w-2.5 h-2.5 mr-1" />
                            RAG
                          </Badge>
                          <Badge
                            className={`text-[10px] px-2 py-0.5 font-medium border cursor-default ${
                              chatMode === 'fast'
                                ? 'bg-sky-50 text-sky-700 border-sky-200/60'
                                : chatMode === 'deep'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200/60'
                                  : 'bg-slate-50 text-slate-700 border-slate-200/70'
                            }`}
                            title={`Response mode: ${chatMode}`}
                          >
                            {chatMode === 'fast' ? 'Fast' : chatMode === 'deep' ? 'Deep' : 'Balanced'}
                          </Badge>
                          {perspective === 'counterparty' && (
                            <Badge
                              className="bg-amber-50 text-amber-800 text-[10px] border-amber-200/60 px-2 py-0.5 font-medium cursor-default"
                              title="Opposing-party lens is ON — analyzing from counterparty view"
                            >
                              Counterparty view
                            </Badge>
                          )}
                          {persona !== 'default' && (
                            <Badge
                              className="bg-indigo-50 text-indigo-700 text-[10px] border-indigo-200/60 px-2 py-0.5 font-medium cursor-default"
                              title={`Persona: ${persona}`}
                            >
                              {persona.charAt(0).toUpperCase() + persona.slice(1)}
                            </Badge>
                          )}
                          {/* Usage Quota Indicator */}
                          <InlineUsageIndicator />
                          {lastArtifactUpdate && (
                            <Badge className="bg-emerald-50 text-emerald-700 text-[10px] border-emerald-200/50 px-2 py-0.5 font-medium">
                              <RefreshCw className="w-2.5 h-2.5 mr-1" />
                              Live
                            </Badge>
                          )}
                        </h3>
                        <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                          {isTyping ? (
                            <span 
                              className="flex items-center gap-1.5"
                            >
                              <motion.span 
                                className="w-1.5 h-1.5 bg-violet-500 rounded-full"
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ repeat: Infinity, duration: 0.8 }}
                              />
                              <span className="text-violet-600 font-medium">Analyzing...</span>
                            </span>
                          ) : currentContractId ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full" />
                              <span className="text-violet-600">Context-aware</span>
                              {lastArtifactUpdate && (
                                <span className="text-xs text-green-600">
                                  • Synced {formatTimeAgo(lastArtifactUpdate)}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              Ready • {messages.length - 1} message{messages.length - 1 !== 1 ? 's' : ''}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pointer-events-auto">
                      {/* Cost Widget - Real-time token usage */}
                      <AICostWidget
                        currentUsage={currentTokenUsage}
                        compact
                        onBudgetAlert={(percent) => {
                          if (percent >= 95) {
                            // Show warning in chat
                            setMessages((prev) => [...prev, {
                              id: `budget-warning-${Date.now()}`,
                              role: "system" as const,
                              content: "⚠️ You've used 95% of your daily AI budget.",
                              timestamp: new Date(),
                            }]);
                          }
                        }}
                      />
                      
                      {/* Settings dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                          >
                            <Settings className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white border-gray-200 text-gray-900 min-w-[220px] shadow-lg">
                          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            Response mode
                          </div>
                          <DropdownMenuItem onClick={() => setChatMode('fast')} className={`hover:bg-gray-100 cursor-pointer py-2.5 ${chatMode === 'fast' ? 'bg-violet-50 text-violet-700' : ''}`}>
                            <Zap className="w-4 h-4 mr-3" />
                            <div className="flex-1">
                              <div className="text-sm font-medium">Fast</div>
                              <div className="text-[11px] text-gray-500">Quick answers · gpt-4o-mini</div>
                            </div>
                            {chatMode === 'fast' && <Check className="w-4 h-4 ml-2" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setChatMode('balanced')} className={`hover:bg-gray-100 cursor-pointer py-2.5 ${chatMode === 'balanced' ? 'bg-violet-50 text-violet-700' : ''}`}>
                            <Sparkles className="w-4 h-4 mr-3" />
                            <div className="flex-1">
                              <div className="text-sm font-medium">Balanced</div>
                              <div className="text-[11px] text-gray-500">Auto-routed default</div>
                            </div>
                            {chatMode === 'balanced' && <Check className="w-4 h-4 ml-2" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setChatMode('deep')} className={`hover:bg-gray-100 cursor-pointer py-2.5 ${chatMode === 'deep' ? 'bg-violet-50 text-violet-700' : ''}`}>
                            <Bot className="w-4 h-4 mr-3" />
                            <div className="flex-1">
                              <div className="text-sm font-medium">Deep</div>
                              <div className="text-[11px] text-gray-500">Thorough reasoning · gpt-4o</div>
                            </div>
                            {chatMode === 'deep' && <Check className="w-4 h-4 ml-2" />}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-gray-200" />
                          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            Persona
                          </div>
                          {([
                            { id: 'default', label: 'Default', desc: 'General assistant' },
                            { id: 'analyst', label: 'Analyst', desc: 'Data-oriented, numbers first' },
                            { id: 'counsel', label: 'Counsel', desc: 'Legal precision, clause refs' },
                            { id: 'executive', label: 'Executive', desc: 'Bottom line + decision' },
                          ] as const).map((p) => (
                            <DropdownMenuItem
                              key={p.id}
                              onClick={() => setPersona(p.id)}
                              className={`hover:bg-gray-100 cursor-pointer py-2 ${persona === p.id ? 'bg-violet-50 text-violet-700' : ''}`}
                            >
                              <User className="w-4 h-4 mr-3" />
                              <div className="flex-1">
                                <div className="text-sm font-medium">{p.label}</div>
                                <div className="text-[11px] text-gray-500">{p.desc}</div>
                              </div>
                              {persona === p.id && <Check className="w-4 h-4 ml-2" />}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator className="bg-gray-200" />
                          <DropdownMenuItem
                            onClick={() => setPerspective(perspective === 'counterparty' ? 'self' : 'counterparty')}
                            className={`hover:bg-gray-100 cursor-pointer py-2.5 ${perspective === 'counterparty' ? 'bg-amber-50 text-amber-800' : ''}`}
                          >
                            <Search className="w-4 h-4 mr-3" />
                            <div className="flex-1">
                              <div className="text-sm font-medium">Opposing-party lens</div>
                              <div className="text-[11px] text-gray-500">
                                {perspective === 'counterparty' ? 'ON — viewing from counterparty' : 'View contracts from the other side'}
                              </div>
                            </div>
                            {perspective === 'counterparty' && <Check className="w-4 h-4 ml-2" />}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-gray-200" />
                          <DropdownMenuItem onClick={() => setShowHistoryPanel(true)} className="hover:bg-gray-100 cursor-pointer py-3">
                            <History className="w-4 h-4 mr-3" />
                            Conversation history
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowSearchDialog(true)} className="hover:bg-gray-100 cursor-pointer py-3">
                            <Search className="w-4 h-4 mr-3" />
                            Search history
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsSoundEnabled(!isSoundEnabled)} className="hover:bg-gray-100 cursor-pointer py-3">
                            {isSoundEnabled ? <Volume2 className="w-4 h-4 mr-3" /> : <VolumeX className="w-4 h-4 mr-3" />}
                            {isSoundEnabled ? "Mute sounds" : "Enable sounds"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setUseStreaming(!useStreaming)} className="hover:bg-gray-100 cursor-pointer py-3">
                            <Zap className="w-4 h-4 mr-3" />
                            {useStreaming ? "Disable streaming" : "Enable streaming"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowShortcuts(true)} className="hover:bg-gray-100 cursor-pointer py-3">
                            <Keyboard className="w-4 h-4 mr-3" />
                            Keyboard shortcuts
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowExamples(true)} className="hover:bg-gray-100 cursor-pointer py-3">
                            <Sparkles className="w-4 h-4 mr-3" />
                            Example prompts
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setShowBookmarksPanel(true)}
                            disabled={bookmarkedIds.size === 0}
                            className="hover:bg-gray-100 cursor-pointer py-3 disabled:opacity-40"
                          >
                            <BookmarkCheck className="w-4 h-4 mr-3" />
                            Bookmarks ({bookmarkedIds.size})
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-gray-200" />
                          <DropdownMenuItem
                            onClick={() => {
                              const md = messages
                                .filter((m) => m.id !== 'welcome')
                                .map((m) => `**${m.role === 'user' ? 'You' : 'ConTigo AI'}** · ${m.timestamp.toLocaleString()}\n\n${m.content}\n`)
                                .join('\n---\n\n');
                              const header = `# ConTigo AI Conversation\n\n_Exported ${new Date().toLocaleString()}_\n\n---\n\n`;
                              navigator.clipboard.writeText(header + md).then(
                                () => toast.success('Conversation copied as Markdown'),
                                () => toast.error('Clipboard copy failed'),
                              );
                            }}
                            className="hover:bg-gray-100 cursor-pointer py-3"
                          >
                            <Copy className="w-4 h-4 mr-3" />
                            Copy as Markdown
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const payload = {
                                exportedAt: new Date().toISOString(),
                                messages: messages
                                  .filter((m) => m.id !== 'welcome')
                                  .map((m) => ({
                                    id: m.id,
                                    role: m.role,
                                    content: m.content,
                                    timestamp: m.timestamp.toISOString(),
                                  })),
                              };
                              navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(
                                () => toast.success('Conversation copied as JSON'),
                                () => toast.error('Clipboard copy failed'),
                              );
                            }}
                            className="hover:bg-gray-100 cursor-pointer py-3"
                          >
                            <Copy className="w-4 h-4 mr-3" />
                            Copy as JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              try {
                                window.open(
                                  `${window.location.pathname}?chat=popout`,
                                  'contigo-chat-popout',
                                  'width=520,height=820,resizable=yes,scrollbars=yes',
                                );
                              } catch {
                                toast.error('Could not open pop-out window');
                              }
                            }}
                            className="hover:bg-gray-100 cursor-pointer py-3"
                          >
                            <Maximize2 className="w-4 h-4 mr-3" />
                            Open in new window
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowExportDialog(true)} className="hover:bg-gray-100 cursor-pointer py-3">
                            <Download className="w-4 h-4 mr-3" />
                            Export chat
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleClearChat} className="hover:bg-gray-100 text-red-600 cursor-pointer py-3">
                            <Trash2 className="w-4 h-4 mr-3" />
                            Clear conversation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {!isEmbedded && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                            onClick={() => setIsExpanded(!isExpanded)}
                          >
                            {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                            onClick={toggleOpen}
                          >
                            <X className="w-5 h-5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Conversation History Panel - Round 3 Enhancement */}
                  <AnimatePresence>
                    {showHistoryPanel && (
                      <ConversationHistoryPanel key="history-panel"
                        conversations={(() => {
                          // For authenticated users, use conversations array (has messageCount)
                          if (persistence.isAuthenticated && persistence.conversations.length > 0) {
                            return persistence.conversations.map(c => ({
                              id: c.id,
                              title: c.title || 'Untitled conversation',
                              preview: c.title || 'New conversation',
                              messageCount: c.messageCount || 0,
                              createdAt: new Date(c.createdAt),
                              updatedAt: new Date(c.lastMessageAt || c.createdAt),
                              context: c.context,
                              contextType: c.contextType as 'global' | 'contract' | undefined,
                              starred: c.isPinned || false,
                            }));
                          }
                          // For unauthenticated users, build from conversationList (has messages)
                          if (persistence.conversationList && persistence.conversationList.length > 0) {
                            return persistence.conversationList.map(c => ({
                              id: c.id,
                              title: c.title || 'Current conversation',
                              preview: c.messages?.[0]?.content?.slice(0, 100) || c.title || 'New conversation',
                              messageCount: c.messages?.length || 0,
                              createdAt: new Date(c.createdAt),
                              updatedAt: new Date(c.updatedAt),
                              context: c.context,
                              contextType: c.contextType as 'global' | 'contract' | undefined,
                              starred: false,
                            }));
                          }
                          return [];
                        })()}
                        currentConversationId={persistence.conversationId || undefined}
                        isLoading={persistence.isLoading}
                        onSelectConversation={(id) => {
                          persistence.switchConversation(id).then(() => {
                            // Sync restored messages from the hook
                            if (persistence.messages.length > 0) {
                              const restoredMessages = persistence.messages.map((m) => ({
                                ...m,
                                timestamp: new Date(m.timestamp),
                                suggestions: m.suggestions || [],
                                actions: m.actions || [],
                              })) as Message[];
                              setMessages([INITIAL_MESSAGE, ...restoredMessages]);
                            }
                          });
                          setShowHistoryPanel(false);
                        }}
                        onDeleteConversation={(id) => {
                          persistence.deleteConversation(id);
                        }}
                        onNewConversation={() => {
                          handleClearChat();
                          setShowHistoryPanel(false);
                        }}
                        onClose={() => setShowHistoryPanel(false)}
                      />
                    )}
                  </AnimatePresence>

                  {/* Messages - Enhanced with better visual hierarchy */}
                  <div className="relative flex-1 overflow-hidden bg-gray-50/50">
                    <ScrollArea className="h-full">
                      <div ref={scrollRef} className="p-6 space-y-5">
                        {messages.map((message, msgIndex) => (
                          <motion.div
                            key={message.id}
                            id={`chat-msg-${message.id}`}
                            role="article"
                            aria-label={`Message from ${message.role === "user" ? "you" : "ConTigo AI"}`}
                            tabIndex={message.role === "assistant" ? 0 : -1}
                            initial={{ opacity: 0, y: 15, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ 
                              type: "spring", 
                              damping: 20, 
                              stiffness: 300,
                              delay: msgIndex === messages.length - 1 ? 0.1 : 0 
                            }}
                            className="space-y-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-xl"
                          >
                            <div
                              className={`flex ${
                                message.role === "user" ? "justify-end" : "justify-start"
                              }`}
                            >
                              {message.role === "assistant" && (
                              <div 
                                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mr-3 flex-shrink-0 shadow-md"
                                >
                                  <Sparkles className="w-4.5 h-4.5 text-white" />
                                </div>
                              )}
                              <div className="relative max-w-[85%]">
                                <motion.div
                                  whileHover={{ scale: 1.01 }}
                                  transition={{ type: "spring", damping: 20 }}
                                  className={`rounded-2xl px-5 py-4 ${
                                    message.role === "user"
                                      ? "bg-gradient-to-br from-violet-500 to-purple-500 text-white rounded-br-md shadow-md"
                                      : "bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                                  }`}
                                >
                                  {/* Plan Steps Visualization */}
                                  {message.planSteps && message.planSteps.length > 0 && (
                                    <div className="mb-3 p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100">
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Agent Plan</span>
                                      </div>
                                      <div className="space-y-0">
                                        {message.planSteps.map((ps, psIdx) => (
                                          <div key={ps.step} className="flex items-start gap-2 text-xs text-indigo-700">
                                            <div className="flex flex-col items-center shrink-0">
                                              <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-[10px] font-bold mt-0.5">
                                                {ps.step}
                                              </span>
                                              {psIdx < (message.planSteps?.length ?? 0) - 1 && (
                                                <div className="w-px h-3 bg-indigo-200 mt-0.5" />
                                              )}
                                            </div>
                                            <span className="pt-0.5 pb-1">{ps.description}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Tool Progress Indicators */}
                                  {message.toolProgress && message.toolProgress.length > 0 && (
                                    <div className="mb-3 space-y-1.5">
                                      {message.toolProgress.map((tp, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs">
                                          {tp.status === 'running' ? (
                                            <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
                                          ) : tp.status === 'done' ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                          ) : (
                                            <X className="h-3 w-3 text-red-400" />
                                          )}
                                          <span className="text-gray-500 font-medium">
                                            {formatToolName(tp.toolName)}
                                          </span>
                                          {tp.summary && (
                                            <span className="text-gray-400">— {tp.summary}</span>
                                          )}
                                          {tp.navigation && (
                                            <a
                                              href={tp.navigation.url}
                                              className="text-violet-500 hover:underline ml-auto"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                router.push(tp.navigation!.url);
                                                if (!isEmbedded) setIsOpen(false);
                                              }}
                                            >
                                              {tp.navigation.label} →
                                            </a>
                                          )}
                                          {tp.executionTimeMs !== undefined && tp.status === 'done' && (
                                            <span className="text-gray-300 ml-auto text-[10px]">{tp.executionTimeMs}ms</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Thinking indicator: shown when tools finished but no content streamed yet */}
                                  {message.toolProgress && message.toolProgress.length > 0 &&
                                   message.toolProgress.every(tp => tp.status !== 'running') &&
                                   !message.content && (
                                    <div className="mb-3 flex items-center gap-2 text-xs text-violet-500">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      <span className="font-medium">Synthesizing response...</span>
                                    </div>
                                  )}

                                  {/* Tool Preview Cards */}
                                  {message.toolPreviews && message.toolPreviews.length > 0 && (
                                    <div className="mb-3 space-y-2">
                                      {message.toolPreviews.map((tp, idx) => (
                                        <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                                          <div className="flex items-center gap-1.5 mb-1">
                                            <span className="font-semibold text-slate-700 capitalize">
                                              {tp.preview.title || tp.preview.type?.replace('_', ' ')}
                                            </span>
                                            {tp.preview.count != null && (
                                              <span className="text-slate-400">({tp.preview.count})</span>
                                            )}
                                          </div>
                                          {tp.preview.items && tp.preview.items.slice(0, 3).map((item, i) => (
                                            <div key={i} className="text-slate-600 truncate">
                                              {String(item.title || item.name || item.contractName || JSON.stringify(item).slice(0, 80))}
                                            </div>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div className="relative">
                                    <div
                                      className={
                                        message.role === 'assistant' &&
                                        message.content.length > LONG_MESSAGE_THRESHOLD &&
                                        !expandedMessageIds.has(message.id) &&
                                        !(isLoading && msgIndex === messages.length - 1)
                                          ? 'max-h-[420px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_85%,transparent)]'
                                          : ''
                                      }
                                    >
                                      <MarkdownContent
                                        content={(() => {
                                          // Inline citations: transform [N] tokens into visible superscripts
                                          // when the message has ragSources. Keeps markdown rendering simple.
                                          const sources = message.metadata?.ragSources;
                                          if (!sources || sources.length === 0 || message.role === 'user') {
                                            return message.content;
                                          }
                                          return message.content.replace(/\[(\d+)\]/g, (_m, digits) => {
                                            const idx = parseInt(digits, 10);
                                            if (idx < 1 || idx > sources.length) return `[${digits}]`;
                                            return `[${toSuperscriptNumber(idx)}](${buildCitationHref({ source: sources[idx - 1], index: idx })})`;
                                          });
                                        })()}
                                        className={`text-[15px] leading-relaxed ${message.role === "user" ? "prose-invert text-white" : ""}`}
                                        onInternalLinkClick={(href, event) => handleInlineCitationClick(href, message.metadata?.ragSources, event)}
                                      />
                                      {/* Streaming cursor: visible only on the last assistant message while still loading */}
                                      {isLoading && message.role === 'assistant' && msgIndex === messages.length - 1 && (
                                        <span
                                          aria-hidden="true"
                                          className="inline-block w-[2px] h-[1.1em] -mb-[0.2em] ml-0.5 bg-violet-500 animate-pulse align-middle"
                                        />
                                      )}
                                    </div>
                                    {message.role === 'assistant' &&
                                      message.content.length > LONG_MESSAGE_THRESHOLD &&
                                      !(isLoading && msgIndex === messages.length - 1) && (
                                        <button
                                          type="button"
                                          onClick={() => toggleMessageExpanded(message.id)}
                                          className="mt-2 text-xs font-medium text-violet-600 hover:text-violet-800 underline-offset-2 hover:underline"
                                        >
                                          {expandedMessageIds.has(message.id)
                                            ? 'Show less ▲'
                                            : `Show full response (${Math.ceil(message.content.length / 100) / 10}k chars) ▼`}
                                        </button>
                                      )}
                                  </div>
                                  
                                  {/* Metadata footer - Enhanced */}
                                  <div className={`flex items-center justify-between mt-3 pt-3 border-t ${message.role === "user" ? "border-white/20" : "border-gray-100"}`}>
                                    <span className={`text-xs font-medium ${message.role === "user" ? "text-white/70" : "text-gray-400"}`}>
                                      {message.timestamp.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {/* RAG indicator - Enhanced */}
                                      {message.metadata?.usedRAG && (
                                        <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-violet-200/50">
                                          <Search className="w-2.5 h-2.5" />
                                          RAG
                                        </span>
                                      )}
                                      {message.metadata?.confidence && message.role === "assistant" && (
                                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-200/50">
                                          <Zap className="w-2.5 h-2.5" />
                                          {Math.round(message.metadata.confidence * 100)}%
                                        </span>
                                      )}
                                      {/* Self-critique grounding indicator */}
                                      {message.selfCritique && (
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                          message.selfCritique.grounded
                                            ? 'text-emerald-600 bg-emerald-50 border-emerald-200/50'
                                            : 'text-amber-600 bg-amber-50 border-amber-200/50'
                                        }`}
                                          title={message.selfCritique.note}
                                        >
                                          {message.selfCritique.grounded ? '✓' : '⚠'} {message.selfCritique.grounded ? 'Grounded' : 'Review'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* RAG Sources - Enhanced collapsible section */}
                                  {message.metadata?.ragSources && message.metadata.ragSources.length > 0 && (
                                    <motion.div 
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ delay: 0.3 }}
                                      className="mt-3 pt-3 border-t border-gray-100"
                                    >
                                      <details className="text-xs group/sources">
                                        <summary className="cursor-pointer text-violet-600 hover:text-violet-700 flex items-center gap-1.5 font-medium transition-colors">
                                          <FileText className="w-3.5 h-3.5" />
                                          <span>{message.metadata.ragSources.length} source{message.metadata.ragSources.length !== 1 ? 's' : ''} referenced</span>
                                          <motion.span 
                                            className="text-gray-400 ml-auto"
                                            initial={{ rotate: 0 }}
                                          >
                                            ›
                                          </motion.span>
                                        </summary>
                                        <ul className="mt-2.5 space-y-2 text-gray-600">
                                          {message.metadata.ragSources.slice(0, 3).map((src, i) => (
                                            <motion.li 
                                              key={i} 
                                              initial={{ opacity: 0, x: -10 }}
                                              animate={{ opacity: 1, x: 0 }}
                                              transition={{ delay: i * 0.1 }}
                                              className="bg-gray-50 rounded-lg border border-gray-200 hover:border-violet-300 transition-colors"
                                            >
                                              <button
                                                type="button"
                                                onClick={() => setActiveCitationPreview({ source: src, index: i + 1 })}
                                                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
                                              >
                                                <div className="min-w-0 flex-1">
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded flex-shrink-0" aria-label={`Citation ${i + 1}`}>
                                                      [{i + 1}]
                                                    </span>
                                                    <FileText className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                                                    <span className="truncate font-medium">{src.contractName}</span>
                                                    {(src.heading || src.section) && (
                                                      <span className="hidden sm:inline rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 border border-gray-200">
                                                        {src.heading || src.section}
                                                      </span>
                                                    )}
                                                  </div>
                                                  {src.snippet && (
                                                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-gray-500">
                                                      {src.snippet}
                                                    </p>
                                                  )}
                                                  {(typeof src.startOffset === 'number' || typeof src.endOffset === 'number') && (
                                                    <p className="mt-1 text-[10px] font-medium text-slate-400">
                                                      Span {typeof src.startOffset === 'number' ? src.startOffset : '?'}
                                                      {typeof src.endOffset === 'number' ? `-${src.endOffset}` : ''}
                                                    </p>
                                                  )}
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                  <span className="text-xs font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded flex-shrink-0">
                                                    {Math.round(src.score * 100)}%
                                                  </span>
                                                  <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                                </div>
                                              </button>
                                            </motion.li>
                                          ))}
                                        </ul>
                                      </details>
                                    </motion.div>
                                  )}

                                  {/* Contract Preview Cards - Smart visual cards for found contracts */}
                                  {message.contractPreviews && message.contractPreviews.length > 0 && (
                                    <motion.div 
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: 0.2 }}
                                      className="mt-4 space-y-2"
                                    >
                                      <div className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 mb-2">
                                        <FileText className="w-3.5 h-3.5" />
                                        Found {message.contractPreviews.length} Contract{message.contractPreviews.length !== 1 ? 's' : ''}
                                      </div>
                                      <div className="grid gap-2">
                                        {message.contractPreviews.slice(0, 5).map((contract, i) => (
                                          <motion.div
                                            key={contract.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            onClick={() => router.push(`/contracts/${contract.id}`)}
                                            className="group/card relative bg-white rounded-xl p-3 border border-gray-200 hover:border-violet-300 hover:shadow-md transition-all cursor-pointer"
                                          >
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <h4 className="font-semibold text-sm text-gray-900 truncate group-hover/card:text-violet-600 transition-colors">
                                                    {contract.name}
                                                  </h4>
                                                  {contract.riskLevel && (
                                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                                                      contract.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                                                      contract.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                      'bg-green-100 text-green-700'
                                                    }`}>
                                                      {contract.riskLevel === 'high' ? 'High' : contract.riskLevel === 'medium' ? 'Medium' : 'Low'}
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                  {contract.supplier && (
                                                    <span className="flex items-center gap-1">
                                                      <Building2 className="w-3 h-3" />
                                                      {contract.supplier}
                                                    </span>
                                                  )}
                                                  {contract.type && (
                                                    <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full text-xs font-semibold">
                                                      {contract.type}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="text-right flex-shrink-0">
                                                {contract.value && (
                                                  <div className="text-sm font-bold text-gray-900">
                                                    ${contract.value.toLocaleString()}
                                                  </div>
                                                )}
                                                {contract.daysUntilExpiry !== undefined && (
                                                  <div className={`text-xs font-medium ${
                                                    contract.daysUntilExpiry <= 30 ? 'text-red-600' :
                                                    contract.daysUntilExpiry <= 90 ? 'text-amber-600' :
                                                    'text-gray-500'
                                                  }`}>
                                                    {contract.daysUntilExpiry <= 0 ? 'Expired' :
                                                     contract.daysUntilExpiry === 1 ? '1 day left' :
                                                     `${contract.daysUntilExpiry} days left`}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 group-hover/card:opacity-100 transition-opacity">
                                              <ExternalLink className="w-4 h-4 text-violet-500" />
                                            </div>
                                          </motion.div>
                                        ))}
                                      </div>
                                      {message.contractPreviews.length > 5 && (
                                        <button 
                                          onClick={() => router.push("/contracts")}
                                          className="w-full text-xs text-center text-violet-600 hover:text-violet-700 py-2 font-medium hover:underline"
                                        >
                                          +{message.contractPreviews.length - 5} more contracts — View All
                                        </button>
                                      )}
                                    </motion.div>
                                  )}
                                </motion.div>

                                {/* Message actions - Enhanced floating toolbar */}
                                {message.role === "assistant" && (
                                  <motion.div 
                                    initial={{ opacity: 0, x: 10 }}
                                    className="absolute -right-2 top-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col gap-1"
                                  >
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <motion.button
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => copyMessage(message.id, message.content)}
                                          className="w-8 h-8 rounded-xl bg-white/95 backdrop-blur-sm hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-all shadow-lg border border-gray-200/80 hover:border-gray-300"
                                        >
                                          {copiedId === message.id ? (
                                            <motion.div
                                              initial={{ scale: 0 }}
                                              animate={{ scale: 1 }}
                                              transition={{ type: "spring", damping: 10 }}
                                            >
                                              <Check className="w-4 h-4 text-violet-500" />
                                            </motion.div>
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </motion.button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="text-xs bg-gray-900 text-white border-gray-700">Copy</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <motion.button
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => toggleReadAloud(message.id, message.content)}
                                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-lg border backdrop-blur-sm ${
                                            speakingMessageId === message.id
                                              ? "bg-violet-50 text-violet-600 border-violet-300"
                                              : "bg-white/95 hover:bg-gray-50 text-gray-400 hover:text-violet-600 border-gray-200/80 hover:border-violet-300"
                                          }`}
                                          aria-label={speakingMessageId === message.id ? 'Stop reading' : 'Read aloud'}
                                        >
                                          {speakingMessageId === message.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                        </motion.button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="text-xs bg-gray-900 text-white border-gray-700">
                                        {speakingMessageId === message.id ? 'Stop' : 'Read aloud'}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <motion.button
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => toggleBookmark(message.id)}
                                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-lg border backdrop-blur-sm ${
                                            bookmarkedIds.has(message.id)
                                              ? "bg-amber-50 text-amber-600 border-amber-300"
                                              : "bg-white/95 hover:bg-gray-50 text-gray-400 hover:text-amber-600 border-gray-200/80 hover:border-amber-300"
                                          }`}
                                          aria-label={bookmarkedIds.has(message.id) ? 'Remove bookmark' : 'Bookmark message'}
                                        >
                                          {bookmarkedIds.has(message.id) ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                                        </motion.button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="text-xs bg-gray-900 text-white border-gray-700">
                                        {bookmarkedIds.has(message.id) ? 'Unbookmark' : 'Bookmark'}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <motion.button
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => reactToMessage(message.id, "like")}
                                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-lg border backdrop-blur-sm ${
                                            message.reaction === "like"
                                              ? "bg-violet-50 text-violet-600 border-violet-300 shadow-violet-500/20"
                                              : "bg-white/95 hover:bg-gray-50 text-gray-400 hover:text-violet-600 border-gray-200/80 hover:border-violet-300"
                                          }`}
                                        >
                                          <ThumbsUp className="w-3.5 h-3.5" />
                                        </motion.button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="text-xs bg-gray-900 text-white border-gray-700">Helpful</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <motion.button
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => {
                                            reactToMessage(message.id, "dislike");
                                            // Open feedback dialog for detailed feedback
                                            setFeedbackMessageId(message.id);
                                            setShowFeedbackDialog(true);
                                          }}
                                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-lg border backdrop-blur-sm ${
                                            message.reaction === "dislike"
                                              ? "bg-red-50 text-red-600 border-red-300 shadow-red-500/20"
                                              : "bg-white/95 hover:bg-gray-50 text-gray-400 hover:text-red-500 border-gray-200/80 hover:border-red-300"
                                          }`}
                                        >
                                          <ThumbsDown className="w-3.5 h-3.5" />
                                        </motion.button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="text-xs bg-gray-900 text-white border-gray-700">Not helpful - Give feedback</TooltipContent>
                                    </Tooltip>
                                  </motion.div>
                                )}
                              </div>
                            </div>

                            {/* Action buttons - Enhanced */}
                            {message.actions && message.role === "assistant" && (
                              <motion.div 
                                className="flex flex-wrap gap-2.5 pl-14"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                              >
                                {message.actions.map((action, idx) => (
                                  <motion.button
                                    key={idx}
                                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ delay: 0.3 + idx * 0.08, type: "spring", damping: 15 }}
                                    whileHover={{ scale: 1.03, y: -2 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => handleAction(action.action)}
                                    className={`text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all font-medium ${
                                      action.variant === "primary"
                                        ? "bg-violet-500 hover:bg-violet-600 text-white shadow-md hover:shadow-lg"
                                        : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300"
                                    }`}
                                  >
                                    {action.icon && <action.icon className="w-4 h-4" />}
                                    {action.label}
                                    <ExternalLink className="w-3 h-3 opacity-60" />
                                  </motion.button>
                                ))}
                              </motion.div>
                            )}

                            {/* ENHANCED: Clarification prompts with visual indicator */}
                            {message.clarificationNeeded && message.clarificationPrompts && message.clarificationPrompts.length > 0 && (
                              <motion.div 
                                className="pl-14"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                              >
                                <div className="text-xs text-amber-600 font-medium mb-2 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  Need more details? Try one of these:
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {message.clarificationPrompts.map((prompt, idx) => (
                                    <motion.button
                                      key={idx}
                                      initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      transition={{ delay: 0.4 + idx * 0.06, type: "spring", damping: 15 }}
                                      whileHover={{ scale: 1.05, y: -1 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => handleSendMessage(prompt)}
                                      className="text-[13px] px-4 py-2 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200 hover:border-amber-300 transition-all shadow-sm hover:shadow-md font-medium"
                                    >
                                      {prompt}
                                    </motion.button>
                                  ))}
                                </div>
                              </motion.div>
                            )}

                            {/* Suggestions - Enhanced as pills */}
                            {message.suggestions && message.suggestions.length > 0 && message.role === "assistant" && !message.clarificationNeeded && (
                              <motion.div 
                                className="flex flex-wrap gap-2 pl-14 max-w-full overflow-x-auto pb-1"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                              >
                                {message.suggestions.map((suggestion, idx) => (
                                  <motion.button
                                    key={idx}
                                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ delay: 0.5 + idx * 0.06, type: "spring", damping: 15 }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => handleSendMessage(suggestion)}
                                    className="text-sm px-4 py-2 rounded-full bg-white hover:bg-violet-50 text-gray-600 hover:text-violet-700 border border-gray-200 hover:border-violet-300 transition-all shadow-sm hover:shadow-md font-medium flex-shrink-0"
                                  >
                                    {suggestion}
                                  </motion.button>
                                ))}
                              </motion.div>
                            )}
                          </motion.div>
                        ))}

                        {/* Enhanced typing indicator with animated thinking status */}
                        {isLoading && (
                          <motion.div
                            role="status"
                            aria-live="polite"
                            aria-label="AI is analyzing your question"
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className="flex items-start gap-3"
                          >
                            <div 
                              className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md flex-shrink-0"
                            >
                              <Loader2 className="w-4.5 h-4.5 text-white animate-spin" />
                            </div>
                            <div className="bg-white rounded-2xl rounded-bl-lg px-5 py-4 shadow-sm border border-gray-200 min-w-[220px]">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="flex gap-1.5">
                                  <motion.span
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                                    transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
                                    className="w-2 h-2 bg-violet-500 rounded-full"
                                  />
                                  <motion.span
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.15, ease: "easeInOut" }}
                                    className="w-2 h-2 bg-violet-400 rounded-full"
                                  />
                                  <motion.span
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.3, ease: "easeInOut" }}
                                    className="w-2 h-2 bg-violet-300 rounded-full"
                                  />
                                </div>
                                <span className="text-sm font-semibold text-violet-600">Thinking</span>
                              </div>
                              <motion.div 
                                className="space-y-2"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                              >
                                <motion.p 
                                  className="text-xs text-gray-600 flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.3 }}
                                >
                                  <Search className="w-3 h-3 text-violet-500" />
                                  Searching contracts with RAG...
                                </motion.p>
                                <motion.p 
                                  className="text-xs text-gray-500 flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 0.8, x: 0 }}
                                  transition={{ delay: 0.6 }}
                                >
                                  <FileText className="w-3 h-3 text-violet-500" />
                                  Analyzing relevant clauses...
                                </motion.p>
                              </motion.div>
                              {/* Cancel button */}
                              <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1 }}
                                onClick={cancelCurrentRequest}
                                className="mt-3 text-xs text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-red-50 font-medium"
                              >
                                <X className="w-3 h-3" />
                                Cancel request
                              </motion.button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </ScrollArea>
                    {isScrolledUp && messages.length > 2 && (
                      <button
                        type="button"
                        onClick={jumpToLatest}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-slate-800 transition-all"
                        aria-label="Jump to latest message"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 3a1 1 0 01.77.363l5 6a1 1 0 01-1.54 1.274L11 6.747V16a1 1 0 11-2 0V6.747l-3.23 3.89a1 1 0 01-1.54-1.274l5-6A1 1 0 0110 3z" clipRule="evenodd" transform="rotate(180 10 10)" />
                        </svg>
                        Jump to latest
                      </button>
                    )}
                  </div>

                  {/* Quick Actions - Enhanced with better visual hierarchy */}
                  {messages.length === 1 && (
                    <div className="px-6 pb-4 bg-white">
                      <div className="text-sm text-gray-600 mb-3 flex items-center gap-2 font-semibold">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Suggested Queries
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {QUICK_ACTIONS.map((action, idx) => (
                          <motion.button
                            key={idx}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: idx * 0.08, type: "spring", damping: 15 }}
                            whileHover={{ scale: 1.03, y: -3 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleSendMessage(action.query)}
                            className="group flex items-center gap-3.5 p-4 sm:p-3 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 hover:border-violet-300 transition-all text-left shadow-sm hover:shadow-md"
                          >
                            <div
                              className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center flex-shrink-0 shadow-md`}
                            >
                              <action.icon className="w-5 h-5 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-semibold text-gray-800 group-hover:text-violet-700 block truncate transition-colors">
                                {action.label}
                              </span>
                              <span className="text-xs text-gray-500 group-hover:text-gray-600 block truncate mt-0.5 transition-colors">
                                {action.description}
                              </span>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Send className="w-4 h-4 text-violet-500" />
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Input area - Enhanced with better visual design */}
                  <div className="p-6 border-t border-gray-200 bg-white">
                    {/* Regenerate / Edit last-message controls + Prompt library */}
                    {!isLoading && (
                      <div className="flex items-center gap-2 mb-3 relative">
                        <button
                          type="button"
                          onClick={() => setShowPromptLibrary((v) => !v)}
                          aria-expanded={showPromptLibrary}
                          aria-haspopup="menu"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-violet-700 bg-gray-50 hover:bg-violet-50 border border-gray-200 hover:border-violet-300 rounded-full px-3 py-1.5 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Prompts
                        </button>
                        {showPromptLibrary && (
                          <div
                            role="menu"
                            aria-label="Prompt library"
                            className="absolute bottom-full left-0 mb-2 w-[320px] max-h-[320px] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-2"
                          >
                            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                              Quick prompts
                            </div>
                            {[
                              { label: 'Summarize this contract', text: 'Give me a concise executive summary of this contract covering parties, term, value, key obligations, and notable risks.' },
                              { label: 'Find renewal terms', text: 'What are the renewal terms, auto-renewal clauses, and notice periods? When must we act?' },
                              { label: 'List key obligations', text: 'List all obligations for each party with deadlines and owners. Flag anything overdue or ambiguous.' },
                              { label: 'Identify top risks', text: 'Identify the top 5 commercial and legal risks in this contract, ranked by severity, with a short mitigation for each.' },
                              { label: 'Extract financial terms', text: 'Extract all financial terms: fees, payment schedule, caps, penalties, indexation, and currency.' },
                              { label: 'Compare to playbook', text: 'Flag clauses that deviate from our standard playbook positions and suggest fallback language.' },
                              { label: 'Termination + exit', text: 'Explain termination rights, notice periods, cure rights, transition obligations, and fees on exit.' },
                              { label: 'What changed vs prior version?', text: 'If a prior version exists, summarize material changes and their impact. Otherwise say no prior version is available.' },
                            ].map((p) => (
                              <button
                                key={p.label}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setInput(p.text);
                                  setShowPromptLibrary(false);
                                  setTimeout(() => inputRef.current?.focus(), 50);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-violet-50 rounded-lg transition-colors"
                              >
                                <div className="text-sm font-medium text-gray-800">{p.label}</div>
                                <div className="text-[11px] text-gray-500 truncate">{p.text}</div>
                              </button>
                            ))}
                          </div>
                        )}
                        {messages.some((m) => m.role === 'assistant' && m.id !== 'welcome') && (
                          <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 text-xs font-medium text-gray-600 overflow-hidden">
                            <button
                              type="button"
                              onClick={handleRegenerate}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                              title="Regenerate with current mode"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Regenerate
                            </button>
                            <div className="w-px bg-gray-200" />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center px-2 py-1.5 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                                  title="Regenerate with different mode"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-white border-gray-200 rounded-xl shadow-lg w-44">
                                {(['fast', 'balanced', 'deep'] as const).map((mode) => (
                                  <DropdownMenuItem
                                    key={mode}
                                    onClick={() => { setChatMode(mode); setTimeout(() => handleRegenerate(), 0); }}
                                    className="hover:bg-gray-100 cursor-pointer py-2 text-sm capitalize"
                                  >
                                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${mode === chatMode ? 'bg-violet-500' : 'bg-gray-300'}`} />
                                    Regenerate · {mode}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                        {messages.some((m) => m.role === 'user') && (
                          <button
                            type="button"
                            onClick={handleEditLastUser}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-violet-700 bg-gray-50 hover:bg-violet-50 border border-gray-200 hover:border-violet-300 rounded-full px-3 py-1.5 transition-colors"
                          >
                            <Keyboard className="w-3.5 h-3.5" />
                            Edit last message
                          </button>
                        )}
                        {!offlineQueue.isOnline && (
                          <span className="ml-auto text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                            Offline · messages will queue
                          </span>
                        )}
                      </div>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                      }}
                      className="flex gap-3"
                    >
                      <div className="relative flex-1 group">
                        {/* Slash command popover */}
                        {input.startsWith('/') && !input.includes(' ') && (() => {
                          const q = input.slice(1).toLowerCase();
                          const matches = SLASH_COMMANDS.filter(c => c.cmd.slice(1).startsWith(q)).slice(0, 6);
                          if (matches.length === 0) return null;
                          const active = slashIndex % matches.length;
                          return (
                            <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden z-10 dark:bg-slate-900 dark:border-slate-700">
                              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 dark:bg-slate-800 dark:text-slate-400">
                                Slash commands · Tab or Enter to use
                              </div>
                              {matches.map((c, i) => (
                                <button
                                  key={c.cmd}
                                  type="button"
                                  onMouseEnter={() => setSlashIndex(i)}
                                  onClick={() => {
                                    setInput(c.prompt);
                                    setSlashIndex(0);
                                    setTimeout(() => inputRef.current?.focus(), 0);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm flex items-start gap-3 transition-colors ${i === active ? 'bg-violet-50 dark:bg-violet-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                                >
                                  <span className="font-mono text-[11px] font-semibold text-violet-600 dark:text-violet-400 mt-0.5 w-20 shrink-0">{c.cmd}</span>
                                  <span className="flex-1 min-w-0">
                                    <span className="block text-gray-900 dark:text-slate-100 font-medium">{c.label}</span>
                                    <span className="block text-[11px] text-gray-500 dark:text-slate-400 line-clamp-1">{c.prompt}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                        <Input
                          ref={inputRef}
                          value={input}
                          onChange={(e) => { setInput(e.target.value); setSlashIndex(0); }}
                          onKeyDown={(e) => {
                            if (!input.startsWith('/') || input.includes(' ')) return;
                            const q = input.slice(1).toLowerCase();
                            const matches = SLASH_COMMANDS.filter(c => c.cmd.slice(1).startsWith(q));
                            if (matches.length === 0) return;
                            if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => i + 1); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex(i => i - 1 + matches.length); }
                            else if (e.key === 'Tab' || (e.key === 'Enter' && matches.length > 0)) {
                              e.preventDefault();
                              const picked = matches[slashIndex % matches.length];
                              setInput(picked.prompt);
                              setSlashIndex(0);
                            } else if (e.key === 'Escape') {
                              setInput('');
                            }
                          }}
                          aria-label="Chat message input"
                          autoComplete="off"
                          placeholder={currentContractId 
                            ? "Ask about this contract..." 
                            : messages.length > 1 
                              ? "Continue the conversation..." 
                              : "Try: 'Summarize Deloitte contracts from 2024'"
                          }
                          disabled={isLoading}
                          className="w-full bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-2xl pr-24 focus:border-violet-500 focus:ring-violet-500/30 focus:ring-2 h-14 text-base px-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          {/* Voice input button - Enhanced */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.button
                                type="button"
                                onClick={toggleVoiceInput}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                                  isListening
                                    ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md shadow-red-500/25"
                                    : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                                }`}
                              >
                                {isListening ? (
                                  <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ repeat: Infinity, duration: 0.5 }}
                                  >
                                    <MicOff className="w-4 h-4" />
                                  </motion.div>
                                ) : (
                                  <Mic className="w-4 h-4" />
                                )}
                              </motion.button>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs bg-gray-900 text-white border-gray-700">
                              {isListening ? "Stop listening" : "Voice input"}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        {isLoading ? (
                          <Button
                            type="button"
                            size="icon"
                            aria-label="Stop generating"
                            onClick={cancelCurrentRequest}
                            className="h-14 w-14 rounded-2xl bg-red-500 hover:bg-red-600 shadow-md hover:shadow-lg transition-all duration-200"
                          >
                            <X className="w-5 h-5" />
                            <span className="sr-only">Stop generating</span>
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            size="icon"
                            disabled={!input.trim()}
                            aria-label={!input.trim() ? "Type a message to send" : "Send message"}
                            className="h-14 w-14 rounded-2xl bg-violet-500 hover:bg-violet-600 shadow-md hover:shadow-lg disabled:opacity-50 disabled:brightness-75 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
                          >
                            <Send className="w-5 h-5" />
                          </Button>
                        )}
                      </motion.div>
                    </form>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500 flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs text-gray-600 font-mono shadow-sm">Enter</kbd>
                          <span>send</span>
                        </span>
                        {!isEmbedded && (
                          <span className="text-xs text-gray-500 flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs text-gray-600 font-mono shadow-sm">⌘/</kbd>
                            <span>toggle</span>
                          </span>
                        )}
                        {input.length > 0 && (
                          <span className={`text-xs font-medium tabular-nums ${input.length > 4000 ? 'text-rose-600' : input.length > 2000 ? 'text-amber-600' : 'text-gray-400'}`}>
                            {input.length.toLocaleString()} chars · ~{Math.ceil(input.length / 4).toLocaleString()} tokens
                          </span>
                        )}
                      </div>
                      <motion.button 
                        onClick={() => setShowExamples(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors font-medium"
                      >
                        <Sparkles className="w-3 h-3" />
                        View examples
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bookmarks panel */}
        <AnimatePresence>
          {showBookmarksPanel && (
            <motion.div
              key="bookmarks"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setShowBookmarksPanel(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="bg-white border border-gray-200/80 rounded-3xl w-full max-w-md shadow-2xl max-h-[70vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h3 className="text-gray-900 font-bold flex items-center gap-2.5 text-lg">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                      <BookmarkCheck className="w-4 h-4 text-violet-600" />
                    </div>
                    Bookmarks
                  </h3>
                  <button
                    onClick={() => setShowBookmarksPanel(false)}
                    className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {messages.filter((m) => bookmarkedIds.has(m.id)).length === 0 ? (
                    <div className="text-center text-sm text-gray-500 py-12">No bookmarks yet</div>
                  ) : (
                    messages
                      .filter((m) => bookmarkedIds.has(m.id))
                      .map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setShowBookmarksPanel(false);
                            setTimeout(() => scrollToMessage(m.id), 100);
                          }}
                          className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-600 mb-1">
                                {m.role === 'user' ? 'You' : 'ConTigo AI'} · {m.timestamp.toLocaleString()}
                              </div>
                              <div className="text-sm text-gray-700 line-clamp-3">
                                {m.content.slice(0, 240)}{m.content.length > 240 ? '…' : ''}
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleBookmark(m.id); }}
                              className="text-gray-400 hover:text-rose-500 transition-colors p-1"
                              title="Remove bookmark"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </button>
                      ))
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keyboard shortcuts modal - Enhanced */}
        <AnimatePresence>
          {showShortcuts && (
            <motion.div key="shortcuts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center"
              onClick={() => setShowShortcuts(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="bg-white border border-gray-200/80 rounded-3xl p-6 w-80 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-gray-900 font-bold flex items-center gap-2.5 text-lg">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-gray-200 flex items-center justify-center shadow-sm">
                      <Keyboard className="w-4 h-4 text-gray-600" />
                    </div>
                    Shortcuts
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowShortcuts(false)}
                    className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
                <div className="space-y-2.5">
                  {KEYBOARD_SHORTCUTS.map((shortcut, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-sm text-gray-700 font-medium">{shortcut.action}</span>
                      <kbd className="px-2.5 py-1 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-mono shadow-sm">
                        {shortcut.key}
                      </kbd>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Example prompts modal - Enhanced */}
        <AnimatePresence>
          {showExamples && (
            <motion.div key="examples"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setShowExamples(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="bg-white border border-gray-200/80 rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-gray-900 font-bold text-lg flex items-center gap-2.5">
                    <motion.div 
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/25"
                    >
                      <Sparkles className="w-5 h-5 text-white" />
                    </motion.div>
                    Example Prompts
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowExamples(false)}
                    className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
                <p className="text-sm text-gray-500 mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  💡 Click any prompt to try it, or use these as inspiration for your own questions.
                </p>
                <div className="space-y-6">
                  {EXAMPLE_PROMPTS.map((category, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <category.icon className="w-4 h-4 text-gray-400" />
                        <h4 className="text-sm font-medium text-gray-700">{category.category}</h4>
                      </div>
                      <div className="space-y-2">
                        {category.prompts.map((prompt, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => {
                              setShowExamples(false);
                              handleSendMessage(prompt);
                            }}
                            className="w-full text-left px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 hover:border-gray-200 text-sm text-gray-700 hover:text-gray-900 transition-all group"
                          >
                            <span className="flex items-center justify-between">
                              {prompt}
                              <Send className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-violet-500 transition-opacity" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 text-center">
                    💡 Tip: The AI remembers context, so you can ask follow-up questions!
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Citation Source Preview */}
        <AnimatePresence>
          {activeCitationPreview && (
            <motion.div
              key="citation-preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setActiveCitationPreview(null)}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 18 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 18 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-600">
                      <span className="rounded-full bg-violet-100 px-2 py-0.5">[{activeCitationPreview.index}] Grounded source</span>
                      {activeCitationPreview.source.matchType && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                          {activeCitationPreview.source.matchType}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-gray-900">
                      {activeCitationPreview.source.contractName}
                    </h3>
                    {(activeCitationPreview.source.heading || activeCitationPreview.source.section) && (
                      <p className="mt-1 text-sm text-gray-500">
                        {activeCitationPreview.source.heading || activeCitationPreview.source.section}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setActiveCitationPreview(null)}
                    className="h-9 w-9 rounded-xl"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="px-5 py-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-violet-50 px-2 py-1 font-semibold text-violet-700 border border-violet-200/70">
                      {Math.round(activeCitationPreview.source.score * 100)}% relevance
                    </span>
                    {(typeof activeCitationPreview.source.startOffset === 'number' || typeof activeCitationPreview.source.endOffset === 'number') && (
                      <span className="rounded-full bg-slate-50 px-2 py-1 font-medium text-slate-600 border border-slate-200">
                        Span {typeof activeCitationPreview.source.startOffset === 'number' ? activeCitationPreview.source.startOffset : '?'}
                        {typeof activeCitationPreview.source.endOffset === 'number' ? `-${activeCitationPreview.source.endOffset}` : ''}
                      </span>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Quoted excerpt</p>
                    <blockquote className="mt-2 text-sm leading-6 text-gray-700 whitespace-pre-wrap border-l-2 border-violet-300 pl-3">
                      {activeCitationPreview.source.snippet || 'No excerpt available for this source.'}
                    </blockquote>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        await copy(activeCitationPreview.source.snippet || activeCitationPreview.source.contractName);
                      }}
                      className="rounded-xl"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy excerpt
                    </Button>
                    <Button
                      type="button"
                      onClick={() => openCitationInContract(activeCitationPreview)}
                      className="rounded-xl bg-violet-500 hover:bg-violet-600"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Open contract
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat History Search Dialog */}
        <AnimatePresence>
          {showSearchDialog && (
            <motion.div key="search-dialog"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setShowSearchDialog(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Search className="w-5 h-5 text-violet-500" />
                    Search Chat History
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSearchDialog(false)}
                    className="h-8 w-8 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="p-4 overflow-y-auto max-h-[calc(80vh-70px)]">
                  <ChatHistorySearch
                    onOpenConversation={(conversationId) => {
                      // Load selected conversation
                      if (persistence.switchConversation) {
                        persistence.switchConversation(conversationId);
                      }
                      setShowSearchDialog(false);
                    }}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Export Chat Dialog */}
        <ExportChatDialog
          conversation={{
            id: persistence.conversationId || 'current',
            title: currentContractId 
              ? `Contract ${currentContractId} Conversation` 
              : 'AI Chat Conversation',
            messages: messages.map(m => ({
              id: m.id,
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
              timestamp: m.timestamp.toISOString(),
            })),
            createdAt: messages[0]?.timestamp.toISOString() || new Date().toISOString(),
            updatedAt: messages[messages.length - 1]?.timestamp.toISOString() || new Date().toISOString(),
            contractId: currentContractId || undefined,
          }}
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          onExportComplete={(_format) => {
            // Export completed successfully
          }}
        />

        {/* Safety Appeal Modal */}
        {safetyAppeal && <SafetyAppealModal
          appeal={safetyAppeal}
          submitting={appealSubmitting}
          onSubmit={submitSafetyAppeal}
          onClose={() => setSafetyAppeal(null)}
        />}

        {/* AI Feedback Dialog - Round 3 Enhancement */}
        <AIFeedbackDialog
          open={showFeedbackDialog}
          onOpenChange={setShowFeedbackDialog}
          messageId={feedbackMessageId || ''}
          messageContent={
            feedbackMessageId 
              ? messages.find(m => m.id === feedbackMessageId)?.content ?? ''
              : ''
          }
          conversationId={persistence.conversationId || undefined}
          onFeedbackSubmitted={() => {
            setShowFeedbackDialog(false);
            setFeedbackMessageId(null);
          }}
        />

        {/* Offline Status Indicator */}
        <OfflineStatusIndicator 
          position="fixed"
          className="bottom-4 left-4 z-[52]"
          showDetails={true}
        />
      </>
    </TooltipProvider>
  );
}

/**
 * Safety Appeal Modal - shown when a user message is blocked by input guardrails.
 * Allows the user to review the block reason and optionally submit an appeal.
 */
function SafetyAppealModal({
  appeal,
  submitting,
  onSubmit,
  onClose,
}: {
  appeal: { reason: string; category?: string; originalMessage: string };
  submitting: boolean;
  onSubmit: (notes: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  return (
    <AnimatePresence>
      <motion.div
        key="safety-appeal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          key="safety-appeal-card"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
            <div className="rounded-lg bg-amber-100 dark:bg-amber-900/40 p-2">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Message blocked by safety filter
              </h3>
              {appeal.category && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {appeal.category}
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {appeal.reason || "Your message couldn\u2019t be processed by the AI due to a safety policy."}
            </p>
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                Appeal (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Explain why this should be allowed (e.g., legitimate contract clause, quoted third-party text, etc.)"
                rows={4}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => onSubmit(notes)}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Submitting
                </>
              ) : (
                "Submit appeal"
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Wrapped FloatingAIBubble with Error Boundary
 * Provides graceful error handling for the entire chatbot component
 */
export function FloatingAIBubbleWithErrorBoundary() {
  return (
    <AIErrorBoundary
      errorTitle="AI Chat Unavailable"
      errorDescription="The AI assistant encountered an error. You can try again or contact support if the problem persists."
      onError={(error, errorInfo) => {
        console.error('[FloatingAIBubble] Error:', error);
        console.error('[FloatingAIBubble] Error Info:', errorInfo);
      }}
    >
      <FloatingAIBubble />
    </AIErrorBoundary>
  );
}
