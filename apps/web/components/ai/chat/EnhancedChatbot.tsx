'use client';

/**
 * Enhanced AI Chatbot
 * Full-featured chatbot with conversation memory, rich messages, and smart suggestions
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
  Sun,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import chat components
import { MessageBubble, ChatMessage, MessageAttachment } from './MessageBubble';
import { EnhancedChatInput, Attachment } from './EnhancedChatInput';
import { ThinkingStatus } from './TypingIndicator';
import { SmartSuggestions } from './SmartSuggestions';
import { ConversationSidebar } from './ConversationSidebar';
import { ChatContextProvider, useChatContext } from './ChatContext';

// Types
interface ChatSettings {
  soundEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  showSuggestions: boolean;
  compactMode: boolean;
}

// Default settings
const DEFAULT_SETTINGS: ChatSettings = {
  soundEnabled: true,
  theme: 'system',
  showSuggestions: true,
  compactMode: false,
};

// Chat header component
interface ChatHeaderProps {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onClearChat: () => void;
  title?: string;
}

const ChatHeader = memo(({
  isMaximized,
  onToggleMaximize,
  onClose,
  onOpenSettings,
  onClearChat,
  title = 'AI Assistant',
}: ChatHeaderProps) => (
  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-600 to-purple-600">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-white/20 rounded-lg">
        <Bot className="h-5 w-5 text-white" />
      </div>
      <div>
        <h2 className="text-white font-semibold">{title}</h2>
        <p className="text-white/70 text-xs">Powered by AI</p>
      </div>
    </div>
    <div className="flex items-center gap-1">
      <button
        onClick={onClearChat}
        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        title="Clear chat"
      >
        <Trash2 className="h-4 w-4 text-white/70 hover:text-white" />
      </button>
      <button
        onClick={onOpenSettings}
        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        title="Settings"
      >
        <Settings className="h-4 w-4 text-white/70 hover:text-white" />
      </button>
      <button
        onClick={onToggleMaximize}
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
        onClick={onClose}
        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        title="Close"
      >
        <X className="h-4 w-4 text-white/70 hover:text-white" />
      </button>
    </div>
  </div>
));

ChatHeader.displayName = 'ChatHeader';

// Settings panel
interface SettingsPanelProps {
  settings: ChatSettings;
  onUpdateSettings: (settings: Partial<ChatSettings>) => void;
  onClose: () => void;
}

const SettingsPanel = memo(({
  settings,
  onUpdateSettings,
  onClose,
}: SettingsPanelProps) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    className="absolute inset-0 bg-white dark:bg-slate-900 z-50"
  >
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200">Settings</h3>
      <button
        onClick={onClose}
        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
      >
        <X className="h-4 w-4 text-slate-500" />
      </button>
    </div>
    <div className="p-4 space-y-4">
      {/* Sound */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {settings.soundEnabled ? (
            <Volume2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          ) : (
            <VolumeX className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          )}
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Sound</p>
            <p className="text-xs text-slate-500">Play sounds for new messages</p>
          </div>
        </div>
        <button
          onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
          className={cn(
            "w-11 h-6 rounded-full transition-colors relative",
            settings.soundEnabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
          )}
        >
          <span className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform",
            settings.soundEnabled && "translate-x-5"
          )} />
        </button>
      </div>

      {/* Theme */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sun className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Theme</p>
            <p className="text-xs text-slate-500">Choose your preferred theme</p>
          </div>
        </div>
        <select
          value={settings.theme}
          onChange={(e) => onUpdateSettings({ theme: e.target.value as ChatSettings['theme'] })}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>

      {/* Suggestions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Smart Suggestions</p>
            <p className="text-xs text-slate-500">Show AI-powered suggestions</p>
          </div>
        </div>
        <button
          onClick={() => onUpdateSettings({ showSuggestions: !settings.showSuggestions })}
          className={cn(
            "w-11 h-6 rounded-full transition-colors relative",
            settings.showSuggestions ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
          )}
        >
          <span className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform",
            settings.showSuggestions && "translate-x-5"
          )} />
        </button>
      </div>

      {/* Compact mode */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Minimize2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Compact Mode</p>
            <p className="text-xs text-slate-500">Reduce message spacing</p>
          </div>
        </div>
        <button
          onClick={() => onUpdateSettings({ compactMode: !settings.compactMode })}
          className={cn(
            "w-11 h-6 rounded-full transition-colors relative",
            settings.compactMode ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
          )}
        >
          <span className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform",
            settings.compactMode && "translate-x-5"
          )} />
        </button>
      </div>
    </div>
  </motion.div>
));

