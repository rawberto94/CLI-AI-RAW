"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BookOpen, Brain, CheckCircle2, ChevronDown,
  ChevronRight, ClipboardList, Clock, ExternalLink, FileBarChart,
  FileText, FolderKanban, HelpCircle, Lightbulb, MessageSquare,
  PenTool, Plus, Rocket, Search, Send, Shield, Sparkles,
  TrendingUp, Upload, Users, Zap, GitBranch, RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════

interface FAQItem {
  question: string;
  answer: string;
  tags: string[];
}

interface GuideItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  steps: string[];
  color: string;
}

const faqs: FAQItem[] = [
  {
    question: "How do I request a new contract?",
    answer: "Go to Self-Service Hub → New Contract Request. Fill out the form with the contract title, type, urgency, counterparty details, and business justification. The system will automatically route it based on urgency — Critical requests get a 4-hour SLA, High gets 24h, Medium gets 72h, and Low gets 7 days.",
    tags: ["requests", "new", "getting started"],
  },
  {
    question: "How do I track my contract request status?",
    answer: "Visit My Requests from the Self-Service Hub. You'll see all your submitted requests with real-time status updates (Submitted → In Triage → Approved → In Progress → Completed). Click any request to see the full progress timeline, SLA countdown, and details.",
    tags: ["tracking", "status", "requests"],
  },
  {
    question: "What are the SLA response times?",
    answer: "Response SLAs are based on the urgency you select: Critical = 4 hours, High = 24 hours, Medium = 72 hours (3 days), Low = 168 hours (7 days). If the SLA is breached, the request is automatically flagged. You can see SLA status on each request card.",
    tags: ["sla", "urgency", "timing"],
  },
  {
    question: "How do I generate a contract from a template?",
    answer: "Go to Generate Contract from the Self-Service Hub. Browse the template library (NDA, MSA, SOW, SLA, etc.), select one, fill in the variables (party names, dates, terms), preview the output, and download. You can also start from scratch using the AI Drafting Studio.",
    tags: ["templates", "generate", "drafting"],
  },
  {
    question: "How can I compare two contracts?",
    answer: "Navigate to Compare from the main menu. Select two contracts to view a side-by-side diff highlighting additions, deletions, and modifications. The AI analyzer can also summarize key differences and flag risk areas.",
    tags: ["compare", "diff", "analysis"],
  },
  {
    question: "How do I use the AI Report Builder?",
    answer: "Go to AI Report Builder from Self-Service. Select filters (suppliers, categories, date ranges, statuses), choose a report preset or create custom criteria, then generate the report. Reports include analytics, benchmarks, and AI-powered recommendations. You can schedule recurring reports (daily/weekly/monthly) and export to Excel or PDF.",
    tags: ["reports", "analytics", "ai"],
  },
  {
    question: "Can I search across all my contracts?",
    answer: "Use Smart Search from the sidebar or Self-Service Hub. It supports semantic search — you can ask natural language questions like 'which contracts expire next month' or 'NDA with Acme Corp'. Advanced search lets you filter by status, type, date, supplier, value, and more.",
    tags: ["search", "find", "semantic"],
  },
  {
    question: "How do contract workflows work?",
    answer: "Workflows automate the approval and review process. When a contract needs approval, it enters the workflow pipeline (Pending → In Review → Approved/Rejected). You can view pending items in Workflows. Escalation rules automatically bump unresolved items, and SLA tracking ensures timely reviews.",
    tags: ["workflows", "approvals", "process"],
  },
  {
    question: "How do I renew an expiring contract?",
    answer: "The Renewals page shows all contracts approaching expiration (30/60/90 days). Click on a contract to initiate renewal — you can duplicate the existing terms, negotiate new terms, or submit a renewal request through self-service. The dashboard also sends proactive expiry alerts.",
    tags: ["renewals", "expiry", "deadlines"],
  },
  {
    question: "What is the Ecosystem dashboard?",
    answer: "The Ecosystem Command Center gives you a unified view across ERP integrations, spend management, and contract intelligence. It shows integration health (ERP sync status, data completeness), spend analytics (PO/Invoice matching, variance), supplier concentration, and cross-system data quality metrics.",
    tags: ["ecosystem", "erp", "integrations", "spend"],
  },
  {
    question: "How do I use the AI Chatbot?",
    answer: "Click the AI Chatbot button in the sidebar (or the floating bubble). You can ask natural language questions about your contracts, clauses, obligations, and spend data. The chatbot can also execute workflow actions — start approvals, check statuses, assign approvers, and escalate items.",
    tags: ["chatbot", "ai", "help"],
  },
  {
    question: "Who manages contract compliance and risk?",
    answer: "The Governance & Risk section has three tools: Governance (policies, pre-approval gates, routing rules, signature policies), Compliance (regulatory tracking, audit readiness), and Risk (vendor risk assessments, risk scoring). These are typically managed by legal/admin teams but visible to all users.",
    tags: ["governance", "compliance", "risk"],
  },
];

