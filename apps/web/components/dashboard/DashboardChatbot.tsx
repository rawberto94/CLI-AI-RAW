/**
 * Dashboard Chatbot - AI Assistant for Contract Queries
 * Floating chatbot interface with contract intelligence capabilities
 */

"use client";

import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      // Simulate AI response with contract intelligence
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = generateAIResponse(messageContent);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        suggestions: response.suggestions,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I apologize, but I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateAIResponse = (query: string): { content: string; suggestions?: string[] } => {
    const lowerQuery = query.toLowerCase();

    // Contract summary
    if (lowerQuery.includes('summary') || lowerQuery.includes('overview')) {
      return {
        content: "📊 **Contract Portfolio Summary:**\n\n✅ **Total Contracts:** 7\n🟢 **Active:** 6 completed, 1 processing\n💰 **Portfolio Value:** $255,500\n📅 **Recent Activity:** 7 contracts added this month\n\nYour portfolio is in good health with high completion rates. Would you like more details on any specific area?",
        suggestions: ["Show renewals", "View top contracts", "Compliance status"]
      };
    }

    // Renewals
    if (lowerQuery.includes('expir') || lowerQuery.includes('renewal') || lowerQuery.includes('soon')) {
      return {
        content: "📅 **Upcoming Renewals:**\n\n🔴 **Urgent (15 days):**\n• AWS Enterprise Agreement - Cloud Services\n\n🟠 **High Priority (28 days):**\n• Accenture IT Services MSA - IT Services\n\n🟡 **Medium Priority (45 days):**\n• Salesforce Enterprise License - Software\n\nI recommend prioritizing the AWS contract renewal first. Would you like me to create reminders?",
        suggestions: ["Create reminders", "View AWS contract", "All renewals"]
      };
    }

    // Portfolio insights
    if (lowerQuery.includes('insight') || lowerQuery.includes('analytics') || lowerQuery.includes('portfolio')) {
      return {
        content: "📈 **Portfolio Insights:**\n\n🎯 **Key Findings:**\n• Growing portfolio: +7 contracts this month\n• High compliance: 94% score maintained\n• Low risk profile: Score of 23/100\n• 3 urgent renewals in next 30 days\n\n💡 **Recommendations:**\n1. Review upcoming renewals\n2. Update contract types for better categorization\n3. Consider consolidating cloud services\n\nWhat would you like to explore?",
        suggestions: ["Risk analysis", "Cost optimization", "Compliance details"]
      };
    }

    // Search help
    if (lowerQuery.includes('find') || lowerQuery.includes('search') || lowerQuery.includes('locate')) {
      return {
        content: "🔍 **Search Assistance:**\n\nI can help you find contracts by:\n• Contract name or vendor\n• Contract type (IT Services, Cloud, etc.)\n• Status (Active, Expired, Processing)\n• Date range\n• Value range\n\nWhat are you looking for? For example: \"Find all AWS contracts\" or \"Show cloud services contracts\"",
        suggestions: ["Show all contracts", "Filter by type", "Recent contracts"]
      };
    }

    // Compliance
    if (lowerQuery.includes('complian') || lowerQuery.includes('risk')) {
      return {
        content: "🛡️ **Compliance & Risk Status:**\n\n✅ **Compliance Score:** 94%\n⚠️ **Risk Score:** 23/100 (Low)\n\n**Compliance Highlights:**\n• All active contracts have required documentation\n• No expired contracts in active use\n• Regular renewal tracking in place\n\n**Risk Factors:**\n• 3 contracts expiring within 30 days\n• Minor: Some contracts missing detailed categorization\n\nOverall, your portfolio shows strong compliance!",
        suggestions: ["Risk breakdown", "Compliance report", "Improvement tips"]
      };
    }

    // Default response
    return {
      content: "I'm here to help with your contract management! I can assist with:\n\n📊 Contract summaries and analytics\n📅 Renewal tracking and reminders\n🔍 Finding specific contracts\n💡 Portfolio insights and recommendations\n🛡️ Compliance and risk analysis\n\nWhat would you like to know?",
      suggestions: ["Contract summary", "Upcoming renewals", "Portfolio insights"]
    };
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
                        ? 'bg-blue-600 text-white'
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
                    {message.suggestions.map((suggestion, idx) => (
                      <Button
                        key={idx}
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
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
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
            {QUICK_ACTIONS.map((action, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="h-auto py-2 flex items-center gap-2 justify-start text-left"
                onClick={() => handleQuickAction(action.query)}
              >
                <action.icon className="h-4 w-4 text-blue-600 flex-shrink-0" />
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
            className="bg-blue-600 hover:bg-blue-700 px-4"
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
