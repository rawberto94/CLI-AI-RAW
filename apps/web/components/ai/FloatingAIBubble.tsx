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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useChatPersistence } from "@/hooks/useChatPersistence";

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
  {
    icon: Shield,
    label: "Compliance",
    query: "Show me compliance status",
    color: "from-emerald-500 to-teal-500",
    description: "Risk & compliance overview",
  },
  {
    icon: DollarSign,
    label: "Cost Analysis",
    query: "Analyze my contract costs",
    color: "from-rose-500 to-pink-500",
    description: "Spending breakdown",
  },
  {
    icon: FileText,
    label: "Categories",
    query: "Show me all procurement categories",
    color: "from-slate-500 to-gray-600",
    description: "Taxonomy & categorization",
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
      "Show me contracts over $100,000",
    ],
  },
  {
    category: "Compare",
    icon: DollarSign,
    prompts: [
      "Compare Deloitte vs Accenture contracts",
      "What's the difference between Microsoft and AWS agreements?",
      "Compare payment terms in IBM and Oracle contracts",
      "Compare termination clauses between Deloitte and KPMG",
    ],
  },
  {
    category: "Risk & Renewals",
    icon: Shield,
    prompts: [
      "What contracts expire in the next 30 days?",
      "Show me contracts with auto-renewal clauses",
      "Which contracts are high risk?",
    ],
  },
  {
    category: "Search",
    icon: Search,
    prompts: [
      "Find all IT services contracts",
      "Show me contracts with AWS",
      "List active MSAs",
    ],
  },
];

const INITIAL_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "👋 Hey! I'm **ConTigo AI**, your intelligent contract assistant powered by RAG technology.\n\n**What I can do:**\n• 🔍 **Smart Search** - Find contracts by supplier, type, value, or any criteria\n• 📊 **Deep Analysis** - Get summaries, spending insights, and duration patterns\n• 🔄 **Compare Contracts** - Side-by-side supplier comparison with rates and clauses\n• ⚠️ **Risk Alerts** - Track expirations, auto-renewals, and compliance\n\n**Pro Tips:**\n• Try: \"Compare Deloitte vs Accenture contracts\"\n• Ask follow-ups: I remember our conversation context\n• Click suggestions below or type anything!\n\nWhat would you like to explore?",
  timestamp: new Date(),
  suggestions: ["📊 Contract summary", "🔄 Compare suppliers", "⏰ Expiring soon", "💰 Top suppliers"],
  metadata: {
    confidence: 1,
    source: "system",
  },
};

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
  const [_streamingContent, setStreamingContent] = useState<string>("");
  
  // Artifact context state - for real-time updates
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [lastArtifactUpdate, setLastArtifactUpdate] = useState<Date | null>(null);
  
  // Enhanced features - Round 2
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // Round 3 Enhancements - New State
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);
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
      setStreamingContent("");
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
    window.addEventListener('realtime-event', ((e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === 'artifact:updated') {
        handleArtifactUpdate(customEvent);
      }
    }) as EventListener);
    
    // Also listen for custom artifact update events
    window.addEventListener('artifact-updated', handleArtifactUpdate as EventListener);
    
    return () => {
      window.removeEventListener('realtime-event', handleArtifactUpdate as EventListener);
      window.removeEventListener('artifact-updated', handleArtifactUpdate as EventListener);
    };
  }, [currentContractId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  // Process pending auto-message when chat opens
  useEffect(() => {
    if (isOpen && pendingAutoMessageRef.current && !isLoading) {
      const autoMessage = pendingAutoMessageRef.current;
      pendingAutoMessageRef.current = null; // Clear the ref
      
      // Small delay to ensure chat is fully rendered, then set input
      const timer = setTimeout(() => {
        setInput(autoMessage);
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
    setStreamingContent("");
    
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
            conversationHistory: messages.slice(-10).map(m => ({
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
            },
            useRAG: true,
          }),
        });

        if (!response.ok) {
          // Try to parse error body for specific error types
          let errorBody: { error?: string; message?: string } | null = null;
          try {
            errorBody = await response.clone().json();
          } catch { /* ignore parse errors */ }

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

        setStreamingContent("");
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
            conversationHistory: messages.slice(-10).map(m => ({
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
          snippet: r.text?.slice(0, 150),
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
        
        // Persist assistant message to database
        if (persistence.isAuthenticated && persistence.conversationId) {
          persistence.addMessage({
            role: 'assistant',
            content: assistantMessage.content,
            metadata: assistantMessage.metadata as Record<string, unknown>,
          }).catch(() => {
            // Continue even if persistence fails
          });
        }
      }
      
      if (!isOpen) setHasNewMessage(true);
      updateContext(messageContent);
    } catch (error) {
      // Clear timeout on any error
      clearTimeout(timeoutId);
      
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
                          ConTigo AI
                          <Badge className="bg-violet-50 text-violet-700 text-[10px] border-violet-200/50 px-2 py-0.5 font-medium">
                            <Zap className="w-2.5 h-2.5 mr-1" />
                            RAG
                          </Badge>
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
                      
                      {/* History Panel Toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50"
                        onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                      >
                        <History className="w-5 h-5" />
                      </Button>
                      
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
                        <DropdownMenuContent align="end" className="bg-white border-gray-200 text-gray-900 min-w-[200px] shadow-lg">
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
                          <DropdownMenuSeparator className="bg-gray-200" />
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
                  <div className="flex-1 overflow-hidden bg-gray-50/50">
                    <ScrollArea className="h-full">
                      <div ref={scrollRef} className="p-6 space-y-5">
                        {messages.map((message, msgIndex) => (
                          <motion.div
                            key={message.id}
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

                                  <MarkdownContent
                                    content={message.content}
                                    className={`text-[15px] leading-relaxed ${message.role === "user" ? "prose-invert text-white" : ""}`}
                                  />
                                  
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
                                              className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 hover:border-violet-300 transition-colors cursor-pointer"
                                              onClick={() => window.open(`/contracts/${src.contractId}`, '_blank')}
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                <FileText className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                                                <span className="truncate font-medium">{src.contractName}</span>
                                              </div>
                                              <span className="text-xs font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded flex-shrink-0">
                                                {Math.round(src.score * 100)}%
                                              </span>
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
                  </div>

                  {/* Quick Actions - Enhanced with better visual hierarchy */}
                  {messages.length === 1 && (
                    <div className="px-6 pb-4 bg-white">
                      <div className="text-sm text-gray-600 mb-3 flex items-center gap-2 font-semibold">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Suggested Queries
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {QUICK_ACTIONS.slice(0, 4).map((action, idx) => (
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
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                      }}
                      className="flex gap-3"
                    >
                      <div className="relative flex-1 group">
                        <Input
                          ref={inputRef}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
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
                        <Button
                          type="submit"
                          size="icon"
                          disabled={!input.trim() || isLoading}
                          aria-label={isLoading ? "Sending message" : !input.trim() ? "Type a message to send" : "Send message"}
                          className="h-14 w-14 rounded-2xl bg-violet-500 hover:bg-violet-600 shadow-md hover:shadow-lg disabled:opacity-50 disabled:brightness-75 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span className="sr-only">Sending message...</span>
                            </>
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                        </Button>
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
