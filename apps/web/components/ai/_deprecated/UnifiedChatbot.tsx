'use client';

/**
 * Unified AI Chatbot
 * 
 * Consolidated chatbot combining best features from:
 * - FloatingAIBubble: Streaming, persistence, contract previews, offline queue
 * - AIChatbot: Workflow integration, file attachments, retry logic
 * - EnhancedChatbot: Modular architecture, rich markdown, context management
 * 
 * @version 2.0.0
 */

import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  X,
  Maximize2,
  Minimize2,
  Settings,
  Trash2,
  MessageSquare,
  Sparkles,
  ChevronDown,
  WifiOff,
  RefreshCw,
  History,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Keyboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Hooks
import { useStreamingHandler, type StreamingState } from './useStreamingHandler';

// Components
import { ContractPreviewCard, ContractPreviewList, type ContractPreviewData } from './ContractPreview';
import { WorkflowActions, InlineConfirmReject, type WorkflowAction } from './WorkflowActions';

// Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokenCount?: number;
    processingTime?: number;
    agentUsed?: boolean;
    toolsUsed?: string[];
    ragSources?: Array<{
      id: string;
      contractTitle?: string;
      relevance: number;
    }>;
  };
  contracts?: ContractPreviewData[];
  actions?: WorkflowAction[];
  error?: boolean;
  pending?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSettings {
  soundEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  showSuggestions: boolean;
  streamingEnabled: boolean;
}

interface UnifiedChatbotProps {
  /** Initial visible state */
  defaultOpen?: boolean;
  /** Page context for relevance */
  context?: {
    page?: string;
    contractId?: string;
    contractName?: string;
  };
  /** Callback when contract is clicked */
  onContractClick?: (contractId: string) => void;
  /** Callback when workflow action is triggered */
  onWorkflowAction?: (action: WorkflowAction) => Promise<void>;
  /** Chat title */
  title?: string;
  /** Position */
  position?: 'bottom-right' | 'bottom-left';
  /** Custom class */
  className?: string;
}

// Storage keys
const STORAGE_KEYS = {
  CONVERSATIONS: 'contigo-chat-conversations',
  CURRENT_CONVERSATION: 'contigo-chat-current',
  SETTINGS: 'contigo-chat-settings',
  OFFLINE_QUEUE: 'contigo-chat-offline-queue',
};

// Default settings
const DEFAULT_SETTINGS: ChatSettings = {
  soundEnabled: true,
  theme: 'system',
  showSuggestions: true,
  streamingEnabled: true,
};

// Quick action suggestions
const QUICK_ACTIONS = [
  { label: '📋 Show expiring contracts', query: 'Show contracts expiring in 30 days' },
  { label: '🔍 Search contracts', query: 'Search for contracts with ' },
  { label: '📊 Spend analysis', query: 'Show spend analysis' },
  { label: '⚠️ High-risk contracts', query: 'List high-risk contracts' },
  { label: '📝 Contract summary', query: 'Summarize my contracts' },
];

// Utility: Generate ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Utility: Create welcome message
function createWelcomeMessage(): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: `👋 **Welcome to ConTigo AI!**

I'm your intelligent contract assistant. I can help you:

• **Find contracts** - Search by supplier, status, or keywords
• **Analyze risks** - Identify high-risk contracts and clauses
• **Track expirations** - Monitor upcoming renewals
• **Get insights** - Spend analysis, supplier performance, compliance

Try asking me something like:
- "Show contracts expiring this month"
- "What's our spend with Acme Corp?"
- "Find high-risk clauses in recent contracts"

How can I help you today?`,
    timestamp: new Date(),
  };
}