const guides: GuideItem[] = [
  {
    title: "Submit a Contract Request",
    description: "Get a new contract, renewal, or amendment processed by your legal team",
    icon: Send,
    href: "/requests/new",
    steps: [
      "Click 'New Contract Request' from the Self-Service Hub",
      "Enter a descriptive title and select the request type (New, Renewal, Amendment, etc.)",
      "Set the urgency level — this determines your SLA response time",
      "Fill in counterparty details, estimated value, and business justification",
      "Attach any supporting documents (SOW, specs, etc.)",
      "Submit — you'll get a confirmation and can track progress in My Requests",
    ],
    color: "from-violet-600 to-indigo-600",
  },
  {
    title: "Generate a Contract from Template",
    description: "Use pre-approved templates to create contracts in minutes",
    icon: FileText,
    href: "/contracts/generate",
    steps: [
      "Browse the template library — NDA, MSA, SOW, SLA, DPA, and more",
      "Select a template and review its structure",
      "Fill in the variable fields (party names, dates, dollar amounts, terms)",
      "Preview the generated contract in real-time",
      "Download as PDF/DOCX or save as a draft for further editing",
    ],
    color: "from-cyan-600 to-blue-600",
  },
  {
    title: "Draft with AI Copilot",
    description: "Write and refine contract language with AI suggestions",
    icon: PenTool,
    href: "/drafting",
    steps: [
      "Open the AI Drafting Studio from Self-Service",
      "Start a blank draft or import an existing contract",
      "Use the AI copilot to suggest clauses, improve language, and flag risks",
      "Review AI suggestions inline — accept, modify, or reject each one",
      "Export the final draft or send it directly into a workflow for approval",
    ],
    color: "from-emerald-600 to-teal-600",
  },
  {
    title: "Build an Analytics Report",
    description: "Generate custom reports with AI-powered insights",
    icon: FileBarChart,
    href: "/reports/ai-builder",
    steps: [
      "Open the AI Report Builder",
      "Select filters: suppliers, categories, date ranges, contract statuses",
      "Choose a report preset or define custom analysis criteria",
      "Click Generate — the AI analyzes your contract portfolio and produces insights",
      "Review benchmarks, recommendations, and trend analysis",
      "Export to Excel/PDF or schedule recurring delivery (daily/weekly/monthly)",
    ],
    color: "from-amber-500 to-orange-600",
  },
  {
    title: "Track Renewals & Obligations",
    description: "Never miss an expiry or obligation deadline",
    icon: RefreshCcw,
    href: "/renewals",
    steps: [
      "Visit the Renewals page to see contracts expiring in 30/60/90 days",
      "Click a contract to view details and initiate renewal",
      "Check Obligations to see upcoming contractual deadlines",
      "Both pages highlight overdue items at the top with red badges",
      "Set up renewal reminders through the notification system",
    ],
    color: "from-rose-500 to-pink-600",
  },
  {
    title: "Search & Find Contracts",
    description: "Use semantic search to find anything across your portfolio",
    icon: Search,
    href: "/search",
    steps: [
      "Open Smart Search from the sidebar or Self-Service Hub",
      "Type a natural language query, e.g. 'NDAs expiring next quarter'",
      "Use advanced filters for precise matching (status, date, value, supplier)",
      "Click any result to view the full contract detail page",
      "Save frequent searches for quick access later",
    ],
    color: "from-pink-600 to-rose-600",
  },
];

