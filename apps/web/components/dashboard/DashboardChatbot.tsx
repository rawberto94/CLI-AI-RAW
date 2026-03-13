/**
 * Dashboard Chatbot - AI Assistant for Contract Queries
 * Floating chatbot interface with contract intelligence capabilities
 * Now uses real OpenAI API with RAG integration
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Sparkles,
  FileText,
  TrendingUp,
  Calendar,
  Search,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { streamChatToJSON } from '@/lib/ai/stream-to-json';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  error?: boolean;
}

interface AIResponse {
  message: string;
  sources?: Array<{
    contractId: string;
    title: string;
    snippet: string;
    score: number;
  }>;
  suggestions?: string[];
}

const QUICK_ACTIONS = [
  { icon: FileText, label: "Show contract summary", query: "Give me a summary of my contracts" },
  { icon: Calendar, label: "Upcoming renewals", query: "What contracts are expiring soon?" },
  { icon: TrendingUp, label: "Portfolio insights", query: "Show me portfolio insights" },
  { icon: Search, label: "Search contracts", query: "Help me find a specific contract" },
];

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "👋 Hello! I'm your Contract Intelligence AI Assistant. I can help you with contract queries, renewals, insights, and more. How can I assist you today?",
  timestamp: new Date(),
  suggestions: [
    "Show contract summary",
    "What's expiring soon?",
    "Portfolio insights",
  ]
};

export function DashboardChatbot() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const callAIAPI = useCallback(async (messageContent: string, messageHistory: Message[]): Promise<AIResponse> => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const result = await streamChatToJSON({
      message: messageContent,
      conversationHistory: messageHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      })),
      context: { context: 'dashboard' },
      signal: abortControllerRef.current.signal,
    });

    return {
      message: result.message,
      suggestions: result.suggestions,
    };
  }, []);

  const handleSendMessage = async (content?: string) => {
    const messageContent = content || input.trim();
    if (!messageContent || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await callAIAPI(messageContent, [...messages, userMessage]);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        suggestions: response.suggestions || generateDefaultSuggestions(messageContent),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      // Don't show error for aborted requests
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I apologize, but I encountered an error. Please try again.",
        timestamp: new Date(),
        error: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate contextual suggestions based on query
  const generateDefaultSuggestions = (query: string): string[] => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('renew') || lowerQuery.includes('expir')) {
      return ["Set up reminders", "View all renewals", "Create renewal report"];
    }
    if (lowerQuery.includes('risk') || lowerQuery.includes('complian')) {
      return ["Risk breakdown", "Compliance report", "Mitigation strategies"];
    }
    if (lowerQuery.includes('summar') || lowerQuery.includes('overview')) {
      return ["Show renewals", "View top contracts", "Compliance status"];
    }
    return ["Contract summary", "Upcoming renewals", "Portfolio insights"];
  };

  const handleQuickAction = (query: string) => {
    handleSendMessage(query);
  };

  return (
    <div className="w-full space-y-4">
      {/* Messages Area */}
      <ScrollArea className="h-[280px] border rounded-lg p-4 bg-gray-50">
          <div ref={scrollRef} className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-line">{message.content}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Suggestions */}
                {message.suggestions && message.role === 'assistant' && (
                  <div className="flex flex-wrap gap-2 pl-2">
                    {message.suggestions.map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => handleSendMessage(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

      {/* Quick Actions */}
      {messages.length === 1 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="h-auto py-2 flex items-center gap-2 justify-start text-left"
                onClick={() => handleQuickAction(action.query)}
              >
                <action.icon className="h-4 w-4 text-violet-600 flex-shrink-0" />
                <span className="text-xs truncate">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t pt-4 mt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your contracts..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isLoading}
            className="bg-violet-600 hover:bg-violet-700 px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          AI-powered contract intelligence
        </p>
      </div>
    </div>
  );
}
