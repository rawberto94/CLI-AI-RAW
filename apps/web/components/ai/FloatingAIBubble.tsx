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
    color: "from-violet-500 to-pink-500",
    description: "Analytics & trends",
  },
  {
    icon: Search,
    label: "Search",
    query: "Help me find a specific contract",
    color: "from-violet-500 to-violet-500",
    description: "Find contracts quickly",
  },
  {
    icon: Shield,
    label: "Compliance",
    query: "Show me compliance status",
    color: "from-violet-500 to-purple-500",
    description: "Risk & compliance overview",
  },
  {
    icon: DollarSign,
    label: "Cost Analysis",
    query: "Analyze my contract costs",
    color: "from-violet-500 to-purple-500",
    description: "Spending breakdown",
  },
  {
    icon: FileText,
    label: "Categories",
    query: "Show me all procurement categories",
    color: "from-violet-500 to-purple-500",
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
      '<a href="/contracts/$2" class="text-violet-600 hover:text-violet-800 underline font-medium" target="_blank">$1</a>')
    // Convert other markdown links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, 
      '<a href="$2" class="text-violet-600 hover:text-violet-800 underline" target="_blank">$1</a>')
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
  };
  return labels[name] || name.replace(/_/g, ' ');
}

// Get page context for better RAG targeting
function getPageContext(pathname: string | null): string {
  if (!pathname) return 'dashboard';
  
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

export function FloatingAIBubble() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Extract contract ID from current page URL
  const currentContractId = useMemo(() => {
    // Check if we're on a contract detail page: /contracts/[id]
    const contractMatch = pathname?.match(/\/contracts\/([^\/]+)/);
    if (contractMatch) return contractMatch[1];
    
    // Check query params for contractId
    const queryContractId = searchParams?.get('contractId');
    if (queryContractId) return queryContractId;
    
    return null;
  }, [pathname, searchParams]);

  // Chat persistence - database-backed with localStorage fallback
  const persistence = useChatPersistence({
    context: currentContractId || undefined,
    contextType: currentContractId ? 'contract' : 'global',
  });

  // Conversation persistence key (for backward compatibility)
  const STORAGE_KEY = 'contigo-chat-history';
  const MAX_STORED_MESSAGES = 50; // Limit stored messages to prevent storage bloat
  
  // Core state
  const [isOpen, setIsOpen] = useState(false);
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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const pendingAutoMessageRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
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
        setIsOpen((prev) => !prev);
      }
      // Close with Escape
      if (e.key === "Escape" && isOpen) {
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
    
  }, [isOpen]);

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

  // Handle action button clicks
  const handleAction = useCallback((action: string) => {
    switch (action) {
      case "view-contracts":
        router.push("/contracts");
        setIsOpen(false);
        break;
      case "view-renewals":
        router.push("/renewals");
        setIsOpen(false);
        break;
      case "view-analytics":
        router.push("/analytics");
        setIsOpen(false);
        break;
      case "set-reminder":
        handleSendMessage("Set a reminder for upcoming renewals");
        break;
      default:
        // Unhandled action - no-op
        break;
    }
    
  }, [router]);

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

    // Persist user message to database (only on first attempt)
    if (retryCount === 0 && persistence.isAuthenticated && persistence.conversationId) {
      persistence.addMessage({
        role: 'user',
        content: messageContent,
      }).catch(() => {
        // Continue even if persistence fails
      });
    }

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
          // Check for retryable status codes
          if (response.status >= 500 && retryCount < MAX_RETRIES) {
            clearTimeout(timeoutId);
            const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 5000);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            return handleSendMessage(messageContent, retryCount + 1);
          }
          throw new Error(`Stream request failed: ${response.status}`);
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

        if (reader) {
          setIsTyping(false); // Start showing streaming content
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === 'content') {
                    accumulatedContent += data.content;
                    setStreamingContent(accumulatedContent);
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
                                { toolName: data.toolName, status: 'running' as const },
                              ],
                            }
                          : m
                      )
                    );
                  } else if (data.type === 'tool_done') {
                    // Update tool progress to done
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? {
                              ...m,
                              toolProgress: (m.toolProgress || []).map((tp) =>
                                tp.toolName === data.toolName
                                  ? {
                                      ...tp,
                                      status: (data.success ? 'done' : 'error') as 'done' | 'error',
                                      summary: data.summary,
                                      navigation: data.navigation,
                                      executionTimeMs: data.executionTimeMs,
                                    }
                                  : tp
                              ),
                            }
                          : m
                      )
                    );
                    // If tool returned navigation, add to suggested actions
                    if (data.suggestedActions) {
                      finalMetadata.suggestedActions = [
                        ...((finalMetadata.suggestedActions as Array<{ label: string; action: string }>) || []),
                        ...data.suggestedActions,
                      ];
                    }
                  } else if (data.type === 'metadata') {
                    finalMetadata = data || {};
                    // Update token usage for cost widget
                    if (data.metadata?.usage) {
                      const usage = data.metadata.usage;
                      setCurrentTokenUsage({
                        promptTokens: usage.prompt_tokens || 0,
                        completionTokens: usage.completion_tokens || 0,
                        totalTokens: usage.total_tokens || 0,
                        model: data.metadata.model || 'gpt-4o-mini',
                        cost: calculateCost(
                          data.metadata.model || 'gpt-4o-mini',
                          usage.prompt_tokens || 0,
                          usage.completion_tokens || 0
                        ),
                      });
                    }
                  } else if (data.type === 'done') {
                    const processingTime = Date.now() - startTime;
                    
                    // Finalize the message with full metadata including tools
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? {
                              ...m,
                              content: accumulatedContent,
                              suggestions: data.suggestions,
                              actions: (data.suggestedActions || (finalMetadata.suggestedActions as Array<{ label: string; action: string }>))?.map((a: { label: string; action: string }) => ({
                                label: a.label,
                                action: a.action,
                              })),
                              metadata: {
                                confidence: data.confidence as number || finalMetadata.confidence as number || 0.95,
                                processingTime,
                                source: "ai-stream-v2",
                                usedRAG: (finalMetadata.sources as string[])?.length > 0,
                                ragSources: finalMetadata.ragSources as RAGSource[],
                                toolsUsed: data.toolsUsed as string[],
                              },
                            }
                          : m
                      )
                    );
                  } else if (data.type === 'error') {
                    throw new Error(data.message || data.error || 'Stream error');
                  }
                } catch {
                  // Parse error, continue
                }
              }
            }
          }
        }

        setStreamingContent("");
        playSound("receive");
        
        // Persist assistant message
        if (persistence.isAuthenticated && persistence.conversationId) {
          persistence.addMessage({
            role: 'assistant',
            content: accumulatedContent,
            metadata: finalMetadata as Record<string, unknown>,
          }).catch(() => {});
        }
        
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
              contractId: currentContractId,
              context: currentContractId ? 'contract-detail' : 'global',
              pageContext,
              currentPage: pathname,
              artifactVersion,
              forceRefresh: artifactVersion > 0,
            },
            useRAG: true,
            useMock: false,
          }),
        });

        const data = await response.json();
        const processingTime = Date.now() - startTime;

        // Update context based on query
        updateContext(messageContent);

        // Check if it's an error response with recovery suggestions
        const isErrorResponse = data.error === true && data.errorRecovery;

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
          content: data.response || data.error || "I couldn't process that request.",
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
        return handleSendMessage(messageContent, retryCount + 1);
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

  // Enhanced AI response generator
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

    // Summary/Overview queries
    if (lowerQuery.includes("summary") || lowerQuery.includes("overview") || lowerQuery.includes("dashboard")) {
      return {
        content:
          "📊 **Your Contract Portfolio**\n\n" +
          "I'm fetching the latest data from your contract database...\n\n" +
          "Please use the **View All Contracts** button to see real-time contract information, or try refreshing the page.\n\n" +
          "💡 **Tip:** For accurate portfolio metrics, visit the Dashboard or Analytics pages.",
        suggestions: ["Show my contracts", "View renewals", "Risk analysis"],
        actions: [
          { label: "View All Contracts", action: "view-contracts", icon: FileText, variant: "primary" },
          { label: "See Analytics", action: "view-analytics", icon: TrendingUp },
        ],
        confidence: 0.90,
        source: "fallback-guide",
      };
    }

    // Renewal queries
    if (lowerQuery.includes("expir") || lowerQuery.includes("renewal") || lowerQuery.includes("soon") || lowerQuery.includes("due")) {
      return {
        content:
          "📅 **Contract Renewals**\n\n" +
          "I'm checking your contract expiration dates...\n\n" +
          "Please use the **View Renewals** button to see real-time renewal information from your database.\n\n" +
          "💡 **Tip:** You can also filter contracts by expiration date on the Contracts page.",
        suggestions: ["Show expiring contracts", "View all contracts", "Set reminders"],
        actions: [
          { label: "View Renewals", action: "view-renewals", icon: Calendar, variant: "primary" },
          { label: "View Contracts", action: "view-contracts", icon: FileText },
        ],
        confidence: 0.90,
        source: "fallback-guide",
      };
    }

    // Insights/Analytics queries
    if (lowerQuery.includes("insight") || lowerQuery.includes("analytics") || lowerQuery.includes("portfolio") || lowerQuery.includes("trend")) {
      return {
        content:
          "💡 **Portfolio Insights**\n\n" +
          "I'm analyzing your contract portfolio in real-time...\n\n" +
          "Please use the **Full Analytics** button to view live metrics and trends from your database.\n\n" +
          "💡 **Tip:** The Analytics page shows real-time data including spend analysis, risk metrics, and renewal tracking.",
        suggestions: ["View analytics", "Show contracts", "Risk analysis"],
        actions: [
          { label: "Full Analytics", action: "view-analytics", icon: TrendingUp, variant: "primary" },
        ],
        confidence: 0.90,
        source: "fallback-guide",
      };
    }

    // Search queries
    if (lowerQuery.includes("find") || lowerQuery.includes("search") || lowerQuery.includes("locate") || lowerQuery.includes("where")) {
      return {
        content:
          "🔍 **Smart Contract Search**\n\n" +
          "I can help you find contracts by:\n\n" +
          "• **Vendor name** - \"Find AWS contracts\"\n" +
          "• **Contract type** - \"Show IT services\"\n" +
          "• **Status** - \"List active contracts\"\n" +
          "• **Date range** - \"Contracts signed in 2024\"\n" +
          "• **Value** - \"Contracts over $50,000\"\n" +
          "• **Keywords** - \"Find SLA terms\"\n\n" +
          "**Try these examples:**\n" +
          "• \"Find all cloud services contracts\"\n" +
          "• \"Show contracts expiring in Q1\"\n" +
          "• \"List vendors by spend\"",
        suggestions: ["All contracts", "By vendor", "By type", "Recent uploads"],
        confidence: 0.92,
        source: "search-assistant",
      };
    }

    // Compliance/Risk queries
    if (lowerQuery.includes("complian") || lowerQuery.includes("risk") || lowerQuery.includes("audit")) {
      return {
        content:
          "🛡️ **Compliance & Risk Dashboard**\n\n" +
          "**Overall Status: ✅ Healthy**\n\n" +
          "**Compliance Score: 94%**\n" +
          "• Required signatures: ✅ Complete\n" +
          "• Document retention: ✅ Compliant\n" +
          "• SLA monitoring: ✅ Active\n" +
          "• Audit trail: ✅ Complete\n\n" +
          "**Risk Assessment: Low (23/100)**\n" +
          "• Vendor concentration: Low\n" +
          "• Contract gaps: None\n" +
          "• Renewal risk: 3 contracts flagged\n\n" +
          "**⚠️ Attention Items:**\n" +
          "• Review AWS contract terms before renewal\n" +
          "• Update Accenture contact information",
        suggestions: ["Risk breakdown", "Compliance report", "Audit history", "Improvement tips"],
        confidence: 0.97,
        source: "compliance-engine",
      };
    }

    // Cost analysis queries
    if (lowerQuery.includes("cost") || lowerQuery.includes("spend") || lowerQuery.includes("budget") || lowerQuery.includes("money") || lowerQuery.includes("save")) {
      return {
        content:
          "💰 **Cost Analysis Report**\n\n" +
          "**Total Annual Spend: $255,500**\n\n" +
          "**By Category:**\n" +
          "• Cloud Services: $78,000 (31%)\n" +
          "• IT Services: $120,000 (47%)\n" +
          "• Software Licenses: $45,000 (18%)\n" +
          "• Other: $12,500 (4%)\n\n" +
          "**Savings Opportunities:**\n" +
          "💡 Cloud consolidation: ~$8,000/year\n" +
          "💡 License optimization: ~$5,500/year\n" +
          "💡 Early renewal discounts: ~$5,000/year\n\n" +
          "**Total Potential Savings: $18,500/year**",
        suggestions: ["Implement savings", "Vendor comparison", "Budget forecast", "ROI analysis"],
        confidence: 0.95,
        source: "cost-analytics",
      };
    }

    // Help queries
    if (lowerQuery.includes("help") || lowerQuery.includes("what can") || lowerQuery.includes("how to")) {
      return {
        content:
          "🤖 **How I Can Help You**\n\n" +
          "I'm your AI contract assistant! Here's what I can do:\n\n" +
          "**📊 Analytics & Reports**\n" +
          "• Contract summaries & portfolio overview\n" +
          "• Cost analysis & savings opportunities\n" +
          "• Trend analysis & forecasting\n\n" +
          "**📅 Tracking & Alerts**\n" +
          "• Renewal reminders & deadlines\n" +
          "• Compliance monitoring\n" +
          "• Risk assessments\n\n" +
          "**🔍 Search & Discovery**\n" +
          "• Find contracts by any criteria\n" +
          "• Compare vendors & terms\n" +
          "• Extract key clauses\n\n" +
          "**💡 Recommendations**\n" +
          "• Negotiation strategies\n" +
          "• Best practices\n" +
          "• Process improvements\n\n" +
          "Just ask me anything in natural language!",
        suggestions: ["Contract summary", "Renewals", "Cost analysis", "Compliance"],
        confidence: 1.0,
        source: "help-system",
      };
    }

    // Context-aware follow-up
    if (context.lastTopic) {
      const topicResponses: Record<string, string> = {
        renewals: "Based on our renewal discussion, would you like to set up automated reminders or view the full renewal calendar?",
        contracts: "Continuing with contracts, I can show you detailed analytics, compare vendors, or help you search for specific terms.",
        risk: "Regarding risk management, shall I generate a detailed risk report or show you mitigation strategies?",
        costs: "For cost optimization, I can provide vendor comparisons, suggest negotiation strategies, or forecast next quarter's spend.",
      };

      const topicResponse = context.lastTopic ? topicResponses[context.lastTopic] : undefined;
      if (topicResponse && lowerQuery.length < 20) {
        return {
          content: topicResponse,
          suggestions: ["Yes, please", "Something else", "Go back"],
          confidence: 0.85,
          source: "context-aware",
        };
      }
    }

    // Default response with smart suggestions
    return {
      content:
        "I'm here to help with your contract management needs! I can assist with:\n\n" +
        "📊 **Contract Analytics** - Summaries, trends, insights\n" +
        "📅 **Renewal Tracking** - Deadlines, reminders, alerts\n" +
        "🔍 **Smart Search** - Find any contract or clause\n" +
        "💰 **Cost Analysis** - Spending, savings, budgets\n" +
        "🛡️ **Compliance** - Risk scores, audit trails\n\n" +
        "What would you like to explore?" as string,
      suggestions: ["Contract summary", "Renewals", "Search", "Cost analysis"],
      confidence: 0.90,
      source: "general-assistant",
    };
  };

  // Toggle open state
  const toggleOpen = useCallback(() => {
    setIsOpen(!isOpen);
    if (!isOpen) setHasNewMessage(false);
  }, [isOpen]);

  // Memoized unread count
  const unreadCount = useMemo(() => {
    return hasNewMessage ? 1 : 0;
  }, [hasNewMessage]);

  return (
    <TooltipProvider>
      <>
        {/* Floating Bubble Button - Draggable with better animations */}
        <AnimatePresence>
          {!isOpen && (
            <motion.div
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
                    {/* Animated glow rings */}
                    <motion.span 
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500"
                      animate={{ 
                        scale: [1, 1.3, 1],
                        opacity: [0.3, 0, 0.3]
                      }}
                      transition={{ 
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    <motion.span 
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 via-pink-500 to-purple-500"
                      animate={{ 
                        scale: [1, 1.5, 1],
                        opacity: [0.2, 0, 0.2]
                      }}
                      transition={{ 
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.5
                      }}
                    />

                    {/* Main bubble with refined gradient */}
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 shadow-2xl shadow-violet-500/40 flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:shadow-violet-500/60">
                      {/* Shimmer effect */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/25 to-white/0 animate-shimmer" />
                      
                      {/* Inner glow */}
                      <div className="absolute inset-1 rounded-full bg-gradient-to-br from-white/10 to-transparent" />
                      
                      {/* Icon with subtle animation */}
                      <motion.div 
                        className="relative z-10"
                        animate={{ 
                          y: [0, -2, 0],
                          rotate: [0, 5, -5, 0]
                        }}
                        transition={{ 
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        <Sparkles className="w-7 h-7 text-white drop-shadow-lg" />
                      </motion.div>

                      {/* Floating particles - more refined */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <motion.div 
                          className="absolute w-2 h-2 bg-white/40 rounded-full top-2 left-3 blur-[0.5px]"
                          animate={{ y: [-2, 2, -2], x: [-1, 1, -1], opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <motion.div 
                          className="absolute w-1.5 h-1.5 bg-white/50 rounded-full bottom-3 right-4 blur-[0.5px]"
                          animate={{ y: [2, -2, 2], x: [1, -1, 1], opacity: [0.4, 0.7, 0.4] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                        />
                        <motion.div 
                          className="absolute w-1 h-1 bg-white/60 rounded-full top-4 right-2 blur-[0.5px]"
                          animate={{ y: [-1, 3, -1], opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                        />
                      </div>
                    </div>

                    {/* Notification badge with bounce */}
                    <AnimatePresence>
                      {unreadCount > 0 && (
                        <motion.span
                          initial={{ scale: 0, y: 10 }}
                          animate={{ scale: 1, y: 0 }}
                          exit={{ scale: 0, y: 10 }}
                          transition={{ type: "spring", damping: 10, stiffness: 300 }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-rose-500 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-lg shadow-red-500/30 ring-2 ring-white"
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
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 280 }}
              className={`fixed z-50 ${
                isExpanded
                  ? "inset-2 md:inset-4 lg:inset-8"
                  : "w-[560px] h-[780px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-80px)]"
              }`}
              style={!isExpanded ? {
                bottom: `${16 + position.y}px`,
                right: `${16 + position.x}px`,
              } : undefined}
            >
              <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl shadow-violet-500/20 border border-gray-200/80 backdrop-blur-sm">
                {/* White/Light background with subtle pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-gray-50/50" />
                
                {/* Animated gradient accent at top - also serves as drag handle */}
                <motion.div 
                  className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 cursor-grab active:cursor-grabbing"
                  animate={{
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                  }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                  style={{ backgroundSize: "200% 100%" }}
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                />

                {/* Content */}
                <div className="relative h-full flex flex-col">
                  {/* Header - Enhanced with glassmorphism and drag handle */}
                  <div 
                    className="flex items-center justify-between px-6 py-5 border-b border-gray-200/80 bg-gradient-to-r from-gray-50/90 to-white/90 backdrop-blur-md cursor-grab active:cursor-grabbing select-none"
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                  >
                    <div className="flex items-center gap-4 pointer-events-none">
                      <div className="relative">
                        <motion.div 
                          className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/25"
                          whileHover={{ scale: 1.05, rotate: 5 }}
                          transition={{ type: "spring", damping: 10 }}
                        >
                          <Bot className="w-6 h-6 text-white drop-shadow-sm" />
                        </motion.div>
                        <motion.span
                          animate={{ 
                            scale: [1, 1.3, 1],
                            opacity: [1, 0.7, 1]
                          }}
                          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gradient-to-r from-violet-400 to-violet-500 rounded-full border-2 border-white shadow-sm"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2.5">
                          ConTigo AI
                          <Badge className="bg-gradient-to-r from-violet-100 to-pink-100 text-violet-700 text-[10px] border-violet-200/50 px-2 py-0.5 font-medium shadow-sm">
                            <Zap className="w-2.5 h-2.5 mr-1" />
                            RAG Powered
                          </Badge>
                          {/* Usage Quota Indicator */}
                          <InlineUsageIndicator />
                          {lastArtifactUpdate && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="flex items-center gap-1"
                            >
                              <Badge className="bg-gradient-to-r from-violet-100 to-violet-100 text-green-700 text-[10px] border-green-200/50 px-2 py-0.5 font-medium shadow-sm">
                                <RefreshCw className="w-2.5 h-2.5 mr-1" />
                                Live Data
                              </Badge>
                            </motion.div>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                          {isTyping ? (
                            <motion.span 
                              className="flex items-center gap-1.5"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                            >
                              <motion.span 
                                className="w-1.5 h-1.5 bg-gradient-to-r from-violet-400 to-violet-500 rounded-full"
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ repeat: Infinity, duration: 0.8 }}
                              />
                              <span className="text-violet-600 font-medium">Analyzing contracts...</span>
                            </motion.span>
                          ) : currentContractId ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 bg-gradient-to-r from-violet-400 to-purple-500 rounded-full shadow-sm" />
                              <span className="text-violet-600">Context-aware mode</span>
                              {lastArtifactUpdate && (
                                <span className="text-xs text-green-600">
                                  • Synced {formatTimeAgo(lastArtifactUpdate)}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 bg-gradient-to-r from-violet-400 to-violet-500 rounded-full shadow-sm" />
                              Online • {messages.length - 1} message{messages.length - 1 !== 1 ? 's' : ''}
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
                    </div>
                  </div>

                  {/* Conversation History Panel - Round 3 Enhancement */}
                  <AnimatePresence>
                    {showHistoryPanel && (
                      <ConversationHistoryPanel
                        conversations={persistence.conversationList?.map(c => ({
                          id: c.id,
                          title: c.title,
                          preview: c.messages?.[0]?.content?.slice(0, 100) || 'New conversation',
                          messageCount: c.messages?.length || 0,
                          createdAt: new Date(c.createdAt),
                          updatedAt: new Date(c.updatedAt),
                          context: c.context,
                          contextType: c.contextType as 'global' | 'contract' | undefined,
                          starred: false,
                        })) || []}
                        currentConversationId={persistence.conversationId || undefined}
                        isLoading={persistence.isLoading}
                        onSelectConversation={(id) => {
                          if (persistence.switchConversation) {
                            persistence.switchConversation(id);
                          }
                          setShowHistoryPanel(false);
                        }}
                        onDeleteConversation={(id) => {
                          if (persistence.deleteConversation) {
                            persistence.deleteConversation(id);
                          }
                        }}
                        onNewConversation={() => {
                          if (persistence.startNewConversation) {
                            persistence.startNewConversation();
                          }
                          setShowHistoryPanel(false);
                        }}
                        onClose={() => setShowHistoryPanel(false)}
                      />
                    )}
                  </AnimatePresence>

                  {/* Messages - Enhanced with better visual hierarchy */}
                  <div className="flex-1 overflow-hidden bg-gradient-to-b from-gray-50/30 to-gray-50/80">
                    <ScrollArea className="h-full">
                      <div ref={scrollRef} className="p-6 space-y-6">
                        {messages.map((message, msgIndex) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 15, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ 
                              type: "spring", 
                              damping: 20, 
                              stiffness: 300,
                              delay: msgIndex === messages.length - 1 ? 0.1 : 0 
                            }}
                            className="space-y-3 group"
                          >
                            <div
                              className={`flex ${
                                message.role === "user" ? "justify-end" : "justify-start"
                              }`}
                            >
                              {message.role === "assistant" && (
                                <motion.div 
                                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center mr-3 flex-shrink-0 shadow-lg shadow-violet-500/20"
                                  whileHover={{ scale: 1.05, rotate: 5 }}
                                  transition={{ type: "spring", damping: 10 }}
                                >
                                  <Sparkles className="w-5 h-5 text-white drop-shadow-sm" />
                                </motion.div>
                              )}
                              <div className="relative max-w-[85%]">
                                <motion.div
                                  whileHover={{ scale: 1.01 }}
                                  transition={{ type: "spring", damping: 20 }}
                                  className={`rounded-2xl px-5 py-4 ${
                                    message.role === "user"
                                      ? "bg-gradient-to-br from-violet-500 via-purple-600 to-purple-600 text-white rounded-br-md shadow-lg shadow-violet-500/20"
                                      : "bg-white/95 backdrop-blur-sm text-gray-800 rounded-bl-md shadow-md border border-gray-100/80 hover:shadow-lg transition-shadow"
                                  }`}
                                >
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
                                              onClick={(e) => { e.preventDefault(); window.location.href = tp.navigation!.url; }}
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

                                  <div
                                    className="text-[15px] leading-relaxed prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-violet-600"
                                    dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
                                  />
                                  
                                  {/* Metadata footer - Enhanced */}
                                  <div className={`flex items-center justify-between mt-3 pt-3 border-t ${message.role === "user" ? "border-white/20" : "border-gray-100/80"}`}>
                                    <span className={`text-[11px] font-medium ${message.role === "user" ? "text-white/70" : "text-gray-400"}`}>
                                      {message.timestamp.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {/* RAG indicator - Enhanced */}
                                      {message.metadata?.usedRAG && (
                                        <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-violet-200/50">
                                          <Search className="w-2.5 h-2.5" />
                                          RAG
                                        </span>
                                      )}
                                      {message.metadata?.confidence && message.role === "assistant" && (
                                        <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-violet-200/50">
                                          <Zap className="w-2.5 h-2.5" />
                                          {Math.round(message.metadata.confidence * 100)}%
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
                                      className="mt-3 pt-3 border-t border-gray-100/80"
                                    >
                                      <details className="text-xs group/sources">
                                        <summary className="cursor-pointer text-violet-600 hover:text-violet-700 flex items-center gap-1.5 font-medium transition-colors">
                                          <FileText className="w-3 h-3" />
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
                                              className="flex items-center justify-between gap-2 bg-gradient-to-r from-gray-50 to-purple-50/30 rounded-lg px-3 py-2 border border-gray-100/80 hover:border-violet-200/50 transition-colors cursor-pointer"
                                              onClick={() => window.open(`/contracts/${src.contractId}`, '_blank')}
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                <FileText className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                                                <span className="truncate font-medium">{src.contractName}</span>
                                              </div>
                                              <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded flex-shrink-0">
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
                                            className="group/card relative bg-gradient-to-r from-white to-purple-50/30 rounded-xl p-3 border border-gray-200/80 hover:border-violet-300 hover:shadow-md transition-all cursor-pointer"
                                          >
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <h4 className="font-semibold text-sm text-gray-900 truncate group-hover/card:text-violet-600 transition-colors">
                                                    {contract.name}
                                                  </h4>
                                                  {contract.riskLevel && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                                      contract.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                                                      contract.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                      'bg-green-100 text-green-700'
                                                    }`}>
                                                      {contract.riskLevel === 'high' ? '🔴' : contract.riskLevel === 'medium' ? '🟡' : '🟢'}
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
                                                    <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
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
                                                  <div className={`text-[10px] font-medium ${
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
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                              <ExternalLink className="w-4 h-4 text-violet-500" />
                                            </div>
                                          </motion.div>
                                        ))}
                                      </div>
                                      {message.contractPreviews.length > 5 && (
                                        <button 
                                          onClick={() => {/* Could expand to show more */}}
                                          className="w-full text-xs text-center text-violet-600 hover:text-violet-700 py-2 font-medium"
                                        >
                                          +{message.contractPreviews.length - 5} more contracts
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
                                        ? "bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 text-white hover:shadow-xl hover:shadow-violet-500/30 shadow-md"
                                        : "bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-gray-200/80 shadow-sm hover:shadow-md hover:border-gray-300"
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
                                className="flex flex-wrap gap-2 pl-14"
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
                                    whileHover={{ scale: 1.05, y: -1 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleSendMessage(suggestion)}
                                    className="text-[13px] px-4 py-2 rounded-full bg-white hover:bg-gradient-to-r hover:from-violet-50 hover:to-purple-50 text-gray-600 hover:text-violet-700 border border-gray-200 hover:border-violet-300 transition-all shadow-sm hover:shadow-md font-medium"
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
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className="flex items-start gap-3"
                          >
                            <motion.div 
                              className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/25 flex-shrink-0"
                              animate={{ rotate: [0, 5, -5, 0] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            >
                              <Loader2 className="w-5 h-5 text-white animate-spin" />
                            </motion.div>
                            <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl rounded-bl-lg px-5 py-4 shadow-md border border-gray-100/80 min-w-[220px] backdrop-blur-sm">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="flex gap-1.5">
                                  <motion.span
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
                                    className="w-2 h-2 bg-gradient-to-r from-violet-500 to-pink-500 rounded-full shadow-sm"
                                  />
                                  <motion.span
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ repeat: Infinity, duration: 1, delay: 0.2, ease: "easeInOut" }}
                                    className="w-2 h-2 bg-gradient-to-r from-violet-400 to-pink-400 rounded-full shadow-sm"
                                  />
                                  <motion.span
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ repeat: Infinity, duration: 1, delay: 0.4, ease: "easeInOut" }}
                                    className="w-2 h-2 bg-gradient-to-r from-violet-300 to-pink-300 rounded-full shadow-sm"
                                  />
                                </div>
                                <span className="text-sm font-semibold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">Thinking</span>
                              </div>
                              <motion.div 
                                className="space-y-2"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                              >
                                <motion.p 
                                  className="text-xs text-gray-600 flex items-center gap-2 bg-violet-50/50 rounded-lg px-2.5 py-1.5"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.3 }}
                                >
                                  <Search className="w-3 h-3 text-violet-500" />
                                  Searching contracts with RAG...
                                </motion.p>
                                <motion.p 
                                  className="text-xs text-gray-500 flex items-center gap-2 bg-violet-50/50 rounded-lg px-2.5 py-1.5"
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
                                transition={{ delay: 2 }}
                                onClick={cancelCurrentRequest}
                                className="mt-3 text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1.5 px-2 py-1 rounded hover:bg-red-50"
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
                    <div className="px-6 pb-4 bg-gradient-to-b from-white to-gray-50/50">
                      <div className="text-sm text-gray-600 mb-3 flex items-center gap-2 font-semibold">
                        <motion.span
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="inline-flex"
                        >
                          <Zap className="w-4 h-4 text-amber-500" />
                        </motion.span>
                        Quick Actions
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {QUICK_ACTIONS.slice(0, 4).map((action, idx) => (
                          <motion.button
                            key={idx}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: idx * 0.08, type: "spring", damping: 15 }}
                            whileHover={{ scale: 1.03, y: -3 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleSendMessage(action.query)}
                            className="group flex items-center gap-3.5 p-4 rounded-2xl bg-white hover:bg-gradient-to-r hover:from-gray-50 hover:to-purple-50/30 border border-gray-100 hover:border-violet-200/50 transition-all text-left shadow-sm hover:shadow-lg"
                          >
                            <motion.div
                              whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                              transition={{ duration: 0.5 }}
                              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center flex-shrink-0 shadow-lg`}
                            >
                              <action.icon className="w-5 h-5 text-white drop-shadow-sm" />
                            </motion.div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-semibold text-gray-800 group-hover:text-violet-700 block truncate transition-colors">
                                {action.label}
                              </span>
                              <span className="text-xs text-gray-400 group-hover:text-gray-500 block truncate mt-0.5 transition-colors">
                                {action.description}
                              </span>
                            </div>
                            <motion.div 
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              initial={{ x: -5 }}
                              whileHover={{ x: 0 }}
                            >
                              <Send className="w-4 h-4 text-violet-400" />
                            </motion.div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Input area - Enhanced with better visual design */}
                  <div className="p-6 border-t border-gray-200/80 bg-gradient-to-b from-white to-gray-50/30">
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
                          placeholder={currentContractId 
                            ? "Ask about this contract..." 
                            : messages.length > 1 
                              ? "Continue the conversation..." 
                              : "Try: 'Summarize Deloitte contracts from 2024'"
                          }
                          disabled={isLoading}
                          className="w-full bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-2xl pr-24 focus:border-violet-400 focus:ring-violet-500/20 focus:ring-2 h-14 text-base px-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200"
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
                          className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 hover:from-violet-600 hover:via-purple-600 hover:to-pink-600 shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
                        >
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                        </Button>
                      </motion.div>
                    </form>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-4">
                        <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded-md text-[10px] text-gray-600 font-mono shadow-sm">Enter</kbd>
                          <span>send</span>
                        </span>
                        <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded-md text-[10px] text-gray-600 font-mono shadow-sm">⌘/</kbd>
                          <span>toggle</span>
                        </span>
                      </div>
                      <motion.button 
                        onClick={() => setShowExamples(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="text-[11px] text-violet-600 hover:text-violet-800 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-violet-50 transition-colors font-medium"
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
            <motion.div
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
            <motion.div
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
            <motion.div
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
          messageId={feedbackMessageId || undefined}
          messageContent={
            feedbackMessageId 
              ? messages.find(m => m.id === feedbackMessageId)?.content 
              : undefined
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
