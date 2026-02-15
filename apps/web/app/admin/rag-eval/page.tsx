'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Gauge } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { RAGEvaluationPanel } from '@/components/ai/RAGEvaluationPanel';

export default function RAGEvalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-cyan-50/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: 'Administration', href: '/admin/ai-governance' },
            { label: 'RAG Quality' },
          ]}
          showHomeIcon
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Gauge className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                RAG Quality Evaluation
              </h1>
              <p className="text-sm text-slate-500">
                Monitor and measure retrieval-augmented generation pipeline quality
              </p>
            </div>
          </div>

          <RAGEvaluationPanel />
        </motion.div>
      </div>
    </div>
  );
}
