"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  FileText,
  Sparkles,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  citations?: Citation[];
  suggestions?: string[];
}

interface Citation {
  contractId: string;
  contractTitle: string;
  excerpt: string;
  relevanceScore: number;
}

interface AIContractChatProps {
  onContractSelect?: (contractId: string) => void;
  className?: string;
}

export function AIContractChat({
  onContractSelect,
  className,
}: AIContractChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hi! I'm your AI contract assistant. I can help you find contracts, analyze terms, identify risks, and answer questions about your contract portfolio. What would you like to know?",
      timestamp: new Date(),
      suggestions: [
        "Show me all high-risk contracts",
        "Which contracts expire this quarter?",
        "Find contracts with renewal clauses",
        "Compare supplier rates across contracts",
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Simulate AI response (replace with actual API call)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: generateAIResponse(input),
        timestamp: new Date(),
        citations: generateCitations(input),
        suggestions: generateSuggestions(input),
      };

      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "system",
        content:
          "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
          "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
          className
        )}
      >
        <MessageCircle className="w-6 h-6 text-white" />
        <span className="absolute -top-1 -right-1 flex h-5 w-5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-500 items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </span>
        </span>
      </Button>
    );
  }

  return (
    <Card
      className={cn(
        "fixed bottom-6 right-6 w-96 shadow-2xl z-50 flex flex-col overflow-hidden",
        isMinimized ? "h-16" : "h-[600px]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <div className="relative">
            <MessageCircle className="w-5 h-5" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Contract Assistant</h3>
            <p className="text-xs text-blue-100">Powered by GPT-4</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-8 w-8 p-0 text-white hover:bg-white/20"
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 p-0 text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg p-3 space-y-2",
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : message.role === "system"
                      ? "bg-red-50 text-red-900 border border-red-200"
                      : "bg-white border shadow-sm"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </p>

                  {message.citations && message.citations.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-medium text-gray-600">
                        Referenced Contracts:
                      </p>
                      {message.citations.map((citation, idx) => (
                        <button
                          key={idx}
                          onClick={() =>
                            onContractSelect?.(citation.contractId)
                          }
                          className="w-full text-left p-2 rounded border bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">
                                {citation.contractTitle}
                              </p>
                              <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">
                                {citation.excerpt}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-medium text-gray-600">
                        You might also ask:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {message.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs opacity-60 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border rounded-lg p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <p className="text-sm text-gray-600">Thinking...</p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask about contracts..."
                rows={2}
                className="flex-1 px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                size="sm"
                className="h-auto px-3"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </>
      )}
    </Card>
  );
}

// Utility functions for demo (replace with actual AI API calls)
function generateAIResponse(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes("high-risk") || lower.includes("risk")) {
    return "I found 3 contracts with high-risk indicators:\n\n1. ACME Corp Master Service Agreement - Contains unlimited liability clause\n2. TechVendor Cloud Services - Auto-renewal without opt-out period\n3. Global Logistics Contract - Penalty clauses exceed industry standards\n\nWould you like me to analyze any of these in detail?";
  }

  if (lower.includes("expire") || lower.includes("expir")) {
    return "Based on your current portfolio, 8 contracts are expiring this quarter:\n\n• 3 expire in the next 30 days\n• 5 expire in 60-90 days\n\nThe highest-value expiring contract is the ACME Corp agreement ($2.5M annually). Would you like me to set up renewal reminders?";
  }

  if (lower.includes("renewal") || lower.includes("renew")) {
    return "I found 12 contracts with automatic renewal clauses:\n\n• 7 have 30-day notice periods\n• 3 have 60-day notice periods\n• 2 have 90-day notice periods\n\nI recommend reviewing contracts with upcoming renewal dates to avoid unwanted extensions.";
  }

  if (lower.includes("compare") || lower.includes("rate")) {
    return "Analyzing supplier rates across your contracts:\n\n• Average hourly rate: $185/hour\n• Range: $120 - $250/hour\n• Best value: TechVendor ($120/hour)\n• Above market: Premium Consulting ($250/hour, 35% above average)\n\nWould you like a detailed breakdown by service type?";
  }

  return "I understand you're asking about your contracts. Could you provide more specific details? For example:\n\n• Which contracts are you interested in?\n• What specific information do you need?\n• Are you looking for analysis or comparison?";
}

function generateCitations(input: string): Citation[] {
  const lower = input.toLowerCase();

  if (lower.includes("high-risk") || lower.includes("risk")) {
    return [
      {
        contractId: "1",
        contractTitle: "ACME Corp Master Service Agreement",
        excerpt:
          "...unlimited liability for consequential damages including lost profits...",
        relevanceScore: 0.95,
      },
      {
        contractId: "2",
        contractTitle: "TechVendor Cloud Services Agreement",
        excerpt:
          "...automatically renews for successive 12-month periods unless...",
        relevanceScore: 0.88,
      },
    ];
  }

  return [];
}

function generateSuggestions(input: string): string[] {
  const lower = input.toLowerCase();

  if (lower.includes("risk")) {
    return [
      "Show risk mitigation strategies",
      "Compare risk scores over time",
      "Which clauses trigger high risk?",
    ];
  }

  if (lower.includes("expire")) {
    return [
      "Set up renewal reminders",
      "Compare renewal terms",
      "Show renegotiation opportunities",
    ];
  }

  return [
    "Summarize this contract",
    "Find similar contracts",
    "Check compliance status",
  ];
}
