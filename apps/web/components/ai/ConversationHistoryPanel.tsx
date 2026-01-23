/**
 * Conversation History Panel
 * 
 * Sidebar showing past conversations with search and filtering.
 * Integrates with useChatPersistence hook for database-backed history.
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  MessageSquare,
  Calendar,
  Trash2,
  Clock,
  ChevronRight,
  History,
  X,
  FileText,
  Star,
  StarOff,
  Filter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Conversation {
  id: string;
  title?: string;
  preview: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  context?: string;
  contextType?: "global" | "contract";
  starred?: boolean;
}

interface ConversationHistoryPanelProps {
  conversations: Conversation[];
  currentConversationId?: string;
  isLoading?: boolean;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
  onClose: () => void;
  onToggleStar?: (id: string) => void;
}

export function ConversationHistoryPanel({
  conversations,
  currentConversationId,
  isLoading,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  onClose,
  onToggleStar,
}: ConversationHistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "starred" | "contract">("all");

  // Filter and search conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    // Apply filter
    if (filter === "starred") {
      filtered = filtered.filter((c) => c.starred);
    } else if (filter === "contract") {
      filtered = filtered.filter((c) => c.contextType === "contract");
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.title?.toLowerCase().includes(query) ||
          c.preview.toLowerCase().includes(query) ||
          c.context?.toLowerCase().includes(query)
      );
    }

    // Sort by most recent
    return filtered.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [conversations, searchQuery, filter]);

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const groups: { label: string; conversations: Conversation[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const todayConvs: Conversation[] = [];
    const yesterdayConvs: Conversation[] = [];
    const lastWeekConvs: Conversation[] = [];
    const lastMonthConvs: Conversation[] = [];
    const olderConvs: Conversation[] = [];

    filteredConversations.forEach((conv) => {
      const date = new Date(conv.updatedAt);
      date.setHours(0, 0, 0, 0);

      if (date.getTime() === today.getTime()) {
        todayConvs.push(conv);
      } else if (date.getTime() === yesterday.getTime()) {
        yesterdayConvs.push(conv);
      } else if (date > lastWeek) {
        lastWeekConvs.push(conv);
      } else if (date > lastMonth) {
        lastMonthConvs.push(conv);
      } else {
        olderConvs.push(conv);
      }
    });

    if (todayConvs.length) groups.push({ label: "Today", conversations: todayConvs });
    if (yesterdayConvs.length) groups.push({ label: "Yesterday", conversations: yesterdayConvs });
    if (lastWeekConvs.length) groups.push({ label: "Last 7 Days", conversations: lastWeekConvs });
    if (lastMonthConvs.length) groups.push({ label: "Last 30 Days", conversations: lastMonthConvs });
    if (olderConvs.length) groups.push({ label: "Older", conversations: olderConvs });

    return groups;
  }, [filteredConversations]);

  const formatTime = useCallback((date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, []);

  const _formatDate = useCallback((date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }, []);

  return (
    <motion.div
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute inset-y-0 left-0 w-80 bg-white border-r border-gray-200 flex flex-col z-10 shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-purple-500" />
          <h3 className="font-semibold text-gray-900">History</h3>
          <Badge variant="secondary" className="text-xs">
            {conversations.length}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="p-3 space-y-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-gray-50 border-gray-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Filter className="w-3 h-3 mr-1.5" />
                {filter === "all" ? "All" : filter === "starred" ? "Starred" : "Contracts"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[150px]">
              <DropdownMenuItem onClick={() => setFilter("all")}>
                <MessageSquare className="w-4 h-4 mr-2" />
                All Conversations
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("starred")}>
                <Star className="w-4 h-4 mr-2" />
                Starred
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("contract")}>
                <FileText className="w-4 h-4 mr-2" />
                Contract Chats
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="default"
            size="sm"
            className="h-8 text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            onClick={onNewConversation}
          >
            + New Chat
          </Button>
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">Loading history...</p>
            </div>
          ) : groupedConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <MessageSquare className="w-10 h-10 mb-3 text-gray-300" />
              <p className="text-sm font-medium">No conversations found</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchQuery ? "Try a different search term" : "Start a new chat to begin"}
              </p>
            </div>
          ) : (
            groupedConversations.map((group) => (
              <div key={group.label} className="mb-4">
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <Calendar className="w-3 h-3" />
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.conversations.map((conv) => (
                    <motion.div
                      key={conv.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`group relative rounded-lg transition-all cursor-pointer ${
                        currentConversationId === conv.id
                          ? "bg-purple-50 border border-purple-200"
                          : "hover:bg-gray-50 border border-transparent"
                      }`}
                      onClick={() => onSelectConversation(conv.id)}
                    >
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {conv.starred && (
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              )}
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {conv.title || "New Conversation"}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {conv.preview}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                <Clock className="w-3 h-3" />
                                {formatTime(conv.updatedAt)}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                • {conv.messageCount} msgs
                              </span>
                              {conv.contextType === "contract" && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] h-4 px-1.5 bg-blue-50 text-blue-600"
                                >
                                  <FileText className="w-2.5 h-2.5 mr-0.5" />
                                  Contract
                                </Badge>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 mt-0.5" />
                        </div>
                      </div>

                      {/* Hover actions */}
                      <div className="absolute top-2 right-8 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onToggleStar && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleStar(conv.id);
                            }}
                          >
                            {conv.starred ? (
                              <StarOff className="w-3 h-3 text-amber-500" />
                            ) : (
                              <Star className="w-3 h-3 text-gray-400" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conv.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </motion.div>
  );
}

export default ConversationHistoryPanel;
