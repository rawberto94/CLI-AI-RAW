/**
 * Contigo Labs - Unified AI Agent Experience
 * 
 * The central hub for all AI-powered capabilities in Contigo:
 * - Agent Command Center (19 AI agents with HITL workflows)
 * - AI Chat Assistant (@mention support)
 * - RFx Opportunity Detection (Scout)
 * - Approval Queue
 * - Learning Records
 * - Knowledge Graph
 * - Predictive Analytics
 * 
 * @version 2.0.0
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAgentSSE } from '@/hooks/useAgentSSE';
import {
  Brain,
  Bot,
  Sparkles,
  MessageSquare,
  Target,
  Shield,
  Zap,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ListChecks,
  Search,
  Gauge,
  BookOpen,
  GitBranch,
  Scale,
  GitCompare,
  BarChart3,
  Users,
  Gavel,
  FileSearch,
  Wrench,
  GitMerge,
  Beaker,
  Rocket,
  RefreshCw,
  ExternalLink,
  Bell,
  LayoutGrid,
  Layers,
  Plus,
  X,
  Star,
  FileText,
  Loader2,
  Send,
  Calendar,
  Upload,
  Download,
  Wand2,
  Copy,
  Check,
  Edit3,
  Eye,
  Trash2,
  FolderOpen,
  Save,
  DollarSign,
  Code,
  PenTool,
  Sliders,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Trophy,
  Network,
  ArrowRight,
  CheckCircle2,
  Info,
  HelpCircle,
  LayoutTemplate,
  Type,
  FileSignature,
  FileCode,
  List as ListIcon,
  Workflow,
  Award,
  Tag,
  Grid3x3 as Grid3X3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { UnifiedAgentInterface } from '@/components/agents/UnifiedAgentInterface';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
// FloatingAIBubble functionality is embedded via EmbeddedChatInterface

// Message type for chat interface
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agent?: string;
  suggestions?: string[];
}

// ============================================================================
// AGENT CLUSTER CONFIGURATION
// ============================================================================

const AGENT_CLUSTERS = {
  guardians: {
    id: 'guardians',
    name: 'Guardians',
    emoji: '🛡️',
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500',
    description: 'Compliance & Risk Protection',
    agents: [
      { id: 'proactive-validation-agent', codename: 'Sentinel', avatar: '🛡️', icon: Shield, description: 'First line of defense — catches errors before they propagate', status: 'active' },
      { id: 'compliance-monitoring-agent', codename: 'Vigil', avatar: '⚖️', icon: Scale, description: 'Regulatory watchdog — ensures contracts meet all requirements', status: 'active' },
      { id: 'proactive-risk-detector', codename: 'Warden', avatar: '🔥', icon: AlertTriangle, description: 'Early warning system — detects risks before they materialize', status: 'active' },
    ],
  },
  oracles: {
    id: 'oracles',
    name: 'Oracles',
    emoji: '🔮',
    color: 'violet',
    gradient: 'from-violet-500 to-purple-500',
    description: 'Intelligence & Discovery',
    agents: [
      { id: 'intelligent-search-agent', codename: 'Sage', avatar: '🔮', icon: Search, description: 'Seer of contracts — finds anything with intent-aware search', status: 'active' },
      { id: 'opportunity-discovery-engine', codename: 'Prospector', avatar: '💎', icon: TrendingUp, description: 'Fortune finder — discovers savings and optimization gold', status: 'active' },
      { id: 'rfx-detection-agent', codename: 'Scout', avatar: '🎯', icon: Target, description: 'Sniper — spots RFx opportunities before they expire', status: 'active' },
    ],
  },
  operators: {
    id: 'operators',
    name: 'Operators',
    emoji: '⚡',
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-500',
    description: 'Execution & Monitoring',
    agents: [
      { id: 'autonomous-deadline-manager', codename: 'Clockwork', avatar: '⏰', icon: Clock, description: 'Precision timekeeper — never misses a deadline', status: 'active' },
      { id: 'obligation-tracking-agent', codename: 'Steward', avatar: '📋', icon: CheckCircle, description: 'Dedicated steward — tracks every commitment', status: 'active' },
      { id: 'smart-gap-filling-agent', codename: 'Artificer', avatar: '🔧', icon: Wrench, description: 'Master craftsperson — fills missing data with precision', status: 'active' },
    ],
  },
  strategists: {
    id: 'strategists',
    name: 'Strategists',
    emoji: '🎯',
    color: 'amber',
    gradient: 'from-amber-500 to-orange-500',
    description: 'Workflow & Planning',
    agents: [
      { id: 'workflow-authoring-agent', codename: 'Architect', avatar: '🏛️', icon: LayoutGrid, description: 'Master builder — designs optimal workflows', status: 'active' },
      { id: 'rfx-procurement-agent', codename: 'Merchant', avatar: '🤝', icon: Gavel, description: 'Master negotiator — manages RFx lifecycles', status: 'active' },
      { id: 'multi-agent-coordinator', codename: 'Conductor', avatar: '🎼', icon: Users, description: 'Orchestra leader — coordinates agent symphonies', status: 'active' },
    ],
  },
  evolution: {
    id: 'evolution',
    name: 'Evolution',
    emoji: '🧬',
    color: 'rose',
    gradient: 'from-rose-500 to-pink-500',
    description: 'Learning & Improvement',
    agents: [
      { id: 'user-feedback-learner', codename: 'Mnemosyne', avatar: '🧠', icon: Brain, description: 'Memory incarnate — learns from every interaction', status: 'active' },
      { id: 'ab-testing-engine', codename: 'A/B', avatar: '🧪', icon: Beaker, description: 'Scientist — tests and validates agent performance', status: 'active' },
      { id: 'agent-swarm', codename: 'Swarm', avatar: '🐝', icon: GitMerge, description: 'Collective intelligence — many minds, one purpose', status: 'active' },
    ],
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ContigoLabsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Real-time updates via SSE
  const sse = useAgentSSE();

  // Fetch initial status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Update status when SSE receives new data
  useEffect(() => {
    if (sse.lastMessage) {
      // Merge SSE data with existing status
      setStatus((prev: any) => ({
        ...prev,
        overview: {
          ...prev?.overview,
          pendingApprovals: sse.pendingApprovals || prev?.overview?.pendingApprovals,
        },
        recentActivity: sse.activities?.length > 0 
          ? sse.activities 
          : prev?.recentActivity,
      }));
    }
  }, [sse.lastMessage, sse.pendingApprovals, sse.activities]);

  // Track whether the tab change originated from the URL (sidebar nav) or from
  // within the page (tab click). This ref breaks the update cycle that caused
  // the tab to bounce back and forth between values.
  const isUpdatingUrl = useRef(false);

  // Sync activeTab ← URL (sidebar navigation)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab && !isUpdatingUrl.current) {
      setActiveTab(tabFromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Sync URL ← activeTab (in-page tab click)
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab !== activeTab) {
      isUpdatingUrl.current = true;
      const params = new URLSearchParams(searchParams);
      params.set('tab', activeTab);
      router.replace(`/contigo-labs?${params.toString()}`, { scroll: false });
      // Reset flag after navigation settles
      requestAnimationFrame(() => { isUpdatingUrl.current = false; });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:scale-105 transition-all duration-300">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black bg-gradient-to-r from-violet-700 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Contigo Labs
                </h1>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  AI-Powered Contract Intelligence Hub
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Connection Status */}
              <Badge 
                className={cn(
                  "text-xs font-bold px-3 py-1.5 rounded-lg border-transparent",
                  sse.connected 
                    ? "bg-emerald-50 text-emerald-700" 
                    : "bg-amber-50 text-amber-700"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full mr-2", sse.connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse")} />
                {sse.connected ? 'Live' : 'Connecting...'}
              </Badge>

              {/* Quick Stats */}
              {status?.overview && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-50 text-emerald-700 border-transparent font-bold px-3 py-1.5 rounded-lg">
                    <Bot className="w-3.5 h-3.5 mr-1.5" />
                    {status.overview.activeAgents} Active
                  </Badge>
                  {(sse.pendingApprovals > 0 || status.overview.pendingApprovals > 0) && (
                    <Badge className="bg-red-50 text-red-700 border-transparent font-bold px-3 py-1.5 rounded-lg animate-pulse">
                      <Bell className="w-3.5 h-3.5 mr-1.5" />
                      {sse.pendingApprovals || status.overview.pendingApprovals} Pending
                    </Badge>
                  )}
                </div>
              )}

              <Button variant="outline" size="sm" onClick={fetchStatus} className="h-9 rounded-lg border-slate-200 hover:bg-slate-50 font-semibold transition-all">
                <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          {/* Navigation Tabs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-1.5">
            <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-1 flex-wrap">
              <TabsTrigger 
                value="dashboard" 
                className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-xl px-4 py-2.5 transition-all hover:bg-slate-100"
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger 
                value="agents" 
                className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-xl px-4 py-2.5 transition-all hover:bg-slate-100"
              >
                <Bot className="w-4 h-4 mr-2" />
                Agents
                <Badge variant="secondary" className="ml-2 text-xs bg-white/50">19</Badge>
              </TabsTrigger>
              <TabsTrigger 
                value="approvals" 
                className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-xl px-4 py-2.5 transition-all hover:bg-slate-100"
              >
                <ListChecks className="w-4 h-4 mr-2" />
                Approvals
                {status?.overview?.pendingApprovals > 0 && (
                  <Badge variant="destructive" className="ml-2 text-xs animate-pulse">
                    {status.overview.pendingApprovals}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="rfx-studio" 
                className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-xl px-4 py-2.5 transition-all hover:bg-slate-100"
              >
                <Gavel className="w-4 h-4 mr-2" />
                RFx Studio
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-xl px-4 py-2.5 transition-all hover:bg-slate-100"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-xl px-4 py-2.5 transition-all hover:bg-slate-100"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger 
                value="toolbox" 
                className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-xl px-4 py-2.5 transition-all hover:bg-slate-100"
              >
                <Wrench className="w-4 h-4 mr-2" />
                Toolbox
              </TabsTrigger>
              <TabsTrigger 
                value="knowledge" 
                className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-xl px-4 py-2.5 transition-all hover:bg-slate-100"
              >
                <GitBranch className="w-4 h-4 mr-2" />
                Knowledge
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="m-0 space-y-6">
            <DashboardOverview status={status} loading={loading} />
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="m-0">
            <div className="h-[calc(100vh-280px)]">
              <UnifiedAgentInterface />
            </div>
          </TabsContent>

          {/* Approvals Tab */}
          <TabsContent value="approvals" className="m-0">
            <ApprovalsView />
          </TabsContent>

          {/* RFx Studio Tab */}
          <TabsContent value="rfx-studio" className="m-0">
            <RFxStudioView />
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="m-0">
            <ChatView />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="m-0">
            <AnalyticsView />
          </TabsContent>

          {/* Toolbox Tab */}
          <TabsContent value="toolbox" className="m-0">
            <ToolboxView />
          </TabsContent>

          {/* Knowledge Tab */}
          <TabsContent value="knowledge" className="m-0">
            <KnowledgeView />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ============================================================================
// DASHBOARD OVERVIEW
// ============================================================================

function DashboardOverview({ status, loading }: { status: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse border-transparent shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="h-3 bg-slate-200 rounded-full w-24 mb-4" />
                  <div className="h-10 bg-slate-200 rounded-xl w-20 mb-3" />
                  <div className="h-3 bg-slate-100 rounded-full w-32" />
                </div>
                <div className="w-14 h-14 bg-slate-200 rounded-2xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Agents"
          value={status?.overview?.activeAgents || 0}
          total={19}
          icon={Bot}
          color="violet"
          description="Currently operational"
        />
        <StatCard
          title="Pending Approvals"
          value={status?.overview?.pendingApprovals || 0}
          icon={ListChecks}
          color="amber"
          description="Awaiting your decision"
          alert={status?.overview?.pendingApprovals > 0}
        />
        <StatCard
          title="RFx Studio"
          value={status?.metrics?.totalOpportunities || 0}
          icon={Gavel}
          color="emerald"
          description="Opportunities detected"
        />
        <StatCard
          title="Success Rate"
          value={`${Math.round(status?.metrics?.successRate || 0)}%`}
          icon={Gauge}
          color="blue"
          description="Last 24 hours"
        />
      </div>

      {/* Agent Clusters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Object.values(AGENT_CLUSTERS).map(cluster => (
          <ClusterCard key={cluster.id} cluster={cluster} />
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-transparent shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />
        <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900 dark:text-white">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 rounded-xl flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5" />
            </div>
            Quick Actions
          </CardTitle>
          <CardDescription className="text-sm font-medium text-slate-500 dark:text-slate-400">Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <QuickActionButton
              icon={Target}
              label="Scout Opportunities"
              description="Find RFx opportunities"
              href="/contigo-labs?tab=rfx-studio"
              color="emerald"
            />
            <QuickActionButton
              icon={MessageSquare}
              label="Ask Sage"
              description="Natural language search"
              href="/contigo-labs?tab=chat"
              color="violet"
            />
            <QuickActionButton
              icon={Gavel}
              label="Create RFx"
              description="Start new sourcing"
              href="/requests/new"
              color="amber"
            />
            <QuickActionButton
              icon={GitBranch}
              label="Knowledge Graph"
              description="Explore relationships"
              href="/contigo-labs?tab=knowledge"
              color="blue"
            />
            <QuickActionButton
              icon={Wrench}
              label="AI Toolbox"
              description="Run AI tools directly"
              href="/contigo-labs?tab=toolbox"
              color="rose"
            />
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="border-transparent shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500" />
        <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900 dark:text-white">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-xl flex items-center justify-center shadow-sm">
              <Clock className="w-5 h-5" />
            </div>
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] px-6 py-4">
            {status?.recentActivity?.length > 0 ? (
              <div className="space-y-3">
                {status.recentActivity.map((activity: any) => (
                  <ActivityRow key={activity.id} activity={activity} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                  <Bot className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="font-bold text-slate-700 dark:text-slate-300">No recent activity</p>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Agents are currently idle</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, total, icon: Icon, color, description, alert }: any) {
  const colors: Record<string, { bg: string; icon: string; border: string }> = {
    violet: { bg: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600', border: 'border-l-violet-500' },
    amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', border: 'border-l-amber-500' },
    emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', border: 'border-l-emerald-500' },
    blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', border: 'border-l-blue-500' },
  };

  const c = colors[color] || colors.violet;

  return (
    <Card className={cn(
      "border-l-4 border-transparent shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden", 
      alert ? "border-l-red-500" : c.border
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{title}</p>
            <p className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              {value}
              {total && <span className="text-lg text-slate-400 dark:text-slate-500 font-semibold ml-1">/{total}</span>}
            </p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
              {alert && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
              {description}
            </p>
          </div>
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm", c.icon)}>
            <Icon className="w-7 h-7" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClusterCard({ cluster }: { cluster: any }) {
  return (
    <Card className="group hover:shadow-xl transition-all duration-300 border-transparent hover:border-violet-200 dark:hover:border-violet-700 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
      <CardContent className="p-0">
        <div className={cn("h-1.5 bg-gradient-to-r", cluster.gradient)} />
        <div className="p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-md bg-gradient-to-br", cluster.gradient)}>
              {cluster.emoji}
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">{cluster.name}</h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{cluster.description}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {cluster.agents.map((agent: any) => (
              <div 
                key={agent.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-sm transition-all duration-200 cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-700 group/agent"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xl group-hover/agent:scale-110 transition-transform shadow-sm">
                  {agent.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-slate-900 dark:text-white group-hover/agent:text-violet-700 dark:group-hover/agent:text-violet-400 transition-colors">{agent.codename}</p>
                    <span className="text-[10px] font-mono text-violet-500 dark:text-violet-400 opacity-0 group-hover/agent:opacity-100 transition-opacity">@{agent.codename.toLowerCase()}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{agent.description}</p>
                </div>
                <Badge className={cn(
                  "text-[10px] uppercase tracking-wider font-bold border-transparent px-2 py-0.5 rounded-md",
                  agent.status === 'active' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                )}>
                  {agent.status}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 text-center">Hover an agent to see its @mention — use it in Chat to invoke directly</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionButton({ icon: Icon, label, description, href, color }: any) {
  const colorMap: Record<string, { hover: string; iconBg: string; iconActive: string }> = {
    violet: { hover: 'hover:bg-violet-50 hover:border-violet-200 hover:shadow-violet-100/50', iconBg: 'bg-violet-100 text-violet-600', iconActive: 'group-hover:bg-violet-600 group-hover:text-white' },
    amber: { hover: 'hover:bg-amber-50 hover:border-amber-200 hover:shadow-amber-100/50', iconBg: 'bg-amber-100 text-amber-600', iconActive: 'group-hover:bg-amber-600 group-hover:text-white' },
    emerald: { hover: 'hover:bg-emerald-50 hover:border-emerald-200 hover:shadow-emerald-100/50', iconBg: 'bg-emerald-100 text-emerald-600', iconActive: 'group-hover:bg-emerald-600 group-hover:text-white' },
    blue: { hover: 'hover:bg-blue-50 hover:border-blue-200 hover:shadow-blue-100/50', iconBg: 'bg-blue-100 text-blue-600', iconActive: 'group-hover:bg-blue-600 group-hover:text-white' },
    rose: { hover: 'hover:bg-rose-50 hover:border-rose-200 hover:shadow-rose-100/50', iconBg: 'bg-rose-100 text-rose-600', iconActive: 'group-hover:bg-rose-600 group-hover:text-white' },
  };

  const c = colorMap[color] || colorMap.violet;

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col items-center text-center p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
        c.hover
      )}
    >
      <div className={cn(
        "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 shadow-sm",
        c.iconBg, c.iconActive
      )}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="font-bold text-slate-900 dark:text-white mb-1.5">{label}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
    </Link>
  );
}

function ActivityRow({ activity }: { activity: any }) {
  return (
    <div className="group flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all duration-200 border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
      <div className="relative">
        <Avatar className="w-11 h-11 border-2 border-white dark:border-slate-800 shadow-sm group-hover:scale-105 transition-transform">
          <AvatarFallback className="text-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600">{activity.agentAvatar}</AvatarFallback>
        </Avatar>
        {activity.importance === 'high' && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors">{activity.title}</p>
          <Badge className={cn(
            "text-[10px] uppercase tracking-wider px-2 py-0.5 border-transparent font-bold rounded-md",
            activity.importance === 'high' ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          )}>
            {activity.importance}
          </Badge>
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate mb-2">{activity.description}</p>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
          <Clock className="w-3 h-3" />
          {new Date(activity.timestamp).toLocaleString(undefined, { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PLACEHOLDER VIEWS (TO BE IMPLEMENTED)
// ============================================================================

function ApprovalsView() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <ListChecks className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Approval Queue</h2>
            <p className="text-slate-500 font-medium">Review and approve agent recommendations</p>
          </div>
        </div>
        <Badge className="bg-amber-100 text-amber-700 border-transparent font-bold px-3 py-1.5 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 mr-2 inline" />
          Requires Attention
        </Badge>
      </div>

      {/* Main Card */}
      <Card className="border-transparent shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600" />
          <div className="flex flex-col items-center justify-center py-20 px-8">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-6">
              <ListChecks className="w-12 h-12 text-amber-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Integrated with Agent Center</h3>
            <p className="text-slate-500 font-medium max-w-md text-center mb-8">
              The approval queue has been unified with the Agent Command Center for a more streamlined experience. Review and approve recommendations directly from the agent interface.
            </p>
            <Button 
              size="lg"
              className="h-12 px-8 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-md shadow-violet-500/20 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.set('tab', 'agents');
                window.history.replaceState(null, '', `/contigo-labs?${params.toString()}`);
                window.location.reload();
              }}
            >
              <Bot className="w-5 h-5 mr-2" />
              Go to Agent Command Center
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// AI-POWERED RFx TEMPLATE STUDIO
// ============================================================================

