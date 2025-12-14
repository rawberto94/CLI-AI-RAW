"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  MessageSquare,
  Edit3,
  Eye,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Clock,
  MousePointer2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/contexts/websocket-context";
import { PresenceIndicator } from "@/components/collaboration/PresenceIndicator";

interface CursorPosition {
  userId: string;
  userName: string;
  x: number;
  y: number;
  selection?: {
    start: number;
    end: number;
    text: string;
  };
  lastUpdate: Date;
}

interface DocumentLock {
  sectionId: string;
  userId: string;
  userName: string;
  lockedAt: Date;
  expiresAt: Date;
}

interface CollaborativeEditorWrapperProps {
  documentId: string;
  documentType: "contract" | "template" | "workflow";
  children: React.ReactNode;
  className?: string;
  onContentChange?: (change: DocumentChange) => void;
  onCursorMove?: (cursor: CursorPosition) => void;
}

interface DocumentChange {
  type: "insert" | "delete" | "replace" | "format";
  position: number;
  content?: string;
  length?: number;
  userId: string;
  timestamp: Date;
}

const CURSOR_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

export function CollaborativeEditorWrapper({
  documentId,
  documentType,
  children,
  className,
  onContentChange,
  onCursorMove,
}: CollaborativeEditorWrapperProps) {
  const wsContext = useWebSocket();
  
  // Provide defaults/adapters for WebSocket context
  const isConnected = wsContext?.connected ?? false;
  
  interface ActiveUser {
    id: string;
    name: string;
    avatar?: string;
    color?: string;
    status?: string;
  }
  
  const activeUsers: ActiveUser[] = wsContext?.presence 
    ? Array.from(wsContext.presence.values()).map(p => ({
        id: (p as { userId?: string }).userId || p.userId || '',
        name: p.name || '',
        avatar: p.avatar,
        color: p.color,
      }))
    : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updateCursor = wsContext?.updateCursor ?? ((_pos: { x: number; y: number }) => {});
  const lockSection = wsContext?.lockSection ?? (async (_id: string) => false);
  const unlockSection = wsContext?.unlockSection ?? ((_id: string) => {});
  
  // Event subscription helpers
  const on = useCallback((event: string, callback: (data: unknown) => void) => {
    if (wsContext?.onEvent) {
      return wsContext.onEvent(callback as (data: unknown) => void);
    }
    return () => {};
  }, [wsContext]);
  
  const off = useCallback((_event: string, _callback: (data: unknown) => void) => {
    // No-op since onEvent returns cleanup
  }, []);
  
  // Room management stubs
  const joinRoom = useCallback((_roomId: string) => {
    wsContext?.joinDocument(documentId, documentType);
  }, [wsContext, documentId, documentType]);
  
  const leaveRoom = useCallback((_roomId: string) => {
    wsContext?.leaveDocument();
  }, [wsContext]);
  
  const sendDocumentChange = useCallback((sectionId: string, content: string) => {
    wsContext?.broadcastEdit(sectionId, content);
  }, [wsContext]);

  const [remoteCursors, setRemoteCursors] = useState<CursorPosition[]>([]);
  const [documentLocks, setDocumentLocks] = useState<DocumentLock[]>([]);
  const [pendingChanges, setPendingChanges] = useState<DocumentChange[]>([]);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">(
    "synced"
  );
  const [showCollabPanel, setShowCollabPanel] = useState(false);

  // Room ID based on document
  const roomId = useMemo(
    () => `${documentType}:${documentId}`,
    [documentType, documentId]
  );

  // Join room on mount
  useEffect(() => {
    joinRoom(roomId);
    return () => {
      leaveRoom(roomId);
    };
  }, [roomId, joinRoom, leaveRoom]);

  // Handle remote cursor updates
  useEffect(() => {
    const handleCursorUpdate = (cursor: CursorPosition) => {
      setRemoteCursors((prev) => {
        const existing = prev.findIndex((c) => c.userId === cursor.userId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...cursor, lastUpdate: new Date() };
          return updated;
        }
        return [...prev, { ...cursor, lastUpdate: new Date() }];
      });
    };

    const handleCursorLeave = (userId: string) => {
      setRemoteCursors((prev) => prev.filter((c) => c.userId !== userId));
    };

    on("cursor_update", handleCursorUpdate as (data: unknown) => void);
    on("cursor_leave", handleCursorLeave as (data: unknown) => void);

    return () => {
      off("cursor_update", handleCursorUpdate as (data: unknown) => void);
      off("cursor_leave", handleCursorLeave as (data: unknown) => void);
    };
  }, [on, off]);

  // Handle document changes from other users
  useEffect(() => {
    const handleRemoteChange = (change: DocumentChange) => {
      setPendingChanges((prev) => [...prev, change]);
      setSyncStatus("syncing");

      // Apply change after short delay to batch
      setTimeout(() => {
        onContentChange?.(change);
        setPendingChanges((prev) =>
          prev.filter((c) => c.timestamp !== change.timestamp)
        );
        setSyncStatus("synced");
      }, 100);
    };

    on("document_change", handleRemoteChange as (data: unknown) => void);
    return () => off("document_change", handleRemoteChange as (data: unknown) => void);
  }, [on, off, onContentChange]);

  // Handle section locks
  useEffect(() => {
    const handleLockChange = (lock: DocumentLock | { sectionId: string }) => {
      if ("userId" in lock) {
        setDocumentLocks((prev) => [
          ...prev.filter((l) => l.sectionId !== lock.sectionId),
          lock as DocumentLock,
        ]);
      } else {
        setDocumentLocks((prev) =>
          prev.filter((l) => l.sectionId !== lock.sectionId)
        );
      }
    };

    on("section_locked", handleLockChange as (data: unknown) => void);
    on("section_unlocked", handleLockChange as (data: unknown) => void);

    return () => {
      off("section_locked", handleLockChange as (data: unknown) => void);
      off("section_unlocked", handleLockChange as (data: unknown) => void);
    };
  }, [on, off]);

  // Clean up stale cursors
  useEffect(() => {
    const interval = setInterval(() => {
      const staleThreshold = Date.now() - 10000; // 10 seconds
      setRemoteCursors((prev) =>
        prev.filter((c) => c.lastUpdate.getTime() > staleThreshold)
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Track local cursor movement
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const position = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      updateCursor(position);
      onCursorMove?.({
        userId: "local",
        userName: "You",
        ...position,
        lastUpdate: new Date(),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateCursor, onCursorMove]
  );

  // Handle local content changes
  const handleLocalChange = useCallback(
    (change: Omit<DocumentChange, "userId" | "timestamp"> & { sectionId?: string }) => {
      const fullChange: DocumentChange = {
        ...change,
        userId: "local",
        timestamp: new Date(),
      };
      if (change.sectionId && change.content) {
        sendDocumentChange(change.sectionId, change.content);
      }
      onContentChange?.(fullChange);
    },
    [sendDocumentChange, onContentChange]
  );

  // Get cursor color for a user
  const getCursorColor = (userId: string) => {
    const hash = userId.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
    return CURSOR_COLORS[hash % CURSOR_COLORS.length];
  };

  return (
    <div
      className={cn("relative", className)}
      onMouseMove={handleMouseMove}
    >
      {/* Collaboration Header Bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white/95 backdrop-blur px-4 py-2">
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                isConnected ? "bg-green-500" : "bg-red-500"
              )}
            />
            <span className="text-xs text-slate-500">
              {isConnected ? "Connected" : "Offline"}
            </span>
          </div>

          {/* Sync Status */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            {syncStatus === "synced" && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span>Saved</span>
              </>
            )}
            {syncStatus === "syncing" && (
              <>
                <Clock className="h-3.5 w-3.5 animate-spin text-blue-500" />
                <span>Syncing...</span>
              </>
            )}
            {syncStatus === "error" && (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <span>Sync error</span>
              </>
            )}
          </div>

          {/* Pending Changes Indicator */}
          {pendingChanges.length > 0 && (
            <span className="text-xs text-blue-600">
              {pendingChanges.length} pending change
              {pendingChanges.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Active Collaborators */}
          <PresenceIndicator
            maxAvatars={4}
            showConnectionStatus={true}
          />

          {/* Collaboration Panel Toggle */}
          <button
            onClick={() => setShowCollabPanel(!showCollabPanel)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
              showCollabPanel
                ? "bg-blue-100 text-blue-700"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Collaborate</span>
          </button>
        </div>
      </div>

      {/* Main Content with Cursor Overlays */}
      <div className="relative">
        {/* Remote Cursors */}
        <AnimatePresence>
          {remoteCursors.map((cursor) => (
            <motion.div
              key={cursor.userId}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              style={{
                position: "absolute",
                left: cursor.x,
                top: cursor.y,
                zIndex: 50,
                pointerEvents: "none",
              }}
            >
              {/* Cursor Icon */}
              <MousePointer2
                className="h-4 w-4"
                style={{ color: getCursorColor(cursor.userId) }}
              />
              {/* User Label */}
              <div
                className="ml-4 -mt-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-white"
                style={{ backgroundColor: getCursorColor(cursor.userId) }}
              >
                {cursor.userName}
              </div>
              {/* Selection Highlight */}
              {cursor.selection && (
                <div
                  className="absolute rounded opacity-20"
                  style={{
                    backgroundColor: getCursorColor(cursor.userId),
                    // Selection bounds would be calculated based on text positions
                  }}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Editor Content */}
        {children}
      </div>

      {/* Section Lock Indicators */}
      {documentLocks.map((lock) => (
        <div
          key={lock.sectionId}
          className="absolute right-2 flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-xs text-amber-800"
        >
          <Lock className="h-3 w-3" />
          <span>
            {lock.userName} is editing
          </span>
        </div>
      ))}

      {/* Collaboration Side Panel */}
      <AnimatePresence>
        {showCollabPanel && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed right-0 top-0 z-30 h-full w-80 border-l bg-white shadow-xl"
          >
            <div className="flex h-full flex-col">
              {/* Panel Header */}
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold text-slate-900">Collaboration</h3>
                <button
                  onClick={() => setShowCollabPanel(false)}
                  className="rounded p-1 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>

              {/* Active Users Section */}
              <div className="border-b p-4">
                <h4 className="mb-3 text-sm font-medium text-slate-700">
                  Active Users ({activeUsers.length})
                </h4>
                <div className="space-y-2">
                  {activeUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-medium"
                        >
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {user.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {user.status === "editing" ? (
                              <span className="flex items-center gap-1 text-blue-600">
                                <Edit3 className="h-3 w-3" />
                                Editing
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                Viewing
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: getCursorColor(user.id) }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Section Locks */}
              <div className="border-b p-4">
                <h4 className="mb-3 text-sm font-medium text-slate-700">
                  Editing Locks
                </h4>
                {documentLocks.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No sections are currently locked
                  </p>
                ) : (
                  <div className="space-y-2">
                    {documentLocks.map((lock) => (
                      <div
                        key={lock.sectionId}
                        className="flex items-center justify-between rounded-lg bg-amber-50 p-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-amber-900">
                            {lock.sectionId}
                          </p>
                          <p className="text-xs text-amber-700">
                            Locked by {lock.userName}
                          </p>
                        </div>
                        <Lock className="h-4 w-4 text-amber-600" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="flex-1 overflow-auto p-4">
                <h4 className="mb-3 text-sm font-medium text-slate-700">
                  Recent Activity
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 text-slate-600">
                    <Edit3 className="mt-0.5 h-4 w-4 text-blue-500" />
                    <div>
                      <p>
                        <span className="font-medium">Sarah</span> edited Section 3
                      </p>
                      <p className="text-xs text-slate-400">2 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600">
                    <MessageSquare className="mt-0.5 h-4 w-4 text-green-500" />
                    <div>
                      <p>
                        <span className="font-medium">John</span> added a comment
                      </p>
                      <p className="text-xs text-slate-400">5 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600">
                    <Users className="mt-0.5 h-4 w-4 text-purple-500" />
                    <div>
                      <p>
                        <span className="font-medium">Mike</span> joined the session
                      </p>
                      <p className="text-xs text-slate-400">10 minutes ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CollaborativeEditorWrapper;
