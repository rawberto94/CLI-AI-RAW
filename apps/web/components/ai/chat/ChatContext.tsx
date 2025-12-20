'use client';

/**
 * Chat Context Manager
 * Manages conversation history, context, and memory
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ChatMessage } from './MessageBubble';

// Types
interface ConversationContext {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
  metadata: {
    totalMessages: number;
    lastTopic?: string;
    mentionedContracts: string[];
    userPreferences: Record<string, any>;
  };
}

interface ChatContextValue {
  // Current conversation
  currentConversation: ConversationContext | null;
  messages: ChatMessage[];
  
  // Conversation actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => ChatMessage;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  
  // Conversation management
  createNewConversation: (title?: string) => ConversationContext;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  listConversations: () => ConversationContext[];
  
  // Context and memory
  setContext: (key: string, value: any) => void;
  getContext: (key: string) => any;
  clearContext: () => void;
  
  // Contract context
  currentContractId: string | null;
  setCurrentContractId: (id: string | null) => void;
  mentionedContracts: string[];
  addMentionedContract: (id: string) => void;
  
  // Loading state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  // Streaming
  streamingMessageId: string | null;
  setStreamingMessageId: (id: string | null) => void;
  appendToStreamingMessage: (content: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatContextProvider');
  }
  return context;
}

// Storage keys
const STORAGE_KEY_CONVERSATIONS = 'contigo-chat-conversations';
const STORAGE_KEY_CURRENT = 'contigo-chat-current';
const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 100;

// Generate unique ID
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Initial welcome message
const createWelcomeMessage = (): ChatMessage => ({
  id: 'welcome',
  role: 'assistant',
  content: `👋 **Welcome to ConTigo AI!**

I'm your intelligent contract assistant. I can help you:

• **Search & Find** - Locate contracts by supplier, type, or value
• **Analyze** - Extract key terms, dates, and obligations
• **Compare** - Side-by-side contract comparisons
• **Track** - Monitor renewals and expirations
• **Answer** - Natural language questions about your portfolio

Try asking me something or use a quick command!`,
  timestamp: new Date(),
  suggestions: ['📊 Contract summary', '🔍 Search contracts', '⏰ Expiring soon', '💰 Top suppliers'],
});

interface ChatContextProviderProps {
  children: React.ReactNode;
  initialContractId?: string | null;
}

export function ChatContextProvider({ children, initialContractId = null }: ChatContextProviderProps) {
  // State
  const [conversations, setConversations] = useState<ConversationContext[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [contextData, setContextData] = useState<Record<string, any>>({});
  const [currentContractId, setCurrentContractId] = useState<string | null>(initialContractId);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  const loadedRef = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    try {
      const storedConversations = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
      const storedCurrentId = localStorage.getItem(STORAGE_KEY_CURRENT);

      if (storedConversations) {
        const parsed = JSON.parse(storedConversations);
        const restored: ConversationContext[] = parsed.map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        }));
        setConversations(restored);

        if (storedCurrentId && restored.find(c => c.id === storedCurrentId)) {
          setCurrentConversationId(storedCurrentId);
        } else if (restored.length > 0) {
          setCurrentConversationId(restored[0]!.id);
        }
      }

      // If no conversations, create initial one
      if (!storedConversations || JSON.parse(storedConversations).length === 0) {
        const newConv = createNewConversationInternal();
        setConversations([newConv]);
        setCurrentConversationId(newConv.id);
      }
    } catch (e) {
      console.warn('Failed to load chat history:', e);
      // Create a fresh conversation
      const newConv = createNewConversationInternal();
      setConversations([newConv]);
      setCurrentConversationId(newConv.id);
    }
  }, []);

  // Save to localStorage when conversations change
  useEffect(() => {
    if (!loadedRef.current) return;

    try {
      // Limit stored messages per conversation
      const toStore = conversations.map(conv => ({
        ...conv,
        messages: conv.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
      }));
      localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(toStore));
      
      if (currentConversationId) {
        localStorage.setItem(STORAGE_KEY_CURRENT, currentConversationId);
      }
    } catch (e) {
      console.warn('Failed to save chat history:', e);
    }
  }, [conversations, currentConversationId]);

  // Create a new conversation (internal helper)
  function createNewConversationInternal(title?: string): ConversationContext {
    const now = new Date();
    return {
      id: generateId(),
      title: title || `Conversation ${now.toLocaleDateString()}`,
      createdAt: now,
      updatedAt: now,
      messages: [createWelcomeMessage()],
      metadata: {
        totalMessages: 1,
        mentionedContracts: [],
        userPreferences: {},
      },
    };
  }

  // Current conversation
  const currentConversation = useMemo(() => {
    return conversations.find(c => c.id === currentConversationId) || null;
  }, [conversations, currentConversationId]);

  // Current messages
  const messages = useMemo(() => {
    return currentConversation?.messages || [];
  }, [currentConversation]);

  // Mentioned contracts
  const mentionedContracts = useMemo(() => {
    return currentConversation?.metadata.mentionedContracts || [];
  }, [currentConversation]);

  // Add a message
  const addMessage = useCallback((messageData: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage => {
    const message: ChatMessage = {
      ...messageData,
      id: generateId(),
      timestamp: new Date(),
    };

    setConversations(prev => prev.map(conv => {
      if (conv.id !== currentConversationId) return conv;
      
      return {
        ...conv,
        updatedAt: new Date(),
        messages: [...conv.messages, message],
        metadata: {
          ...conv.metadata,
          totalMessages: conv.metadata.totalMessages + 1,
          lastTopic: messageData.role === 'user' ? messageData.content.slice(0, 100) : conv.metadata.lastTopic,
        },
      };
    }));

    return message;
  }, [currentConversationId]);

  // Update a message
  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id !== currentConversationId) return conv;
      
      return {
        ...conv,
        messages: conv.messages.map(msg => 
          msg.id === id ? { ...msg, ...updates } : msg
        ),
      };
    }));
  }, [currentConversationId]);

  // Delete a message
  const deleteMessage = useCallback((id: string) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id !== currentConversationId) return conv;
      
      return {
        ...conv,
        messages: conv.messages.filter(msg => msg.id !== id),
        metadata: {
          ...conv.metadata,
          totalMessages: conv.metadata.totalMessages - 1,
        },
      };
    }));
  }, [currentConversationId]);

  // Clear messages (keep welcome)
  const clearMessages = useCallback(() => {
    setConversations(prev => prev.map(conv => {
      if (conv.id !== currentConversationId) return conv;
      
      return {
        ...conv,
        messages: [createWelcomeMessage()],
        metadata: {
          ...conv.metadata,
          totalMessages: 1,
          lastTopic: undefined,
        },
      };
    }));
  }, [currentConversationId]);

  // Create a new conversation
  const createNewConversation = useCallback((title?: string): ConversationContext => {
    const newConv = createNewConversationInternal(title);
    
    setConversations(prev => {
      // Limit total conversations
      const updated = [newConv, ...prev];
      return updated.slice(0, MAX_CONVERSATIONS);
    });
    setCurrentConversationId(newConv.id);
    
    return newConv;
  }, []);

  // Load a conversation
  const loadConversation = useCallback((id: string) => {
    if (conversations.find(c => c.id === id)) {
      setCurrentConversationId(id);
    }
  }, [conversations]);

  // Delete a conversation
  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== id);
      
      // If we deleted the current conversation, switch to another
      if (id === currentConversationId) {
        if (updated.length > 0) {
          setCurrentConversationId(updated[0]!.id);
        } else {
          // Create a new one if none left
          const newConv = createNewConversationInternal();
          setCurrentConversationId(newConv.id);
          return [newConv];
        }
      }
      
      return updated;
    });
  }, [currentConversationId]);

  // List all conversations
  const listConversations = useCallback(() => {
    return conversations;
  }, [conversations]);

  // Context management
  const setContext = useCallback((key: string, value: any) => {
    setContextData(prev => ({ ...prev, [key]: value }));
  }, []);

  const getContext = useCallback((key: string) => {
    return contextData[key];
  }, [contextData]);

  const clearContext = useCallback(() => {
    setContextData({});
  }, []);

  // Add mentioned contract
  const addMentionedContract = useCallback((id: string) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id !== currentConversationId) return conv;
      if (conv.metadata.mentionedContracts.includes(id)) return conv;
      
      return {
        ...conv,
        metadata: {
          ...conv.metadata,
          mentionedContracts: [...conv.metadata.mentionedContracts, id],
        },
      };
    }));
  }, [currentConversationId]);

  // Append to streaming message
  const appendToStreamingMessage = useCallback((content: string) => {
    if (!streamingMessageId) return;
    
    setConversations(prev => prev.map(conv => {
      if (conv.id !== currentConversationId) return conv;
      
      return {
        ...conv,
        messages: conv.messages.map(msg => 
          msg.id === streamingMessageId 
            ? { ...msg, content: msg.content + content }
            : msg
        ),
      };
    }));
  }, [currentConversationId, streamingMessageId]);

  const value: ChatContextValue = {
    currentConversation,
    messages,
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
    createNewConversation,
    loadConversation,
    deleteConversation,
    listConversations,
    setContext,
    getContext,
    clearContext,
    currentContractId,
    setCurrentContractId,
    mentionedContracts,
    addMentionedContract,
    isLoading,
    setIsLoading,
    streamingMessageId,
    setStreamingMessageId,
    appendToStreamingMessage,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export default ChatContextProvider;