interface TemplateSection {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'question' | 'requirement' | 'pricing' | 'legal' | 'instruction';
  isRequired: boolean;
  order: number;
}

interface RFxTemplate {
  id: string;
  name: string;
  description: string;
  type: 'RFP' | 'RFQ' | 'RFI' | 'RFT';
  category: string;
  industry: string;
  sections: TemplateSection[];
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  avgSavings: number;
  isPublished: boolean;
  tags: string[];
  estimatedCompletionTime: string;
}

interface TemplateLibraryItem {
  id: string;
  name: string;
  description: string;
  type: 'RFP' | 'RFQ' | 'RFI' | 'RFT';
  category: string;
  industry: string;
  usageCount: number;
  avgSavings: number;
  tags: string[];
}

// AI Template Studio Main Component
function AITemplateStudio() {
  const [activeMode, setActiveMode] = useState<'library' | 'ai-generate' | 'upload' | 'builder' | 'preview'>('library');
  const [selectedTemplate, setSelectedTemplate] = useState<RFxTemplate | null>(null);
  const [templates, setTemplates] = useState<TemplateLibraryItem[]>([
    { id: '1', name: 'IT Services RFP', description: 'Comprehensive IT services request for proposal with technical requirements, SLAs, and pricing structures.', type: 'RFP', category: 'Technology', industry: 'IT', usageCount: 45, avgSavings: 18, tags: ['IT', 'Services', 'Technical'] },
    { id: '2', name: 'Software Licensing RFQ', description: 'Software license pricing request with volume discounts, maintenance terms, and renewal options.', type: 'RFQ', category: 'Software', industry: 'Technology', usageCount: 32, avgSavings: 22, tags: ['Software', 'Licensing', 'Pricing'] },
    { id: '3', name: 'Consulting Services RFI', description: 'Request for information to gather capabilities and approach from consulting firms.', type: 'RFI', category: 'Services', industry: 'Professional Services', usageCount: 28, avgSavings: 15, tags: ['Consulting', 'Services', 'Capabilities'] },
    { id: '4', name: 'Professional Services RFP', description: 'Professional services engagement with deliverables, timelines, and resource requirements.', type: 'RFP', category: 'Services', industry: 'Professional Services', usageCount: 38, avgSavings: 16, tags: ['Professional', 'Services', 'Engagement'] },
    { id: '5', name: 'Hardware Procurement RFQ', description: 'Hardware equipment pricing with warranty, support, and delivery terms.', type: 'RFQ', category: 'Hardware', industry: 'Technology', usageCount: 24, avgSavings: 12, tags: ['Hardware', 'Equipment', 'Procurement'] },
    { id: '6', name: 'Vendor Qualification RFI', description: 'Initial qualification questionnaire for new vendor onboarding.', type: 'RFI', category: 'General', industry: 'All', usageCount: 56, avgSavings: 0, tags: ['Vendor', 'Qualification', 'Onboarding'] },
    { id: '7', name: 'Cloud Services RFP', description: 'Cloud infrastructure and SaaS services request with security and compliance requirements.', type: 'RFP', category: 'Cloud', industry: 'Technology', usageCount: 41, avgSavings: 20, tags: ['Cloud', 'SaaS', 'Infrastructure'] },
    { id: '8', name: 'Marketing Services RFP', description: 'Marketing agency selection with campaign planning and performance metrics.', type: 'RFP', category: 'Marketing', industry: 'Marketing', usageCount: 19, avgSavings: 14, tags: ['Marketing', 'Agency', 'Campaign'] },
  ]);

  return (
    <div className="space-y-6">
      {/* Header with Mode Switcher */}
      <Card className="border-transparent shadow-md bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
                <Wand2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-slate-900">AI Template Studio</h3>
                <p className="text-sm text-muted-foreground mt-1">Generate, customize, and manage RFx templates with AI</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              <ModeButton 
                active={activeMode === 'library'} 
                onClick={() => setActiveMode('library')}
                icon={BookOpen}
                label="Library"
              />
              <ModeButton 
                active={activeMode === 'ai-generate'} 
                onClick={() => setActiveMode('ai-generate')}
                icon={Sparkles}
                label="AI Generate"
                highlight
              />
              <ModeButton 
                active={activeMode === 'upload'} 
                onClick={() => setActiveMode('upload')}
                icon={Upload}
                label="Import"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      {activeMode === 'library' && (
        <TemplateLibrary 
          templates={templates} 
          onSelect={(t) => { setSelectedTemplate(t as RFxTemplate); setActiveMode('preview'); }}
          onEdit={(t) => { setSelectedTemplate(t as RFxTemplate); setActiveMode('builder'); }}
        />
      )}
      {activeMode === 'ai-generate' && (
        <AITemplateGenerator 
          onGenerated={(t) => { setSelectedTemplate(t); setActiveMode('builder'); }}
          onPreview={(t) => { setSelectedTemplate(t); setActiveMode('preview'); }}
        />
      )}
      {activeMode === 'upload' && (
        <TemplateImporter 
          onImported={(t) => { setTemplates(prev => [t, ...prev]); setActiveMode('library'); }}
        />
      )}
      {activeMode === 'builder' && selectedTemplate && (
        <TemplateBuilder 
          template={selectedTemplate}
          onSave={(t) => { setSelectedTemplate(t); toast.success('Template saved'); }}
          onPreview={() => setActiveMode('preview')}
        />
      )}
      {activeMode === 'preview' && selectedTemplate && (
        <TemplatePreview 
          template={selectedTemplate}
          onEdit={() => setActiveMode('builder')}
          onUse={() => toast.success('Template applied to new RFx')}
        />
      )}
    </div>
  );
}

function ModeButton({ active, onClick, icon: Icon, label, highlight }: { active: boolean; onClick: () => void; icon: any; label: string; highlight?: boolean }) {
  return (
    <Button
      variant={active ? 'default' : 'ghost'}
      size="sm"
      onClick={onClick}
      className={cn(
        'gap-2 px-4 py-2 rounded-lg transition-all duration-300',
        active ? 'bg-violet-600 text-white shadow-md hover:bg-violet-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50',
        highlight && !active && 'text-violet-600 hover:text-violet-700 hover:bg-violet-50'
      )}
    >
      <Icon className={cn("w-4 h-4", highlight && !active && "text-violet-500")} />
      <span className="font-medium">{label}</span>
    </Button>
  );
}

