/**
 * Enhanced Chatbot UI - Professional and Flexible
 * 
 * A polished, modern chatbot interface that can handle any type of message
 */

'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Sparkles,
  X,
  Minimize2,
  Maximize2,
  Bot,
  User,
  RefreshCw,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  ChevronDown,
  ArrowUp,
  Lightbulb,
  History,
  Settings,
  MoreVertical,
  FileText,
  TrendingUp,
  Calendar,
  AlertCircle,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: string[];
  suggestions?: string[];
  actions?: Array<{ label: string; action: string }>;
  status?: 'sending' | 'sent' | 'error';
  feedback?: 'positive' | 'negative';
  isStreaming?: boolean;
}

interface ChatbotProps {
  context?: 'global' | 'contract' | 'dashboard';
  contractId?: string;
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'inline';
  theme?: 'light' | 'dark' | 'system';
}

// =============================================================================
// QUICK ACTIONS
// =============================================================================

const QUICK_ACTIONS = [
  { icon: FileText, label: 'Contract summary', query: 'Summarize my active contracts' },
  { icon: Calendar, label: 'Expiring soon', query: 'What contracts expire in the next 30 days?' },
  { icon: TrendingUp, label: 'Spending insights', query: 'Show me spending analysis by supplier' },
  { icon: AlertCircle, label: 'High risk', query: 'Show me high risk contracts' },
];

const WELCOME_SUGGESTIONS = [
  'How can I find contracts expiring soon?',
  'Summarize contracts with Accenture',
  'What are the top suppliers by spend?',
  'Compare contract terms for IT services',
];

// =============================================================================
// TYPING INDICATOR
// =============================================================================

const TypingIndicator = memo(() => (
  <div className="flex items-center gap-2 py-3">
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
      <Bot className="h-4 w-4 text-white" />
    </div>
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-gray-400"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
    <span className="text-xs text-gray-500">Thinking...</span>
  </div>
));
TypingIndicator.displayName = 'TypingIndicator';

// =============================================================================
// MESSAGE BUBBLE
// =============================================================================

interface MessageBubbleProps {
  message: Message;
  onCopy: (content: string) => void;
  onFeedback: (id: string, feedback: 'positive' | 'negative') => void;
  onAction: (action: string) => void;
  onSuggestion: (suggestion: string) => void;
}

const MessageBubble = memo<MessageBubbleProps>(({
  message,
  onCopy,
  onFeedback,
  onAction,
  onSuggestion,
}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group flex gap-3 max-w-full',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800'
            : 'bg-gradient-to-br from-blue-500 to-indigo-600'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex flex-col gap-1 max-w-[85%]',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md',
            message.isStreaming && 'animate-pulse'
          )}
        >
          {/* Render markdown-like content */}
          <div className="whitespace-pre-wrap">{message.content}</div>

          {/* Sources */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200/30 dark:border-gray-700/30">
              <p className="text-xs opacity-70 mb-1.5 font-medium">Sources:</p>
              <div className="flex flex-wrap gap-1">
                {message.sources.slice(0, 3).map((source, i) => (
                  <span
                    key={i}
                    className="text-xs bg-white/10 dark:bg-gray-700/50 px-2 py-0.5 rounded-full"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions for assistant messages */}
        {!isUser && !message.isStreaming && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onCopy(message.content)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Copy</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onFeedback(message.id, 'positive')}
                    className={cn(
                      'p-1 rounded transition-colors',
                      message.feedback === 'positive'
                        ? 'text-green-600 bg-green-100'
                        : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                    )}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Helpful</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onFeedback(message.id, 'negative')}
                    className={cn(
                      'p-1 rounded transition-colors',
                      message.feedback === 'negative'
                        ? 'text-red-600 bg-red-100'
                        : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                    )}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Not helpful</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Suggested Actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => onAction(action.action)}
                className="text-xs px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-300 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSuggestion(suggestion)}
                className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1"
              >
                <Lightbulb className="h-3 w-3" />
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-gray-400 mt-1">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </motion.div>
  );
});
MessageBubble.displayName = 'MessageBubble';

// =============================================================================
// CHAT INPUT
// =============================================================================

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onQuickAction: (query: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

const ChatInput = memo<ChatInputProps>(({
  value,
  onChange,
  onSend,
  onQuickAction,
  isLoading,
  disabled,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) {
        onSend();
      }
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
      {/* Quick Actions */}
      {value.length === 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => onQuickAction(action.query)}
                disabled={isLoading}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <action.icon className="h-3 w-3" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3">
        <div className="relative flex items-end gap-2 bg-gray-100 dark:bg-gray-800 rounded-2xl p-2 pr-3">
          {/* Attachment Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  disabled={disabled}
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Attach file</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your contracts..."
            disabled={disabled || isLoading}
            className="flex-1 min-h-[40px] max-h-[120px] bg-transparent border-0 resize-none focus:ring-0 focus-visible:ring-0 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
            rows={1}
          />

          {/* AI Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 px-2">
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">AI</span>
          </div>

          {/* Send Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSend}
            disabled={!value.trim() || isLoading || disabled}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-xl transition-all',
              value.trim() && !isLoading
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </motion.button>
        </div>

        {/* Keyboard Hint */}
        <p className="text-[10px] text-gray-400 text-center mt-2">
          Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[9px]">Enter</kbd> to send,{' '}
          <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[9px]">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
});
ChatInput.displayName = 'ChatInput';

// =============================================================================
// MAIN CHATBOT COMPONENT
// =============================================================================

export function ProfessionalChatbot({
  context = 'global',
  contractId,
  className,
  position = 'bottom-right',
  theme: _theme = 'system',
}: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollButton, _setShowScrollButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: `👋 Hello! I'm your ConTigo AI assistant. I can help you with:

• **Search & Find** - Find contracts by any criteria
• **Analyze** - Get insights and summaries
• **Compare** - Compare contracts or suppliers
• **Monitor** - Track renewals and risks

What would you like to know about your contracts?`,
        timestamp: new Date(),
        suggestions: WELCOME_SUGGESTIONS,
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length]);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  // Auto scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send message
  const handleSend = useCallback(async (overrideMessage?: string) => {
    const messageText = overrideMessage || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          contractId,
          context,
          conversationHistory: messages.slice(-10),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || data.message || 'I apologize, I couldn\'t process that request.',
        timestamp: new Date(),
        sources: data.sources,
        suggestions: data.suggestions,
        actions: data.suggestedActions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date(),
        suggestions: ['Try a simpler question', 'Refresh and try again'],
      };
      
      setMessages((prev) => [...prev, errorMessage]);
      toast.error('Failed to get response');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, contractId, context]);

  // Handle quick action
  const handleQuickAction = useCallback((query: string) => {
    setInput(query);
    handleSend(query);
  }, [handleSend]);

  // Handle suggestion click
  const handleSuggestion = useCallback((suggestion: string) => {
    handleSend(suggestion);
  }, [handleSend]);

  // Handle action click
  const handleAction = useCallback((action: string) => {
    if (action.startsWith('navigate:')) {
      const path = action.replace('navigate:', '');
      window.location.href = path;
    } else if (action.startsWith('view-contract:')) {
      const id = action.replace('view-contract:', '');
      window.location.href = `/contracts/${id}`;
    } else {
      handleSend(action);
    }
  }, [handleSend]);

  // Copy message
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  }, []);

  // Handle feedback
  const handleFeedback = useCallback((messageId: string, feedback: 'positive' | 'negative') => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, feedback } : m
      )
    );
    toast.success(feedback === 'positive' ? 'Thanks for the feedback!' : 'We\'ll improve based on your feedback');
  }, []);

  // Clear chat
  const clearChat = useCallback(() => {
    setMessages([]);
    toast.success('Chat cleared');
  }, []);

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'inline': 'relative',
  };

  // Floating button (when closed)
  if (!isOpen && position !== 'inline') {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed z-50 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center group',
          positionClasses[position]
        )}
      >
        <MessageSquare className="h-6 w-6 transition-transform group-hover:scale-110" />
        
        {/* Pulse effect */}
        <span className="absolute inset-0 rounded-full bg-blue-600 animate-ping opacity-20" />
        
        {/* Tooltip */}
        <span className="absolute right-full mr-3 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Ask AI Assistant
        </span>
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'z-50 flex flex-col overflow-hidden rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-900 shadow-2xl',
          position !== 'inline' && 'fixed',
          position !== 'inline' && positionClasses[position],
          isExpanded
            ? 'w-[90vw] h-[90vh] max-w-4xl'
            : 'w-[400px] h-[600px]',
          isMinimized && 'h-14',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">ConTigo AI</h3>
              <p className="text-[10px] text-white/70 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                Online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* More Options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={clearChat}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clear chat
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <History className="h-4 w-4 mr-2" />
                  Chat history
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Expand/Minimize */}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <Minimize2 className="h-4 w-4" />
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>

            {/* Close */}
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        {!isMinimized && (
          <>
            <ScrollArea className="flex-1 p-4">
              <div ref={scrollRef} className="space-y-4">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onCopy={handleCopy}
                    onFeedback={handleFeedback}
                    onAction={handleAction}
                    onSuggestion={handleSuggestion}
                  />
                ))}

                {isLoading && <TypingIndicator />}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Scroll to bottom button */}
            <AnimatePresence>
              {showScrollButton && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  onClick={() => scrollToBottom()}
                  className="absolute bottom-28 right-4 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg hover:shadow-xl transition-shadow"
                >
                  <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Input */}
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              onQuickAction={handleQuickAction}
              isLoading={isLoading}
            />
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default ProfessionalChatbot;
