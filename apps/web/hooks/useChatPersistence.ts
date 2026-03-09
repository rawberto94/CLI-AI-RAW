/**
 * Chat Persistence Hook
 * 
 * Provides database-backed conversation persistence for AI chat components.
 * Falls back to localStorage for unauthenticated users.
 * 
 * Features:
 * - Automatic conversation creation/restoration
 * - Message persistence with each send
 * - Conversation history browsing
 * - Context-aware conversations (e.g., contract-specific)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  reaction?: 'like' | 'dislike';
  suggestions?: string[];
  actions?: Array<{ label: string; action: string }>;
  contractPreviews?: Array<{
    id: string;
    name: string;
    supplier?: string;
    status?: string;
    value?: number;
  }>;
}

export interface Conversation {
  id: string;
  title: string;
  context?: string;
  contextType?: 'contract' | 'supplier' | 'global';
  messageCount: number;
  lastMessageAt: Date;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: Date;
}

export interface ConversationListItem {
  id: string;
  title: string;
  context?: string;
  contextType?: 'contract' | 'supplier' | 'global';
  messages?: ChatMessage[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ChatPersistenceOptions {
  /** Context identifier (e.g., contract ID) */
  context?: string;
  /** Context type for categorization */
  contextType?: 'contract' | 'supplier' | 'global';
  /** Maximum messages to store locally as fallback */
  maxLocalMessages?: number;
  /** localStorage key prefix */
  storageKey?: string;
  /** Auto-save messages to database */
  autoSave?: boolean;
  /** Debounce delay for auto-save (ms) */
  saveDebounce?: number;
}

export interface UseChatPersistenceReturn {
  /** Current conversation ID */
  conversationId: string | null;
  /** All messages in current conversation */
  messages: ChatMessage[];
  /** List of user's conversations */
  conversations: Conversation[];
  /** List of conversations for UI display (alias for conversations) */
  conversationList?: ConversationListItem[];
  /** Loading state */
  isLoading: boolean;
  /** Whether user is authenticated (DB persistence available) */
  isAuthenticated: boolean;
  /** Add a message to the conversation */
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<ChatMessage>;
  /** Update message reaction/feedback */
  updateMessage: (messageId: string, updates: { reaction?: 'like' | 'dislike' }) => Promise<void>;
  /** Create a new conversation */
  createConversation: (title?: string) => Promise<string>;
  /** Switch to a different conversation */
  switchConversation: (conversationId: string) => Promise<void>;
  /** Delete current conversation */
  deleteConversation: (conversationId?: string) => Promise<void>;
  /** Clear all messages (new conversation) */
  clearChat: () => void;
  /** Start a new conversation (alias for createConversation) */
  startNewConversation?: () => Promise<void>;
  /** Refresh conversations list */
  refreshConversations: () => Promise<void>;
  /** Pin/unpin conversation */
  togglePin: (conversationId: string) => Promise<void>;
  /** Archive conversation */
  archiveConversation: (conversationId: string) => Promise<void>;
  /** Link a server-created conversationId without loading messages (prevents orphans) */
  linkConversationId: (id: string) => void;
}

const DEFAULT_OPTIONS: Required<ChatPersistenceOptions> = {
  context: undefined as unknown as string,
  contextType: 'global',
  maxLocalMessages: 50,
  storageKey: 'contigo-chat-history',
  autoSave: true,
  saveDebounce: 1000,
};

