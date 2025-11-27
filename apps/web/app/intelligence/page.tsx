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
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <PageBreadcrumb />
      </div>
      
      <div className="p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contract Intelligence</h1>
            <p className="text-slate-500">AI-powered insights and analysis for your contract portfolio</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">78</div>
                <div className="text-sm text-slate-500">Avg Health Score</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">92%</div>
                <div className="text-sm text-slate-500">Compliance Rate</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">156</div>
                <div className="text-sm text-slate-500">AI Insights</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">8</div>
                <div className="text-sm text-slate-500">Actions Required</div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                <div className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:border-slate-300 transition-all cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                        {feature.title}
                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                      <p className="text-slate-500 mt-1 mb-3">{feature.description}</p>
                      <div className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full inline-block">
                        {feature.stats}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* AI Assistant Banner */}
      <div className="max-w-6xl mx-auto mt-8">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">AI Contract Assistant</h3>
                <p className="text-blue-100">Ask me anything about your contracts - I can search, analyze, and provide recommendations</p>
              </div>
            </div>
            <Link href="/intelligence/search">
              <button className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2">
                <Search className="w-4 h-4" />
                Start Asking
              </button>
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
