'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';

// =====================
// Types
// =====================

export interface Presence {
  oduserId: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number };
  lastSeen: Date;
}

export interface CollaborationEvent {
  type: 'join' | 'leave' | 'cursor' | 'selection' | 'edit' | 'comment' | 'lock' | 'unlock';
  userId: string;
  documentId: string;
  data?: unknown;
  timestamp: Date;
}

export interface DocumentLock {
  sectionId: string;
  userId: string;
  userName: string;
  lockedAt: Date;
  expiresAt: Date;
}

interface WebSocketContextValue {
  socket: Socket | null;
  connected: boolean;
  presence: Map<string, Presence>;
  locks: Map<string, DocumentLock>;
  joinDocument: (documentId: string, documentType: 'contract' | 'template' | 'workflow') => void;
  leaveDocument: () => void;
  updateCursor: (position: { x: number; y: number }) => void;
  updateSelection: (selection: { start: number; end: number }) => void;
  broadcastEdit: (sectionId: string, content: string) => void;
  lockSection: (sectionId: string) => Promise<boolean>;
  unlockSection: (sectionId: string) => void;
  sendComment: (sectionId: string, content: string, parentId?: string) => void;
  onEvent: (callback: (event: CollaborationEvent) => void) => () => void;
}

// =====================
// Context
// =====================

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// Generate a consistent color for a user
function getUserColor(userId: string): string {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
  ];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length]!;
}

// =====================
// Provider
// =====================

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<Map<string, Presence>>(new Map());
  const [locks, setLocks] = useState<Map<string, DocumentLock>>(new Map());
  const [currentDocument, setCurrentDocument] = useState<string | null>(null);
  const [eventCallbacks, setEventCallbacks] = useState<Set<(event: CollaborationEvent) => void>>(new Set());

  // Initialize socket connection
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    
    const newSocket = io(socketUrl, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('[WebSocket] Connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error.message);
    });

    // Handle presence updates
    newSocket.on('presence:update', (data: { users: Presence[] }) => {
      const newPresence = new Map<string, Presence>();
      data.users.forEach(user => newPresence.set(user.oduserId, user));
      setPresence(newPresence);
    });

    newSocket.on('presence:join', (user: Presence) => {
      setPresence(prev => new Map(prev).set(user.oduserId, user));
    });

    newSocket.on('presence:leave', (userId: string) => {
      setPresence(prev => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    });

    newSocket.on('presence:cursor', (data: { userId: string; cursor: { x: number; y: number } }) => {
      setPresence(prev => {
        const user = prev.get(data.userId);
        if (user) {
          return new Map(prev).set(data.userId, { ...user, cursor: data.cursor });
        }
        return prev;
      });
    });

    // Handle locks
    newSocket.on('lock:acquired', (lock: DocumentLock) => {
      setLocks(prev => new Map(prev).set(lock.sectionId, lock));
    });

    newSocket.on('lock:released', (sectionId: string) => {
      setLocks(prev => {
        const next = new Map(prev);
        next.delete(sectionId);
        return next;
      });
    });

    newSocket.on('locks:sync', (data: { locks: DocumentLock[] }) => {
      const newLocks = new Map<string, DocumentLock>();
      data.locks.forEach(lock => newLocks.set(lock.sectionId, lock));
      setLocks(newLocks);
    });

    // Handle collaboration events
    newSocket.on('collaboration:event', (event: CollaborationEvent) => {
      eventCallbacks.forEach(callback => callback(event));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Join a document for collaboration
  const joinDocument = useCallback((documentId: string, documentType: 'contract' | 'template' | 'workflow') => {
    if (!socket) return;
    
    // Leave current document if any
    if (currentDocument) {
      socket.emit('document:leave', { documentId: currentDocument });
    }

    socket.emit('document:join', { 
      documentId, 
      documentType,
      color: getUserColor(socket.id || 'default'),
    });
    setCurrentDocument(documentId);
  }, [socket, currentDocument]);

  const leaveDocument = useCallback(() => {
    if (!socket || !currentDocument) return;
    socket.emit('document:leave', { documentId: currentDocument });
    setCurrentDocument(null);
    setPresence(new Map());
    setLocks(new Map());
  }, [socket, currentDocument]);

  const updateCursor = useCallback((position: { x: number; y: number }) => {
    if (!socket || !currentDocument) return;
    socket.emit('cursor:move', { documentId: currentDocument, position });
  }, [socket, currentDocument]);

  const updateSelection = useCallback((selection: { start: number; end: number }) => {
    if (!socket || !currentDocument) return;
    socket.emit('selection:update', { documentId: currentDocument, selection });
  }, [socket, currentDocument]);

  const broadcastEdit = useCallback((sectionId: string, content: string) => {
    if (!socket || !currentDocument) return;
    socket.emit('edit:broadcast', { 
      documentId: currentDocument, 
      sectionId, 
      content,
      timestamp: new Date(),
    });
  }, [socket, currentDocument]);

  const lockSection = useCallback(async (sectionId: string): Promise<boolean> => {
    if (!socket || !currentDocument) return false;
    
    return new Promise((resolve) => {
      socket.emit('lock:acquire', { documentId: currentDocument, sectionId }, (response: { success: boolean }) => {
        resolve(response.success);
      });
    });
  }, [socket, currentDocument]);

  const unlockSection = useCallback((sectionId: string) => {
    if (!socket || !currentDocument) return;
    socket.emit('lock:release', { documentId: currentDocument, sectionId });
  }, [socket, currentDocument]);

  const sendComment = useCallback((sectionId: string, content: string, parentId?: string) => {
    if (!socket || !currentDocument) return;
    socket.emit('comment:add', { 
      documentId: currentDocument, 
      sectionId, 
      content,
      parentId,
      timestamp: new Date(),
    });
  }, [socket, currentDocument]);

  const onEvent = useCallback((callback: (event: CollaborationEvent) => void) => {
    setEventCallbacks(prev => new Set(prev).add(callback));
    return () => {
      setEventCallbacks(prev => {
        const next = new Set(prev);
        next.delete(callback);
        return next;
      });
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{
      socket,
      connected,
      presence,
      locks,
      joinDocument,
      leaveDocument,
      updateCursor,
      updateSelection,
      broadcastEdit,
      lockSection,
      unlockSection,
      sendComment,
      onEvent,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}

// =====================
// Hook
// =====================

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

// =====================
// Collaboration Hook
// =====================

export function useCollaboration(documentId: string, documentType: 'contract' | 'template' | 'workflow') {
  const ws = useWebSocket();
  
  useEffect(() => {
    ws.joinDocument(documentId, documentType);
    return () => ws.leaveDocument();
  }, [documentId, documentType, ws]);

  return {
    connected: ws.connected,
    collaborators: Array.from(ws.presence.values()),
    locks: ws.locks,
    updateCursor: ws.updateCursor,
    updateSelection: ws.updateSelection,
    broadcastEdit: ws.broadcastEdit,
    lockSection: ws.lockSection,
    unlockSection: ws.unlockSection,
    sendComment: ws.sendComment,
    onEvent: ws.onEvent,
  };
}