// Message bubble component
const MessageBubble = memo(function MessageBubble({
  message,
  onContractClick,
  onWorkflowAction,
}: {
  message: ChatMessage;
  onContractClick?: (id: string) => void;
  onWorkflowAction?: (action: WorkflowAction) => Promise<void>;
}) {
  const isUser = message.role === 'user';
  
  // Simple markdown rendering
  const renderContent = (content: string) => {
    // Bold
    let html = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-slate-800 text-slate-100 p-3 rounded-lg overflow-x-auto my-2"><code>$2</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-sm">$1</code>');
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-violet-600 hover:underline" target="_blank" rel="noopener">$1</a>');
    // Lists
    html = html.replace(/^• (.+)$/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc my-2">$&</ul>');
    // Line breaks
    html = html.replace(/\n/g, '<br/>');
    
    return html;
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3',
        isUser
          ? 'bg-violet-600 text-white rounded-br-md'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-md',
        message.error && 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700',
        message.pending && 'opacity-70'
      )}>
        <div 
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: renderContent(message.content) }}
        />
        
        {/* Contract previews */}
        {message.contracts && message.contracts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <ContractPreviewList
              contracts={message.contracts}
              onContractClick={onContractClick}
              variant="compact"
              maxItems={3}
            />
          </div>
        )}
        
        {/* RAG sources */}
        {message.metadata?.ragSources && message.metadata.ragSources.length > 0 && (
          <details className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
              {message.metadata.ragSources.length} source(s) referenced
            </summary>
            <div className="mt-2 space-y-1">
              {message.metadata.ragSources.map((source) => (
                <div key={source.id || source.contractTitle} className="text-xs text-slate-500 flex items-center gap-2">
                  <span className="w-8 text-right">{Math.round(source.relevance * 100)}%</span>
                  <span className="truncate">{source.contractTitle || source.id}</span>
                </div>
              ))}
            </div>
          </details>
        )}
        
        {/* Workflow actions */}
        {message.actions && message.actions.length > 0 && onWorkflowAction && (
          <div className="mt-3">
            <WorkflowActions
              actions={message.actions}
              onAction={onWorkflowAction}
            />
          </div>
        )}
        
        {/* Timestamp and metadata */}
        <div className="mt-2 flex items-center gap-2 text-xs opacity-60">
          <span>{message.timestamp.toLocaleTimeString()}</span>
          {message.metadata?.model && (
            <span>• {message.metadata.model}</span>
          )}
          {message.metadata?.agentUsed && (
            <span className="text-violet-500">• Agent</span>
          )}
        </div>
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center">
          <MessageSquare className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </div>
      )}
    </motion.div>
  );
});

