/**
 * AI Chat Interface Component
 * Full implementation for rate benchmarking AI assistant
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Loader2,
  ChevronDown,
  Copy,
  Check,
  RefreshCw,
  Lightbulb,
  TrendingUp,
  DollarSign,
  BarChart2,
  MessageSquare,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  suggestions?: string[];
  sources?: { title: string; url?: string }[];
}

export interface AIChatInterfaceProps {
  className?: string;
  onSendMessage?: (message: string) => Promise<string>;
  initialMessages?: Message[];
  context?: {
    contractId?: string;
    rateData?: any;
    benchmarkData?: any;
  };
}

const quickPrompts = [
  { icon: TrendingUp, text: "What's the market trend for this rate category?", category: 'trends' },
  { icon: DollarSign, text: "How can I optimize my pricing strategy?", category: 'pricing' },
  { icon: BarChart2, text: "Compare my rates against industry benchmarks", category: 'benchmark' },
  { icon: Lightbulb, text: "Suggest negotiation points for this contract", category: 'negotiation' },
];

// Simulated AI responses for demo purposes
const simulatedResponses: Record<string, string> = {
  trends: `Based on current market analysis, this rate category has shown a **5.2% year-over-year increase**. Key observations:

• **Q4 rates** are typically 8-12% higher due to budget flush
• Regional variance is significant - West Coast rates are 15% above national average
• Remote-friendly roles have seen the largest growth at 18% YoY

**Recommendation:** Consider timing your negotiations in Q3 for better leverage on annual contracts.`,
  pricing: `Here are my recommendations for optimizing your pricing strategy:

1. **Tier your pricing** by engagement size:
   - Small (<100 hrs): Premium rate (+10%)
   - Medium (100-500 hrs): Standard rate
   - Large (>500 hrs): Volume discount (-5%)

2. **Value-based adjustments:**
   - Mission-critical projects: +15-20%
   - Specialized expertise: +10-15%
   - Long-term commitment: -5-8%

3. **Market positioning:** You're currently at the 55th percentile. Moving to 60th would add ~$8K/year without significant churn risk.`,
  benchmark: `Comparing your current rates against industry benchmarks:

| Metric | Your Rate | Market P50 | Difference |
|--------|-----------|------------|------------|
| Base Rate | $125/hr | $120/hr | +4.2% |
| Senior Rate | $175/hr | $180/hr | -2.8% |
| Manager Rate | $200/hr | $210/hr | -4.8% |

**Key Insights:**
• Your base rates are competitive
• Senior and manager tiers have room for increase
• Consider adjusting by $5-10/hr to align with market`,
  negotiation: `Based on the contract analysis, here are key negotiation points:

🎯 **High Priority:**
1. Payment terms are Net-60 - push for Net-30 (industry standard)
2. Rate escalation clause is missing - request 3% annual increase

💡 **Moderate Priority:**
3. Travel expenses at $500/day cap - market is $750/day
4. Overtime multiplier at 1.25x - standard is 1.5x

⚠️ **Risk Areas:**
5. Liability cap seems low - recommend increasing to 2x annual value
6. IP assignment clause is broad - consider carve-outs for pre-existing work`,
  default: `I'm here to help you with rate benchmarking and contract analysis. I can:

• **Analyze market trends** for your rate categories
• **Compare your rates** against industry benchmarks
• **Suggest negotiation strategies** based on market data
• **Provide pricing optimization** recommendations

What would you like to explore?`
};

export function AIChatInterface({ 
  className, 
  onSendMessage,
  initialMessages = [],
  context 
}: AIChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages.length > 0 ? initialMessages : [
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI rate benchmarking assistant. I can help you analyze market rates, optimize pricing, and prepare for negotiations. What would you like to know?",
      timestamp: new Date(),
      suggestions: quickPrompts.map(p => p.text)
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add loading message
    const loadingId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    }]);

    try {
      let response: string;
      
      if (onSendMessage) {
        response = await onSendMessage(messageText);
      } else {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Determine response based on keywords
        const lowerMessage = messageText.toLowerCase();
        const defaultResponse = 'I can help you with rate benchmarking and contract analysis.';
        if (lowerMessage.includes('trend') || lowerMessage.includes('market')) {
          response = simulatedResponses.trends ?? defaultResponse;
        } else if (lowerMessage.includes('pric') || lowerMessage.includes('optimiz')) {
          response = simulatedResponses.pricing ?? defaultResponse;
        } else if (lowerMessage.includes('benchmark') || lowerMessage.includes('compar')) {
          response = simulatedResponses.benchmark ?? defaultResponse;
        } else if (lowerMessage.includes('negotiat') || lowerMessage.includes('contract')) {
          response = simulatedResponses.negotiation ?? defaultResponse;
        } else {
          response = simulatedResponses.default ?? defaultResponse;
        }
      }

      // Replace loading message with actual response
      setMessages(prev => prev.map(msg => 
        msg.id === loadingId 
          ? {
              ...msg,
              content: response,
              isLoading: false,
              suggestions: quickPrompts.slice(0, 2).map(p => p.text)
            }
          : msg
      ));
    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === loadingId 
          ? {
              ...msg,
              content: "I'm sorry, I encountered an error. Please try again.",
              isLoading: false
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRetry = (messageIndex: number) => {
    const userMessage = messages[messageIndex - 1];
    if (userMessage?.role === 'user') {
      // Remove the assistant message
      setMessages(prev => prev.filter((_, i) => i !== messageIndex));
      // Resend
      handleSend(userMessage.content);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: "Chat cleared. How can I help you with rate benchmarking?",
      timestamp: new Date(),
      suggestions: quickPrompts.map(p => p.text)
    }]);
  };

  return (
    <motion.div
      layout
      className={cn(
        "flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden",
        isExpanded ? "fixed inset-4 z-50" : "h-[500px]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-purple-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg shadow-sm">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              AI Rate Assistant
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-700 rounded">
                BETA
              </span>
            </h3>
            <p className="text-xs text-gray-500">Powered by contract intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="p-2 rounded-lg hover:bg-white/80 text-gray-500 transition-colors"
            title="Clear chat"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-white/80 text-gray-500 transition-colors"
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          {isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 rounded-lg hover:bg-white/80 text-gray-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "flex gap-3",
                message.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              )}
              
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3",
                message.role === 'user' 
                  ? "bg-violet-600 text-white" 
                  : "bg-white border border-gray-200 shadow-sm"
              )}>
                {message.isLoading ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Analyzing...</span>
                  </div>
                ) : (
                  <>
                    <div className={cn(
                      "text-sm prose prose-sm max-w-none",
                      message.role === 'user' ? "prose-invert" : ""
                    )}>
                      {/* Simple markdown rendering */}
                      {message.content.split('\n').map((line, i) => (
                        <p key={i} className="mb-1 last:mb-0">
                          {line.replace(/\*\*(.*?)\*\*/g, '⟨strong⟩$1⟨/strong⟩')
                            .split('⟨strong⟩')
                            .map((part, j) => 
                              part.includes('⟨/strong⟩') 
                                ? <strong key={j}>{part.replace('⟨/strong⟩', '')}</strong>
                                : part
                            )}
                        </p>
                      ))}
                    </div>

                    {/* Timestamp and actions */}
                    <div className={cn(
                      "flex items-center gap-2 mt-2 pt-2 border-t",
                      message.role === 'user' 
                        ? "border-violet-500/30" 
                        : "border-gray-100"
                    )}>
                      <span className={cn(
                        "text-[10px]",
                        message.role === 'user' ? "text-violet-200" : "text-gray-400"
                      )}>
                        {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                      </span>
                      
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => handleCopy(message.id, message.content)}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {copiedId === message.id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRetry(index)}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Suggestions */}
                    {message.suggestions && message.suggestions.length > 0 && message.role === 'assistant' && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400 mb-2">Try asking:</p>
                        <div className="flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion, i) => (
                            <button
                              key={i}
                              onClick={() => handleSend(suggestion)}
                              disabled={isLoading}
                              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors disabled:opacity-50"
                            >
                              {suggestion.length > 40 ? suggestion.slice(0, 40) + '...' : suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length === 1 && (
        <div className="px-4 py-3 border-t border-gray-100 bg-white">
          <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
          <div className="grid grid-cols-2 gap-2">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt.text)}
                disabled={isLoading}
                className="flex items-center gap-2 p-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <prompt.icon className="h-4 w-4 text-violet-500 flex-shrink-0" />
                <span className="text-gray-700 text-xs line-clamp-1">{prompt.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about rates, benchmarks, or negotiations..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              "p-2.5 rounded-xl transition-all",
              input.trim() && !isLoading
                ? "bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>
        <p className="text-[10px] text-gray-400 text-center mt-2">
          AI responses are generated for guidance only. Verify critical data independently.
        </p>
      </div>
    </motion.div>
  );
}

export default AIChatInterface;
