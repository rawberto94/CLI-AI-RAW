'use client';

import React, { lazy, Suspense } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { PageBreadcrumb } from '@/components/navigation';
const IntelligenceDashboard = lazy(() => import('@/components/dashboard/IntelligenceDashboard').then(m => ({ default: m.IntelligenceDashboard })));
import {
  Brain,
  Share2,
  Activity,
  Search,
  GitCompare,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Shield,
  Zap,
  MessageCircle,
  AlertTriangle,
  RefreshCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HealthScores {
  average: number;
  healthy: number;
  atRisk: number;
  critical: number;
  improving: number;
  declining: number;
}

interface Insight {
  id: string;
  type: 'risk' | 'opportunity' | 'compliance';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  contractId?: string;
  createdAt: string;
}

interface IntelligenceData {
  healthScores: HealthScores;
  insights: Insight[];
  recentActivity: Array<{ type: string; message: string; time: string }>;
  aiCapabilities: { searchEnabled: boolean; healthScoresEnabled: boolean; negotiationCopilotEnabled: boolean; knowledgeGraphEnabled: boolean };
}

const features = [
  {
    id: 'graph',
    title: 'Contract Knowledge Graph',
    description: 'Visualize relationships between contracts, suppliers, clauses, and risks in an interactive graph explorer.',
    icon: Share2,
    href: '/intelligence/graph',
    color: 'from-violet-500 to-purple-500',
  },
  {
    id: 'health',
    title: 'Contract Health Scores',
    description: 'Monitor contract performance with AI-powered health scoring across risk, compliance, financial, and operational dimensions.',
    icon: Activity,
    href: '/intelligence/health',
    color: 'from-violet-500 to-violet-500',
  },
  {
    id: 'search',
    title: 'Universal RAG Search',
    description: 'Ask questions in natural language and get AI-powered answers with evidence links from across your contract portfolio.',
    icon: Search,
    href: '/intelligence/search',
    color: 'from-violet-500 to-pink-500',
  },
  {
    id: 'negotiate',
    title: 'Negotiation Co-Pilot',
    description: 'AI-assisted redline analysis with playbook matching, risk assessment, and counter-proposal suggestions.',
    icon: GitCompare,
    href: '/intelligence/negotiate',
    color: 'from-amber-500 to-orange-500',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function IntelligencePage() {
  const { data, isLoading, refetch } = useQuery<{ data: IntelligenceData }>({
    queryKey: ['intelligence'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence');
      if (!res.ok) throw new Error('Failed to fetch intelligence data');
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const health = data?.data?.healthScores;
  const insights = data?.data?.insights || [];
  const activity = data?.data?.recentActivity || [];

  const openChatbot = (prompt?: string) => {
    window.dispatchEvent(new CustomEvent('openAIChatbot', { detail: prompt ? { message: prompt } : undefined }));
  };

  const highSeverity = insights.filter(i => i.severity === 'high').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/30">
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-3 sticky top-0 z-30">
        <PageBreadcrumb />
      </div>
      
      <div className="p-6">
      {/* Header */}
      <motion.div 
        className="max-w-[1600px] mx-auto mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 mb-2">
            <motion.div 
              className="w-16 h-16 bg-gradient-to-br from-violet-500 via-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/30"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Brain className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-purple-600 bg-clip-text text-transparent">
                Contract Intelligence
              </h1>
              <p className="text-muted-foreground text-lg">AI-powered insights and analysis for your contract portfolio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
              <RefreshCcw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700" onClick={() => openChatbot('Give me an overview of my contract portfolio health and key intelligence insights')}>
              <MessageCircle className="h-3.5 w-3.5" /> Ask AI
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Intelligence Dashboard — aggregate agent metrics */}
      <div className="max-w-[1600px] mx-auto mb-8">
        <Suspense fallback={<div className="h-64 bg-slate-100 rounded-lg animate-pulse" />}>
          <IntelligenceDashboard />
        </Suspense>
      </div>

      {/* Quick Stats — LIVE from API */}
      <motion.div 
        className="max-w-[1600px] mx-auto mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon={TrendingUp} gradient="from-violet-500 to-purple-500" value={isLoading ? '—' : String(health?.average ?? '—')} label="Avg Health Score" loading={isLoading} />
          <StatCard icon={Shield} gradient="from-violet-500 to-purple-500" value={isLoading ? '—' : `${health ? Math.round((health.healthy / Math.max(health.healthy + health.atRisk + health.critical, 1)) * 100) : '—'}%`} label="Compliance Rate" loading={isLoading} />
          <StatCard icon={Sparkles} gradient="from-violet-500 to-pink-500" value={isLoading ? '—' : String(insights.length)} label="AI Insights" loading={isLoading} />
          <StatCard icon={Zap} gradient="from-amber-500 to-orange-500" value={isLoading ? '—' : String(highSeverity)} label="Actions Required" loading={isLoading} />
        </div>
      </motion.div>

      {/* Active Insights (live) */}
      {insights.length > 0 && (
        <motion.div
          className="max-w-[1600px] mx-auto mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Active Risk Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.slice(0, 4).map((insight) => (
              <div key={insight.id} className="bg-white/90 backdrop-blur-xl rounded-xl p-4 border border-white/50 shadow-md flex items-start gap-3">
                <Badge variant={insight.severity === 'high' ? 'destructive' : 'secondary'} className="mt-0.5 text-[10px]">
                  {insight.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{insight.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{insight.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-[10px] text-violet-600 italic">{insight.recommendation}</p>
                    {insight.contractId && (
                      <Link href={`/contracts/${insight.contractId}`} className="text-[10px] text-violet-600 hover:underline font-medium flex-shrink-0">
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Feature Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-[1600px] mx-auto grid grid-cols-2 gap-6"
      >
        {features.map((feature) => {
          const Icon = feature.icon;
          const featureStats = getFeatureStats(feature.id, health, insights);
          return (
            <motion.div key={feature.id} variants={item}>
              <Link href={feature.href}>
                <motion.div 
                  className="group relative overflow-hidden bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 p-6 shadow-xl hover:shadow-2xl transition-all cursor-pointer"
                  whileHover={{ scale: 1.01, y: -4 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-slate-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="flex items-start gap-4 relative">
                    <motion.div 
                      className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center flex-shrink-0 shadow-lg`}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Icon className="w-8 h-8 text-white" />
                    </motion.div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-slate-900 group-hover:text-violet-600 transition-colors flex items-center gap-2">
                        {feature.title}
                        <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </h3>
                      <p className="text-muted-foreground mt-1 mb-4">{feature.description}</p>
                      <div className="text-xs text-muted-foreground bg-slate-100/80 dark:bg-slate-800/50 px-4 py-2 rounded-full inline-block backdrop-blur-sm">
                        {featureStats}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* AI Assistant Banner — now opens chatbot */}
      <motion.div 
        className="max-w-[1600px] mx-auto mt-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-purple-600 rounded-2xl p-6 text-white shadow-2xl shadow-violet-500/30">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-4">
              <motion.div 
                className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-7 h-7" />
              </motion.div>
              <div>
                <h3 className="text-xl font-semibold">AI Contract Assistant</h3>
                <p className="text-violet-100">Ask about health scores, risks, insights, or anything across your portfolio</p>
              </div>
            </div>
            <div className="flex gap-3">
              <motion.button 
                className="px-5 py-2.5 bg-white/20 text-white rounded-xl font-semibold hover:bg-white/30 transition-colors flex items-center gap-2 backdrop-blur-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openChatbot('What are the top risk insights and contracts that need my attention right now?')}
              >
                <MessageCircle className="w-4 h-4" />
                Ask AI
              </motion.button>
              <Link href="/intelligence/search">
                <motion.button 
                  className="px-5 py-2.5 bg-white text-violet-600 rounded-xl font-semibold hover:bg-violet-50 transition-colors flex items-center gap-2 shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Search className="w-4 h-4" />
                  RAG Search
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Recent Activity (live) */}
      {activity.length > 0 && (
        <motion.div
          className="max-w-[1600px] mx-auto mt-6 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-sm font-semibold text-slate-500 mb-2">Recent Activity</h2>
          <div className="flex flex-wrap gap-2">
            {activity.slice(0, 6).map((a, i) => (
              <span key={i} className="text-xs bg-white/80 border border-slate-100 rounded-full px-3 py-1 text-slate-600">
                {a.message} — {a.time}
              </span>
            ))}
          </div>
        </motion.div>
      )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, gradient, value, label, loading }: { icon: React.ComponentType<{ className?: string }>; gradient: string; value: string; label: string; loading: boolean }) {
  return (
    <motion.div
      className="bg-white/90 backdrop-blur-xl rounded-xl p-5 border border-white/50 shadow-xl shadow-violet-500/5 hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300 group"
      whileHover={{ scale: 1.02, y: -2 }}
    >
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className={`text-3xl font-bold bg-gradient-to-r ${gradient.replace('to-purple-500', 'to-purple-600').replace('to-pink-500', 'to-pink-600').replace('to-orange-500', 'to-orange-600')} bg-clip-text text-transparent ${loading ? 'animate-pulse' : ''}`}>
            {value}
          </div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </div>
    </motion.div>
  );
}

function getFeatureStats(id: string, health: HealthScores | undefined, insights: Insight[]): string {
  if (!health) return 'Loading...';
  switch (id) {
    case 'graph':
      return `${health.healthy + health.atRisk + health.critical} contracts • ${health.atRisk + health.critical} need attention`;
    case 'health':
      return `${health.average} avg score • ${health.atRisk} at risk • ${health.critical} critical`;
    case 'search':
      return `${health.healthy + health.atRisk + health.critical} contracts indexed • AI-powered Q&A`;
    case 'negotiate':
      return `${insights.filter(i => i.severity === 'high').length} high priority • ${insights.length} total insights`;
    default:
      return '';
  }
}