export function useChatPersistence(
  options: ChatPersistenceOptions = {}
): UseChatPersistenceReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  // ============================================================================
  // Helper: Local Storage Fallback
  // ============================================================================
  
  const getLocalStorageKey = useCallback(() => {
    if (opts.context) {
      return `${opts.storageKey}-${opts.contextType}-${opts.context}`;
    }
    return opts.storageKey;
  }, [opts.storageKey, opts.context, opts.contextType]);

  const saveToLocalStorage = useCallback((msgs: ChatMessage[]) => {
    try {
      const toStore = msgs.slice(-opts.maxLocalMessages);
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(toStore));
    } catch {
      // Storage full or unavailable
    }
  }, [getLocalStorageKey, opts.maxLocalMessages]);

  const loadFromLocalStorage = useCallback((): ChatMessage[] => {
    try {
      const stored = localStorage.getItem(getLocalStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((m: ChatMessage) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      }
    } catch {
      // Parse error
    }
    return [];
  }, [getLocalStorageKey]);

  // ============================================================================
  // API Calls
  // ============================================================================

  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      return !!data?.user?.id;
    } catch {
      return false;
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (opts.contextType !== 'global') {
        params.set('contextType', opts.contextType);
      }
      if (opts.context) {
        params.set('context', opts.context);
      }

      const res = await fetch(`/api/chat/conversations?${params}`);
      if (!res.ok) return [];

      const data = await res.json();
      return (data.data?.conversations || []).map((c: Conversation) => ({
        ...c,
        lastMessageAt: new Date(c.lastMessageAt),
        createdAt: new Date(c.createdAt),
      }));
    } catch {
      return [];
    }
  }, [opts.context, opts.contextType]);

  const fetchConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/conversations/${id}?messageLimit=100`);
      if (!res.ok) return null;

      const data = await res.json();
      return data.data;
    } catch {
      return null;
    }
  }, []);

  // ============================================================================
  // Actions
  // ============================================================================

  const createConversation = useCallback(async (title?: string): Promise<string> => {
    if (!isAuthenticated) {
      // Generate local ID
      const localId = `local-${Date.now()}`;
      setConversationId(localId);
      setMessages([]);
      return localId;
    }

    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'New Conversation',
          context: opts.context,
          contextType: opts.contextType,
        }),
      });

      if (!res.ok) throw new Error('Failed to create conversation');

      const data = await res.json();
      const newConversationId = data.data.id;
      
      setConversationId(newConversationId);
      setMessages([]);
      
      // Refresh conversations list
      const convs = await fetchConversations();
      setConversations(convs);

      return newConversationId;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }, [isAuthenticated, opts.context, opts.contextType, fetchConversations]);

  const addMessage = useCallback(async (
    message: Omit<ChatMessage, 'id' | 'timestamp'>
  ): Promise<ChatMessage> => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);

    // Save to database if authenticated
    if (isAuthenticated && conversationId && !conversationId.startsWith('local-')) {
      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: message.role,
            content: message.content,
            metadata: message.metadata,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          // Update message with server ID
          setMessages(prev => prev.map(m => 
            m.id === newMessage.id ? { ...m, id: data.data.id } : m
          ));
        }
      } catch {
        // Failed to save to server, message stays local
      }
    } else {
      // Save to localStorage as fallback
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        setMessages(current => {
          saveToLocalStorage(current);
          return current;
        });
      }, opts.saveDebounce);
    }

    return newMessage;
  }, [isAuthenticated, conversationId, saveToLocalStorage, opts.saveDebounce]);

  const updateMessage = useCallback(async (
    messageId: string,
    updates: { reaction?: 'like' | 'dislike' }
  ) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, ...updates } : m
    ));

    if (isAuthenticated && conversationId && !messageId.startsWith('msg-')) {
      try {
        await fetch(`/api/chat/conversations/${conversationId}/messages/${messageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: updates.reaction }),
        });
      } catch {
        // Failed to update on server
      }
    }
  }, [isAuthenticated, conversationId]);

  const switchConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    setConversationId(id);

    if (isAuthenticated && !id.startsWith('local-')) {
      const conversation = await fetchConversation(id);
      if (conversation?.messages) {
        setMessages(conversation.messages.map((m: ChatMessage) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })));
      }
    } else {
      setMessages(loadFromLocalStorage());
    }

    setIsLoading(false);
  }, [isAuthenticated, fetchConversation, loadFromLocalStorage]);

  const deleteConversation = useCallback(async (targetId?: string) => {
    const idToDelete = targetId || conversationId;
    if (!idToDelete) return;

    if (isAuthenticated && !idToDelete.startsWith('local-')) {
      try {
        await fetch(`/api/chat/conversations/${idToDelete}`, {
          method: 'DELETE',
        });
      } catch {
        // Failed to delete on server
      }
    }

    // Clear local storage if deleting current conversation
    if (!targetId || targetId === conversationId) {
      localStorage.removeItem(getLocalStorageKey());
      setConversationId(null);
      setMessages([]);
    }
    
    // Refresh conversations
    if (isAuthenticated) {
      const convs = await fetchConversations();
      setConversations(convs);
    }
  }, [conversationId, isAuthenticated, getLocalStorageKey, fetchConversations]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    localStorage.removeItem(getLocalStorageKey());
  }, [getLocalStorageKey]);

  const refreshConversations = useCallback(async () => {
    if (isAuthenticated) {
      const convs = await fetchConversations();
      setConversations(convs);
    }
  }, [isAuthenticated, fetchConversations]);

  const togglePin = useCallback(async (id: string) => {
    if (!isAuthenticated) return;

    const conv = conversations.find(c => c.id === id);
    if (!conv) return;

    try {
      await fetch(`/api/chat/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !conv.isPinned }),
      });

      await refreshConversations();
    } catch {
      // Failed to toggle pin
    }
  }, [isAuthenticated, conversations, refreshConversations]);

  const archiveConversation = useCallback(async (id: string) => {
    if (!isAuthenticated) return;

    try {
      await fetch(`/api/chat/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });

      await refreshConversations();
    } catch {
      // Failed to archive
    }
  }, [isAuthenticated, refreshConversations]);

  // ============================================================================
  // Initialization
  // ============================================================================

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initialize = async () => {
      setIsLoading(true);

      // Check authentication
      const authed = await checkAuth();
      setIsAuthenticated(authed);

      if (authed) {
        // Load conversations from database
        const convs = await fetchConversations();
        setConversations(convs);

        // Find or create conversation for current context
        const activeConv = convs.find((c: Conversation) =>
          opts.context ? c.context === opts.context : !c.context && c.contextType === 'global'
        );

        if (activeConv) {
          setConversationId(activeConv.id);
          const fullConv = await fetchConversation(activeConv.id);
          if (fullConv?.messages) {
            setMessages(fullConv.messages.map((m: ChatMessage) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            })));
          }
        } else {
          // Load from localStorage as temporary state
          const localMessages = loadFromLocalStorage();
          if (localMessages.length > 0) {
            setMessages(localMessages);
          }
        }
      } else {
        // Not authenticated - use localStorage only
        const localMessages = loadFromLocalStorage();
        setMessages(localMessages);
        setConversationId(`local-${opts.context || 'global'}`);
      }

      setIsLoading(false);
    };

    initialize();
  }, [checkAuth, fetchConversation, fetchConversations, loadFromLocalStorage, opts.context]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Lightweight setter to link a server-created conversationId without reloading messages
  const linkConversationId = useCallback((id: string) => {
    setConversationId(id);
  }, []);

  // Start a new conversation (convenience wrapper)
  const startNewConversation = useCallback(async () => {
    await createConversation();
  }, [createConversation]);

  // Build conversationList from conversations for UI components
  const conversationList: ConversationListItem[] = useMemo(() => {
    // For authenticated users, map DB conversations
    if (isAuthenticated && conversations.length > 0) {
      return conversations.map(c => ({
        id: c.id,
        title: c.title,
        context: c.context,
        contextType: c.contextType,
        messages: [], // Messages loaded on demand via switchConversation
        createdAt: c.createdAt,
        updatedAt: c.lastMessageAt,
      }));
    }

    // For unauthenticated users, create a synthetic entry from localStorage messages
    if (!isAuthenticated && messages.length > 0) {
      const firstUserMsg = messages.find(m => m.role === 'user');
      return [{
        id: conversationId || 'local-current',
        title: firstUserMsg?.content?.slice(0, 60) || 'Current conversation',
        context: opts.context || undefined,
        contextType: opts.contextType,
        messages,
        createdAt: messages[0]?.timestamp || new Date(),
        updatedAt: messages[messages.length - 1]?.timestamp || new Date(),
      }];
    }

    return [];
  }, [isAuthenticated, conversations, messages, conversationId, opts.context, opts.contextType]);

  return {
    conversationId,
    messages,
    conversations,
    conversationList,
    isLoading,
    isAuthenticated,
    addMessage,
    updateMessage,
    createConversation,
    switchConversation,
    deleteConversation,
    clearChat,
    startNewConversation,
    refreshConversations,
    togglePin,
    archiveConversation,
    linkConversationId,
  };
}

export default useChatPersistence;