SettingsPanel.displayName = 'SettingsPanel';

// Welcome screen
const WelcomeScreen = memo(({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-6"
    >
      <Bot className="h-12 w-12 text-white" />
    </motion.div>
    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
      Welcome to AI Assistant
    </h2>
    <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
      I can help you analyze contracts, answer questions, and provide insights about your documents.
    </p>
    <div className="w-full max-w-md">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
        Try asking about
      </p>
      <SmartSuggestions
        onSuggestionClick={onSuggestionClick}
        variant="cards"
        maxSuggestions={4}
      />
    </div>
  </div>
));

WelcomeScreen.displayName = 'WelcomeScreen';

// Main chat content
interface ChatContentProps {
  settings: ChatSettings;
  onSendMessage: (message: string, attachments?: Attachment[]) => void;
  contractContext?: { id: string; name: string } | null;
}

const ChatContent = memo(({
  settings,
  onSendMessage,
  contractContext,
}: ChatContentProps) => {
  const { messages, isLoading, streamingMessage, updateMessage } = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState('');

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  // Handle send and clear input
  const handleSend = useCallback((text: string, attachments?: Attachment[]) => {
    onSendMessage(text, attachments);
    setInputValue('');
  }, [onSendMessage]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((text: string) => {
    onSendMessage(text);
    setInputValue('');
  }, [onSendMessage]);

  // Handle message feedback
  const handleFeedback = useCallback((messageId: string, feedback: 'positive' | 'negative') => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      updateMessage(messageId, { feedback });
    }
  }, [messages, updateMessage]);

  // Handle message copy
  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  // Convert context messages to ChatMessage format
  const chatMessages: ChatMessage[] = useMemo(() => 
    messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      isTyping: false,
      feedback: m.feedback,
      sources: m.sources,
      attachments: m.attachments,
    })),
    [messages]
  );

  // Show welcome if no messages
  if (messages.length === 0 && !isLoading) {
    return <WelcomeScreen onSuggestionClick={handleSuggestionClick} />;
  }

  return (
    <>
      {/* Messages */}
      <div 
        data-testid="chatbot-messages"
        className={cn(
          "flex-1 overflow-y-auto p-4 space-y-4",
          settings.compactMode && "space-y-2"
        )}
      >
        <AnimatePresence mode="popLayout">
          {chatMessages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              layout
            >
              <MessageBubble
                message={message}
                onFeedback={(messageId, feedback) => handleFeedback(messageId, feedback)}
                onCopy={(content) => handleCopy(content)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Streaming message */}
        {streamingMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <MessageBubble
              message={{
                id: 'streaming',
                role: 'assistant',
                content: streamingMessage,
                timestamp: new Date(),
                isTyping: true,
              }}
            />
          </motion.div>
        )}

        {/* Typing indicator */}
        {isLoading && !streamingMessage && (
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shrink-0">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
              <ThinkingStatus />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {settings.showSuggestions && messages.length > 0 && !isLoading && (
        <div className="px-4 pb-2">
          <SmartSuggestions
            onSuggestionClick={handleSuggestionClick}
            pageContext={contractContext ? 'contract-detail' : 'dashboard'}
            contractContext={contractContext}
            variant="pills"
            maxSuggestions={3}
          />
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <EnhancedChatInput
          ref={inputRef}
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          isLoading={isLoading}
          placeholder="Ask me anything about your contracts..."
          contractContext={contractContext}
        />
      </div>
    </>
  );
});

ChatContent.displayName = 'ChatContent';

// Main chatbot component
interface EnhancedChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  contractContext?: { id: string; name: string } | null;
  className?: string;
}

export const EnhancedChatbot = memo(({
  isOpen,
  onClose,
  contractContext,
  className,
}: EnhancedChatbotProps) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('chat-settings');
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // Failed to load chat settings, using defaults
    }
  }, []);

  // Save settings
  const updateSettings = useCallback((updates: Partial<ChatSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      localStorage.setItem('chat-settings', JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  if (!isOpen) return null;

  return (
    <ChatContextProvider>
      <ChatbotInner
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized(!isMaximized)}
        onClose={onClose}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        settings={settings}
        onUpdateSettings={updateSettings}
        contractContext={contractContext}
        className={className}
      />
    </ChatContextProvider>
  );
});

EnhancedChatbot.displayName = 'EnhancedChatbot';

// Inner component with context access
interface ChatbotInnerProps {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  showSettings: boolean;
  onToggleSettings: () => void;
  showSidebar: boolean;
  onToggleSidebar: () => void;
  settings: ChatSettings;
  onUpdateSettings: (settings: Partial<ChatSettings>) => void;
  contractContext?: { id: string; name: string } | null;
  className?: string;
}

const ChatbotInner = memo(({
  isMaximized,
  onToggleMaximize,
  onClose,
  showSettings,
  onToggleSettings,
  showSidebar,
  onToggleSidebar,
  settings,
  onUpdateSettings,
  contractContext,
  className,
}: ChatbotInnerProps) => {
  const {
    conversations,
    currentConversationId,
    addMessage,
    setIsLoading,
    setStreamingMessage,
    loadConversation,
    createConversation,
    deleteConversation,
    clearCurrentConversation,
    setContractContext,
  } = useChatContext();

  // Set contract context on mount
  useEffect(() => {
    if (contractContext) {
      setContractContext(contractContext);
    }
  }, [contractContext, setContractContext]);

  // Send message handler
  const handleSendMessage = useCallback(async (text: string, attachments?: Attachment[]) => {
    // Convert Attachment to MessageAttachment
    const messageAttachments: MessageAttachment[] | undefined = attachments?.map(a => ({
      id: a.id,
      type: 'file' as const,
      name: a.file.name,
      preview: a.preview,
      size: a.file.size,
    }));
    
    // Add user message
    addMessage({
      role: 'user',
      content: text,
      attachments: messageAttachments,
    });

    setIsLoading(true);

    try {
      // Call AI API with conversation memory support
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          contractId: contractContext?.id,
          conversationId: currentConversationId, // Pass conversation ID for memory
          attachments: attachments?.map(a => ({
            name: a.file.name,
            type: a.file.type,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (reader) {
        let fullResponse = '';
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          fullResponse += chunk;
          setStreamingMessage(fullResponse);
        }

        // Add assistant message
        setStreamingMessage('');
        addMessage({
          role: 'assistant',
          content: fullResponse,
        });
      } else {
        // Non-streaming response
        const data = await response.json();
        
        // Build message content with reference resolutions
        let messageContent = data.response || data.message || 'Sorry, I could not generate a response.';
        
        // Add reference resolutions if present
        if (data.referenceResolutions && data.referenceResolutions.length > 0) {
          const resolutions = data.referenceResolutions
            .map((r: any) => `"${r.originalText}" → "${r.resolvedValue}"`)
            .join(', ');
          messageContent += `\n\n_Resolved references: ${resolutions}_`;
        }
        
        addMessage({
          role: 'assistant',
          content: messageContent,
          sources: data.sources,
          suggestions: data.suggestions,
          metadata: {
            referenceResolutions: data.referenceResolutions,
          },
        });
      }
    } catch {
      addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, setIsLoading, setStreamingMessage, contractContext, currentConversationId]);

  // Convert conversations for sidebar
  const sidebarConversations = useMemo(() => 
    conversations.map(c => ({
      id: c.id,
      title: c.title,
      lastMessage: c.messages[c.messages.length - 1]?.content?.slice(0, 50),
      messageCount: c.messages.length,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      contractContext: (c.metadata as Record<string, unknown>)?.contractContext as { id: string; name: string } | undefined,
    })),
    [conversations]
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className={cn(
        "fixed z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex",
        isMaximized
          ? "inset-4"
          : "bottom-24 right-6 w-[420px] h-[600px]",
        className
      )}
    >
      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && isMaximized && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
          >
            <ConversationSidebar
              conversations={sidebarConversations}
              activeConversationId={currentConversationId}
              onSelectConversation={loadConversation}
              onNewConversation={() => createConversation()}
              onDeleteConversation={deleteConversation}
              onRenameConversation={(_id, _title) => {
                // Rename logic would go here
              }}
              isCollapsed={false}
              onToggleCollapse={onToggleSidebar}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col relative">
        <ChatHeader
          isMaximized={isMaximized}
          onToggleMaximize={onToggleMaximize}
          onClose={onClose}
          onOpenSettings={onToggleSettings}
          onClearChat={clearCurrentConversation}
        />

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <SettingsPanel
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              onClose={onToggleSettings}
            />
          )}
        </AnimatePresence>

        {/* Chat content */}
        {!showSettings && (
          <ChatContent
            settings={settings}
            onSendMessage={handleSendMessage}
            contractContext={contractContext}
          />
        )}
      </div>
    </motion.div>
  );
});

ChatbotInner.displayName = 'ChatbotInner';

export default EnhancedChatbot;