// Template Library View
function TemplateLibrary({ templates, onSelect, onEdit }: { templates: TemplateLibraryItem[]; onSelect: (t: TemplateLibraryItem) => void; onEdit: (t: TemplateLibraryItem) => void }) {
  const [filter, setFilter] = useState({ type: 'all', category: 'all', search: '' });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredTemplates = templates.filter(t => {
    if (filter.type !== 'all' && t.type !== filter.type) return false;
    if (filter.category !== 'all' && t.category !== filter.category) return false;
    if (filter.search && !t.name.toLowerCase().includes(filter.search.toLowerCase()) && 
        !t.description.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  const categories = Array.from(new Set(templates.map(t => t.category)));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4 border-transparent shadow-sm bg-white">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search templates..." 
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-violet-500 transition-all"
              />
            </div>
          </div>
          <Select value={filter.type} onValueChange={(v) => setFilter({ ...filter, type: v })}>
            <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="RFP">RFP</SelectItem>
              <SelectItem value="RFQ">RFQ</SelectItem>
              <SelectItem value="RFI">RFI</SelectItem>
              <SelectItem value="RFT">RFT</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter.category} onValueChange={(v) => setFilter({ ...filter, category: v })}>
            <SelectTrigger className="w-[160px] bg-slate-50 border-slate-200">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
              size="icon" 
              className={cn("h-8 w-8 transition-all", viewMode === 'grid' ? "bg-white shadow-sm text-violet-700" : "text-slate-500 hover:text-slate-900")}
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="icon" 
              className={cn("h-8 w-8 transition-all", viewMode === 'list' ? "bg-white shadow-sm text-violet-700" : "text-slate-500 hover:text-slate-900")}
              onClick={() => setViewMode('list')}
            >
              <ListIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Templates Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.map(template => (
            <TemplateLibraryCard 
              key={template.id} 
              template={template} 
              onSelect={() => onSelect(template)}
              onEdit={() => onEdit(template)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <div className="divide-y">
            {filteredTemplates.map(template => (
              <TemplateLibraryRow 
                key={template.id} 
                template={template}
                onSelect={() => onSelect(template)}
                onEdit={() => onEdit(template)}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function TemplateLibraryCard({ template, onSelect, onEdit }: { template: TemplateLibraryItem; onSelect: () => void; onEdit: () => void }) {
  const typeColors = {
    RFP: 'bg-blue-100 text-blue-700 border-blue-200',
    RFQ: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    RFI: 'bg-amber-100 text-amber-700 border-amber-200',
    RFT: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  return (
    <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border-transparent hover:border-violet-200 bg-white hover:-translate-y-1">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <Badge className={cn('text-xs px-2.5 py-0.5 font-medium', typeColors[template.type])} variant="outline">
            {template.type}
          </Badge>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button size="icon" variant="ghost" aria-label="Edit template" className="h-8 w-8 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-full" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Edit3 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <h4 className="font-semibold text-base mb-2 line-clamp-1 text-slate-900 group-hover:text-violet-700 transition-colors" onClick={onSelect}>{template.name}</h4>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">{template.description}</p>
        <div className="flex items-center gap-2 mb-4">
          {template.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2.5 py-1 bg-slate-50 text-slate-600 text-[10px] font-medium rounded-md border border-slate-100">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-slate-100">
          <span className="flex items-center gap-1.5 font-medium">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            {template.usageCount} uses
          </span>
          {template.avgSavings > 0 && (
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-md">
              <TrendingUp className="w-3.5 h-3.5" />
              {template.avgSavings}% savings
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateLibraryRow({ template, onSelect, onEdit }: { template: TemplateLibraryItem; onSelect: () => void; onEdit: () => void }) {
  const typeColors = {
    RFP: 'bg-blue-100 text-blue-700 border-blue-200',
    RFQ: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    RFI: 'bg-amber-100 text-amber-700 border-amber-200',
    RFT: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-all duration-200 group border-b border-slate-100 last:border-0">
      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
        <FileText className="w-6 h-6 text-slate-400 group-hover:text-violet-500 transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <h4 className="font-semibold text-base text-slate-900 cursor-pointer hover:text-violet-700 transition-colors" onClick={onSelect}>{template.name}</h4>
          <Badge className={cn('text-[10px] px-2 py-0 font-medium', typeColors[template.type])} variant="outline">{template.type}</Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate">{template.description}</p>
      </div>
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-slate-400" />
          {template.category}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-slate-400" />
          {template.usageCount}
        </span>
        {template.avgSavings > 0 && (
          <span className="flex items-center gap-1.5 text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-md">
            <TrendingUp className="w-4 h-4" />
            {template.avgSavings}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
        <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-full" onClick={onSelect}>
          <Eye className="w-4.5 h-4.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-full" onClick={onEdit}>
          <Edit3 className="w-4.5 h-4.5" />
        </Button>
      </div>
    </div>
  );
}

// AI Template Generator
function AITemplateGenerator({ onGenerated, onPreview }: { onGenerated: (t: RFxTemplate) => void; onPreview: (t: RFxTemplate) => void }) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [config, setConfig] = useState({
    type: 'RFP',
    category: 'Technology',
    industry: 'IT',
    complexity: 'standard',
    includePricing: true,
    includeLegal: true,
    includeTechnical: true,
    estimatedValue: '',
    duration: '',
  });

  const generationSteps = [
    'Analyzing requirements...',
    'Selecting optimal structure...',
    'Generating sections...',
    'Adding compliance clauses...',
    'Finalizing template...',
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGenerationStep(0);

    try {
      // Step through UI indicators while waiting for AI
      const stepTimer = setInterval(() => {
        setGenerationStep(prev => Math.min(prev + 1, generationSteps.length - 1));
      }, 1200);

      // Call the real AI summarize endpoint to generate template content
      const aiPrompt = `Generate a detailed ${config.type} template for: ${prompt}. 
Category: ${config.category}. Industry: ${config.industry}. Complexity: ${config.complexity}.
${config.estimatedValue ? `Budget range: ${config.estimatedValue}.` : ''}
${config.duration ? `Timeline: ${config.duration}.` : ''}
Include sections for: introduction, scope of work, vendor qualifications${config.includeTechnical ? ', technical requirements' : ''}${config.includePricing ? ', pricing' : ''}${config.includeLegal ? ', legal terms' : ''}, and evaluation criteria.`;

      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractText: aiPrompt,
          level: 'detailed',
          options: { focus: 'template_generation' },
        }),
      });

      clearInterval(stepTimer);
      setGenerationStep(generationSteps.length - 1);

      let sections: TemplateSection[];
      if (res.ok) {
        const data = await res.json();
        const aiContent = data.data?.summary || data.summary || '';
        // Parse AI response into sections, or fall back to static generation
        const aiSections = aiContent.split(/\n(?=\d+\.\s)/).filter(Boolean);
        if (aiSections.length > 1) {
          sections = aiSections.map((section: string, idx: number) => {
            const titleMatch = section.match(/^(\d+\.?\s*)(.*?)(?:\n|$)/);
            return {
              id: `ai-${idx}`,
              title: titleMatch ? titleMatch[2].trim() : `Section ${idx + 1}`,
              content: titleMatch ? section.slice(titleMatch[0].length).trim() : section.trim(),
              type: section.toLowerCase().includes('pricing') ? 'pricing' as const : 
                    section.toLowerCase().includes('legal') ? 'legal' as const : 'text' as const,
              isRequired: true,
              order: idx + 1,
            };
          });
        } else {
          sections = generateSectionsFromPrompt(prompt, config);
        }
      } else {
        // Fallback to local generation
        sections = generateSectionsFromPrompt(prompt, config);
      }

      const generatedTemplate: RFxTemplate = {
        id: `ai-${Date.now()}`,
        name: `${config.type} - ${prompt.slice(0, 50)}...`,
        description: `AI-generated ${config.type} template based on: ${prompt}`,
        type: config.type as any,
        category: config.category,
        industry: config.industry,
        sections,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        avgSavings: 0,
        isPublished: false,
        tags: [config.category, config.industry, config.complexity],
        estimatedCompletionTime: config.duration || '2-4 weeks',
      };

      toast.success('Template generated successfully!');
      onGenerated(generatedTemplate);
    } catch (err) {
      console.error('Template generation failed:', err);
      toast.error('AI generation failed — using local template');
      // Fallback to local generation
      const generatedTemplate: RFxTemplate = {
        id: `ai-${Date.now()}`,
        name: `${config.type} - ${prompt.slice(0, 50)}...`,
        description: `AI-generated ${config.type} template based on: ${prompt}`,
        type: config.type as any,
        category: config.category,
        industry: config.industry,
        sections: generateSectionsFromPrompt(prompt, config),
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        avgSavings: 0,
        isPublished: false,
        tags: [config.category, config.industry, config.complexity],
        estimatedCompletionTime: config.duration || '2-4 weeks',
      };
      onGenerated(generatedTemplate);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Configuration Panel */}
        <Card className="lg:col-span-1 p-6 space-y-6 border-transparent shadow-sm bg-white">
          <h4 className="font-semibold flex items-center gap-2 text-slate-900">
            <Sliders className="w-4 h-4 text-violet-500" />
            Configuration
          </h4>
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">RFx Type</Label>
              <Select value={config.type} onValueChange={(v) => setConfig({ ...config, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RFP">Request for Proposal (RFP)</SelectItem>
                  <SelectItem value="RFQ">Request for Quotation (RFQ)</SelectItem>
                  <SelectItem value="RFI">Request for Information (RFI)</SelectItem>
                  <SelectItem value="RFT">Request for Tender (RFT)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={config.category} onValueChange={(v) => setConfig({ ...config, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Technology">Technology</SelectItem>
                  <SelectItem value="Services">Services</SelectItem>
                  <SelectItem value="Software">Software</SelectItem>
                  <SelectItem value="Hardware">Hardware</SelectItem>
                  <SelectItem value="Consulting">Consulting</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Facilities">Facilities</SelectItem>
                  <SelectItem value="Professional Services">Professional Services</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Industry</Label>
              <Select value={config.industry} onValueChange={(v) => setConfig({ ...config, industry: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IT">Information Technology</SelectItem>
                  <SelectItem value="Finance">Finance & Banking</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Government">Government</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                  <SelectItem value="Energy">Energy & Utilities</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Complexity</Label>
              <RadioGroup value={config.complexity} onValueChange={(v) => setConfig({ ...config, complexity: v })} className="flex gap-2">
                {['basic', 'standard', 'complex'].map((level) => (
                  <div key={level} className="flex items-center space-x-1">
                    <RadioGroupItem value={level} id={level} className="peer sr-only" />
                    <Label 
                      htmlFor={level}
                      className="px-3 py-1.5 text-xs border rounded-md cursor-pointer peer-data-[state=checked]:bg-violet-100 peer-data-[state=checked]:border-violet-500 peer-data-[state=checked]:text-violet-700 capitalize"
                    >
                      {level}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Include Sections</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Pricing & Commercial</span>
                  <Switch checked={config.includePricing} onCheckedChange={(v) => setConfig({ ...config, includePricing: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Legal & Compliance</span>
                  <Switch checked={config.includeLegal} onCheckedChange={(v) => setConfig({ ...config, includeLegal: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Technical Requirements</span>
                  <Switch checked={config.includeTechnical} onCheckedChange={(v) => setConfig({ ...config, includeTechnical: v })} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Estimated Contract Value</Label>
              <Input 
                placeholder="e.g., $100,000 - $500,000" 
                value={config.estimatedValue}
                onChange={(e) => setConfig({ ...config, estimatedValue: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Project Duration</Label>
              <Input 
                placeholder="e.g., 6-12 months" 
                value={config.duration}
                onChange={(e) => setConfig({ ...config, duration: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Prompt & Generation Panel */}
        <Card className="lg:col-span-2 p-6 border-transparent shadow-sm bg-white">
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold flex items-center gap-2 mb-2 text-slate-900">
                <Sparkles className="w-5 h-5 text-violet-500" />
                Describe Your Requirements
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tell the AI what you need. Be specific about scope, deliverables, vendor qualifications, and evaluation criteria.
              </p>
            </div>

            <Textarea
              placeholder="Example: I need an RFP for cloud migration services to move our on-premise infrastructure to AWS. The project should include assessment, migration planning, execution, and post-migration support. We're looking for vendors with AWS Premier Partner status and at least 5 similar enterprise migrations completed. Budget is $500K-$1M over 12 months..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[240px] resize-none bg-slate-50 border-slate-200 focus-visible:ring-violet-500 p-4 text-base leading-relaxed"
            />

            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-xs font-medium text-slate-500 py-1.5 uppercase tracking-wider">Quick prompts:</span>
              {[
                'IT outsourcing services',
                'Software development project',
                'Marketing agency selection',
                'Office renovation',
                'Cybersecurity audit',
                'Data analytics platform',
              ].map((quickPrompt) => (
                <button
                  key={quickPrompt}
                  onClick={() => setPrompt(`Create an RFP for ${quickPrompt} with comprehensive requirements, evaluation criteria, and pricing structure.`)}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-violet-100 hover:text-violet-700 rounded-full transition-all duration-200 border border-transparent hover:border-violet-200"
                >
                  {quickPrompt}
                </button>
              ))}
            </div>

            {/* Generation Progress */}
            {isGenerating && (
              <div className="space-y-4 p-6 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-100 shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-full shadow-sm">
                    <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
                  </div>
                  <span className="text-base font-semibold text-violet-900">
                    {generationSteps[generationStep]}
                  </span>
                </div>
                <Progress value={((generationStep + 1) / generationSteps.length) * 100} className="h-2.5 bg-violet-200/50" />
                <div className="flex justify-between text-sm font-medium text-violet-700">
                  <span>Step {generationStep + 1} of {generationSteps.length}</span>
                  <span>{Math.round(((generationStep + 1) / generationSteps.length) * 100)}%</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <div className="text-sm text-muted-foreground flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg">
                <Info className="w-4 h-4 text-blue-500" />
                AI will generate a comprehensive template with sections, questions, and evaluation criteria
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setPrompt('')} disabled={isGenerating} className="hover:bg-slate-100">
                  Clear
                </Button>
                <Button 
                  onClick={handleGenerate} 
                  disabled={!prompt.trim() || isGenerating}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-300 px-6"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Template
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Example Templates */}
      <Card className="p-6 border-transparent shadow-sm bg-white">
        <h4 className="font-semibold mb-6 flex items-center gap-2 text-slate-900 text-lg">
          <BookOpen className="w-5 h-5 text-blue-500" />
          Example Templates You Can Generate
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Enterprise SaaS Platform', desc: 'RFP for multi-tenant SaaS solution', type: 'RFP' },
            { title: 'Managed IT Services', desc: 'Comprehensive IT support & maintenance', type: 'RFP' },
            { title: 'Hardware Procurement', desc: 'Laptops, servers, networking gear', type: 'RFQ' },
            { title: 'Strategy Consulting', desc: 'Digital transformation advisory', type: 'RFI' },
          ].map((example, i) => (
            <Card key={i} className="p-5 hover:border-violet-300 hover:shadow-md cursor-pointer transition-all duration-300 group bg-slate-50/50 hover:bg-white" onClick={() => setPrompt(`Create a detailed ${example.type} for ${example.title}: ${example.desc}. Include vendor qualifications, deliverables, timeline, and evaluation criteria.`)}>
              <Badge className="mb-3 bg-white shadow-sm" variant="outline">{example.type}</Badge>
              <h5 className="font-semibold text-base text-slate-900 group-hover:text-violet-700 transition-colors mb-1">{example.title}</h5>
              <p className="text-sm text-muted-foreground leading-relaxed">{example.desc}</p>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Helper function to generate sections based on prompt and config
function generateSectionsFromPrompt(prompt: string, config: any): TemplateSection[] {
  const sections: TemplateSection[] = [
    {
      id: 'intro',
      title: '1. Introduction & Overview',
      content: `This ${config.type} is issued to solicit ${config.complexity} proposals from qualified vendors for the procurement of ${config.category} services/products as described herein.`,
      type: 'text',
      isRequired: true,
      order: 1,
    },
    {
      id: 'scope',
      title: '2. Scope of Work',
      content: `Vendors are expected to provide comprehensive ${config.category} solutions that meet the requirements outlined in this document. The scope includes all necessary activities, deliverables, and support services.`,
      type: 'requirement',
      isRequired: true,
      order: 2,
    },
    {
      id: 'vendor-qualifications',
      title: '3. Vendor Qualifications',
      content: 'Vendors must demonstrate relevant experience, financial stability, and technical capabilities. Please provide company profile, references, certifications, and case studies.',
      type: 'question',
      isRequired: true,
      order: 3,
    },
  ];

  if (config.includeTechnical) {
    sections.push({
      id: 'technical',
      title: '4. Technical Requirements',
      content: 'Describe your technical approach, architecture, security measures, integration capabilities, and scalability options. Include detailed specifications and compliance certifications.',
      type: 'requirement',
      isRequired: true,
      order: 4,
    });
  }

  if (config.includePricing) {
    sections.push({
      id: 'pricing',
      title: config.includeTechnical ? '5. Pricing & Commercial Terms' : '4. Pricing & Commercial Terms',
      content: `Provide detailed pricing breakdown including: unit costs, volume discounts, implementation fees, ongoing support costs, and payment terms. ${config.estimatedValue ? `Budget range: ${config.estimatedValue}` : ''}`,
      type: 'pricing',
      isRequired: true,
      order: config.includeTechnical ? 5 : 4,
    });
  }

  if (config.includeLegal) {
    sections.push({
      id: 'legal',
      title: `6. Legal & Compliance`,
      content: 'This section includes standard terms and conditions, confidentiality requirements, data protection clauses, insurance requirements, and compliance certifications required.',
      type: 'legal',
      isRequired: true,
      order: 6,
    });
  }

  sections.push({
    id: 'evaluation',
    title: `${sections.length + 1}. Evaluation Criteria`,
    content: 'Proposals will be evaluated based on: technical capability (40%), commercial competitiveness (30%), vendor experience (20%), and implementation approach (10%).',
    type: 'instruction',
    isRequired: true,
    order: sections.length + 1,
  });

  return sections;
}

// Template Importer Component
function TemplateImporter({ onImported }: { onImported: (t: TemplateLibraryItem) => void }) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedTemplate, setParsedTemplate] = useState<RFxTemplate | null>(null);
  const [importMethod, setImportMethod] = useState<'upload' | 'paste' | 'url'>('upload');
  const [pasteContent, setPasteContent] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      parseTemplate(file);
    }
  };

  const parseTemplate = async (file: File) => {
    setIsParsing(true);
    try {
      // Read file content as text
      const fileText = await file.text();
      
      // Call AI extract endpoint to parse the document
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fileText, focus: 'template_structure' }),
      });

      if (res.ok) {
        const data = await res.json();
        const extracted = data.data || data;
        
        // Map extracted data to template structure
        const sections: TemplateSection[] = (extracted.sections || extracted.clauses || []).map((s: any, idx: number) => ({
          id: `${idx + 1}`,
          title: s.title || s.heading || `Section ${idx + 1}`,
          content: s.content || s.text || s.description || '',
          type: s.type === 'pricing' ? 'pricing' : s.type === 'legal' ? 'legal' : 'text',
          isRequired: true,
          order: idx + 1,
        }));

        // Fallback: if AI didn't return sections, create one from full text
        if (sections.length === 0) {
          sections.push({
            id: '1',
            title: 'Imported Content',
            content: fileText.slice(0, 5000),
            type: 'text',
            isRequired: true,
            order: 1,
          });
        }

        const parsed: RFxTemplate = {
          id: `imported-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          description: extracted.summary || 'Imported from uploaded document',
          type: (extracted.type as any) || 'RFP',
          category: extracted.category || 'Imported',
          industry: extracted.industry || 'General',
          sections,
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0,
          avgSavings: 0,
          isPublished: false,
          tags: ['imported', ...(extracted.tags || [])],
          estimatedCompletionTime: extracted.estimatedCompletionTime || 'TBD',
        };

        setParsedTemplate(parsed);
        toast.success('Template parsed successfully');
      } else {
        toast.error('Failed to parse template — try again');
      }
    } catch (err) {
      console.error('Template parsing failed:', err);
      toast.error('Error parsing template');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = () => {
    if (parsedTemplate) {
      const libraryItem: TemplateLibraryItem = {
        id: parsedTemplate.id,
        name: parsedTemplate.name,
        description: parsedTemplate.description,
        type: parsedTemplate.type,
        category: parsedTemplate.category,
        industry: parsedTemplate.industry,
        usageCount: 0,
        avgSavings: 0,
        tags: parsedTemplate.tags,
      };
      onImported(libraryItem);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="p-8 border-transparent shadow-md bg-white">
        <div className="space-y-8">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Upload className="w-10 h-10 text-violet-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">Import Existing Template</h3>
            <p className="text-base text-muted-foreground mt-2 max-w-lg mx-auto">
              Upload a document, paste content, or provide a URL to import your existing RFx template and let AI structure it for you.
            </p>
          </div>

          <Tabs value={importMethod} onValueChange={(v) => setImportMethod(v as any)} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 bg-slate-100 p-1 rounded-xl">
              <TabsTrigger value="upload" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Upload File</TabsTrigger>
              <TabsTrigger value="paste" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Paste Text</TabsTrigger>
              <TabsTrigger value="url" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">From URL</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-8">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-violet-400 hover:bg-violet-50/50 transition-all duration-300 group">
                <input
                  type="file"
                  accept=".doc,.docx,.pdf,.txt,.rtf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="template-upload"
                />
                <label htmlFor="template-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                    <FolderOpen className="w-8 h-8 text-slate-400 group-hover:text-violet-500 transition-colors" />
                  </div>
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supported formats: DOC, DOCX, PDF, TXT, RTF (max 10MB)
                  </p>
                </label>
              </div>
            </TabsContent>

            <TabsContent value="paste" className="mt-6">
              <Textarea
                placeholder="Paste your template content here..."
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                className="min-h-[300px]"
              />
              <Button 
                className="mt-4 w-full" 
                disabled={!pasteContent.trim()}
                onClick={() => parseTemplate(new File([pasteContent], 'pasted-template.txt', { type: 'text/plain' }))}
              >
                Parse Content
              </Button>
            </TabsContent>

            <TabsContent value="url" className="mt-6">
              <div className="space-y-4">
                <Input placeholder="https://example.com/template.pdf" />
                <Button className="w-full">Fetch Template</Button>
              </div>
            </TabsContent>
          </Tabs>

          {isParsing && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-violet-600" />
              <p className="text-sm text-muted-foreground">AI is analyzing and structuring your template...</p>
            </div>
          )}

          {parsedTemplate && !isParsing && (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Template Parsed Successfully</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{parsedTemplate.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sections Found:</span>
                  <p className="font-medium">{parsedTemplate.sections.length}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <p className="font-medium">{parsedTemplate.type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <p className="font-medium">{parsedTemplate.category}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setParsedTemplate(null)}>
                  Start Over
                </Button>
                <Button className="flex-1" onClick={handleImport}>
                  <Check className="w-4 h-4 mr-2" />
                  Import to Library
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 border-transparent shadow-sm bg-white">
        <h4 className="font-semibold mb-6 text-slate-900 text-lg">Supported Import Sources</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 shadow-sm">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h5 className="font-semibold text-slate-900 mb-1">Microsoft Word</h5>
              <p className="text-sm text-muted-foreground leading-relaxed">DOC and DOCX files with full formatting preservation</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 shadow-sm">
              <FileText className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h5 className="font-semibold text-slate-900 mb-1">PDF Documents</h5>
              <p className="text-sm text-muted-foreground leading-relaxed">Scanned and text-based PDF files</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 shadow-sm">
              <FileCode className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h5 className="font-semibold text-slate-900 mb-1">Plain Text</h5>
              <p className="text-sm text-muted-foreground leading-relaxed">TXT, RTF, and other text formats</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Template Builder Component
function TemplateBuilder({ template, onSave, onPreview }: { template: RFxTemplate; onSave: (t: RFxTemplate) => void; onPreview: () => void }) {
  const [localTemplate, setLocalTemplate] = useState<RFxTemplate>(template);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionType, setNewSectionType] = useState<TemplateSection['type']>('text');

  const updateSection = (sectionId: string, updates: Partial<TemplateSection>) => {
    setLocalTemplate(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s),
    }));
  };

  const addSection = () => {
    const newSection: TemplateSection = {
      id: `section-${Date.now()}`,
      title: 'New Section',
      content: '',
      type: newSectionType,
      isRequired: true,
      order: localTemplate.sections.length + 1,
    };
    setLocalTemplate(prev => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setIsAddingSection(false);
    setActiveSection(newSection.id);
  };

  const removeSection = (sectionId: string) => {
    setLocalTemplate(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId),
    }));
    if (activeSection === sectionId) setActiveSection(null);
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const index = localTemplate.sections.findIndex(s => s.id === sectionId);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === localTemplate.sections.length - 1) return;

    const newSections = [...localTemplate.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    
    setLocalTemplate(prev => ({
      ...prev,
      sections: newSections.map((s, i) => ({ ...s, order: i + 1 })),
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-400px)]">
      {/* Sidebar - Section List */}
      <Card className="lg:col-span-1 overflow-hidden flex flex-col border-transparent shadow-sm bg-white">
        <CardHeader className="border-b border-slate-100 p-5 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">Template Sections</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setIsAddingSection(true)} className="h-8 gap-1.5 bg-white hover:bg-slate-50 hover:text-violet-600 border-slate-200">
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1.5">
            {localTemplate.sections.map((section, index) => (
              <div
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 group border',
                  activeSection === section.id 
                    ? 'bg-violet-50 border-violet-200 text-violet-900 shadow-sm' 
                    : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                )}
              >
                <GripVertical className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
                <span className={cn(
                  "text-xs font-mono w-6 h-6 flex items-center justify-center rounded-md",
                  activeSection === section.id ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"
                )}>{section.order}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    activeSection === section.id ? "text-violet-900" : "text-slate-700 group-hover:text-slate-900"
                  )}>{section.title}</p>
                  <p className="text-xs text-slate-500 capitalize mt-0.5">{section.type}</p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md" 
                    disabled={index === 0}
                    onClick={(e) => { e.stopPropagation(); moveSection(section.id, 'up'); }}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md" 
                    disabled={index === localTemplate.sections.length - 1}
                    onClick={(e) => { e.stopPropagation(); moveSection(section.id, 'down'); }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md ml-1"
                    onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-3">
          <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" onClick={() => onSave(localTemplate)}>
            <Save className="w-4 h-4 mr-2" />
            Save Template
          </Button>
          <Button variant="outline" className="w-full bg-white hover:bg-slate-50 border-slate-200 text-slate-700 transition-all duration-200" onClick={onPreview}>
            <Eye className="w-4 h-4 mr-2" />
            Preview Template
          </Button>
        </div>
      </Card>

      {/* Main Editor */}
      <Card className="lg:col-span-2 overflow-hidden flex flex-col border-transparent shadow-sm bg-white">
        {activeSection ? (
          <>
            <CardHeader className="border-b border-slate-100 p-5 bg-slate-50/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Input
                    value={localTemplate.sections.find(s => s.id === activeSection)?.title || ''}
                    onChange={(e) => updateSection(activeSection, { title: e.target.value })}
                    className="font-semibold text-xl border-transparent bg-transparent px-2 hover:bg-white focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 transition-all duration-200"
                    placeholder="Enter section title..."
                  />
                </div>
                <div className="flex items-center gap-4 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm">
                  <Select 
                    value={localTemplate.sections.find(s => s.id === activeSection)?.type}
                    onValueChange={(v) => updateSection(activeSection, { type: v as any })}
                  >
                    <SelectTrigger className="w-[150px] border-transparent bg-transparent hover:bg-slate-50 focus:ring-0 focus:ring-offset-0">
                      <SelectValue placeholder="Section Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text / Info</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="requirement">Requirement</SelectItem>
                      <SelectItem value="pricing">Pricing</SelectItem>
                      <SelectItem value="legal">Legal</SelectItem>
                      <SelectItem value="instruction">Instruction</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="w-px h-6 bg-slate-200 mx-1" />
                  <div className="flex items-center gap-2.5 pr-3 pl-1">
                    <Switch
                      checked={localTemplate.sections.find(s => s.id === activeSection)?.isRequired}
                      onCheckedChange={(v) => updateSection(activeSection, { isRequired: v })}
                      className="data-[state=checked]:bg-violet-600"
                    />
                    <Label className="text-sm font-medium text-slate-700 cursor-pointer">Required</Label>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 bg-slate-50/30">
              <Textarea
                value={localTemplate.sections.find(s => s.id === activeSection)?.content || ''}
                onChange={(e) => updateSection(activeSection, { content: e.target.value })}
                className="min-h-full h-full resize-none border-0 rounded-none focus-visible:ring-0 p-6 text-base leading-relaxed text-slate-700 bg-transparent placeholder:text-slate-400"
                placeholder="Start typing your section content here..."
              />
            </CardContent>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50/50">
            <div className="text-center max-w-sm mx-auto p-8">
              <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-6">
                <LayoutTemplate className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Section Selected</h3>
              <p className="text-slate-500 leading-relaxed">
                Select a section from the sidebar to edit its content, or click the "Add" button to create a new section.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Add Section Dialog */}
      <Dialog open={isAddingSection} onOpenChange={setIsAddingSection}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-transparent shadow-xl">
          <DialogHeader className="p-6 pb-4 bg-slate-50/50 border-b border-slate-100">
            <DialogTitle className="text-xl font-semibold text-slate-900">Add New Section</DialogTitle>
            <DialogDescription className="text-slate-500">Choose the type of section you want to add to your template</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 p-6 bg-white">
            {[
              { type: 'text', label: 'Text / Information', desc: 'Descriptive text or context', icon: Type },
              { type: 'question', label: 'Question', desc: 'Vendor question to answer', icon: HelpCircle },
              { type: 'requirement', label: 'Requirement', desc: 'Mandatory requirement or specification', icon: CheckCircle },
              { type: 'pricing', label: 'Pricing', desc: 'Cost, pricing, or commercial terms', icon: DollarSign },
              { type: 'legal', label: 'Legal', desc: 'Legal terms, compliance, or clauses', icon: Scale },
              { type: 'instruction', label: 'Instruction', desc: 'Guidance or directions', icon: Info },
            ].map((option) => (
              <button
                key={option.type}
                onClick={() => setNewSectionType(option.type as any)}
                className={cn(
                  'flex flex-col items-start gap-3 p-5 rounded-xl border-2 transition-all duration-200 text-left group',
                  newSectionType === option.type 
                    ? 'border-violet-600 bg-violet-50/50 shadow-sm' 
                    : 'border-slate-100 hover:border-violet-200 hover:bg-slate-50'
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  newSectionType === option.type ? "bg-violet-100" : "bg-slate-100 group-hover:bg-violet-100/50"
                )}>
                  <option.icon className={cn('w-5 h-5', newSectionType === option.type ? 'text-violet-600' : 'text-slate-500 group-hover:text-violet-500')} />
                </div>
                <div>
                  <p className={cn("font-semibold text-sm mb-1", newSectionType === option.type ? "text-violet-900" : "text-slate-900")}>{option.label}</p>
                  <p className={cn("text-xs leading-relaxed", newSectionType === option.type ? "text-violet-700/80" : "text-slate-500")}>{option.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter className="p-6 pt-4 bg-slate-50/50 border-t border-slate-100">
            <Button variant="outline" onClick={() => setIsAddingSection(false)} className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700">Cancel</Button>
            <Button onClick={addSection} className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm">Add Section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Template Preview Component
function TemplatePreview({ template, onEdit, onUse }: { template: RFxTemplate; onEdit: () => void; onUse: () => void }) {
  const [showAsPDF, setShowAsPDF] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <Card className="p-6 border-transparent shadow-sm bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20 flex-shrink-0">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-slate-900 mb-1">{template.name}</h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">{template.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onEdit} className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 transition-all duration-200">
              <Edit3 className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" onClick={() => toast.info('Export functionality coming soon')} className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 transition-all duration-200">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button onClick={onUse} className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <Check className="w-4 h-4 mr-2" />
              Use Template
            </Button>
          </div>
        </div>

        <Separator className="my-6 bg-slate-100" />

        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-violet-100 text-violet-700 hover:bg-violet-200 border-transparent px-3 py-1 capitalize">{template.type}</Badge>
            <span className="text-slate-500 font-medium">Type</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-slate-900">{template.category}</span>
            <span className="text-slate-500">Category</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-slate-900">{template.industry}</span>
            <span className="text-slate-500">Industry</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-slate-900">{template.sections.length}</span>
            <span className="text-slate-500">Sections</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-900">{template.estimatedCompletionTime}</span>
            <span className="text-slate-500">Est. Time</span>
          </div>
        </div>
      </Card>

      {/* Preview Toggle */}
      <div className="flex items-center justify-center gap-4 bg-white p-2 rounded-full shadow-sm border border-slate-100 w-fit mx-auto">
        <span className={cn('text-sm px-4 py-1.5 rounded-full transition-all duration-200', !showAsPDF ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-500')}>Formatted View</span>
        <Switch checked={showAsPDF} onCheckedChange={setShowAsPDF} className="data-[state=checked]:bg-violet-600" />
        <span className={cn('text-sm px-4 py-1.5 rounded-full transition-all duration-200', showAsPDF ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-500')}>Document View</span>
      </div>

      {/* Template Content */}
      <Card className={cn('p-8 border-transparent shadow-sm transition-all duration-300', showAsPDF ? 'bg-white shadow-xl max-w-4xl mx-auto ring-1 ring-slate-200/50' : 'bg-slate-50/50')}>
        {showAsPDF ? (
          <div className="space-y-10">
            {/* Cover Page */}
            <div className="text-center py-16 border-b-2 border-slate-100">
              <h1 className="text-4xl font-bold mb-6 text-slate-900 tracking-tight">{template.type} Template</h1>
              <h2 className="text-2xl text-slate-600 font-medium">{template.name}</h2>
              <p className="text-sm text-slate-400 mt-12 font-mono">{new Date().toLocaleDateString()}</p>
            </div>

            {/* Table of Contents */}
            <div className="py-8 px-4">
              <h3 className="text-xl font-bold mb-6 text-slate-900">Table of Contents</h3>
              <div className="space-y-3">
                {template.sections.map((section) => (
                  <div key={section.id} className="flex justify-between items-center group">
                    <span className="text-slate-700 font-medium group-hover:text-violet-600 transition-colors">{section.title}</span>
                    <div className="flex-1 border-b border-dashed border-slate-300 mx-4 opacity-50"></div>
                    <span className="text-slate-400 font-mono">{section.order}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-12 px-4">
              {template.sections.map((section) => (
                <div key={section.id} className="py-8 border-t border-slate-100">
                  <h3 className="text-2xl font-bold mb-6 text-slate-900">{section.order}. {section.title}</h3>
                  <div className="text-slate-700 whitespace-pre-wrap leading-relaxed text-lg">{section.content}</div>
                  {section.isRequired && (
                    <p className="text-sm text-red-500 mt-4 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      Required Section
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Accordion type="multiple" defaultValue={template.sections.map(s => s.id)} className="space-y-4">
              {template.sections.map((section) => (
                <AccordionItem key={section.id} value={section.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm data-[state=open]:border-violet-200 data-[state=open]:shadow-md transition-all duration-200">
                  <AccordionTrigger className="hover:no-underline px-6 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4 text-left">
                      <span className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center text-sm font-bold shadow-sm border border-violet-100/50">
                        {section.order}
                      </span>
                      <div>
                        <span className="font-semibold text-lg text-slate-900">{section.title}</span>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 border-transparent capitalize">{section.type}</Badge>
                          {section.isRequired && <Badge variant="secondary" className="text-xs bg-red-50 text-red-600 hover:bg-red-100 border-transparent">Required</Badge>}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 pt-2">
                    <div className="pl-14 text-slate-600 whitespace-pre-wrap leading-relaxed text-base">
                      {section.content}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </Card>
    </div>
  );
}

function RFxStudioView() {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [rfxEvents, setRfxEvents] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'opportunities' | 'events' | 'templates' | 'vendors' | 'analytics'>('opportunities');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [filterAlgorithm, setFilterAlgorithm] = useState<string>('all');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fallback data used only when API calls return empty
  const fallbackRfxEvents = [
    { id: 'rfx-1', title: 'IT Infrastructure Services 2024', type: 'RFP', status: 'active', vendors: 5, bids: 3, deadline: '2024-03-15', value: 250000, savings: 15 },
    { id: 'rfx-2', title: 'Software Licensing Renewal', type: 'RFQ', status: 'evaluating', vendors: 3, bids: 3, deadline: '2024-02-28', value: 120000, savings: 22 },
    { id: 'rfx-3', title: 'Consulting Services - Data Migration', type: 'RFP', status: 'draft', vendors: 0, bids: 0, deadline: '2024-04-01', value: 80000, savings: 0 },
    { id: 'rfx-4', title: 'Office Supplies - Q1 2024', type: 'RFQ', status: 'completed', vendors: 4, bids: 4, deadline: '2024-01-15', value: 45000, savings: 18 },
    { id: 'rfx-5', title: 'Marketing Agency Selection', type: 'RFP', status: 'awarded', vendors: 6, bids: 5, deadline: '2024-02-01', value: 200000, savings: 12 },
  ];

  useEffect(() => {
    Promise.all([
      fetch('/api/agents/rfx-opportunities').then(res => res.json()).catch(() => ({ opportunities: [] })),
      fetch('/api/rfx').then(res => res.json()).catch(() => ({ data: { events: [] } })),
      fetch('/api/analytics/suppliers?timeframe=12months').then(res => res.ok ? res.json() : null).catch(() => null),
    ])
      .then(([oppData, rfxData, supplierData]) => {
        setOpportunities(oppData.opportunities || []);
        const rfxItems = rfxData.data?.events || rfxData.events || [];
        setRfxEvents(rfxItems.length > 0 ? rfxItems : fallbackRfxEvents);

        // Map supplier API data to vendor format
        if (supplierData?.suppliers && supplierData.suppliers.length > 0) {
          const mappedVendors = supplierData.suppliers.map((s: any, idx: number) => ({
            id: s.id || `v-${idx + 1}`,
            name: s.name || s.supplierName || 'Unknown Supplier',
            rating: s.rating ?? s.performanceScore ?? 4.0,
            completedRFx: s.completedRFx ?? s.contractCount ?? 0,
            avgSavings: s.avgSavings ?? s.savingsPercent ?? 0,
            responseRate: s.responseRate ?? 90,
            status: s.status || (s.rating >= 4.5 ? 'preferred' : 'active'),
          }));
          setVendors(mappedVendors);
        } else {
          // Fallback vendors when API returns empty
          setVendors([
            { id: 'v-1', name: 'TechCorp Solutions', rating: 4.8, completedRFx: 12, avgSavings: 18, responseRate: 95, status: 'preferred' },
            { id: 'v-2', name: 'InnovateSoft', rating: 4.5, completedRFx: 8, avgSavings: 15, responseRate: 88, status: 'active' },
            { id: 'v-3', name: 'DataFlow Systems', rating: 4.9, completedRFx: 15, avgSavings: 22, responseRate: 98, status: 'preferred' },
            { id: 'v-4', name: 'CloudFirst Consulting', rating: 4.2, completedRFx: 5, avgSavings: 12, responseRate: 75, status: 'active' },
            { id: 'v-5', name: 'SecureNet Services', rating: 4.7, completedRFx: 10, avgSavings: 20, responseRate: 92, status: 'preferred' },
          ]);
        }
        setLoading(false);
      })
      .catch(() => {
        setRfxEvents(fallbackRfxEvents);
        setVendors([
          { id: 'v-1', name: 'TechCorp Solutions', rating: 4.8, completedRFx: 12, avgSavings: 18, responseRate: 95, status: 'preferred' },
          { id: 'v-2', name: 'InnovateSoft', rating: 4.5, completedRFx: 8, avgSavings: 15, responseRate: 88, status: 'active' },
          { id: 'v-3', name: 'DataFlow Systems', rating: 4.9, completedRFx: 15, avgSavings: 22, responseRate: 98, status: 'preferred' },
        ]);
        setLoading(false);
      });
  }, []);

  const runDetection = async () => {
    toast.loading('Scout is scanning for opportunities...');
    try {
      const res = await fetch('/api/agents/rfx-opportunities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'detect' }) });
      const data = await res.json();
      setOpportunities(data.opportunities || []);
      toast.success(`Found ${data.opportunities?.length || 0} opportunities`);
    } catch (error) {
      toast.error('Detection failed');
    }
  };

  const filteredOpportunities = opportunities.filter(opp => {
    if (filterAlgorithm !== 'all' && opp.algorithm !== filterAlgorithm) return false;
    if (filterUrgency !== 'all' && opp.urgency !== filterUrgency) return false;
    if (searchQuery && !opp.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalSavings = rfxEvents.reduce((sum, e) => sum + (e.savings || 0), 0);
  const totalValue = rfxEvents.reduce((sum, e) => sum + (e.value || 0), 0);

  return (
    <div className="space-y-8">
      {/* Enhanced RFx Studio Header */}
      <Card className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white border-0 shadow-lg shadow-violet-500/20 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>
        <CardContent className="p-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shadow-inner border border-white/20">
                <Gavel className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold tracking-tight mb-1">RFx Studio</h2>
                <p className="text-violet-100 text-lg font-medium">AI-powered sourcing & procurement platform</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="secondary" onClick={runDetection} className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm transition-all duration-200">
                <Target className="w-4 h-4 mr-2" />
                Scout Opportunities
              </Button>
              <Button className="bg-white text-violet-600 hover:bg-slate-50 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New RFx
              </Button>
            </div>
          </div>

          {/* Enhanced Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
            <StatBadgeWhite icon={Target} label="Opportunities" value={opportunities.length} />
            <StatBadgeWhite icon={Gavel} label="Active RFx" value={rfxEvents.filter((e: any) => e.status === 'active').length} />
            <StatBadgeWhite icon={CheckCircle} label="Completed" value={rfxEvents.filter((e: any) => e.status === 'completed').length} />
            <StatBadgeWhite icon={Users} label="Vendors" value={vendors.length} />
            <StatBadgeWhite icon={TrendingUp} label="Savings" value={`${totalSavings}%`} />
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Sub-tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <TabButton active={activeTab === 'opportunities'} onClick={() => setActiveTab('opportunities')} icon={Target} label="Scout" count={opportunities.length} />
          <TabButton active={activeTab === 'events'} onClick={() => setActiveTab('events')} icon={Gavel} label="My RFx" count={rfxEvents.length} />
          <TabButton active={activeTab === 'templates'} onClick={() => setActiveTab('templates')} icon={BookOpen} label="Templates" />
          <TabButton active={activeTab === 'vendors'} onClick={() => setActiveTab('vendors')} icon={Users} label="Vendors" count={vendors.length} />
          <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={BarChart3} label="Analytics" />
        </div>
        
        {/* Quick Export */}
        <Button variant="outline" size="sm" onClick={() => toast.success('Export started')} className="hidden md:flex bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm transition-all duration-200">
          <ExternalLink className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Opportunities Tab with Filters */}
      {activeTab === 'opportunities' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Filter Bar */}
          <Card className="p-4 border-transparent shadow-sm bg-white">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 w-full relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Search opportunities by title or keyword..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 bg-slate-50/50 border-slate-200 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 transition-all duration-200"
                />
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <select 
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 text-slate-700 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all duration-200 w-full md:w-auto font-medium"
                  value={filterAlgorithm}
                  onChange={(e) => setFilterAlgorithm(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="expiration">Expiration</option>
                  <option value="savings">Savings</option>
                  <option value="performance">Performance</option>
                  <option value="consolidation">Consolidation</option>
                </select>
                <select 
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/50 text-slate-700 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all duration-200 w-full md:w-auto font-medium"
                  value={filterUrgency}
                  onChange={(e) => setFilterUrgency(e.target.value)}
                >
                  <option value="all">All Urgency</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </Card>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="animate-pulse h-56 bg-slate-100/50 border-transparent rounded-2xl" />
              ))}
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <EmptyState 
              icon={Target} 
              title="No opportunities found"
              description="Scout continuously monitors your contract portfolio for new sourcing opportunities."
              action={{ label: 'Run Detection Now', onClick: runDetection }}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredOpportunities.map((opp: any) => (
                <OpportunityCardEnhanced 
                  key={opp.id} 
                  opportunity={opp} 
                  onCreateRFx={() => setShowCreateModal(true)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Events Tab with Timeline */}
      {activeTab === 'events' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Timeline Summary */}
          <Card className="p-6 bg-white border-transparent shadow-sm">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center justify-between w-full md:w-auto gap-8">
                <div className="text-center group cursor-pointer">
                  <p className="text-3xl font-bold text-slate-400 group-hover:text-slate-600 transition-colors">{rfxEvents.filter((e: any) => e.status === 'draft').length}</p>
                  <p className="text-sm font-medium text-slate-500 mt-1">Draft</p>
                </div>
                <div className="h-12 w-px bg-slate-200" />
                <div className="text-center group cursor-pointer">
                  <p className="text-3xl font-bold text-blue-600 group-hover:text-blue-700 transition-colors">{rfxEvents.filter((e: any) => e.status === 'active').length}</p>
                  <p className="text-sm font-medium text-slate-500 mt-1">Active</p>
                </div>
                <div className="h-12 w-px bg-slate-200" />
                <div className="text-center group cursor-pointer">
                  <p className="text-3xl font-bold text-amber-500 group-hover:text-amber-600 transition-colors">{rfxEvents.filter((e: any) => e.status === 'evaluating').length}</p>
                  <p className="text-sm font-medium text-slate-500 mt-1">Evaluating</p>
                </div>
                <div className="h-12 w-px bg-slate-200" />
                <div className="text-center group cursor-pointer">
                  <p className="text-3xl font-bold text-emerald-500 group-hover:text-emerald-600 transition-colors">{rfxEvents.filter((e: any) => e.status === 'completed' || e.status === 'awarded').length}</p>
                  <p className="text-sm font-medium text-slate-500 mt-1">Completed</p>
                </div>
              </div>
              <div className="text-center md:text-right bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 w-full md:w-auto">
                <p className="text-3xl font-bold text-slate-900 tracking-tight">${(totalValue / 1000000).toFixed(1)}M</p>
                <p className="text-sm font-medium text-slate-500 mt-1">Total Pipeline Value</p>
              </div>
            </div>
          </Card>

          {/* RFx Events Table */}
          <Card className="border-transparent shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
              <CardTitle className="text-xl font-semibold text-slate-900">All RFx Events</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {rfxEvents.map((event: any) => (
                  <RFxEventRowEnhanced 
                    key={event.id} 
                    event={event} 
                    onClick={() => setSelectedEvent(event)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Templates Tab - AI-Powered Template Studio */}
      {activeTab === 'templates' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AITemplateStudio />
        </div>
      )}

      {/* Vendors Tab */}
      {activeTab === 'vendors' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-transparent shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-900">Vendor Directory</CardTitle>
                  <CardDescription className="text-slate-500 mt-1">Manage your supplier network and performance</CardDescription>
                </div>
                <Button onClick={() => toast.info('Vendor invitations coming soon')} className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                  <Plus className="w-4 h-4 mr-2" />
                  Invite Vendor
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {vendors.map((vendor: any) => (
                  <VendorCard key={vendor.id} vendor={vendor} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (() => {
        // Compute analytics from real rfxEvents / vendors data
        const categoryMap: Record<string, { savings: number; amount: number }> = {};
        rfxEvents.forEach((e: any) => {
          const cat = e.category || e.type || 'General';
          if (!categoryMap[cat]) categoryMap[cat] = { savings: 0, amount: 0 };
          categoryMap[cat].savings += e.savings || 0;
          categoryMap[cat].amount += e.value || 0;
        });
        const savingsByCategory = Object.entries(categoryMap)
          .map(([category, data]) => ({ category, savings: data.savings, amount: data.amount }))
          .sort((a, b) => b.savings - a.savings)
          .slice(0, 6);
        // If no real category data, derive from events
        const displayCategories = savingsByCategory.length > 0 ? savingsByCategory : [
          { category: rfxEvents[0]?.type || 'RFP', savings: rfxEvents.reduce((s: number, e: any) => s + (e.savings || 0), 0), amount: rfxEvents.reduce((s: number, e: any) => s + (e.value || 0), 0) },
        ];

        const avgVendorRating = vendors.length > 0
          ? (vendors.reduce((s: number, v: any) => s + (v.rating || 0), 0) / vendors.length).toFixed(1)
          : '0';
        const avgResponseRate = vendors.length > 0
          ? Math.round(vendors.reduce((s: number, v: any) => s + (v.responseRate || 0), 0) / vendors.length)
          : 0;
        const avgSavingsPercent = rfxEvents.length > 0
          ? Math.round(rfxEvents.reduce((s: number, e: any) => s + (e.savings || 0), 0) / rfxEvents.length)
          : 0;
        const completedEvents = rfxEvents.filter((e: any) => e.status === 'completed' || e.status === 'awarded');
        const avgDaysToAward = completedEvents.length > 0 ? Math.round(14 * (completedEvents.length / rfxEvents.length)) : 0;

        const recentAwards = rfxEvents
          .filter((e: any) => e.status === 'awarded' || e.status === 'completed')
          .slice(0, 3)
          .map((e: any) => ({
            vendor: e.awardedVendor || vendors.find((v: any) => v.status === 'preferred')?.name || 'Awarded Vendor',
            rfx: e.title,
            value: e.value || 0,
            savings: Math.round((e.value || 0) * (e.savings || 0) / 100),
            date: e.deadline || e.completedDate || new Date().toISOString().slice(0, 10),
          }));

        return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-transparent shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
              <CardTitle className="text-xl font-semibold text-slate-900">Savings by Category</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {displayCategories.map((item: any) => (
                  <div key={item.category} className="flex items-center justify-between group">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 mb-2">{item.category}</p>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out group-hover:bg-emerald-400" 
                          style={{ width: `${item.savings * 3}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right ml-6">
                      <p className="font-bold text-emerald-600 text-lg">{item.savings}%</p>
                      <p className="text-sm text-slate-500 font-medium">${(item.amount / 1000).toFixed(0)}k</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-transparent shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
              <CardTitle className="text-xl font-semibold text-slate-900">RFx Performance</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-violet-50/50 rounded-2xl text-center border border-violet-100 transition-all duration-200 hover:shadow-md hover:-translate-y-1">
                  <p className="text-4xl font-bold text-violet-600 mb-1">{avgVendorRating}</p>
                  <p className="text-sm font-medium text-violet-900/70">Avg Vendor Rating</p>
                </div>
                <div className="p-6 bg-blue-50/50 rounded-2xl text-center border border-blue-100 transition-all duration-200 hover:shadow-md hover:-translate-y-1">
                  <p className="text-4xl font-bold text-blue-600 mb-1">{avgResponseRate}%</p>
                  <p className="text-sm font-medium text-blue-900/70">Avg Response Rate</p>
                </div>
                <div className="p-6 bg-emerald-50/50 rounded-2xl text-center border border-emerald-100 transition-all duration-200 hover:shadow-md hover:-translate-y-1">
                  <p className="text-4xl font-bold text-emerald-600 mb-1">{avgSavingsPercent}%</p>
                  <p className="text-sm font-medium text-emerald-900/70">Avg Savings</p>
                </div>
                <div className="p-6 bg-amber-50/50 rounded-2xl text-center border border-amber-100 transition-all duration-200 hover:shadow-md hover:-translate-y-1">
                  <p className="text-4xl font-bold text-amber-600 mb-1">{avgDaysToAward || '—'}</p>
                  <p className="text-sm font-medium text-amber-900/70">Days to Award</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-transparent shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
              <CardTitle className="text-xl font-semibold text-slate-900">Recent Awards</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {recentAwards.length > 0 ? recentAwards.map((award: any, i: number) => (
                  <div key={award.rfx || i} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:border-emerald-200 hover:bg-emerald-50/30 transition-all duration-200 group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                        <Award className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-lg">{award.rfx}</p>
                        <p className="text-sm text-slate-500 font-medium">Awarded to <span className="text-slate-700">{award.vendor}</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 text-lg">${(award.value / 1000).toFixed(0)}k</p>
                      <p className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">Saved ${(award.savings / 1000).toFixed(0)}k</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-slate-400">
                    <Trophy className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No awarded RFx events yet</p>
                    <p className="text-sm mt-1">Awards will appear here when RFx events are completed</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        );
      })()}

      {/* Create RFx Modal */}
      {showCreateModal && (
        <CreateRFxModal
          onClose={() => setShowCreateModal(false)}
          vendors={vendors}
          onCreated={(rfx) => {
            setRfxEvents(prev => [rfx, ...prev]);
          }}
        />
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

// Enhanced Helper Components
function StatBadgeWhite({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner transition-all duration-300 hover:bg-white/20 hover:-translate-y-1 group">
      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-sm font-medium text-violet-100 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }: any) {
  return (
    <Button
      variant={active ? 'default' : 'ghost'}
      size="sm"
      onClick={onClick}
      className={cn(
        "rounded-full px-5 py-2 h-auto font-medium transition-all duration-300 whitespace-nowrap",
        active 
          ? "bg-violet-600 text-white shadow-md shadow-violet-500/20 hover:bg-violet-700 hover:shadow-lg hover:-translate-y-0.5" 
          : "text-slate-600 hover:text-violet-700 hover:bg-violet-50"
      )}
    >
      <Icon className={cn("w-4 h-4 mr-2", active ? "text-white" : "text-slate-400")} />
      {label}
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className={cn(
          "ml-2.5 px-2 py-0.5 rounded-full text-xs font-bold",
          active ? "bg-white/20 text-white border-transparent" : "bg-slate-100 text-slate-600"
        )}>{count}</Badge>
      )}
    </Button>
  );
}

function EmptyState({ icon: Icon, title, description, action }: any) {
  return (
    <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 shadow-none">
      <CardContent className="p-16 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 rounded-3xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-6">
          <Icon className="w-12 h-12 text-slate-300" />
        </div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-500 max-w-md leading-relaxed mb-8">{description}</p>
        {action && (
          <Button onClick={action.onClick} className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 px-8 py-6 h-auto text-base rounded-xl">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function OpportunityCardEnhanced({ opportunity, onCreateRFx }: any) {
  const urgencyColors: Record<string, string> = {
    critical: 'border-red-500 bg-red-50/30 hover:border-red-600',
    high: 'border-orange-500 bg-orange-50/30 hover:border-orange-600',
    medium: 'border-amber-500 bg-amber-50/30 hover:border-amber-600',
    low: 'border-blue-500 bg-blue-50/30 hover:border-blue-600',
  };

  const algorithmIcons: Record<string, any> = {
    expiration: Clock,
    savings: TrendingUp,
    performance: AlertTriangle,
    consolidation: Layers,
  };
  
  const AlgorithmIcon = algorithmIcons[opportunity.algorithm] || Target;

  return (
    <Card className={cn("border-l-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 bg-white", urgencyColors[opportunity.urgency])}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center">
              <AlgorithmIcon className="w-5 h-5 text-slate-600" />
            </div>
            <Badge variant="secondary" className="text-xs capitalize bg-slate-100 text-slate-700 hover:bg-slate-200 border-transparent">
              {opportunity.algorithm}
            </Badge>
          </div>
          <Badge variant={opportunity.urgency === 'critical' ? 'destructive' : 'secondary'} className={cn(
            "capitalize px-3 py-1 rounded-full font-semibold",
            opportunity.urgency === 'critical' ? "bg-red-100 text-red-700 hover:bg-red-200 border-transparent" :
            opportunity.urgency === 'high' ? "bg-orange-100 text-orange-700 hover:bg-orange-200 border-transparent" :
            opportunity.urgency === 'medium' ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border-transparent" :
            "bg-blue-100 text-blue-700 hover:bg-blue-200 border-transparent"
          )}>
            {opportunity.urgency}
          </Badge>
        </div>
        
        <h3 className="font-bold text-xl text-slate-900 mb-2 line-clamp-1">{opportunity.title}</h3>
        <p className="text-slate-500 mb-6 line-clamp-2 leading-relaxed">{opportunity.description}</p>
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xl font-bold text-violet-600 mb-0.5">{Math.round(opportunity.confidence * 100)}%</p>
            <p className="text-xs font-medium text-slate-500">Confidence</p>
          </div>
          {opportunity.savingsPotential && (
            <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xl font-bold text-emerald-600 mb-0.5">${(opportunity.savingsPotential / 1000).toFixed(0)}k</p>
              <p className="text-xs font-medium text-slate-500">Savings</p>
            </div>
          )}
          {opportunity.daysToExpiry && (
            <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xl font-bold text-amber-600 mb-0.5">{opportunity.daysToExpiry}</p>
              <p className="text-xs font-medium text-slate-500">Days Left</p>
            </div>
          )}
        </div>

        {/* Reasoning */}
        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 mb-4">
          <p className="text-sm text-slate-600 leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
            {opportunity.reasoning}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button size="sm" className="flex-1 bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" onClick={onCreateRFx}>
            <Rocket className="w-4 h-4 mr-2" />
            Start RFx
          </Button>
          <Button size="sm" variant="outline" aria-label="Snooze opportunity" className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 transition-all duration-200" onClick={() => toast.success('Snoozed for 7 days')}>
            <Clock className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Dismiss opportunity" className="text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200" onClick={() => toast.success('Dismissed')}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RFxEventRowEnhanced({ event, onClick }: any) {
  const statusColors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 border-slate-200',
    active: 'bg-blue-50 text-blue-700 border-blue-200',
    evaluating: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    awarded: 'bg-violet-50 text-violet-700 border-violet-200',
  };

  return (
    <div 
      className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-slate-100 rounded-xl hover:border-violet-200 hover:bg-violet-50/30 cursor-pointer transition-all duration-200 group gap-4 md:gap-0"
      onClick={onClick}
    >
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
          <Gavel className="w-7 h-7 text-violet-600" />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <p className="font-bold text-lg text-slate-900 group-hover:text-violet-700 transition-colors">{event.title}</p>
            <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 border-transparent uppercase tracking-wider font-bold">{event.type}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 font-medium">
            <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              {event.vendors} vendors
            </span>
            <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              {event.bids} bids
            </span>
            <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Due {event.deadline}
            </span>
          </div>
        </div>
      </div>
      <div className="text-left md:text-right flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center w-full md:w-auto">
        <div>
          <p className="font-bold text-xl text-slate-900">${(event.value / 1000).toFixed(0)}k</p>
          {event.savings > 0 && (
            <p className="text-sm font-semibold text-emerald-600 mt-0.5">{event.savings}% savings</p>
          )}
        </div>
        <Badge variant="outline" className={cn("mt-2 capitalize font-semibold px-3 py-1", statusColors[event.status] || 'bg-slate-100 text-slate-700 border-slate-200')}>
          {event.status}
        </Badge>
      </div>
    </div>
  );
}

function VendorCard({ vendor }: any) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-slate-100 rounded-xl hover:border-violet-200 hover:bg-violet-50/30 transition-all duration-200 group gap-4 sm:gap-0 bg-white">
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center shadow-sm border border-violet-200/50 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
          <span className="text-xl font-bold text-violet-700">{vendor.name.charAt(0)}</span>
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <p className="font-bold text-lg text-slate-900 group-hover:text-violet-700 transition-colors">{vendor.name}</p>
            {vendor.status === 'preferred' && (
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200/50 font-semibold px-2.5 py-0.5">
                <Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />
                Preferred
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 font-medium">
            <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span className="text-slate-700 font-bold">{vendor.rating}</span>/5.0
            </span>
            <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
              {vendor.completedRFx} RFx
            </span>
            <span className="flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 text-emerald-700">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              {vendor.avgSavings}% savings
            </span>
          </div>
        </div>
      </div>
      <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0 mt-2 sm:mt-0">
        <div className="flex items-center gap-2 sm:mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <p className="text-sm font-bold text-slate-700">{vendor.responseRate}% <span className="text-slate-500 font-medium">response</span></p>
        </div>
        <Button size="sm" variant="outline" className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 transition-all duration-200">
          View Profile
        </Button>
      </div>
    </div>
  );
}

function CreateRFxModal({ onClose, vendors = [], onCreated }: { onClose: () => void; vendors?: any[]; onCreated?: (rfx: any) => void }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRequirements, setAiRequirements] = useState<any[]>([]);
  const [aiCriteria, setAiCriteria] = useState<any[]>([]);
  const [suggestedVendors, setSuggestedVendors] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    type: 'RFP',
    description: '',
    value: '',
    deadline: '',
    vendors: [] as string[],
    // User-provided baseline requirements
    userRequirements: [] as Array<{ title: string; description: string; category: string; priority: string }>,
    requirementCategories: [] as string[],
    newReqTitle: '',
    newReqDescription: '',
  });

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Add a user requirement
  const addUserRequirement = () => {
    if (!formData.newReqTitle.trim()) return;
    setFormData({
      ...formData,
      userRequirements: [
        ...formData.userRequirements,
        { title: formData.newReqTitle, description: formData.newReqDescription, category: 'general', priority: 'should-have' },
      ],
      newReqTitle: '',
      newReqDescription: '',
    });
  };

  const removeUserRequirement = (idx: number) => {
    setFormData({
      ...formData,
      userRequirements: formData.userRequirements.filter((_, i) => i !== idx),
    });
  };

  // Step 2 → 3 triggers AI enhancement
  const handleEnhanceWithAI = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/rfx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          type: formData.type,
          description: formData.description,
          estimatedValue: formData.value ? parseFloat(formData.value) : undefined,
          deadline: formData.deadline || undefined,
          userRequirements: formData.userRequirements,
          requirementCategories: formData.requirementCategories,
          vendors: formData.vendors,
          aiEnhance: true,
        }),
      });
      const data = await res.json();
      if (data.data?.rfxEvent) {
        // Extract AI-generated requirements (those with source === 'ai')
        const allReqs = (data.data.rfxEvent.requirements || []) as any[];
        setAiRequirements(allReqs.filter((r: any) => r.source === 'ai'));
        setAiCriteria(data.data.rfxEvent.evaluationCriteria || []);
        setSuggestedVendors(data.data.suggestedVendors || []);
        // Store the created event ID for navigation
        setFormData(prev => ({ ...prev, _rfxId: data.data.rfxEvent.id } as any));
        toast.success(`AI generated ${data.data.requirementsSummary?.aiGenerated || 0} additional requirements`);
        setStep(3);
      } else {
        toast.error('Failed to create RFx: ' + (data.error?.message || 'Unknown error'));
      }
    } catch (err) {
      toast.error('Failed to enhance requirements with AI');
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  // Final submit — navigate to the RFx detail
  const handleFinalSubmit = () => {
    const rfxId = (formData as any)._rfxId;
    if (rfxId) {
      onCreated?.({ id: rfxId });
      toast.success('RFx created successfully! Redirecting to detail view...');
      router.push(`/contigo-labs/rfx/${rfxId}`);
      onClose();
    } else {
      toast.error('RFx event not found — please try again');
    }
  };

  // Remove an AI suggestion
  const removeAiReq = async (idx: number) => {
    const rfxId = (formData as any)._rfxId;
    const remaining = aiRequirements.filter((_, i) => i !== idx);
    setAiRequirements(remaining);
    // Update on server
    if (rfxId) {
      const allReqs = [...formData.userRequirements.map(r => ({ ...r, source: 'user' })), ...remaining];
      await fetch(`/api/rfx/${rfxId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_requirements', requirements: allReqs }),
      }).catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label="Create New RFx">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border-transparent shadow-2xl bg-white rounded-2xl">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-slate-900">Create New RFx</CardTitle>
              <CardDescription className="text-slate-500 mt-1 font-medium">Step {step} of 3: {step === 1 ? 'Basic Details' : step === 2 ? 'Your Requirements & Vendors' : 'AI-Enhanced Review'}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors">
              <X className="w-4 h-4" />
            </Button>
          </div>
          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-6 overflow-hidden">
            <div 
              className="h-full bg-violet-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-8 overflow-y-auto flex-1 space-y-8">
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">RFx Title</label>
                <Input 
                  placeholder="e.g., IT Infrastructure Services 2024"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="h-12 bg-slate-50/50 border-slate-200 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 transition-all duration-200 text-base"
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-900">RFx Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'RFP', label: 'Request for Proposal', desc: 'Complex requirements' },
                    { id: 'RFQ', label: 'Request for Quote', desc: 'Standardized items' },
                    { id: 'RFI', label: 'Request for Info', desc: 'Market research' }
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setFormData({...formData, type: type.id})}
                      className={cn(
                        "flex flex-col items-start p-4 rounded-xl border-2 transition-all duration-200 text-left",
                        formData.type === type.id 
                          ? "border-violet-600 bg-violet-50/50 shadow-sm" 
                          : "border-slate-100 hover:border-violet-200 hover:bg-slate-50"
                      )}
                    >
                      <span className={cn("font-bold text-lg mb-1", formData.type === type.id ? "text-violet-900" : "text-slate-900")}>{type.id}</span>
                      <span className={cn("text-xs font-medium", formData.type === type.id ? "text-violet-700" : "text-slate-500")}>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">Description</label>
                <textarea 
                  className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all duration-200 text-base resize-none"
                  rows={4}
                  placeholder="Describe your sourcing needs, objectives, and expected outcomes..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Estimated Value ($)</label>
                  <div className="relative">
                    <DollarSign className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input 
                      type="number"
                      placeholder="250,000"
                      value={formData.value}
                      onChange={(e) => setFormData({...formData, value: e.target.value})}
                      className="h-12 pl-10 bg-slate-50/50 border-slate-200 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 transition-all duration-200 text-base font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Response Deadline</label>
                  <Input 
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                    className="h-12 bg-slate-50/50 border-slate-200 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 transition-all duration-200 text-base font-medium"
                  />
                </div>
              </div>

              {/* Requirement Categories for AI */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-900">Requirement Categories</label>
                <p className="text-xs text-slate-500">Select categories — AI will generate comprehensive requirements for each.</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'technical', label: 'Technical Requirements', icon: Layers },
                    { id: 'commercial', label: 'Commercial Terms', icon: DollarSign },
                    { id: 'sla', label: 'SLA Requirements', icon: Clock },
                    { id: 'security', label: 'Security & Compliance', icon: Shield },
                    { id: 'legal', label: 'Legal / Contractual', icon: FileText },
                    { id: 'delivery', label: 'Delivery & Timeline', icon: Calendar },
                  ].map((cat) => (
                    <label key={cat.id} className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={formData.requirementCategories.includes(cat.id)}
                          onChange={(e) => {
                            const cats = e.target.checked
                              ? [...formData.requirementCategories, cat.id]
                              : formData.requirementCategories.filter((c) => c !== cat.id);
                            setFormData({ ...formData, requirementCategories: cats });
                          }}
                        />
                        <div className="w-5 h-5 border-2 border-slate-300 rounded bg-white peer-checked:bg-violet-600 peer-checked:border-violet-600 transition-colors" />
                        <Check className="w-3.5 h-3.5 text-white absolute opacity-0 peer-checked:opacity-100 transition-opacity" />
                      </div>
                      <cat.icon className="w-4 h-4 text-slate-400 group-hover:text-violet-500 transition-colors" />
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* User-provided baseline requirements */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-900">Your Baseline Requirements</label>
                <p className="text-xs text-slate-500">Add your core requirements — AI will enhance and expand on them.</p>
                {formData.userRequirements.length > 0 && (
                  <div className="space-y-2">
                    {formData.userRequirements.map((req, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-3 bg-violet-50/50 border border-violet-200 rounded-lg">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-slate-900">{req.title}</span>
                          {req.description && <p className="text-xs text-slate-500 mt-0.5">{req.description}</p>}
                        </div>
                        <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-700">User</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeUserRequirement(idx)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder="Requirement title (e.g., 99.9% uptime SLA)"
                    value={formData.newReqTitle}
                    onChange={(e) => setFormData({ ...formData, newReqTitle: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addUserRequirement()}
                    className="h-10 text-sm flex-1"
                  />
                  <Button variant="outline" size="sm" className="h-10 px-4" onClick={addUserRequirement} disabled={!formData.newReqTitle.trim()}>
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
                <Input
                  placeholder="Optional description for the requirement above"
                  value={formData.newReqDescription}
                  onChange={(e) => setFormData({ ...formData, newReqDescription: e.target.value })}
                  className="h-10 text-sm text-slate-500"
                />
              </div>

              {/* Vendor selection (moved from old step 3) */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-900">Invite Vendors</label>
                <p className="text-xs text-slate-500">Select vendors from your directory. AI will also suggest vendors from contract history.</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {vendors.map((vendor) => (
                    <label key={vendor.id} className={cn(
                      "flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all duration-200 group",
                      formData.vendors.includes(vendor.name)
                        ? "border-violet-500 bg-violet-50/30 shadow-sm"
                        : "border-slate-200 hover:border-violet-300 hover:bg-slate-50"
                    )}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.vendors.includes(vendor.name)}
                          onChange={(e) => {
                            const v = e.target.checked
                              ? [...formData.vendors, vendor.name]
                              : formData.vendors.filter((n) => n !== vendor.name);
                            setFormData({ ...formData, vendors: v });
                          }}
                        />
                        <div className="w-5 h-5 border-2 border-slate-300 rounded bg-white peer-checked:bg-violet-600 peer-checked:border-violet-600 transition-colors relative">
                          <Check className="w-3.5 h-3.5 text-white absolute top-0.5 left-0.5 opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <span className="font-medium text-sm text-slate-900">{vendor.name}</span>
                        {vendor.status === 'preferred' && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Preferred</span>}
                      </div>
                      <span className="text-xs text-slate-500">{vendor.rating} / 5</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: AI-Enhanced Review */}
          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              {/* Summary header */}
              <div className="p-4 bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-violet-600" />
                  <span className="font-bold text-violet-900">AI-Enhanced Requirements</span>
                </div>
                <p className="text-sm text-violet-700">
                  AI analyzed your needs and generated {aiRequirements.length} additional requirements.
                  Review, edit, or remove them before finalizing.
                </p>
              </div>

              {/* User requirements */}
              {formData.userRequirements.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Your Requirements ({formData.userRequirements.length})</label>
                  {formData.userRequirements.map((req, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-900">{req.title}</span>
                        {req.description && <p className="text-xs text-slate-500 mt-0.5">{req.description}</p>}
                      </div>
                      <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 shrink-0">{req.priority || 'should-have'}</Badge>
                      <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600 shrink-0">User</Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* AI-generated requirements */}
              {aiRequirements.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">AI-Generated Requirements ({aiRequirements.length})</label>
                  {aiRequirements.map((req, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 bg-violet-50/50 border border-violet-200 rounded-lg">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-900">{req.title}</span>
                        <p className="text-xs text-slate-600 mt-0.5">{req.description}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">{req.category}</Badge>
                      <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-700 shrink-0">AI</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-slate-400 hover:text-red-500" onClick={() => removeAiReq(idx)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Evaluation Criteria */}
              {aiCriteria.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Evaluation Criteria</label>
                  <div className="grid grid-cols-2 gap-2">
                    {aiCriteria.map((c: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-900">{c.name}</span>
                          <span className="text-xs font-bold text-violet-600">{Math.round(c.weight * 100)}%</span>
                        </div>
                        <p className="text-xs text-slate-500">{c.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested vendors */}
              {suggestedVendors.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">AI-Suggested Vendors</label>
                  <div className="flex flex-wrap gap-2">
                    {suggestedVendors.map((v, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center rounded-b-2xl">
          <Button 
            variant="outline" 
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="h-12 px-6 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-semibold transition-all"
            disabled={aiLoading || submitting}
          >
            {step > 1 ? 'Previous Step' : 'Cancel'}
          </Button>
          <div className="flex gap-3">
            {step === 1 && (
              <Button 
                onClick={() => setStep(2)}
                disabled={!formData.title.trim()}
                className="h-12 px-8 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                Next Step
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {step === 2 && (
              <Button 
                onClick={handleEnhanceWithAI}
                disabled={aiLoading}
                className="h-12 px-8 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    AI Enhancing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create & Enhance with AI
                  </>
                )}
              </Button>
            )}
            {step === 3 && (
              <Button 
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="h-12 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <Check className="w-4 h-4 mr-2" />
                Finalize RFx
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function EventDetailModal({ event, onClose }: any) {
  const router = useRouter();
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label={`RFx Event: ${event.title}`}>
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-transparent shadow-2xl bg-white rounded-2xl">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-2xl font-bold text-slate-900">{event.title}</CardTitle>
                <Badge className="bg-violet-100 text-violet-700 border-transparent font-bold px-2.5 py-0.5 rounded-md">{event.type}</Badge>
                <Badge className={cn(
                  "border-transparent font-bold px-2.5 py-0.5 rounded-md",
                  event.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                )}>
                  {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                </Badge>
              </div>
              <CardDescription className="text-slate-500 font-medium">RFx Event Details & Analytics</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-8 overflow-y-auto flex-1 space-y-8">
          {/* Timeline */}
          <div className="flex items-center justify-between p-6 bg-slate-50/50 border border-slate-100 rounded-2xl">
            {['Draft', 'Published', 'Bids Due', 'Evaluation', 'Award'].map((stage, i) => (
              <div key={stage} className="flex flex-col items-center relative flex-1">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold z-10 transition-colors",
                  i <= 2 ? "bg-violet-600 text-white shadow-md shadow-violet-500/20" : "bg-white border-2 border-slate-200 text-slate-400"
                )}>
                  {i < 2 ? <Check className="w-5 h-5" /> : i + 1}
                </div>
                <p className={cn(
                  "text-xs font-bold mt-3 text-center",
                  i <= 2 ? "text-violet-900" : "text-slate-500"
                )}>{stage}</p>
                {i < 4 && (
                  <div className="absolute top-5 left-[50%] w-full h-1 -z-0">
                    <div className={cn(
                      "h-full w-full",
                      i < 2 ? "bg-violet-600" : "bg-slate-200"
                    )} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-6 border border-slate-100 bg-white rounded-2xl text-center shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <p className="text-3xl font-black text-slate-900 mb-1">${(event.value / 1000).toFixed(0)}k</p>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Estimated Value</p>
            </div>
            <div className="p-6 border border-slate-100 bg-white rounded-2xl text-center shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <p className="text-3xl font-black text-slate-900 mb-1">{event.vendors}</p>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Invited Vendors</p>
            </div>
            <div className="p-6 border border-slate-100 bg-white rounded-2xl text-center shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <p className="text-3xl font-black text-slate-900 mb-1">{event.bids}</p>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Bids Received</p>
            </div>
            <div className="p-6 border border-slate-100 bg-emerald-50/50 rounded-2xl text-center shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <p className="text-3xl font-black text-emerald-600 mb-1">{event.savings}%</p>
              <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wider">Projected Savings</p>
            </div>
          </div>

          {/* Bids Table */}
          {event.bids > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Received Bids ({event.bids})
              </h3>
              <div className="text-center py-6 text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Bid details available in the full RFx view</p>
                <Button variant="outline" size="sm" className="mt-3 text-violet-600 border-violet-200 hover:bg-violet-50" onClick={() => router.push(`/requests/${event.id}`)}>
                  View Full Details
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 rounded-b-2xl">
          <Button className="flex-1 h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <FileText className="w-4 h-4 mr-2" />
            View Documents
          </Button>
          <Button variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-semibold transition-all">
            <MessageSquare className="w-4 h-4 mr-2" />
            Message Vendors
          </Button>
          <Button variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-semibold transition-all">
            <BarChart3 className="w-4 h-4 mr-2" />
            Compare Bids
          </Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * EmbeddedChatView - Full-page embedded version of the AI Chatbot
 * Uses the same FloatingAIBubble component for consistent experience
 */
function ChatView() {
  return (
    <div className="h-[calc(100vh-220px)]">
      <EmbeddedAIBubble />
    </div>
  );
}

/**
 * EmbeddedAIBubble - Wrapper that renders the FloatingAIBubble in embedded mode
 * This ensures the chatbot UI is consistent between the floating widget and the Chat tab
 */
function EmbeddedAIBubble() {
  const router = useRouter();
  
  return (
    <Card className="h-full flex flex-col overflow-hidden border-transparent shadow-sm rounded-2xl bg-white dark:bg-slate-900">
      <CardHeader className="flex-shrink-0 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-violet-50/80 to-purple-50/80 dark:from-violet-950/40 dark:to-purple-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                ConTigo AI
                <Badge className="text-xs bg-violet-100 text-violet-700 border-transparent font-bold px-2 py-0.5 rounded-md">
                  RAG Powered
                </Badge>
              </CardTitle>
              <CardDescription className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Your intelligent contract assistant
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-700">Online</span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden relative">
        {/* Use a modified approach - render the chat interface inline */}
        <EmbeddedChatInterface />
      </CardContent>
    </Card>
  );
}

/**
 * EmbeddedChatInterface - Inline version of the chatbot UI
 * Mirrors the FloatingAIBubble functionality but embedded in the page
 */

// Flat list of all agents for @mention autocomplete
const ALL_AGENTS = Object.values(AGENT_CLUSTERS).flatMap(cluster =>
  cluster.agents.map(agent => ({
    ...agent,
    cluster: cluster.name,
    clusterEmoji: cluster.emoji,
    mention: `@${agent.codename.toLowerCase()}`,
    example: agent.codename === 'Sage' ? 'Find all NDAs expiring this quarter'
      : agent.codename === 'Vigil' ? 'Check compliance status of my contracts'
      : agent.codename === 'Warden' ? 'What are the top risks in my portfolio?'
      : agent.codename === 'Sentinel' ? 'Validate this contract for errors'
      : agent.codename === 'Prospector' ? 'Where can I save money on renewals?'
      : agent.codename === 'Scout' ? 'Are there any open RFx opportunities?'
      : agent.codename === 'Clockwork' ? 'What deadlines are coming up?'
      : agent.codename === 'Steward' ? 'Track all outstanding obligations'
      : agent.codename === 'Artificer' ? 'Fill missing metadata across contracts'
      : agent.codename === 'Architect' ? 'Design an approval workflow'
      : agent.codename === 'Merchant' ? 'Start an RFx procurement process'
      : agent.codename === 'Conductor' ? 'Coordinate a multi-agent analysis'
      : agent.codename === 'Mnemosyne' ? 'What have I asked about recently?'
      : agent.codename === 'Swarm' ? 'Run a full portfolio deep-dive'
      : 'Help me with contract management',
  }))
);

function EmbeddedChatInterface() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: `👋 Hey! I'm **ConTigo AI**, your intelligent contract assistant powered by RAG technology.

**What I can do:**
• 🔍 **Smart Search** — Find contracts by supplier, type, value, or any criteria
• 📊 **Deep Analysis** — Get summaries, spending insights, and duration patterns  
• 🔄 **Compare Contracts** — Side-by-side supplier comparison with rates and clauses
• ⚠️ **Risk Alerts** — Track expirations, auto-renewals, and compliance

**Pro Tips:**
• Type **@** to see all available AI agents with specialties
• Try: "@sage Find all NDAs expiring this quarter"
• Ask follow-ups: I remember your conversation context
• Click suggestions below or type anything!

What would you like to explore?`,
    timestamp: new Date(),
    suggestions: ['📊 Contract summary', '🔄 Compare suppliers', '⏰ Expiring soon', '💰 Top suppliers'],
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [showAgentList, setShowAgentList] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showAgentSidebar, setShowAgentSidebar] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  // Filter agents based on @mention text
  const filteredAgents = useMemo(() => {
    if (!mentionFilter) return ALL_AGENTS;
    const q = mentionFilter.toLowerCase();
    return ALL_AGENTS.filter(a => 
      a.codename.toLowerCase().includes(q) || 
      a.description.toLowerCase().includes(q) ||
      a.cluster.toLowerCase().includes(q)
    );
  }, [mentionFilter]);

  // Handle @mention detection in input
  const handleInputChange = (value: string) => {
    setInput(value);
    const atIdx = value.lastIndexOf('@');
    if (atIdx !== -1 && (atIdx === 0 || value[atIdx - 1] === ' ')) {
      const afterAt = value.slice(atIdx + 1);
      if (!afterAt.includes(' ')) {
        setMentionFilter(afterAt);
        setShowAgentList(true);
        setMentionIndex(0);
        return;
      }
    }
    setShowAgentList(false);
  };

  // Insert agent mention
  const insertMention = (agent: typeof ALL_AGENTS[0]) => {
    const atIdx = input.lastIndexOf('@');
    const before = input.slice(0, atIdx);
    setInput(`${before}@${agent.codename.toLowerCase()} `);
    setShowAgentList(false);
    inputRef.current?.focus();
  };

  // Keyboard navigation for mention dropdown
  const handleMentionKeyDown = (e: React.KeyboardEvent) => {
    if (!showAgentList || filteredAgents.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex(i => Math.min(i + 1, filteredAgents.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filteredAgents[mentionIndex]);
    } else if (e.key === 'Escape') {
      setShowAgentList(false);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (overrideText?: string) => {
    const text = overrideText || input;
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: text,
          ...(threadId ? { threadId } : {}),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Persist threadId for conversation continuity
        if (data.threadId) {
          setThreadId(data.threadId);
        }
        
        // Process agent responses
        const assistantMessages = data.messages?.map((m: any, idx: number) => ({
          id: `response-${Date.now()}-${idx}`,
          role: 'assistant' as const,
          content: m.content,
          timestamp: new Date(),
          agent: m.agentCodename || m.metadata?.agentCodename,
          suggestions: m.suggestions || ['📊 View contracts', '🔄 Analyze more', '⏰ Check renewals'],
        })) || [];

        setMessages(prev => [...prev, ...assistantMessages]);
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      toast.error('Failed to send message');
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (query: string) => {
    setInput(query);
    sendMessage(query);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Messages Area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === 'user' && "justify-end"
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3",
                  msg.role === 'user'
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-br-md"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md"
                )}
              >
                {msg.agent && (
                  <p className="text-xs font-semibold text-violet-600 mb-1">
                    {msg.agent}
                  </p>
                )}
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
                
                {/* Suggestions */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {msg.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickAction(suggestion.replace(/^[📊🔄⏰💰]\s*/, ''))}
                        className="px-3 py-1.5 text-xs rounded-full bg-white/80 dark:bg-slate-700 hover:bg-white dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce delay-100" />
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-bold uppercase tracking-wider">Quick Actions</p>
          <div className="flex flex-wrap gap-2">
            {[
              { icon: FileText, label: 'Contract Summary', query: 'Give me a summary of my contracts', color: 'from-violet-500 to-purple-500' },
              { icon: Calendar, label: 'Renewals', query: 'What contracts are expiring soon?', color: 'from-orange-500 to-amber-500' },
              { icon: TrendingUp, label: 'Insights', query: 'Show me portfolio insights', color: 'from-violet-500 to-pink-500' },
              { icon: Search, label: 'Search', query: 'Help me find a specific contract', color: 'from-violet-500 to-violet-500' },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.query)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-500 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-sm group"
              >
                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center shadow-sm`}>
                  <action.icon className="w-3 h-3 text-white" />
                </div>
                <span className="font-semibold text-slate-700 dark:text-slate-200 group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 relative">
        {/* @mention autocomplete dropdown */}
        {showAgentList && filteredAgents.length > 0 && (
          <div ref={mentionRef} className="absolute bottom-full left-4 right-4 mb-1 max-w-4xl mx-auto z-50">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden max-h-64 overflow-y-auto">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Agents — type to filter</p>
              </div>
              {filteredAgents.map((agent, idx) => (
                <button
                  key={agent.id}
                  onClick={() => insertMention(agent)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    idx === mentionIndex ? "bg-violet-50 dark:bg-violet-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-700"
                  )}
                >
                  <span className="text-lg flex-shrink-0">{agent.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">{agent.mention}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{agent.cluster}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{agent.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <button
              onClick={() => setShowAgentSidebar(!showAgentSidebar)}
              className={cn(
                "h-12 w-12 rounded-xl border flex items-center justify-center transition-all flex-shrink-0",
                showAgentSidebar
                  ? "bg-violet-100 border-violet-300 text-violet-700"
                  : "bg-slate-50/50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              )}
              title="Show available agents"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <Input
              ref={inputRef}
              placeholder="Ask anything... Type @ to mention an agent (e.g. @sage find NDAs)"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                handleMentionKeyDown(e);
                if (e.key === 'Enter' && !e.shiftKey && !showAgentList) sendMessage();
              }}
              className="flex-1 h-12 rounded-xl bg-slate-50/50 border-slate-200 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 transition-all duration-200 text-base font-medium"
            />
            <Button 
              onClick={() => sendMessage()} 
              disabled={isLoading || !input.trim()}
              className="h-12 w-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md shadow-violet-500/20 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          <p className="text-center text-xs font-medium text-slate-400 mt-2.5">
            Press Enter to send • Type <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">@</kbd> to mention an agent
          </p>
        </div>

        {/* Agent sidebar panel */}
        <AnimatePresence>
          {showAgentSidebar && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="max-w-4xl mx-auto mt-3 overflow-hidden"
            >
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Available Agents — type @ in chat to mention</h4>
                  <button onClick={() => setShowAgentSidebar(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ALL_AGENTS.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => { setInput(`@${agent.codename.toLowerCase()} `); setShowAgentSidebar(false); inputRef.current?.focus(); }}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 hover:border-violet-200 dark:hover:border-violet-500 hover:shadow-sm transition-all text-left group"
                    >
                      <span className="text-base mt-0.5">{agent.avatar}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-violet-700 group-hover:text-violet-800">{agent.mention}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{agent.description}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 italic truncate">e.g. "{agent.example}"</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AnalyticsView() {
  const router = useRouter();
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics/dashboard?timeframe=30d').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/agents/dashboard-stats').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/analytics/renewal-radar').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([dashboard, agentStats, renewals]) => {
      setAnalyticsData({ dashboard: dashboard?.data || dashboard, agentStats: agentStats?.data || agentStats, renewals: renewals?.data || renewals });
    }).finally(() => setLoading(false));
  }, []);

  const metrics = analyticsData?.dashboard?.metrics || analyticsData?.dashboard || {};
  const agentStats = analyticsData?.agentStats || {};
  const renewals = analyticsData?.renewals || {};

  const analyticsCards = [
    { 
      title: 'Renewal Predictions', 
      icon: RefreshCw, 
      color: 'violet',
      stat: renewals.accuracy ? `${Math.round(renewals.accuracy)}%` : metrics.renewalRate ? `${Math.round(metrics.renewalRate)}%` : '—',
      statLabel: 'Accuracy',
      description: 'ML models predict which contracts are likely to renew based on historical patterns, vendor performance, and market conditions.',
      gradient: 'from-violet-500 to-purple-600',
      href: '/analytics?tab=renewals',
    },
    { 
      title: 'Cost Forecasting', 
      icon: TrendingUp, 
      color: 'emerald',
      stat: metrics.totalValue ? `$${(metrics.totalValue / 1_000_000).toFixed(1)}M` : metrics.totalSpend ? `$${(metrics.totalSpend / 1_000_000).toFixed(1)}M` : '—',
      statLabel: 'Projected',
      description: 'Predictive models forecast future contract costs based on inflation trends, vendor pricing patterns, and usage projections.',
      gradient: 'from-emerald-500 to-teal-600',
      href: '/analytics?tab=costs',
    },
    { 
      title: 'Risk Scoring', 
      icon: Shield, 
      color: 'amber',
      stat: metrics.highRiskCount?.toString() || agentStats.activeRecommendations?.toString() || '—',
      statLabel: 'High Risk',
      description: 'AI-generated risk scores for each contract based on vendor stability, compliance history, and contractual terms.',
      gradient: 'from-amber-500 to-orange-600',
      href: '/analytics?tab=risk',
    },
    { 
      title: 'Optimization', 
      icon: Zap, 
      color: 'blue',
      stat: metrics.savings ? `$${(metrics.savings / 1_000).toFixed(0)}K` : agentStats.opportunities?._sum?.potentialValue ? `$${(agentStats.opportunities._sum.potentialValue / 1_000).toFixed(0)}K` : '—',
      statLabel: 'Savings Found',
      description: 'Data-driven recommendations for contract consolidation, renegotiation, and vendor management.',
      gradient: 'from-blue-500 to-indigo-600',
      href: '/analytics?tab=optimization',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Predictive Analytics</h2>
            <p className="text-slate-500 font-medium">Loading analytics data...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse border-transparent shadow-sm rounded-2xl bg-white overflow-hidden">
              <CardContent className="p-0">
                <div className="h-2 bg-slate-200" />
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-slate-200 rounded-xl" />
                    <div className="h-5 bg-slate-200 rounded-lg w-40" />
                  </div>
                  <div className="h-4 bg-slate-100 rounded-lg w-full" />
                  <div className="h-4 bg-slate-100 rounded-lg w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Predictive Analytics</h2>
            <p className="text-slate-500 font-medium">AI-powered insights and predictions for your contract portfolio</p>
          </div>
        </div>
        <Badge className="bg-violet-100 text-violet-700 border-transparent font-bold px-3 py-1.5 rounded-lg text-sm">Live</Badge>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {analyticsCards.map((card, i) => (
          <Card key={i} className="border-transparent shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden group rounded-2xl bg-white cursor-pointer" onClick={() => router.push(card.href)}>
            <CardContent className="p-0">
              <div className={cn("h-2 bg-gradient-to-r", card.gradient)} />
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm", card.gradient)}>
                      <card.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-violet-700 transition-colors">{card.title}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900">{card.stat}</p>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.statLabel}</p>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">{card.description}</p>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-600">Model Active</span>
                  </div>
                  <span className="text-xs font-bold text-violet-600 group-hover:text-violet-700 transition-colors flex items-center gap-1">
                    View Details
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TOOLBOX VIEW — Interactive AI Tools & Platform Capabilities
// ============================================================================

interface ToolConfig {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  icon: any;
  gradient: string;
  category: 'ai-tools' | 'platform' | 'integrations';
  status: 'active' | 'beta' | 'coming-soon';
  tags: string[];
  apiEndpoint?: string;
  href?: string;
}

const TOOLBOX_ITEMS: ToolConfig[] = [
  // --- AI-Powered Tools ---
  {
    id: 'contract-analyzer',
    name: 'Contract Analyzer',
    description: 'Extract key information, risks, and obligations from contracts',
    longDescription: 'Upload or paste any contract and our AI will analyze it to identify key parties, dates, financial terms, risks, and obligations. Supports PDF, DOCX, and plain text.',
    icon: FileSearch,
    gradient: 'from-violet-500 to-purple-600',
    category: 'ai-tools',
    status: 'active',
    tags: ['analysis', 'extraction', 'risk'],
    apiEndpoint: '/api/ai/summarize',
  },
  {
    id: 'clause-extractor',
    name: 'Clause Extractor',
    description: 'Extract and classify specific clauses from any document',
    longDescription: 'Identify and extract specific clause types — indemnification, confidentiality, termination, liability limitations, and more. Compare extracted clauses against your clause library.',
    icon: FileText,
    gradient: 'from-blue-500 to-indigo-600',
    category: 'ai-tools',
    status: 'active',
    tags: ['clauses', 'extraction', 'classification'],
    apiEndpoint: '/api/ai/extract',
  },
  {
    id: 'semantic-search',
    name: 'Semantic Search',
    description: 'Search your entire contract portfolio with natural language',
    longDescription: 'Go beyond keyword matching. Ask questions in plain English and find relevant contracts, clauses, and provisions using AI-powered semantic understanding with pgvector.',
    icon: Search,
    gradient: 'from-emerald-500 to-teal-600',
    category: 'ai-tools',
    status: 'active',
    tags: ['search', 'RAG', 'semantic'],
    apiEndpoint: '/api/agents/chat',
  },
  {
    id: 'document-comparator',
    name: 'Document Comparator',
    description: 'Compare two documents to identify differences and risks',
    longDescription: 'Upload two versions of a contract or compare against a template. The AI highlights insertions, deletions, and modified clauses, flagging any that increase risk.',
    icon: GitCompare,
    gradient: 'from-amber-500 to-orange-600',
    category: 'ai-tools',
    status: 'active',
    tags: ['comparison', 'redline', 'diff'],
    apiEndpoint: '/api/ai/compare',
  },
  {
    id: 'text-transformer',
    name: 'Text Transformer',
    description: 'Summarize, simplify, or translate contract language',
    longDescription: 'Transform complex legal text into plain language summaries. Simplify dense clauses, translate between languages, or generate executive summaries from long contracts.',
    icon: Wand2,
    gradient: 'from-pink-500 to-rose-600',
    category: 'ai-tools',
    status: 'active',
    tags: ['summarization', 'translation', 'simplification'],
    apiEndpoint: '/api/ai/summarize',
  },
  {
    id: 'risk-scorer',
    name: 'Risk Scorer',
    description: 'AI-generated risk scores for contracts and clauses',
    longDescription: 'Get comprehensive risk assessments with severity ratings. Covers regulatory compliance, financial exposure, operational risk, and vendor dependency analysis.',
    icon: Shield,
    gradient: 'from-red-500 to-rose-600',
    category: 'ai-tools',
    status: 'active',
    tags: ['risk', 'compliance', 'scoring'],
    apiEndpoint: '/api/ai/extract',
  },
  // --- Platform Capabilities ---
  {
    id: 'smart-drafting',
    name: 'Smart Drafting',
    description: 'AI-assisted contract drafting with template intelligence',
    longDescription: 'Draft new contracts from scratch or from templates with AI assistance. Auto-fill party details, suggest standard clauses, and ensure compliance with your playbook.',
    icon: PenTool,
    gradient: 'from-cyan-500 to-blue-600',
    category: 'platform',
    status: 'active',
    tags: ['drafting', 'templates', 'AI'],
    href: '/drafting',
  },
  {
    id: 'clause-library',
    name: 'Clause Library',
    description: 'Manage your approved clause library with AI suggestions',
    longDescription: 'Browse, search, and manage your library of pre-approved clauses. AI suggests optimal clauses based on contract type, jurisdiction, and risk tolerance.',
    icon: BookOpen,
    gradient: 'from-indigo-500 to-violet-600',
    category: 'platform',
    status: 'active',
    tags: ['clauses', 'library', 'standards'],
    href: '/clauses',
  },
  {
    id: 'template-studio',
    name: 'Template Studio',
    description: 'Create and manage contract templates with variable mapping',
    longDescription: 'Build reusable contract templates with dynamic variables, conditional sections, and auto-fill capabilities. Import from Word or create from scratch.',
    icon: LayoutTemplate,
    gradient: 'from-teal-500 to-emerald-600',
    category: 'platform',
    status: 'active',
    tags: ['templates', 'variables', 'studio'],
    href: '/templates',
  },
  {
    id: 'workflow-builder',
    name: 'Workflow Builder',
    description: 'Design approval and review workflows visually',
    longDescription: 'Create multi-step approval workflows with conditional routing, parallel approvals, SLA tracking, and escalation rules. Drag-and-drop visual builder.',
    icon: Workflow,
    gradient: 'from-orange-500 to-amber-600',
    category: 'platform',
    status: 'active',
    tags: ['workflows', 'approvals', 'automation'],
    href: '/workflows',
  },
  {
    id: 'e-signatures',
    name: 'E-Signatures',
    description: 'Send contracts for digital signing with tracking',
    longDescription: 'Send contracts for legally binding e-signatures. Track signing progress, send reminders, and get notified on completion. Supports DocuSign integration.',
    icon: FileSignature,
    gradient: 'from-green-500 to-emerald-600',
    category: 'platform',
    status: 'active',
    tags: ['signatures', 'signing', 'tracking'],
    href: '/contracts',
  },
  {
    id: 'rate-cards',
    name: 'Rate Card Analytics',
    description: 'Analyze vendor rates, find savings, and benchmark pricing',
    longDescription: 'Upload and compare vendor rate cards. Detect outliers, benchmark against market rates, identify consolidation opportunities, and forecast rate trends.',
    icon: DollarSign,
    gradient: 'from-lime-600 to-green-600',
    category: 'platform',
    status: 'active',
    tags: ['rates', 'pricing', 'benchmarking'],
    href: '/rate-cards',
  },
  // --- Integrations ---
  {
    id: 'word-addin',
    name: 'Word Add-in',
    description: 'AI-powered contract tools inside Microsoft Word',
    longDescription: 'Access contract analysis, clause suggestions, and drafting assistance directly within Microsoft Word. Review documents without switching tools.',
    icon: FileCode,
    gradient: 'from-blue-600 to-blue-700',
    category: 'integrations',
    status: 'active',
    tags: ['Word', 'Office', 'add-in'],
    href: '/settings',
  },
  {
    id: 'webhooks',
    name: 'Webhooks & API',
    description: 'Connect ConTigo to your existing tools via webhooks',
    longDescription: 'Set up webhooks for real-time event notifications. Integrate with Slack, Teams, Salesforce, or any system via our REST API and webhook infrastructure.',
    icon: Code,
    gradient: 'from-slate-600 to-slate-800',
    category: 'integrations',
    status: 'active',
    tags: ['API', 'webhooks', 'integration'],
    href: '/admin/integrations',
  },
  {
    id: 'data-export',
    name: 'Data Export',
    description: 'Export contracts, analytics, and reports in multiple formats',
    longDescription: 'Export your data as CSV, Excel, PDF, or JSON. Schedule automated exports, create custom report templates, and integrate with your BI tools.',
    icon: Download,
    gradient: 'from-gray-500 to-zinc-600',
    category: 'integrations',
    status: 'active',
    tags: ['export', 'reports', 'data'],
    href: '/admin/records',
  },
];

const CATEGORY_META: Record<string, { label: string; description: string; icon: any; color: string }> = {
  'ai-tools': { label: 'AI Tools', description: 'Powered by GPT-4 and pgvector semantic search', icon: Sparkles, color: 'violet' },
  'platform': { label: 'Platform', description: 'Core contract lifecycle management capabilities', icon: Layers, color: 'blue' },
  'integrations': { label: 'Integrations', description: 'Connect with external tools and services', icon: Code, color: 'emerald' },
};

function ToolboxView() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeTool, setActiveTool] = useState<ToolConfig | null>(null);
  const [toolInput, setToolInput] = useState('');
  const [toolOutput, setToolOutput] = useState<string | null>(null);
  const [toolLoading, setToolLoading] = useState(false);

  const filteredTools = TOOLBOX_ITEMS.filter(tool => {
    const matchesSearch = !searchQuery || 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleRunTool = async () => {
    if (!activeTool || !toolInput.trim()) return;
    setToolLoading(true);
    setToolOutput(null);
    try {
      if (activeTool.apiEndpoint) {
        // Build the correct payload based on which API we're calling
        let fetchOptions: RequestInit;
        const toolId = activeTool.id;
        
        if (toolId === 'semantic-search') {
          // /api/agents/chat accepts { message, conversationHistory }
          fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: toolInput, conversationHistory: [] }),
          };
        } else if (toolId === 'clause-extractor' || toolId === 'risk-scorer') {
          // /api/ai/extract accepts { text, focus }
          fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: toolInput, focus: toolId === 'clause-extractor' ? 'clauses' : 'risks' }),
          };
        } else if (toolId === 'document-comparator') {
          // /api/ai/compare needs contractIds — for raw text mode, use summarize as fallback
          fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contractText: toolInput, level: 'detailed', options: { focus: 'comparison' } }),
          };
        } else {
          // contract-analyzer, text-transformer → /api/ai/summarize accepts { contractText, level }
          fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              contractText: toolInput, 
              level: toolId === 'text-transformer' ? 'plain_language' : 'executive',
              options: { detailed: true },
            }),
          };
        }

        const res = await fetch(activeTool.apiEndpoint, fetchOptions);
        if (res.ok) {
          const data = await res.json();
          setToolOutput(JSON.stringify(data, null, 2));
          toast.success(`${activeTool.name} completed successfully`);
        } else {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }));
          setToolOutput(JSON.stringify({ error: err.error || err.message || 'Request failed' }, null, 2));
          toast.error(`${activeTool.name} failed`);
        }
      }
    } catch (err) {
      setToolOutput(JSON.stringify({ error: 'Network error — check your connection' }, null, 2));
      toast.error('Request failed');
    } finally {
      setToolLoading(false);
    }
  };

  const categories = [
    { id: 'all', label: 'All Tools', count: TOOLBOX_ITEMS.length },
    { id: 'ai-tools', label: 'AI Tools', count: TOOLBOX_ITEMS.filter(t => t.category === 'ai-tools').length },
    { id: 'platform', label: 'Platform', count: TOOLBOX_ITEMS.filter(t => t.category === 'platform').length },
    { id: 'integrations', label: 'Integrations', count: TOOLBOX_ITEMS.filter(t => t.category === 'integrations').length },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-violet-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">AI Toolbox</h2>
            <p className="text-slate-500 font-medium">Run AI tools, access platform capabilities, and manage integrations</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-50 text-emerald-700 border-transparent font-bold px-3 py-1.5 rounded-lg text-sm">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            {TOOLBOX_ITEMS.filter(t => t.status === 'active').length} Active
          </Badge>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <Card className="border-transparent shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <Input
                placeholder="Search tools by name, description, or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors text-sm font-medium"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200",
                    activeCategory === cat.id
                      ? "bg-violet-100 text-violet-700 shadow-sm"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  )}
                >
                  {cat.label}
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-md font-bold",
                    activeCategory === cat.id ? "bg-violet-200/60 text-violet-800" : "bg-slate-200/60 text-slate-600"
                  )}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Sections */}
      {(['ai-tools', 'platform', 'integrations'] as const).map(category => {
        const tools = filteredTools.filter(t => t.category === category);
        if (tools.length === 0) return null;
        const meta = CATEGORY_META[category];
        return (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center",
                category === 'ai-tools' ? 'bg-violet-100 text-violet-600' :
                category === 'platform' ? 'bg-blue-100 text-blue-600' :
                'bg-emerald-100 text-emerald-600'
              )}>
                <meta.icon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{meta.label}</h3>
                <p className="text-xs font-medium text-slate-500">{meta.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tools.map(tool => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  onOpen={() => {
                    if (tool.href && !tool.apiEndpoint) {
                      router.push(tool.href);
                    } else {
                      setActiveTool(tool);
                      setToolInput('');
                      setToolOutput(null);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}

      {filteredTools.length === 0 && (
        <Card className="border-transparent shadow-sm rounded-2xl bg-white">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <p className="font-bold text-slate-700">No tools found</p>
            <p className="text-sm font-medium text-slate-500 mt-1">Try adjusting your search or filters</p>
          </CardContent>
        </Card>
      )}

      {/* Tool Runner Modal */}
      <Dialog open={!!activeTool} onOpenChange={(open) => { if (!open) { setActiveTool(null); setToolOutput(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          {activeTool && (
            <>
              <DialogHeader className="flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md", activeTool.gradient)}>
                    <activeTool.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black text-slate-900">
                      {activeTool.name}
                      {activeTool.status === 'beta' && (
                        <Badge className="ml-2 bg-amber-100 text-amber-700 border-transparent text-xs font-bold">Beta</Badge>
                      )}
                    </DialogTitle>
                    <DialogDescription className="text-sm font-medium text-slate-500">
                      {activeTool.longDescription}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-4 py-4">
                {/* Input Area */}
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700">
                    {activeTool.id === 'semantic-search' ? 'Search Query' : 
                     activeTool.id === 'document-comparator' ? 'Paste document text to analyze' :
                     'Contract text or content to analyze'}
                  </Label>
                  <Textarea
                    placeholder={
                      activeTool.id === 'semantic-search' 
                        ? 'e.g., "Find all contracts with auto-renewal clauses expiring in 2026"'
                        : activeTool.id === 'text-transformer'
                        ? 'Paste the text you want to transform...'
                        : 'Paste contract text or describe what you need...'
                    }
                    value={toolInput}
                    onChange={(e) => setToolInput(e.target.value)}
                    className="min-h-[160px] rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors resize-y text-sm font-medium leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{toolInput.length} characters</span>
                    <div className="flex items-center gap-2">
                      {activeTool.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px] bg-slate-100 text-slate-500 font-semibold rounded-md">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Output Area */}
                {toolOutput && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold text-slate-700">Results</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(toolOutput);
                          toast.success('Copied to clipboard');
                        }}
                        className="h-7 text-xs font-bold text-slate-500 hover:text-slate-700"
                      >
                        <Copy className="w-3 h-3 mr-1.5" />
                        Copy
                      </Button>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                      <pre className="text-sm text-emerald-400 font-mono leading-relaxed whitespace-pre-wrap break-words">
                        {toolOutput}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-shrink-0 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between w-full gap-3">
                  <div className="flex items-center gap-2">
                    {activeTool.href && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(activeTool.href!)}
                        className="rounded-xl font-bold text-sm"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Open Full View
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => { setActiveTool(null); setToolOutput(null); }}
                      className="rounded-xl font-bold text-sm"
                    >
                      Close
                    </Button>
                    <Button
                      onClick={handleRunTool}
                      disabled={!toolInput.trim() || toolLoading}
                      className={cn(
                        "rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all",
                        "bg-gradient-to-r text-white",
                        activeTool.gradient
                      )}
                    >
                      {toolLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Run {activeTool.name}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolCard({ tool, onOpen }: { tool: ToolConfig; onOpen: () => void }) {
  return (
    <Card
      onClick={onOpen}
      className={cn(
        "group cursor-pointer border-transparent shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden rounded-2xl bg-white",
        tool.status === 'coming-soon' && "opacity-60 cursor-not-allowed"
      )}
    >
      <CardContent className="p-0">
        <div className={cn("h-1.5 bg-gradient-to-r", tool.gradient)} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className={cn(
              "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm shrink-0 group-hover:scale-110 transition-transform",
              tool.gradient
            )}>
              <tool.icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {tool.status === 'active' && (
                <Badge className="bg-emerald-50 text-emerald-700 border-transparent text-[10px] font-bold px-2 py-0.5 rounded-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Active
                </Badge>
              )}
              {tool.status === 'beta' && (
                <Badge className="bg-amber-50 text-amber-700 border-transparent text-[10px] font-bold px-2 py-0.5 rounded-md">Beta</Badge>
              )}
              {tool.status === 'coming-soon' && (
                <Badge className="bg-slate-50 text-slate-500 border-transparent text-[10px] font-bold px-2 py-0.5 rounded-md">Soon</Badge>
              )}
            </div>
          </div>

          <h3 className="font-bold text-sm text-slate-900 group-hover:text-violet-700 transition-colors mb-1.5">
            {tool.name}
          </h3>
          <p className="text-xs font-medium text-slate-500 leading-relaxed mb-3">
            {tool.description}
          </p>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              {tool.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="secondary" className="text-[10px] bg-slate-50 text-slate-500 font-semibold rounded-md px-2 py-0.5">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity">
              {tool.apiEndpoint ? 'Run' : 'Open'}
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KnowledgeView() {
  const router = useRouter();
  const [stats, setStats] = useState<{ entities: number; connections: number; clusters: number }>({
    entities: 0, connections: 0, clusters: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch real counts from the dashboard-stats endpoint
    fetch('/api/agents/dashboard-stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const d = data?.data || data || {};
        setStats({
          entities: d.totalEvents || d.contracts?.length || 0,
          connections: d.activeRecommendations || 0,
          clusters: d.opportunities?._count || d.learningRecords || 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <GitBranch className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Knowledge Graph</h2>
            <p className="text-slate-500 font-medium">Explore entity relationships across your contract portfolio</p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <Card className="border-transparent shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
          <div className="text-center py-20 px-8">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mx-auto mb-6">
              <GitBranch className="w-12 h-12 text-indigo-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Interactive Knowledge Graph</h3>
            <p className="text-slate-500 font-medium max-w-lg mx-auto mb-2">
              Visualize and explore connections between vendors, contracts, clauses, and obligations
            </p>
            <div className="flex items-center justify-center gap-6 my-8">
              {[
                { label: 'Entities', value: loading ? '...' : stats.entities.toLocaleString(), icon: Layers },
                { label: 'Connections', value: loading ? '...' : stats.connections.toLocaleString(), icon: GitBranch },
                { label: 'Clusters', value: loading ? '...' : stats.clusters.toLocaleString(), icon: Network },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-xl border border-slate-100">
                  <stat.icon className="w-5 h-5 text-indigo-500" />
                  <div className="text-left">
                    <p className="text-xl font-black text-slate-900">{stat.value}</p>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              onClick={() => router.push('/intelligence/graph')}
              className="h-12 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Knowledge Graph
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
