'use client';

/**
 * Conversation Sidebar
 * Manage conversation history and navigation
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  MoreVertical,
  Edit2,
  Archive,
  Star,
  StarOff,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  X,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Conversation {
  id: string;
  title: string;
  lastMessage?: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  isStarred?: boolean;
  tags?: string[];
  contractContext?: {
    id: string;
    name: string;
  };
}

// Format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Group conversations by date
function groupConversationsByDate(conversations: Conversation[]): Record<string, Conversation[]> {
  const groups: Record<string, Conversation[]> = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'This Month': [],
    'Older': [],
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  conversations.forEach((conv) => {
    const convDate = new Date(conv.updatedAt);
    if (convDate >= today) {
      groups['Today'].push(conv);
    } else if (convDate >= yesterday) {
      groups['Yesterday'].push(conv);
    } else if (convDate >= weekAgo) {
      groups['This Week'].push(conv);
    } else if (convDate >= monthAgo) {
      groups['This Month'].push(conv);
    } else {
      groups['Older'].push(conv);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach((key) => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
  onToggleStar: () => void;
}

const ConversationItem = memo(({
  conversation,
  isActive,
  onClick,
  onDelete,
  onRename,
  onToggleStar,
}: ConversationItemProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);

  const handleRename = useCallback(() => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  }, [editTitle, conversation.title, onRename]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="relative group"
    >
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
          isActive
            ? "bg-purple-50 dark:bg-purple-900/30"
            : "hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        <div className={cn(
          "mt-0.5 p-1.5 rounded-md",
          isActive
            ? "bg-purple-100 dark:bg-purple-800"
            : "bg-slate-100 dark:bg-slate-800"
        )}>
          {conversation.contractContext ? (
            <FileText className={cn(
              "h-4 w-4",
              isActive
                ? "text-purple-600 dark:text-indigo-400"
                : "text-slate-500 dark:text-slate-400"
            )} />
          ) : (
            <MessageSquare className={cn(
              "h-4 w-4",
              isActive
                ? "text-purple-600 dark:text-indigo-400"
                : "text-slate-500 dark:text-slate-400"
            )} />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              autoFocus
              aria-label="Edit conversation title"
              className="w-full px-2 py-0.5 text-sm rounded border border-indigo-300 dark:border-purple-600 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-sm font-medium truncate",
                  isActive
                    ? "text-purple-700 dark:text-indigo-300"
                    : "text-slate-700 dark:text-slate-300"
                )}>
                  {conversation.title}
                </span>
                {conversation.isStarred && (
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                )}
              </div>
              {conversation.lastMessage && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {conversation.lastMessage}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                <span>{formatRelativeTime(new Date(conversation.updatedAt))}</span>
                <span>•</span>
                <span>{conversation.messageCount} messages</span>
              </div>
            </>
          )}
        </div>

        {!isEditing && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className={cn(
                "p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity",
                showMenu ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <MoreVertical className="h-4 w-4 text-slate-500" />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Edit2 className="h-4 w-4" />
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      onToggleStar();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {conversation.isStarred ? (
                      <>
                        <StarOff className="h-4 w-4" />
                        Unstar
                      </>
                    ) : (
                      <>
                        <Star className="h-4 w-4" />
                        Star
                      </>
                    )}
                  </button>
                  <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                  <button
                    onClick={() => {
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </button>
    </motion.div>
  );
});

ConversationItem.displayName = 'ConversationItem';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onToggleStarConversation?: (id: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export const ConversationSidebar = memo(({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onToggleStarConversation,
  isCollapsed = false,
  onToggleCollapse,
  className,
}: ConversationSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'starred'>('all');

  // Filter and search conversations
  const filteredConversations = conversations.filter((conv) => {
    if (filter === 'starred' && !conv.isStarred) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        conv.title.toLowerCase().includes(query) ||
        conv.lastMessage?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Sort by updated date
  const sortedConversations = [...filteredConversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Group by date
  const groupedConversations = groupConversationsByDate(sortedConversations);

  // Collapsed state
  if (isCollapsed) {
    return (
      <div className={cn("w-12 border-r border-slate-200 dark:border-slate-700 flex flex-col items-center py-4 gap-4", className)}>
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </button>
        
        <button
          onClick={onNewConversation}
          className="p-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors"
          title="New conversation"
        >
          <Plus className="h-5 w-5 text-white" />
        </button>

        <div className="flex-1 overflow-y-auto py-2">
          {sortedConversations.slice(0, 5).map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={cn(
                "p-2 rounded-lg mb-2 transition-colors",
                activeConversationId === conv.id
                  ? "bg-purple-100 dark:bg-purple-900/50"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
              title={conv.title}
            >
              <MessageSquare className={cn(
                "h-5 w-5",
                activeConversationId === conv.id
                  ? "text-purple-600 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400"
              )} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-72 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full bg-white dark:bg-slate-900", className)}>
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Conversations
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={onNewConversation}
              className="p-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors"
              title="New conversation"
            >
              <Plus className="h-4 w-4 text-white" />
            </button>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search conversations"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              aria-label="Clear search"
            >
              <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
              filter === 'all'
                ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-indigo-300"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('starred')}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1",
              filter === 'starred'
                ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Star className="h-3 w-3" />
            Starred
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2">
        {Object.keys(groupedConversations).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FolderOpen className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery
                ? 'No conversations found'
                : 'No conversations yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={onNewConversation}
                className="mt-3 text-sm text-purple-600 dark:text-indigo-400 hover:underline"
              >
                Start a new conversation
              </button>
            )}
          </div>
        ) : (
          Object.entries(groupedConversations).map(([group, convs]) => (
            <div key={group} className="mb-4">
              <h3 className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-3 w-3" />
                {group}
              </h3>
              <AnimatePresence>
                {convs.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={activeConversationId === conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    onDelete={() => onDeleteConversation(conv.id)}
                    onRename={(title) => onRenameConversation(conv.id, title)}
                    onToggleStar={() => onToggleStarConversation?.(conv.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      {/* Footer stats */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} •{' '}
          {conversations.filter(c => c.isStarred).length} starred
        </p>
      </div>
    </div>
  );
});

ConversationSidebar.displayName = 'ConversationSidebar';

export default ConversationSidebar;