// ═══════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null);

  const filteredFaqs = searchQuery.trim()
    ? faqs.filter(
        (f) =>
          f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.tags.some((t) => t.includes(searchQuery.toLowerCase()))
      )
    : faqs;

  const filteredGuides = searchQuery.trim()
    ? guides.filter(
        (g) =>
          g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.steps.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : guides;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      <div className="max-w-[1100px] mx-auto p-6 space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-4">
            <Link href="/self-service">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Hub
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Help &amp; Guides</h1>
              <p className="text-sm text-slate-500">Step-by-step walkthroughs, FAQs, and platform tips</p>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-10 h-11 text-sm"
              placeholder="Search for help topics, e.g. 'how to renew', 'SLA', 'templates'..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </motion.div>

        {/* Quick Help */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("openAIChatbot")); }}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Brain className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Ask AI Assistant</p>
                <p className="text-xs text-slate-500">Get instant answers about your contracts</p>
              </div>
            </CardContent>
          </Card>
          <Link href="/self-service">
            <Card className="border-slate-200 hover:shadow-md transition-shadow h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Rocket className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Self-Service Hub</p>
                  <p className="text-xs text-slate-500">All quick actions in one place</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/requests/new">
            <Card className="border-slate-200 hover:shadow-md transition-shadow h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Plus className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">New Request</p>
                  <p className="text-xs text-slate-500">Can&apos;t find what you need? Submit a request</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Step-by-Step Guides */}
        {filteredGuides.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-violet-500" />
              Step-by-Step Guides
            </h2>
            <div className="space-y-3">
              {filteredGuides.map((guide, i) => {
                const isOpen = expandedGuide === i;
                return (
                  <Card key={guide.title} className={cn("border-slate-200 overflow-hidden transition-shadow", isOpen && "shadow-md ring-1 ring-violet-100")}>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50"
                      onClick={() => setExpandedGuide(isOpen ? null : i)}>
                      <div className="flex items-center gap-3">
                        <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0", guide.color)}>
                          <guide.icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{guide.title}</p>
                          <p className="text-xs text-slate-500">{guide.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={guide.href} onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="text-xs gap-1">
                            Go <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                        {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      </div>
                    </div>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="px-4 pb-4 pt-0 border-t border-slate-100">
                            <div className="mt-3 space-y-2">
                              {guide.steps.map((step, j) => (
                                <div key={j} className="flex items-start gap-3">
                                  <div className="h-6 w-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                    {j + 1}
                                  </div>
                                  <p className="text-sm text-slate-600">{step}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* FAQ */}
        {filteredFaqs.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Frequently Asked Questions
            </h2>
            <div className="space-y-2">
              {filteredFaqs.map((faq, i) => {
                const isOpen = expandedFaq === i;
                return (
                  <Card key={i} className={cn("border-slate-200 transition-shadow", isOpen && "shadow-sm")}>
                    <div className="p-4 cursor-pointer flex items-center justify-between gap-4 hover:bg-slate-50/50"
                      onClick={() => setExpandedFaq(isOpen ? null : i)}>
                      <p className="text-sm font-medium text-slate-800">{faq.question}</p>
                      {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                    </div>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="px-4 pb-4 border-t border-slate-50">
                            <p className="text-sm text-slate-600 mt-3 leading-relaxed">{faq.answer}</p>
                            <div className="flex gap-1.5 mt-2">
                              {faq.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* No results */}
        {searchQuery && filteredFaqs.length === 0 && filteredGuides.length === 0 && (
          <Card className="border-dashed border-slate-300">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-8 w-8 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-medium">No results for &ldquo;{searchQuery}&rdquo;</p>
              <p className="text-xs text-slate-400 mt-1">Try a different search term or ask the AI Chatbot</p>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5"
                onClick={() => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("openAIChatbot")); }}>
                <MessageSquare className="h-3.5 w-3.5" /> Ask AI
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Platform Tips */}
        <Card className="border-slate-200 bg-gradient-to-r from-violet-50/50 to-indigo-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Pro Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { tip: "Use the AI Chatbot to execute workflow actions — it can start approvals, check statuses, and escalate items for you.", icon: Brain },
                { tip: "Set your urgency level thoughtfully — Critical requests get 4-hour SLAs and are prioritized automatically.", icon: Clock },
                { tip: "The Smart Search understands natural language — try 'show me all NDAs worth over $100k' instead of clicking through filters.", icon: Search },
                { tip: "Schedule recurring reports in the AI Report Builder to get weekly contract portfolio insights delivered automatically.", icon: FileBarChart },
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/60">
                  <t.icon className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600">{t.tip}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
