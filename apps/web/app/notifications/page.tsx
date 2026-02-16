/**
 * Notifications Page
 * Centralized notification management and history
 * Uses real database data via /api/notifications
 */

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageBreadcrumb } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Search,
  Filter,
  ArrowLeft,
  Calendar,
  FileText,
  AlertTriangle,
  DollarSign,
  Clock,
  Settings,
  RefreshCw,
  MoreHorizontal,
  Archive,
  Star,
  StarOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";



// Notification type - matches database schema
interface Notification {
  id: string;
  type: "renewal" | "risk" | "savings" | "deadline" | "system" | "contract" | "APPROVAL_REQUEST" | "APPROVAL_COMPLETED" | "COMMENT_MENTION" | "COMMENT_REPLY" | "CONTRACT_DEADLINE" | "CONTRACT_UPDATE" | "WORKFLOW_STEP" | "SHARE_INVITE" | "SYSTEM";
  title: string;
  message?: string;
  description?: string; // Legacy support
  link?: string;
  createdAt: string | Date;
  isRead: boolean;
  starred?: boolean;
  priority?: "low" | "medium" | "high" | "urgent";
  metadata?: {
    contractId?: string;
    contractName?: string;
    value?: number;
  };
}

// Map database notification types to display types
const mapNotificationType = (type: string): "renewal" | "risk" | "savings" | "deadline" | "system" | "contract" => {
  const typeMap: Record<string, "renewal" | "risk" | "savings" | "deadline" | "system" | "contract"> = {
    APPROVAL_REQUEST: "contract",
    APPROVAL_COMPLETED: "contract",
    COMMENT_MENTION: "system",
    COMMENT_REPLY: "system",
    CONTRACT_DEADLINE: "deadline",
    CONTRACT_UPDATE: "contract",
    WORKFLOW_STEP: "system",
    SHARE_INVITE: "system",
    SYSTEM: "system",
    renewal: "renewal",
    risk: "risk",
    savings: "savings",
    deadline: "deadline",
    system: "system",
    contract: "contract",
  };
  return typeMap[type] || "system";
};

