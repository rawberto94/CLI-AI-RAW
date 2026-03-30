'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { PageBreadcrumb } from '@/components/navigation';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  XCircle,
  Bell,
  Shield,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart3,
  CalendarClock,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { ObligationsCalendar } from '@/components/calendar/ObligationsCalendar';

// Types
interface Obligation {
  id: string;
  title: string;
  description: string;
  type: string;
  dueDate: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'at_risk';
  owner?: string;
  contractId: string;
  contractTitle?: string;
  clauseReference?: string;
  completedAt?: string;
  evidence?: string[];
}

interface DashboardMetrics {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  byOwner: Record<string, number>;
  overdueCount: number;
  atRiskCount: number;
  complianceRate: number;
  upcomingDeadlines: Array<{ id: string; title: string; dueDate: string; priority: string }>;
  criticalItems: Array<{ id: string; title: string; dueDate: string; status: string }>;
  trends: {
    completedThisWeek: number;
    completedLastWeek: number;
    createdThisWeek: number;
    createdLastWeek: number;
  };
}

// Priority colors
const priorityColors = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

// Status colors
const statusColors = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-violet-100 text-violet-700 border-violet-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
  at_risk: 'bg-amber-100 text-amber-700 border-amber-200',
};

// Status icons
const statusIcons = {
  pending: Clock,
  in_progress: Activity,
  completed: CheckCircle2,
  overdue: XCircle,
  at_risk: AlertTriangle,
};

