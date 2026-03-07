'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PredictiveInsightsWidget } from '@/components/ai/PredictiveInsightsWidget';

export default function PredictionsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-violet-50/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: 'AI Intelligence', href: '/ai/chat' },
            { label: 'Predictive Analytics' },
          ]}
          showHomeIcon
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                Predictive Analytics
              </h1>
              <p className="text-sm text-slate-500">
                AI-powered predictions for renewals, costs, and portfolio health
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PredictiveInsightsWidget />
            
            {/* Portfolio-level widget without contractId shows cost + portfolio tabs */}
            <div className="space-y-6">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
                <h3 className="text-sm font-medium text-indigo-900 mb-2">How it works</h3>
                <ul className="text-xs text-indigo-700 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-indigo-500 mt-0.5">1.</span>
                    <span><strong>Renewal Prediction</strong> — Analyzes contract history, supplier relationships, and market patterns to predict renewal likelihood.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-indigo-500 mt-0.5">2.</span>
                    <span><strong>Cost Forecasting</strong> — Projects future spending based on historical trends and identifies savings opportunities.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-indigo-500 mt-0.5">3.</span>
                    <span><strong>Portfolio Health</strong> — Multi-dimensional health assessment with trajectory prediction and actionable recommendations.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