// Type icons and colors
const TYPE_CONFIG = {
  renewal: { color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30" },
  risk: { color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30" },
  savings: { color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30" },
  deadline: { color: "text-violet-500", bg: "bg-violet-100 dark:bg-violet-900/30" },
  system: { color: "text-violet-500", bg: "bg-violet-100 dark:bg-violet-900/30" },
  contract: { color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800" },
};

// Icon mapping function
const getTypeIcon = (type: string) => {
  const icons = {
    renewal: Calendar,
    risk: AlertTriangle,
    savings: DollarSign,
    deadline: Clock,
    system: Bell,
    contract: FileText,
  };
  return icons[type as keyof typeof icons] || Bell;
};

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-3 py-1" },
  medium: { label: "Medium", color: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 px-3 py-1" },
  high: { label: "High", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 px-3 py-1" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-3 py-1" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "starred">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      
      // Transform API data to match UI format
      const transformed = (data.notifications || []).map((n: Notification) => ({
        ...n,
        type: mapNotificationType(n.type),
        description: n.message || n.description || '',
        timestamp: new Date(n.createdAt),
        read: n.isRead,
        starred: n.starred || false,
        priority: n.priority || 'medium',
        actionUrl: n.link,
      }));
      
      setNotifications(transformed);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Search filter
      const desc = n.description || n.message || '';
      if (searchQuery && !n.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !desc.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Read/unread filter
      if (filter === "unread" && n.isRead) return false;
      if (filter === "starred" && !n.starred) return false;
      // Type filter
      if (typeFilter !== "all" && mapNotificationType(n.type) !== typeFilter) return false;
      return true;
    });
  }, [notifications, searchQuery, filter, typeFilter]);

  // Stats
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const starredCount = notifications.filter((n) => n.starred).length;

  // Actions - now persist to API
  const markAsRead = async (ids: string[]) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: ids }),
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n))
      );
    } catch {
      toast.error('Failed to mark notifications as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!response.ok) throw new Error('Failed to mark all as read');
      
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const toggleStar = async (id: string) => {
    const notification = notifications.find((n) => n.id === id);
    if (!notification) return;
    
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: !notification.starred }),
      });
      
      // Optimistic update even if API fails (star is local feature)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, starred: !n.starred } : n))
      );
    } catch {
      // Still toggle locally - starring is optional feature
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, starred: !n.starred } : n))
      );
    }
  };

  const deleteNotifications = async (ids: string[]) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: ids }),
      });
      if (!response.ok) throw new Error('Failed to delete notifications');
      
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
      setSelectedIds(new Set());
      toast.success(`Deleted ${ids.length} notification${ids.length > 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to delete notifications');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
    }
  };

  const formatTime = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <PageBreadcrumb />
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <PageBreadcrumb />
      </div>
      
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">Notifications</h1>
                  <p className="text-xs text-muted-foreground">
                    {loading ? "Loading..." : `${unreadCount} unread • ${starredCount} starred`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button variant="outline" size="sm" onClick={() => fetchNotifications()} disabled={loading}>
                <RefreshCw className={cn("h-3.5 w-3.5 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
                <CheckCheck className="h-3.5 w-3.5 mr-2" />
                Mark all read
              </Button>
              <Link href="/settings/notifications">
                <Button variant="ghost" size="sm">
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="p-1 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl">
              <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/30 transition-all duration-300">All</TabsTrigger>
              <TabsTrigger value="unread" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-amber-500/30 transition-all duration-300">
                Unread {unreadCount > 0 && <Badge variant="secondary" className="ml-1.5 px-2 py-0.5">{unreadCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="starred" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/30 transition-all duration-300">Starred</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 p-3 mb-4 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800"
          >
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button size="sm" variant="secondary" onClick={() => markAsRead(Array.from(selectedIds))}>
              <Check className="h-3.5 w-3.5 mr-2" /> Mark read
            </Button>
            <Button size="sm" variant="destructive" onClick={() => deleteNotifications(Array.from(selectedIds))}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Cancel
            </Button>
          </motion.div>
        )}

        {/* Notifications List */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === filteredNotifications.length && filteredNotifications.length > 0}
                  onCheckedChange={selectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {filteredNotifications.length} notifications
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    {typeFilter === "all" ? "All Types" : typeFilter}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTypeFilter("all")}>All Types</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setTypeFilter("renewal")}>Renewals</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter("risk")}>Risks</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter("savings")}>Savings</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter("deadline")}>Deadlines</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter("system")}>System</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter("contract")}>Contracts</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BellOff className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg mb-2">No notifications</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  {searchQuery || filter !== "all" || typeFilter !== "all"
                    ? "Try adjusting your filters to see more notifications."
                    : "You're all caught up! New notifications will appear here."}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <AnimatePresence>
                  {filteredNotifications.map((notification) => {
                    const displayType = mapNotificationType(notification.type);
                    const TypeIcon = getTypeIcon(displayType);
                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={cn(
                          "flex items-start gap-4 p-4 border-b hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                          !notification.isRead && "bg-violet-50/50 dark:bg-violet-900/10"
                        )}
                      >
                        <Checkbox
                          checked={selectedIds.has(notification.id)}
                          onCheckedChange={() => toggleSelect(notification.id)}
                        />
                        
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", TYPE_CONFIG[displayType].bg)}>
                          <TypeIcon className={cn("h-4 w-4", TYPE_CONFIG[displayType].color)} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className={cn("font-medium text-sm", !notification.isRead && "font-semibold")}>
                                {notification.title}
                              </h4>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                {notification.description || notification.message}
                              </p>
                            </div>
                            <div className="flex items-center gap-2.5 flex-shrink-0">
                              <Badge className={PRIORITY_CONFIG[notification.priority || 'medium'].color}>
                                {PRIORITY_CONFIG[notification.priority || 'medium'].label}
                              </Badge>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatTime(notification.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 mt-3">
                            {notification.link && (
                              <Link href={notification.link}>
                                <Button size="sm" variant="secondary" className="h-8">
                                  View
                                </Button>
                              </Link>
                            )}
                            {!notification.isRead && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markAsRead([notification.id])}
                                className="h-8"
                              >
                                <Check className="h-3.5 w-3.5 mr-2" /> Mark read
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleStar(notification.id)}
                          >
                            {notification.starred ? (
                              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                            ) : (
                              <StarOff className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => markAsRead([notification.id])}>
                                <Check className="h-4 w-4 mr-2.5" /> Mark as read
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleStar(notification.id)}>
                                <Star className="h-4 w-4 mr-2.5" /> {notification.starred ? "Unstar" : "Star"}
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Archive className="h-4 w-4 mr-2.5" /> Archive
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => deleteNotifications([notification.id])}
                              >
                                <Trash2 className="h-4 w-4 mr-2.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