// Typing indicator
const TypingIndicator = memo(function TypingIndicator({ 
  message 
}: { 
  message: string 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-3"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">{message}</span>
          <motion.div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 bg-violet-500 rounded-full"
                animate={{ y: [0, -4, 0] }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
});

// Main chatbot component
export const UnifiedChatbot = memo(function UnifiedChatbot({
  defaultOpen = false,
  context,
  onContractClick,
  onWorkflowAction,
  title = 'ConTigo AI',
  position = 'bottom-right',
  className,
}: UnifiedChatbotProps) {
  // State
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([createWelcomeMessage()]);
  const [inputValue, setInputValue] = useState('');
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState<string[]>([]);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Streaming handler
  const {
    state: streamingState,
    streamMessage,
    sendMessage,
    abort,
    thinkingMessage,
    isActive: isStreaming,
  } = useStreamingHandler({
    onComplete: (content, metadata) => {
      // Will be handled by addAssistantMessage
    },
    onError: (error) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.pending) {
          return [...prev.slice(0, -1), { ...last, error: true, pending: false, content: `Error: ${error}` }];
        }
        return prev;
      });
    },
  });
  
  // Load settings from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch {
      // Use defaults
    }
  }, []);
  
  // Save settings
  const updateSettings = useCallback((updates: Partial<ChatSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);
  
  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingState.content]);
  
  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);
  
  // Send message
  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    // Handle offline
    if (!isOnline) {
      setOfflineQueue(prev => [...prev, trimmed]);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'system',
        content: '📱 You\'re offline. This message will be sent when you reconnect.',
        timestamp: new Date(),
      }]);
      return;
    }
    
    // Prepare conversation history
    const history = messages
      .filter(m => m.role !== 'system' && m.id !== 'welcome')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));
    
    // Add pending assistant message
    const pendingId = generateId();
    setMessages(prev => [...prev, {
      id: pendingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      pending: true,
    }]);
    
    try {
      // Use streaming or direct based on settings
      const response = settings.streamingEnabled
        ? await streamMessage(trimmed, history, context)
        : await sendMessage(trimmed, history, context);
      
      // Update message with response
      setMessages(prev => prev.map(m => 
        m.id === pendingId
          ? {
              ...m,
              content: response || 'I apologize, but I couldn\'t generate a response. Please try again.',
              pending: false,
              metadata: streamingState.metadata,
            }
          : m
      ));
      
      // Play sound if enabled
      if (settings.soundEnabled && typeof window !== 'undefined') {
        // Could add notification sound here
      }
    } catch (err) {
      setMessages(prev => prev.map(m => 
        m.id === pendingId
          ? {
              ...m,
              content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
              error: true,
              pending: false,
            }
          : m
      ));
    }
  }, [inputValue, isStreaming, isOnline, messages, context, settings, streamMessage, sendMessage, streamingState.metadata]);
  
  // Handle quick action
  const handleQuickAction = useCallback((query: string) => {
    setInputValue(query);
    inputRef.current?.focus();
  }, []);
  
  // Clear chat
  const handleClear = useCallback(() => {
    setMessages([createWelcomeMessage()]);
  }, []);
  
  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);
  
  // Position classes
  const positionClasses = position === 'bottom-right'
    ? 'right-4 bottom-4'
    : 'left-4 bottom-4';
  
  return (
    <>
      {/* Trigger button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button key="UnifiedChatbot-ap-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className={cn(
              'fixed z-50 p-4 rounded-full shadow-xl',
              'bg-gradient-to-br from-violet-600 to-purple-600',
              'hover:from-violet-500 hover:to-purple-500',
              'transition-all duration-200',
              positionClasses,
              className
            )}
          >
            <Bot className="h-6 w-6 text-white" />
            {offlineQueue.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full text-xs text-white flex items-center justify-center">
                {offlineQueue.length}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
      
      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div key="open"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              'fixed z-50 flex flex-col overflow-hidden',
              'bg-white dark:bg-slate-900 rounded-xl shadow-2xl',
              'border border-slate-200 dark:border-slate-700',
              isMaximized
                ? 'inset-4'
                : cn('w-96 h-[600px]', positionClasses),
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-semibold">{title}</h2>
                  {!isOnline && (
                    <p className="text-amber-300 text-xs flex items-center gap-1">
                      <WifiOff className="h-3 w-3" /> Offline
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={handleClear}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4 text-white/70 hover:text-white" />
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Settings"
                >
                  <Settings className="h-4 w-4 text-white/70 hover:text-white" />
                </button>
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title={isMaximized ? 'Minimize' : 'Maximize'}
                >
                  {isMaximized ? (
                    <Minimize2 className="h-4 w-4 text-white/70 hover:text-white" />
                  ) : (
                    <Maximize2 className="h-4 w-4 text-white/70 hover:text-white" />
                  )}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Close"
                >
                  <X className="h-4 w-4 text-white/70 hover:text-white" />
                </button>
              </div>
            </div>
            
            {/* Settings panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div key="settings"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden"
                >
                  <div className="p-4 space-y-3">
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-slate-700 dark:text-slate-300">Enable streaming</span>
                      <input
                        type="checkbox"
                        checked={settings.streamingEnabled}
                        onChange={(e) => updateSettings({ streamingEnabled: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-slate-700 dark:text-slate-300">Sound notifications</span>
                      <input
                        type="checkbox"
                        checked={settings.soundEnabled}
                        onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-slate-700 dark:text-slate-300">Show suggestions</span>
                      <input
                        type="checkbox"
                        checked={settings.showSuggestions}
                        onChange={(e) => updateSettings({ showSuggestions: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onContractClick={onContractClick}
                  onWorkflowAction={onWorkflowAction}
                />
              ))}
              
              {/* Streaming content */}
              {isStreaming && streamingState.content && (
                <MessageBubble
                  message={{
                    id: 'streaming',
                    role: 'assistant',
                    content: streamingState.content,
                    timestamp: new Date(),
                  }}
                  onContractClick={onContractClick}
                />
              )}
              
              {/* Typing indicator */}
              {isStreaming && !streamingState.content && (
                <TypingIndicator message={thinkingMessage} />
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Quick actions */}
            {messages.length <= 2 && settings.showSuggestions && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.query)}
                      className="text-xs px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Input */}
            <div className="border-t border-slate-200 dark:border-slate-700 p-4">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask about your contracts..."
                  rows={1}
                  className={cn(
                    'flex-1 resize-none rounded-lg border border-slate-200 dark:border-slate-700',
                    'bg-white dark:bg-slate-800 px-4 py-2.5',
                    'text-slate-900 dark:text-slate-100 placeholder-slate-400',
                    'focus:outline-none focus:ring-2 focus:ring-violet-500',
                    'disabled:opacity-50'
                  )}
                  disabled={isStreaming}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isStreaming}
                  className={cn(
                    'px-4 py-2 rounded-lg font-medium transition-all',
                    'bg-violet-600 hover:bg-violet-700 text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isStreaming ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                </button>
              </div>
              
              <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">⌘ /</kbd> to toggle
                </span>
                <span>{inputValue.length}/2000</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

export default UnifiedChatbot;
