'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PageBreadcrumb } from '@/components/navigation';
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
} from 'lucide-react';

const features = [
  {
    id: 'graph',
    title: 'Contract Knowledge Graph',
    description: 'Visualize relationships between contracts, suppliers, clauses, and risks in an interactive graph explorer.',
    icon: Share2,
    href: '/intelligence/graph',
    color: 'from-blue-500 to-cyan-500',
    stats: '5 contracts • 3 suppliers • 12 connections',
  },
  {
    id: 'health',
    title: 'Contract Health Scores',
    description: 'Monitor contract performance with AI-powered health scoring across risk, compliance, financial, and operational dimensions.',
    icon: Activity,
    href: '/intelligence/health',
    color: 'from-green-500 to-emerald-500',
    stats: '78 avg score • 2 at risk • 6 action items',
  },
  {
    id: 'search',
    title: 'Universal RAG Search',
    description: 'Ask questions in natural language and get AI-powered answers with evidence links from across your contract portfolio.',
    icon: Search,
    href: '/intelligence/search',
    color: 'from-purple-500 to-pink-500',
    stats: '15 contracts indexed • 120 clauses • 45 obligations',
  },
  {
    id: 'negotiate',
    title: 'Negotiation Co-Pilot',
    description: 'AI-assisted redline analysis with playbook matching, risk assessment, and counter-proposal suggestions.',
    icon: GitCompare,
    href: '/intelligence/negotiate',
    color: 'from-amber-500 to-orange-500',
    stats: '5 pending changes • 2 critical • 89% playbook match',
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
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      {/* Breadcrumb Navigation */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-3 sticky top-0 z-10">
        <PageBreadcrumb />
      </div>
      
      <div className="p-6">
      {/* Header */}
      <motion.div 
        className="max-w-6xl mx-auto mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-4 mb-2">
          <motion.div 
            className="w-16 h-16 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Brain className="w-8 h-8 text-white" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Contract Intelligence
            </h1>
            <p className="text-muted-foreground text-lg">AI-powered insights and analysis for your contract portfolio</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div 
        className="max-w-6xl mx-auto mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="grid grid-cols-4 gap-4">
          <motion.div 
            className="bg-white/90 backdrop-blur-xl rounded-xl p-5 border border-white/50 shadow-xl shadow-blue-500/5 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 group"
            whileHover={{ scale: 1.02, y: -2 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">78</div>
                <div className="text-sm text-muted-foreground">Avg Health Score</div>
              </div>
            </div>
          </motion.div>
          <motion.div 
            className="bg-white/90 backdrop-blur-xl rounded-xl p-5 border border-white/50 shadow-xl shadow-emerald-500/5 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 group"
            whileHover={{ scale: 1.02, y: -2 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">92%</div>
                <div className="text-sm text-muted-foreground">Compliance Rate</div>
              </div>
            </div>
          </motion.div>
          <motion.div 
            className="bg-white/90 backdrop-blur-xl rounded-xl p-5 border border-white/50 shadow-xl shadow-purple-500/5 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300 group"
            whileHover={{ scale: 1.02, y: -2 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">156</div>
                <div className="text-sm text-muted-foreground">AI Insights</div>
              </div>
            </div>
          </motion.div>
          <motion.div 
            className="bg-white/90 backdrop-blur-xl rounded-xl p-5 border border-white/50 shadow-xl shadow-amber-500/5 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-300 group"
            whileHover={{ scale: 1.02, y: -2 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">8</div>
                <div className="text-sm text-muted-foreground">Actions Required</div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Feature Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-6xl mx-auto grid grid-cols-2 gap-6"
      >
        {features.map((feature) => {
          const Icon = feature.icon;
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
                      <h3 className="text-xl font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                        {feature.title}
                        <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </h3>
                      <p className="text-muted-foreground mt-1 mb-4">{feature.description}</p>
                      <div className="text-xs text-muted-foreground bg-slate-100/80 dark:bg-slate-800/50 px-4 py-2 rounded-full inline-block backdrop-blur-sm">
                        {feature.stats}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* AI Assistant Banner */}
      <motion.div 
        className="max-w-6xl mx-auto mt-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-2xl shadow-blue-500/30">
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
                <p className="text-blue-100">Ask me anything about your contracts - I can search, analyze, and provide recommendations</p>
              </div>
            </div>
            <Link href="/intelligence/search">
              <motion.button 
                className="px-5 py-2.5 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Search className="w-4 h-4" />
                Start Asking
              </motion.button>
            </Link>
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  );
}
