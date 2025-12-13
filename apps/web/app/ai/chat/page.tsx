/**
 * AI Chat Page - Full-screen AI Assistant Interface
 * Dedicated page for AI-powered contract analysis and Q&A
 */

"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Send,
  Sparkles,
  FileText,
  TrendingUp,
  Calendar,
  Search,
  Loader2,
  Bot,
  User,
  Zap,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  Download,
  Keyboard,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  ExternalLink,
  Shield,
  DollarSign,
  Clock,
  ArrowLeft,
  History,
  BookOpen,
  Settings,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useDataMode } from "@/contexts/DataModeContext";
import { cn } from "@/lib/utils";

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
}

// Quick action suggestions by context
const QUICK_ACTIONS = [
  {
    icon: FileText,
    label: "Analyze Contract",
    query: "Analyze my most recent contract and summarize key terms",
    color: "text-blue-500",
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
    color: "text-purple-500",
  },
  {
    icon: Clock,
    label: "Obligation Tracking",
    query: "What are my upcoming contractual obligations?",
    color: "text-cyan-500",
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
  const contractId = searchParams?.get("contractId");
  const initialQuery = searchParams?.get("query");
  const { dataMode, isRealData } = useDataMode();

  // State
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-data-mode": dataMode,
        },
        body: JSON.stringify({
          message: messageText,
          contractId,
          history: messages.slice(-10), // Last 10 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response || data.message || "I apologize, but I couldn't process that request. Please try again.",
        timestamp: new Date(),
        suggestions: data.suggestions,
        metadata: {
          sources: data.sources,
          confidence: data.confidence,
          processingTime: data.processingTime,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI Chat error:", error);
      
      // Demo mode fallback response
      const fallbackMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: isRealData 
          ? "I'm having trouble connecting to the AI service. Please try again in a moment."
          : `**Demo Mode Response**\n\nIn demo mode, I can show you how the AI assistant works. Here's a sample response to: "${messageText}"\n\n📊 **Analysis Summary:**\n- Your query has been processed\n- AI would analyze relevant contracts\n- Results would include actionable insights\n\n*Switch to real data mode for actual AI-powered analysis.*`,
        timestamp: new Date(),
        suggestions: [
          "Try another question",
          "View my contracts",
          "Go to analytics",
        ],
      };

      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      setStreamingContent("");
    }
  };

  // Clear chat
  const handleClearChat = () => {
    setMessages([WELCOME_MESSAGE]);
    setInput("");
  };

  // Copy message
  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Feedback
  const handleFeedback = (messageId: string, feedback: "positive" | "negative") => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, feedback } : msg
      )
    );
    // Could send to analytics here
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
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
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
          <motion.div
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
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Context indicator */}
          {contractId && (
            <div className="p-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-blue-500" />
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
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl p-4",
                      message.role === "user"
                        ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
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
                                className="h-7 w-7 p-0"
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
                                  "h-7 w-7 p-0",
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
                                  "h-7 w-7 p-0",
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
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-white dark:bg-slate-800 border shadow-sm rounded-xl p-4">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
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
                  className="h-12 px-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
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
  );
}

export default function AIChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      }
    >
      <AIChatPageContent />
    </Suspense>
  );
}
