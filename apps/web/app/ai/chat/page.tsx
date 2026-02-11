/**
 * AI Chat Page - Full-screen AI Assistant Interface
 * Dedicated page for AI-powered contract analysis and Q&A
 * 
 * Features:
 * - Persistent conversation history via /api/chat/conversations
 * - Real-time message streaming
 * - Conversation sidebar for history access
 * - Feedback collection for AI improvement
 */

"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  Send,
  FileText,
  TrendingUp,
  Calendar,
  Loader2,
  Bot,
  User,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  Download,
  Keyboard,
  Shield,
  DollarSign,
  Clock,
  ArrowLeft,
  History,
  MessageSquare,
  Plus,
  ChevronLeft,
  ChevronRight,
  Pin,
  Archive,
  MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useDataMode } from "@/contexts/DataModeContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Conversation interface from API
interface Conversation {
  id: string;
  title: string;
  contextType: string | null;
  context: string | null;
  isPinned: boolean;
  isArchived: boolean;
  lastMessageAt: Date;
  createdAt: Date;
  lastMessage?: {
    content: string;
    role: string;
  };
}

// Message interface
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  suggestions?: string[];
  metadata?: {
    sources?: string[];
    confidence?: number;
    processingTime?: number;
  };
  feedback?: "positive" | "negative";
  conversationId?: string;
}

// Hook for fetching conversations
function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/chat/conversations?limit=50');
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data = await res.json();
      setConversations(data.data?.conversations || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return { conversations, isLoading, error, refresh: fetchConversations, setConversations };
}

// Quick action suggestions by context
const QUICK_ACTIONS = [
  {
    icon: FileText,
    label: "Analyze Contract",
    query: "Analyze my most recent contract and summarize key terms",
    color: "text-violet-500",
  },
  {
    icon: TrendingUp,
    label: "Find Savings",
    query: "Find potential cost savings opportunities across my contracts",
    color: "text-green-500",
  },
  {
    icon: Calendar,
    label: "Upcoming Renewals",
    query: "What contracts are expiring in the next 90 days?",
    color: "text-orange-500",
  },
  {
    icon: Shield,
    label: "Risk Analysis",
    query: "Identify high-risk clauses in my active contracts",
    color: "text-red-500",
  },
  {
    icon: DollarSign,
    label: "Rate Comparison",
    query: "Compare my labor rates against market benchmarks",
    color: "text-violet-500",
  },
  {
    icon: Clock,
    label: "Obligation Tracking",
    query: "What are my upcoming contractual obligations?",
    color: "text-violet-500",
  },
];

// Example conversations
const EXAMPLE_PROMPTS = [
  "What's the average contract value in my portfolio?",
  "Show me contracts with auto-renewal clauses",
  "Which suppliers have the best rates for IT services?",
  "Find contracts with termination clauses less than 30 days",
  "Compare pricing across my software licenses",
  "What are the payment terms in my recent contracts?",
];

// Initial welcome message
const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: `👋 **Welcome to the AI Contract Assistant!**

I'm here to help you navigate your contract portfolio with intelligence and ease. I can:

• **Analyze Contracts** - Extract key terms, dates, and obligations
• **Find Savings** - Identify cost optimization opportunities  
• **Track Renewals** - Never miss a renewal deadline
• **Assess Risks** - Highlight problematic clauses
• **Compare Rates** - Benchmark against market standards
• **Answer Questions** - Natural language queries about your contracts

Try asking me something, or click one of the quick actions below!`,
  timestamp: new Date(),
  suggestions: [
    "Summarize my contract portfolio",
    "What contracts expire this quarter?",
    "Find contracts over $100k",
    "Show me high-risk clauses",
  ],
};

function AIChatPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const contractId = searchParams?.get("contractId");
  const initialQuery = searchParams?.get("query");
  const conversationIdParam = searchParams?.get("conversationId");
  const { dataMode, isRealData } = useDataMode();

  // Conversation state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(conversationIdParam);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { conversations, isLoading: loadingConversations, refresh: refreshConversations } = useConversations();

  // State
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversation messages when switching conversations
  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/chat/conversations/${conversationId}?messageLimit=100`);
      if (!res.ok) throw new Error('Failed to load conversation');
      const data = await res.json();
      
      if (data.data?.conversation?.messages) {
        const loadedMessages: Message[] = data.data.conversation.messages.map((msg: Record<string, unknown>) => ({
          id: msg.id as string,
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content as string,
          timestamp: new Date(msg.createdAt as string),
          feedback: msg.feedback as "positive" | "negative" | undefined,
          conversationId,
          metadata: msg.metadata ? {
            sources: (msg.metadata as Record<string, unknown>).sources as string[],
            confidence: (msg.metadata as Record<string, unknown>).confidence as number,
            processingTime: (msg.metadata as Record<string, unknown>).processingTime as number,
          } : undefined,
        }));
        
        setMessages(loadedMessages.length > 0 ? loadedMessages : [WELCOME_MESSAGE]);
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create new conversation
  const createConversation = useCallback(async (title: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.slice(0, 100),
          contextType: contractId ? 'contract' : 'general',
          context: contractId || null,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to create conversation');
      const data = await res.json();
      const newConversationId = data.data?.conversation?.id;
      
      if (newConversationId) {
        setCurrentConversationId(newConversationId);
        refreshConversations();
        return newConversationId;
      }
      return null;
    } catch (err) {
      console.error('Error creating conversation:', err);
      return null;
    }
  }, [contractId, refreshConversations]);

  // Save message to conversation
  const saveMessage = useCallback(async (conversationId: string, message: Message) => {
    try {
      await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: message.role,
          content: message.content,
          metadata: message.metadata,
        }),
      });
    } catch (err) {
      console.error('Error saving message:', err);
    }
  }, []);

  // Handle conversation selection
  const handleSelectConversation = useCallback((conversation: Conversation) => {
    setCurrentConversationId(conversation.id);
    loadConversation(conversation.id);
    // Update URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.set('conversationId', conversation.id);
    router.replace(url.pathname + url.search);
  }, [loadConversation, router]);

  // Start new conversation
  const handleNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([WELCOME_MESSAGE]);
    const url = new URL(window.location.href);
    url.searchParams.delete('conversationId');
    router.replace(url.pathname + url.search);
  }, [router]);

  // Pin/Archive conversation
  const handleTogglePin = useCallback(async (conversationId: string, isPinned: boolean) => {
    try {
      await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !isPinned }),
      });
      refreshConversations();
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  }, [refreshConversations]);

  const handleArchiveConversation = useCallback(async (conversationId: string) => {
    try {
      await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });
      if (currentConversationId === conversationId) {
        handleNewConversation();
      }
      refreshConversations();
    } catch (err) {
      console.error('Error archiving conversation:', err);
    }
  }, [currentConversationId, handleNewConversation, refreshConversations]);

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    try {
      await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'DELETE',
      });
      if (currentConversationId === conversationId) {
        handleNewConversation();
      }
      refreshConversations();
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  }, [currentConversationId, handleNewConversation, refreshConversations]);

  // Load conversation from URL param
  useEffect(() => {
    if (conversationIdParam && conversationIdParam !== currentConversationId) {
      setCurrentConversationId(conversationIdParam);
      loadConversation(conversationIdParam);
    }
  }, [conversationIdParam, currentConversationId, loadConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle initial query from URL
  useEffect(() => {
    if (initialQuery) {
      setInput(initialQuery);
      // Auto-submit after a brief delay
      const timer = setTimeout(() => {
        handleSendMessage(initialQuery);
      }, 500);
      return () => clearTimeout(timer);
    }
    
  }, [initialQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts with ?
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          setShowShortcuts((prev) => !prev);
        }
      }
      // Clear chat with Cmd/Ctrl + L
      if ((e.metaKey || e.ctrlKey) && e.key === "l") {
        e.preventDefault();
        handleClearChat();
      }
      // Focus input with /
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Send message handler
  const handleSendMessage = async (overrideMessage?: string) => {
    const messageText = overrideMessage || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setIsTyping(true);

    // Create conversation if this is the first user message
    let activeConversationId = currentConversationId;
    if (!activeConversationId) {
      // Use first ~50 chars of message as title
      const title = messageText.slice(0, 50) + (messageText.length > 50 ? '...' : '');
      activeConversationId = await createConversation(title);
    }

    // Save user message
    if (activeConversationId) {
      await saveMessage(activeConversationId, userMessage);
    }

    try {
      // Use streaming endpoint for real-time token-by-token display
      const response = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-data-mode": dataMode,
        },
        body: JSON.stringify({
          message: messageText,
          contractId,
          conversationId: activeConversationId,
          conversationHistory: messages.slice(-10),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let sources: string[] = [];
      let confidence: number | undefined;
      let suggestions: string[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content' && data.content) {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                } else if (data.content && !data.type) {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                }
                if (data.sources) sources = data.sources;
                if (data.confidence) confidence = data.confidence;
                if (data.suggestedActions) {
                  suggestions = data.suggestedActions.map((a: { label: string }) => a.label);
                }
                if (data.done || data.type === 'done') break;
              } catch {
                // Ignore parse errors for incomplete SSE chunks
              }
            }
          }
        }
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: fullContent || "I apologize, but I couldn't process that request. Please try again.",
        timestamp: new Date(),
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        conversationId: activeConversationId || undefined,
        metadata: {
          sources,
          confidence,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Save assistant message
      if (activeConversationId) {
        await saveMessage(activeConversationId, assistantMessage);
      }
    } catch {
      // Demo mode fallback response
      const fallbackMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: isRealData 
          ? "I'm having trouble connecting to the AI service. Please try again in a moment."
          : `**Demo Mode Response**\n\nIn demo mode, I can show you how the AI assistant works. Here's a sample response to: "${messageText}"\n\n📊 **Analysis Summary:**\n- Your query has been processed\n- AI would analyze relevant contracts\n- Results would include actionable insights\n\n*Switch to real data mode for actual AI-powered analysis.*`,
        timestamp: new Date(),
        conversationId: activeConversationId || undefined,
        suggestions: [
          "Try another question",
          "View my contracts",
          "Go to analytics",
        ],
      };

      setMessages((prev) => [...prev, fallbackMessage]);
      
      // Save fallback message too
      if (activeConversationId) {
        await saveMessage(activeConversationId, fallbackMessage);
      }
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      setStreamingContent("");
      refreshConversations(); // Update conversation list with latest message
    }
  };

  // Clear chat
  const handleClearChat = () => {
    handleNewConversation();
  };

  // Copy message
  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Feedback - now persists to database
  const handleFeedback = async (messageId: string, feedback: "positive" | "negative") => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, feedback } : msg
      )
    );
    
    // Persist feedback if we have a conversation
    if (currentConversationId) {
      try {
        await fetch(`/api/chat/conversations/${currentConversationId}/messages/${messageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback }),
        });
      } catch (err) {
        console.error('Error saving feedback:', err);
      }
    }
  };

  // Export chat
  const handleExportChat = () => {
    const chatContent = messages
      .map(
        (msg) =>
          `[${msg.role.toUpperCase()}] ${msg.timestamp.toLocaleString()}\n${msg.content}\n`
      )
      .join("\n---\n\n");

    const blob = new Blob([chatContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-chat-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Use suggestion
  const handleUseSuggestion = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  // Use quick action
  const handleQuickAction = (query: string) => {
    handleSendMessage(query);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Conversation History Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside key="sidebar-open"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 border-r bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden"
          >
            <div className="flex flex-col h-full w-[280px]">
              {/* Sidebar Header */}
              <div className="p-4 border-b">
                <Button
                  onClick={handleNewConversation}
                  className="w-full gap-2 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600"
                >
                  <Plus className="h-4 w-4" />
                  New Chat
                </Button>
              </div>
              
              {/* Conversation List */}
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {loadingConversations ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No conversations yet</p>
                      <p className="text-xs mt-1">Start chatting to create one</p>
                    </div>
                  ) : (
                    <>
                      {/* Pinned Conversations */}
                      {conversations.filter(c => c.isPinned && !c.isArchived).length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-medium text-muted-foreground px-2 mb-2 flex items-center gap-1">
                            <Pin className="h-3 w-3" /> Pinned
                          </p>
                          {conversations
                            .filter(c => c.isPinned && !c.isArchived)
                            .map(conv => (
                              <ConversationItem
                                key={conv.id}
                                conversation={conv}
                                isActive={currentConversationId === conv.id}
                                onSelect={() => handleSelectConversation(conv)}
                                onTogglePin={() => handleTogglePin(conv.id, conv.isPinned)}
                                onArchive={() => handleArchiveConversation(conv.id)}
                                onDelete={() => handleDeleteConversation(conv.id)}
                              />
                            ))}
                        </div>
                      )}
                      
                      {/* Recent Conversations */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground px-2 mb-2 flex items-center gap-1">
                          <History className="h-3 w-3" /> Recent
                        </p>
                        {conversations
                          .filter(c => !c.isPinned && !c.isArchived)
                          .map(conv => (
                            <ConversationItem
                              key={conv.id}
                              conversation={conv}
                              isActive={currentConversationId === conv.id}
                              onSelect={() => handleSelectConversation(conv)}
                              onTogglePin={() => handleTogglePin(conv.id, conv.isPinned)}
                              onArchive={() => handleArchiveConversation(conv.id)}
                              onDelete={() => handleDeleteConversation(conv.id)}
                            />
                          ))}
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Sidebar Toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-l-none border border-l-0"
        style={{ left: sidebarOpen ? 280 : 0 }}
      >
        {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="flex-shrink-0 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Back</span>
                  </Button>
                </Link>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="font-semibold text-lg">AI Contract Assistant</h1>
                    <p className="text-xs text-muted-foreground">
                      Powered by advanced AI • {isRealData ? "Live Data" : "Demo Mode"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowShortcuts((prev) => !prev)}
                      >
                        <Keyboard className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Keyboard Shortcuts (?)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExportChat}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export Chat</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearChat}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clear Chat (⌘L)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </header>

        {/* Keyboard Shortcuts Modal */}
        <AnimatePresence>
          {showShortcuts && (
            <motion.div key="shortcuts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setShowShortcuts(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Keyboard className="h-5 w-5" />
                  Keyboard Shortcuts
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Focus input</span>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs">/</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Clear chat</span>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs">⌘L</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Toggle shortcuts</span>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs">?</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Send message</span>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs">Enter</kbd>
                  </div>
                </div>
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => setShowShortcuts(false)}
                >
                  Close
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Quick Actions */}
        <aside className="hidden lg:flex w-72 flex-col border-r bg-slate-50/50 dark:bg-slate-900/50">
          <div className="p-4 flex-1 overflow-auto">
            <h3 className="font-medium text-sm text-muted-foreground mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {QUICK_ACTIONS.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(action.query)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-white dark:hover:bg-slate-800 transition-colors group"
                >
                  <action.icon className={cn("h-4 w-4", action.color)} />
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="font-medium text-sm text-muted-foreground mb-3">Example Prompts</h3>
              <div className="space-y-2">
                {EXAMPLE_PROMPTS.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleUseSuggestion(prompt)}
                    className="w-full text-left text-sm p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    &ldquo;{prompt}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Context indicator */}
          {contractId && (
            <div className="p-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-violet-500" />
                <span className="text-muted-foreground">Context:</span>
                <Badge variant="secondary" className="truncate">
                  Contract {contractId}
                </Badge>
              </div>
            </div>
          )}
        </aside>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div ref={scrollRef} className="max-w-3xl mx-auto space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl p-4",
                      message.role === "user"
                        ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                        : "bg-white dark:bg-slate-800 border shadow-sm"
                    )}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {message.content}
                    </div>

                    {/* Suggestions */}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleUseSuggestion(suggestion)}
                            className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Message actions */}
                    {message.role === "assistant" && message.id !== "welcome" && (
                      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 p-0"
                                onClick={() => handleCopy(message.content, message.id)}
                              >
                                {copiedId === message.id ? (
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "h-8 p-0",
                                  message.feedback === "positive" && "text-green-500"
                                )}
                                onClick={() => handleFeedback(message.id, "positive")}
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Helpful</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "h-8 p-0",
                                  message.feedback === "negative" && "text-red-500"
                                )}
                                onClick={() => handleFeedback(message.id, "negative")}
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Not helpful</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {message.metadata?.confidence && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {Math.round(message.metadata.confidence * 100)}% confidence
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing / Streaming indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-white dark:bg-slate-800 border shadow-sm rounded-xl p-4 max-w-[80%]">
                    {streamingContent ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                        {streamingContent}
                        <span className="inline-block w-1.5 h-4 bg-violet-500 animate-pulse ml-0.5 align-text-bottom" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </ScrollArea>

          {/* Quick actions for mobile */}
          <div className="lg:hidden border-t bg-slate-50 dark:bg-slate-900/50 p-2 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {QUICK_ACTIONS.slice(0, 4).map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-shrink-0"
                  onClick={() => handleQuickAction(action.query)}
                >
                  <action.icon className={cn("h-3.5 w-3.5", action.color)} />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="flex-shrink-0 border-t bg-white dark:bg-slate-900 p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="max-w-3xl mx-auto"
            >
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything about your contracts..."
                    className="pr-10 h-12 text-base"
                    disabled={isLoading}
                  />
                  {input && (
                    <button
                      type="button"
                      onClick={() => setInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <span className="sr-only">Clear input</span>
                      ×
                    </button>
                  )}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!input.trim() || isLoading}
                  className="h-12 px-6 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">/</kbd> to focus •{" "}
                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">Enter</kbd> to send •{" "}
                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">?</kbd> for shortcuts
              </p>
            </form>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

// Conversation Item Component for Sidebar
function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onTogglePin,
  onArchive,
  onDelete,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const lastMessageDate = new Date(conversation.lastMessageAt);
  const isToday = new Date().toDateString() === lastMessageDate.toDateString();
  const timeStr = isToday 
    ? lastMessageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : lastMessageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors",
        isActive
          ? "bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800"
          : "hover:bg-slate-100 dark:hover:bg-slate-800"
      )}
      onClick={onSelect}
    >
      <MessageSquare className={cn(
        "h-4 w-4 flex-shrink-0",
        isActive ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"
      )} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{conversation.title}</p>
        {conversation.lastMessage && (
          <p className="text-xs text-muted-foreground truncate">
            {conversation.lastMessage.content.slice(0, 50)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {timeStr}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin(); }}>
              <Pin className="h-4 w-4 mr-2" />
              {conversation.isPinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function AIChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      }
    >
      <AIChatPageContent />
    </Suspense>
  );
}