export default function ObligationsDashboardPage() {
  const router = useRouter();
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [contracts, setContracts] = useState<Array<{ id: string; title: string }>>([]);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [obligationToComplete, setObligationToComplete] = useState<string | null>(null);
  
  // New obligation form state
  const [newObligation, setNewObligation] = useState({
    title: '',
    description: '',
    type: 'reporting',
    priority: 'medium',
    dueDate: '',
    owner: '',
    contractId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Handle adding new obligation
  const handleAddObligation = async () => {
    if (!newObligation.title || !newObligation.dueDate) {
      toast.error('Please fill in required fields (Title and Due Date)');
      return;
    }
    if (!newObligation.contractId) {
      toast.error('Please select a contract for this obligation');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/obligations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          contractId: newObligation.contractId,
          obligation: {
            title: newObligation.title,
            description: newObligation.description,
            type: newObligation.type,
            priority: newObligation.priority,
            dueDate: newObligation.dueDate,
            owner: newObligation.owner || 'us',
            status: 'pending',
          },
        }),
      });
      
      if (response.ok) {
        toast.success('Obligation added successfully');
        setShowAddDialog(false);
        setNewObligation({
          title: '',
          description: '',
          type: 'reporting',
          priority: 'medium',
          dueDate: '',
          owner: '',
          contractId: '',
        });
        fetchObligations();
        fetchMetrics();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to add obligation');
      }
    } catch (error) {
      toast.error('Failed to add obligation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch obligations
  const fetchObligations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      
      const response = await fetch(`/api/obligations?${params.toString()}`);
      if (response.ok) {
        const raw = await response.json();
        const data = raw.data ?? raw;
        // API returns { obligations, pagination, metrics } in data envelope
        setObligations(data.obligations || []);
      }
    } catch (error) {
      console.error('Failed to fetch obligations:', error);
      toast.error('Failed to load obligations');
    }
  }, [statusFilter, priorityFilter, typeFilter]);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/obligations/metrics');
      if (response.ok) {
        const raw = await response.json();
        const data = raw.data ?? raw;
        // API returns metrics in data envelope
        if (!data.error) {
          // Transform API response to match expected DashboardMetrics interface
          setMetrics({
            total: data.totalObligations || 0,
            byStatus: data.byStatus || {},
            byPriority: data.byPriority || {},
            byType: data.byType || {},
            byOwner: data.byOwner || {},
            overdueCount: data.overdueCount || 0,
            atRiskCount: data.atRiskCount || 0,
            complianceRate: data.complianceRate || 100,
            upcomingDeadlines: (data.upcomingDeadlines || []).map((d: Record<string, unknown>) => ({
              id: d.obligationId,
              title: d.title,
              dueDate: d.dueDate,
              priority: d.priority,
            })),
            criticalItems: (data.criticalItems || []).map((c: Record<string, unknown>) => ({
              id: c.obligationId,
              title: c.title,
              dueDate: c.dueDate,
              status: 'overdue',
            })),
            trends: {
              completedThisWeek: 0,
              completedLastWeek: 0,
              createdThisWeek: 0,
              createdLastWeek: 0,
            },
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  }, []);

  // Fetch contracts for the add dialog
  const fetchContracts = useCallback(async () => {
    try {
      const response = await fetch('/api/contracts?limit=100');
      if (response.ok) {
        const raw = await response.json();
        const data = raw.data ?? raw;
        const contractList = (data.contracts || []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          title: (c.contractTitle || c.title || 'Untitled Contract') as string,
        }));
        setContracts(contractList);
      }
    } catch (error) {
      console.error('Failed to fetch contracts:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([fetchObligations(), fetchMetrics(), fetchContracts()])
      .finally(() => setLoading(false));
  }, [fetchObligations, fetchMetrics, fetchContracts]);

  // Refresh on filter change
  useEffect(() => {
    if (!loading) {
      fetchObligations();
    }
  }, [statusFilter, priorityFilter, typeFilter, fetchObligations, loading]);

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchObligations(), fetchMetrics()]);
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  // Update obligation status
  const handleStatusUpdate = async (obligationId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/obligations/${obligationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        toast.success('Obligation status updated');
        fetchObligations();
        fetchMetrics();
      } else {
        toast.error('Failed to update status');
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  // Mark as complete - request confirmation
  const handleComplete = async (obligationId: string) => {
    setObligationToComplete(obligationId);
    setCompleteConfirmOpen(true);
  };

  // Confirm completion
  const handleConfirmComplete = async () => {
    if (!obligationToComplete) return;
    try {
      const response = await fetch(`/api/obligations/${obligationToComplete}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'completed',
          completedAt: new Date().toISOString()
        }),
      });
      
      if (response.ok) {
        toast.success('Obligation marked as complete');
        fetchObligations();
        fetchMetrics();
      } else {
        toast.error('Failed to complete obligation');
      }
    } catch {
      toast.error('Failed to complete obligation');
    } finally {
      setCompleteConfirmOpen(false);
      setObligationToComplete(null);
    }
  };

  // Filter obligations by search
  const filteredObligations = obligations.filter(o =>
    o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.contractTitle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Days until due
  const daysUntilDue = (dateStr: string) => {
    const due = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20 dark:from-slate-900 dark:via-purple-950/30 dark:to-pink-950/20 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-16 h-16 border-4 border-violet-200 dark:border-violet-800 border-t-violet-600 dark:border-t-violet-400 rounded-full animate-spin" />
            <Target className="w-6 h-6 text-violet-600 dark:text-violet-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-medium">Loading obligations dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20 dark:from-slate-900 dark:via-purple-950/30 dark:to-pink-950/20">
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <PageBreadcrumb />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent mt-1">
                Obligation Tracker
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                AI-powered contract obligation monitoring and compliance tracking
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700">
                    <Plus className="w-4 h-4" />
                    Add Obligation
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-violet-600" />
                      Add New Obligation
                    </DialogTitle>
                    <DialogDescription>
                      Create a manual obligation to track. You can also have obligations auto-extracted from contracts.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="contract">Contract <span className="text-red-500">*</span></Label>
                      <Select
                        value={newObligation.contractId}
                        onValueChange={(value) => setNewObligation(prev => ({ ...prev, contractId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a contract..." />
                        </SelectTrigger>
                        <SelectContent>
                          {contracts.map((contract) => (
                            <SelectItem key={contract.id} value={contract.id}>
                              {contract.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                      <Input
                        id="title"
                        placeholder="e.g., Submit quarterly compliance report"
                        value={newObligation.title}
                        onChange={(e) => setNewObligation(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Add details about this obligation..."
                        value={newObligation.description}
                        onChange={(e) => setNewObligation(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="type">Type</Label>
                        <Select
                          value={newObligation.type}
                          onValueChange={(value) => setNewObligation(prev => ({ ...prev, type: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reporting">Reporting</SelectItem>
                            <SelectItem value="compliance">Compliance</SelectItem>
                            <SelectItem value="payment">Payment</SelectItem>
                            <SelectItem value="delivery">Delivery</SelectItem>
                            <SelectItem value="notification">Notification</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select
                          value={newObligation.priority}
                          onValueChange={(value) => setNewObligation(prev => ({ ...prev, priority: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dueDate">Due Date <span className="text-red-500">*</span></Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={newObligation.dueDate}
                          onChange={(e) => setNewObligation(prev => ({ ...prev, dueDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="owner">Owner</Label>
                        <Input
                          id="owner"
                          placeholder="Assignee name"
                          value={newObligation.owner}
                          onChange={(e) => setNewObligation(prev => ({ ...prev, owner: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddObligation}
                      disabled={isSubmitting}
                      className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Obligation
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30 p-1.5 rounded-xl">
            <TabsTrigger 
              value="overview" 
              className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:via-violet-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-violet-500/30 rounded-lg transition-all duration-200"
            >
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="obligations" 
              className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:via-violet-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-violet-500/30 rounded-lg transition-all duration-200"
            >
              <FileText className="w-4 h-4" />
              All Obligations
            </TabsTrigger>
            <TabsTrigger 
              value="calendar" 
              className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:via-violet-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-violet-500/30 rounded-lg transition-all duration-200"
            >
              <CalendarClock className="w-4 h-4" />
              Calendar
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Obligations */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="group bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl hover:shadow-violet-200/30 dark:hover:shadow-slate-900/50 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Total Obligations</p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">{metrics?.total || 0}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-violet-400 to-purple-600 rounded-xl shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                        <Target className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm">
                      <span className="flex items-center gap-1 text-green-600">
                        <ArrowUpRight className="w-4 h-4" />
                        {metrics?.trends?.createdThisWeek || 0} this week
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Compliance Rate */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="group bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl hover:shadow-green-200/30 dark:hover:shadow-slate-900/50 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Compliance Rate</p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                          {((metrics?.complianceRate || 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-violet-400 to-violet-600 rounded-xl shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform duration-300">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Progress value={(metrics?.complianceRate || 0) * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Overdue */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="group bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl hover:shadow-red-200/30 dark:hover:shadow-slate-900/50 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Overdue</p>
                        <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{metrics?.overdueCount || 0}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-red-400 to-rose-600 rounded-xl shadow-lg shadow-red-500/30 group-hover:scale-110 transition-transform duration-300">
                        <XCircle className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      {metrics?.atRiskCount || 0} at risk
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Completed This Week */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="group bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl hover:shadow-violet-200/30 dark:hover:shadow-slate-900/50 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Completed This Week</p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                          {metrics?.trends?.completedThisWeek || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-violet-400 to-violet-600 rounded-xl shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm">
                      {(metrics?.trends?.completedThisWeek || 0) >= (metrics?.trends?.completedLastWeek || 0) ? (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <TrendingUp className="w-4 h-4" />
                          Trending up
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <ArrowDownRight className="w-4 h-4" />
                          Down from last week
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Critical Items */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
                      <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                      Critical Items
                    </CardTitle>
                    <CardDescription className="dark:text-slate-400">Obligations requiring immediate attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {metrics?.criticalItems?.length ? (
                      <div className="space-y-3">
                        {metrics.criticalItems.slice(0, 5).map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-900/50">
                            <div className="flex-1">
                              <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{item.title}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                Due: {formatDate(item.dueDate)}
                              </p>
                            </div>
                            <Badge className={statusColors[item.status as keyof typeof statusColors] || statusColors.pending}>
                              {item.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500 dark:text-green-400" />
                        <p>No critical items!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Upcoming Deadlines */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
                      <Calendar className="w-5 h-5 text-violet-500 dark:text-violet-400" />
                      Upcoming Deadlines
                    </CardTitle>
                    <CardDescription className="dark:text-slate-400">Next 7 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {metrics?.upcomingDeadlines?.length ? (
                      <div className="space-y-3">
                        {metrics.upcomingDeadlines.slice(0, 5).map((item) => {
                          const days = daysUntilDue(item.dueDate);
                          return (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-600/50">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{item.title}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                  {days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`}
                                </p>
                              </div>
                              <Badge className={priorityColors[item.priority as keyof typeof priorityColors] || priorityColors.medium}>
                                {item.priority}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                        <p>No upcoming deadlines</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Status Breakdown */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
                    <BarChart3 className="w-5 h-5 text-violet-500 dark:text-violet-400" />
                    Status Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {Object.entries(metrics?.byStatus || {}).map(([status, count]) => {
                      const StatusIcon = statusIcons[status as keyof typeof statusIcons] || Clock;
                      return (
                        <div key={status} className="text-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                          <StatusIcon className={`w-8 h-8 mx-auto mb-2 ${
                            status === 'completed' ? 'text-green-500' :
                            status === 'overdue' ? 'text-red-500' :
                            status === 'at_risk' ? 'text-amber-500' :
                            status === 'in_progress' ? 'text-violet-500' :
                            'text-slate-400 dark:text-slate-500'
                          }`} />
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{count}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">{status.replace('_', ' ')}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* All Obligations Tab */}
          <TabsContent value="obligations" className="space-y-4">
            {/* Filters */}
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Search obligations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="at_risk">At Risk</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                      <SelectItem value="reporting">Reporting</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="renewal">Renewal</SelectItem>
                      <SelectItem value="notice">Notice</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline" size="icon" onClick={() => {
                    setStatusFilter('all');
                    setPriorityFilter('all');
                    setTypeFilter('all');
                    setSearchQuery('');
                  }}>
                    <Filter className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Obligations List */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredObligations.length > 0 ? (
                  filteredObligations.map((obligation, index) => {
                    const StatusIcon = statusIcons[obligation.status as keyof typeof statusIcons] || Clock;
                    const days = daysUntilDue(obligation.dueDate);
                    
                    return (
                      <motion.div
                        key={obligation.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-all">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className={`p-2 rounded-xl ${
                                obligation.status === 'completed' ? 'bg-green-100 dark:bg-green-900/40' :
                                obligation.status === 'overdue' ? 'bg-red-100 dark:bg-red-900/40' :
                                obligation.status === 'at_risk' ? 'bg-amber-100 dark:bg-amber-900/40' :
                                'bg-slate-100 dark:bg-slate-700'
                              }`}>
                                <StatusIcon className={`w-5 h-5 ${
                                  obligation.status === 'completed' ? 'text-green-600' :
                                  obligation.status === 'overdue' ? 'text-red-600' :
                                  obligation.status === 'at_risk' ? 'text-amber-600' :
                                  'text-slate-600 dark:text-slate-400'
                                }`} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{obligation.title}</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">
                                      {obligation.description}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge className={priorityColors[obligation.priority]}>
                                      {obligation.priority}
                                    </Badge>
                                    <Badge className={statusColors[obligation.status]}>
                                      {obligation.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 mt-3 text-sm text-slate-600 dark:text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {formatDate(obligation.dueDate)}
                                    {days < 0 && (
                                      <span className="text-red-600 dark:text-red-400 font-medium ml-1">
                                        ({Math.abs(days)}d overdue)
                                      </span>
                                    )}
                                    {days >= 0 && days <= 7 && (
                                      <span className="text-amber-600 dark:text-amber-400 font-medium ml-1">
                                        ({days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d left`})
                                      </span>
                                    )}
                                  </span>
                                  
                                  {obligation.owner && (
                                    <span className="flex items-center gap-1">
                                      <Users className="w-4 h-4" />
                                      {obligation.owner}
                                    </span>
                                  )}

                                  {obligation.contractTitle && (
                                    <Link 
                                      href={`/contracts/${obligation.contractId}`}
                                      className="flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                                    >
                                      <FileText className="w-4 h-4" />
                                      {obligation.contractTitle}
                                    </Link>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {obligation.status !== 'completed' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleComplete(obligation.id)}
                                    className="gap-1"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Complete
                                  </Button>
                                )}
                                
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleStatusUpdate(obligation.id, 'in_progress')}>
                                      <Activity className="w-4 h-4 mr-2" />
                                      Mark In Progress
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleStatusUpdate(obligation.id, 'at_risk')}>
                                      <AlertTriangle className="w-4 h-4 mr-2" />
                                      Mark At Risk
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>
                                      <Bell className="w-4 h-4 mr-2" />
                                      Set Reminder
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Users className="w-4 h-4 mr-2" />
                                      Reassign
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })
                ) : (
                  <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                    <CardContent className="py-12 text-center">
                      <Target className="w-16 h-16 mx-auto mb-4 text-violet-300 dark:text-violet-700" />
                      <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">No obligations found</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
                        {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all'
                          ? 'Try adjusting your filters to find obligations'
                          : 'Obligations are automatically extracted from your contracts using AI. Upload a contract to get started.'}
                      </p>
                      {!(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all') && (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                          <Link href="/upload">
                            <Button className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 gap-2">
                              <FileText className="w-4 h-4" />
                              Upload Contract
                            </Button>
                          </Link>
                          <Link href="/contracts">
                            <Button variant="outline" className="gap-2">
                              <Search className="w-4 h-4" />
                              Browse Existing Contracts
                            </Button>
                          </Link>
                        </div>
                      )}
                      <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl max-w-lg mx-auto">
                        <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">How it works:</h4>
                        <ol className="text-sm text-slate-600 dark:text-slate-400 text-left space-y-2">
                          <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-xs flex items-center justify-center font-medium">1</span>
                            Open any contract from the Contracts page
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-xs flex items-center justify-center font-medium">2</span>
                            Click &quot;Legal Review&quot; from the Actions menu
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-xs flex items-center justify-center font-medium">3</span>
                            AI extracts obligations, deadlines, and compliance requirements
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-xs flex items-center justify-center font-medium">4</span>
                            Track and manage all obligations from this dashboard
                          </li>
                        </ol>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </AnimatePresence>
            </div>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="space-y-4">
            <ObligationsCalendar 
              obligations={obligations}
              onStatusUpdate={handleStatusUpdate}
              onComplete={handleComplete}
            />
          </TabsContent>
        </Tabs>

        {/* Complete Confirmation Dialog */}
        <ConfirmDialog
          open={completeConfirmOpen}
          onOpenChange={setCompleteConfirmOpen}
          title="Mark Obligation Complete"
          description="Are you sure you want to mark this obligation as completed? This records the completion timestamp."
          confirmLabel="Mark Complete"
          onConfirm={handleConfirmComplete}
        />
      </div>
    </div>
  );
}
