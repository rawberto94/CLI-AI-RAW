"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight, ClipboardList, FileBarChart, FileText, HelpCircle,
  LayoutGrid, Loader2, PenTool, Plus, Rocket, Search, Sparkles,
  Clock, CheckCircle2, AlertTriangle, TrendingUp, FolderKanban,
  MessageSquare, RefreshCcw, Send, Brain, Zap,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════

interface RequestMetrics {
  total: number;
  submitted: number;
  in_triage: number;
  approved: number;
  in_progress: number;
  completed: number;
  rejected: number;
  sla_breached: number;
}

async function fetchMyMetrics(): Promise<RequestMetrics | null> {
  try {
    const res = await fetch("/api/requests?view=my-requests&limit=1");
    const json = await res.json();
    if (json.success) return json.data.metrics;
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════

const quickActions = [
  {
    icon: Plus,
    label: "New Contract Request",
    description: "Submit a request for a new contract, renewal, or amendment",
    href: "/requests/new",
    color: "from-violet-600 to-indigo-600",
    badge: null,
  },
  {
    icon: FileText,
    label: "Generate Contract",
    description: "Create a contract from templates with AI assistance",
    href: "/contracts/generate",
    color: "from-cyan-600 to-blue-600",
    badge: null,
  },
  {
    icon: PenTool,
    label: "AI Drafting Studio",
    description: "Draft contracts with the AI copilot editor",
    href: "/drafting",
    color: "from-emerald-600 to-teal-600",
    badge: null,
  },
  {
    icon: FileBarChart,
    label: "AI Report Builder",
    description: "Generate AI-powered analytics and summaries",
    href: "/reports/ai-builder",
    color: "from-amber-500 to-orange-600",
    badge: null,
  },
  {
    icon: Search,
    label: "Smart Search",
    description: "Find contracts, clauses, and insights instantly",
    href: "/search",
    color: "from-pink-600 to-rose-600",
    badge: null,
  },
  {
    icon: FolderKanban,
    label: "Template Library",
    description: "Browse and use pre-approved contract templates",
    href: "/templates",
    color: "from-slate-600 to-gray-700",
    badge: null,
  },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

// ═══════════════════════════════════════════════════════════════════════

export default function SelfServiceHubPage() {
  const { data: metrics } = useQuery({
    queryKey: ["self-service-my-metrics"],
    queryFn: fetchMyMetrics,
    refetchInterval: 30_000,
  });

  const openRequests = (metrics?.submitted ?? 0) + (metrics?.in_triage ?? 0) + (metrics?.approved ?? 0) + (metrics?.in_progress ?? 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      <div className="max-w-[1200px] mx-auto p-6 space-y-8">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 p-8 text-white">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <Rocket className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-bold">Self-Service Hub</h1>
              </div>
              <p className="text-violet-100 max-w-xl">
                Everything you need to request, draft, generate, and track contracts — without waiting for the legal team.
              </p>
            </div>
            {/* Decorative bg */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-1/2" />
          </div>
        </motion.div>

        {/* My Request Status Summary */}
        {metrics && (metrics.total > 0) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-violet-500" />
                    My Request Summary
                  </CardTitle>
                  <Link href="/self-service/my-requests">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs text-violet-600">
                      View all <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <MetricPill icon={Send} label="Open" value={openRequests} color="text-blue-600 bg-blue-50" />
                  <MetricPill icon={Clock} label="Awaiting Triage" value={metrics.submitted + metrics.in_triage} color="text-amber-600 bg-amber-50" />
                  <MetricPill icon={CheckCircle2} label="Approved" value={metrics.approved} color="text-emerald-600 bg-emerald-50" />
                  <MetricPill icon={CheckCircle2} label="Completed" value={metrics.completed} color="text-violet-600 bg-violet-50" />
                  {metrics.sla_breached > 0 && (
                    <MetricPill icon={AlertTriangle} label="SLA Breached" value={metrics.sla_breached} color="text-red-600 bg-red-50" />
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Actions Grid */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Quick Actions
          </h2>
          <motion.div variants={container} initial="hidden" animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <motion.div key={action.href} variants={item}>
                <Link href={action.href}>
                  <Card className="group h-full border-slate-200 hover:shadow-lg hover:border-violet-200 transition-all cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                          <action.icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">
                              {action.label}
                            </h3>
                            {action.badge && (
                              <Badge variant="secondary" className="text-[10px]">{action.badge}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{action.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Help Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-slate-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Need help?</p>
                  <p className="text-xs text-slate-500">Ask the AI assistant anything about contracts</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full gap-2"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("openAIChatbot"));
                  }
                }}>
                <MessageSquare className="h-3.5 w-3.5" /> Open AI Chatbot
              </Button>
            </CardContent>
          </Card>

          <Link href="/self-service/help">
            <Card className="border-slate-200 hover:shadow-md transition-shadow h-full cursor-pointer">
              <CardContent className="p-5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Help &amp; Guides</p>
                  <p className="text-xs text-slate-500">
                    Step-by-step walkthroughs, FAQs, and tips for using the platform
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 ml-auto flex-shrink-0" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* How It Works */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { step: "1", title: "Submit Request", desc: "Fill out a short form with your contract needs and urgency", icon: Send },
                { step: "2", title: "Auto-Routed", desc: "The system automatically triages and assigns your request by SLA", icon: Zap },
                { step: "3", title: "Track Progress", desc: "Monitor your request in real-time with status updates and SLA tracking", icon: Clock },
                { step: "4", title: "Get Your Contract", desc: "Receive the completed contract, review, and execute", icon: CheckCircle2 },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {s.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════

function MetricPill({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  const [bg, text] = color.split(" ");
  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-lg ${bg}`}>
      <Icon className={`h-4 w-4 ${text}`} />
      <div>
        <p className={`text-lg font-bold ${text}`}>{value}</p>
        <p className="text-[10px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}
