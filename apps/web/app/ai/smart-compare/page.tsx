'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GitCompare, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { SmartComparisonPanel } from '@/components/ai/SmartComparisonPanel';
import Link from 'next/link';

export default function SmartComparePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/20 to-blue-50/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: 'AI Intelligence', href: '/ai/chat' },
            { label: 'AI Comparison' },
          ]}
          showHomeIcon
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <GitCompare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                AI Smart Comparison
              </h1>
              <p className="text-sm text-slate-500">
                Semantic clause-level contract comparison powered by AI
              </p>
            </div>
          </div>

          <SmartComparisonPanel />
        </motion.div>
      </div>
    </div>
  );
}
