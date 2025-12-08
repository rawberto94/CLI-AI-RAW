/**
 * Notifications Page
 * Centralized notification management and history
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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

// Notification type
interface Notification {
  id: string;
  type: "renewal" | "risk" | "savings" | "deadline" | "system" | "contract";
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  priority: "low" | "medium" | "high" | "urgent";
  actionUrl?: string;
  actionLabel?: string;
  metadata?: {
    contractId?: string;
    contractName?: string;
    value?: number;
  };
}

// Demo notifications
const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "renewal",
    title: "Contract Renewal Due",
    description: "Microsoft Enterprise Agreement expires in 30 days. Review and initiate renewal process.",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    read: false,
    starred: true,
    priority: "urgent",
    actionUrl: "/contracts/ms-ea-2024",
    actionLabel: "View Contract",
    metadata: { contractId: "ms-ea-2024", contractName: "Microsoft EA", value: 250000 },
  },
  {
    id: "2",
    type: "risk",
    title: "High-Risk Clause Detected",
    description: "Auto-renewal clause with 60-day notice period found in AWS Services Agreement.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: false,
    starred: false,
    priority: "high",
    actionUrl: "/contracts/aws-sa-2024",
    actionLabel: "Review Clause",
    metadata: { contractId: "aws-sa-2024", contractName: "AWS Services Agreement" },
  },
  {
    id: "3",
    type: "savings",
    title: "Savings Opportunity Identified",
    description: "Potential $15,000 savings found through rate optimization in IT Services contract.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    read: true,
    starred: false,
    priority: "medium",
    actionUrl: "/analytics/savings",
    actionLabel: "View Analysis",
    metadata: { value: 15000 },
  },
  {
    id: "4",
    type: "deadline",
    title: "Payment Deadline Approaching",
    description: "Invoice #INV-2024-0892 for Salesforce subscription due in 5 days.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    read: true,
    starred: false,
    priority: "medium",
    actionUrl: "/contracts/sf-sub-2024",
    actionLabel: "View Details",
    metadata: { value: 12500 },
  },
  {
    id: "5",
    type: "system",
    title: "OCR Processing Complete",
    description: "5 contracts have been successfully processed and are ready for review.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
    read: true,
    starred: false,
    priority: "low",
    actionUrl: "/contracts?status=pending_review",
    actionLabel: "Review Contracts",
  },
  {
    id: "6",
    type: "contract",
    title: "New Contract Uploaded",
    description: "Vendor Services Agreement uploaded by John Smith and pending approval.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72),
    read: true,
    starred: false,
    priority: "low",
    actionUrl: "/approvals",
    actionLabel: "View Approval",
    metadata: { contractName: "Vendor Services Agreement" },
  },
];

// Type icons and colors
const TYPE_CONFIG = {
  renewal: { icon: Calendar, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30" },
  risk: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30" },
  savings: { icon: DollarSign, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30" },
  deadline: { icon: Clock, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30" },
  system: { icon: Bell, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30" },
  contract: { icon: FileText, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800" },
};

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  high: { label: "High", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(DEMO_NOTIFICATIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "starred">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Search filter
      if (searchQuery && !n.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !n.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Read/unread filter
      if (filter === "unread" && n.read) return false;
      if (filter === "starred" && !n.starred) return false;
      // Type filter
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      return true;
    });
  }, [notifications, searchQuery, filter, typeFilter]);

  // Stats
  const unreadCount = notifications.filter((n) => !n.read).length;
  const starredCount = notifications.filter((n) => n.starred).length;

  // Actions
  const markAsRead = (ids: string[]) => {
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const toggleStar = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, starred: !n.starred } : n))
    );
  };

  const deleteNotifications = (ids: string[]) => {
    setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
    setSelectedIds(new Set());
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

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">Notifications</h1>
                  <p className="text-xs text-muted-foreground">
                    {unreadCount} unread • {starredCount} starred
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark all read
              </Button>
              <Link href="/settings/notifications">
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">
                Unread {unreadCount > 0 && <Badge variant="secondary" className="ml-1">{unreadCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="starred">Starred</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 p-3 mb-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button size="sm" variant="secondary" onClick={() => markAsRead(Array.from(selectedIds))}>
              <Check className="h-4 w-4 mr-1" /> Mark read
            </Button>
            <Button size="sm" variant="destructive" onClick={() => deleteNotifications(Array.from(selectedIds))}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
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
                    <Filter className="h-4 w-4 mr-2" />
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
          <CardContent className="p-0">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
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
                    const TypeIcon = TYPE_CONFIG[notification.type].icon;
                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={cn(
                          "flex items-start gap-4 p-4 border-b hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                          !notification.read && "bg-blue-50/50 dark:bg-blue-900/10"
                        )}
                      >
                        <Checkbox
                          checked={selectedIds.has(notification.id)}
                          onCheckedChange={() => toggleSelect(notification.id)}
                        />
                        
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", TYPE_CONFIG[notification.type].bg)}>
                          <TypeIcon className={cn("h-5 w-5", TYPE_CONFIG[notification.type].color)} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className={cn("font-medium text-sm", !notification.read && "font-semibold")}>
                                {notification.title}
                              </h4>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                {notification.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className={PRIORITY_CONFIG[notification.priority].color}>
                                {PRIORITY_CONFIG[notification.priority].label}
                              </Badge>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatTime(notification.timestamp)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-3">
                            {notification.actionUrl && (
                              <Link href={notification.actionUrl}>
                                <Button size="sm" variant="secondary">
                                  {notification.actionLabel || "View"}
                                </Button>
                              </Link>
                            )}
                            {!notification.read && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markAsRead([notification.id])}
                              >
                                <Check className="h-3 w-3 mr-1" /> Mark read
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleStar(notification.id)}
                          >
                            {notification.starred ? (
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            ) : (
                              <StarOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => markAsRead([notification.id])}>
                                <Check className="h-4 w-4 mr-2" /> Mark as read
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleStar(notification.id)}>
                                <Star className="h-4 w-4 mr-2" /> {notification.starred ? "Unstar" : "Star"}
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Archive className="h-4 w-4 mr-2" /> Archive
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => deleteNotifications([notification.id])}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
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
