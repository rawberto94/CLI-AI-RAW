'use client';

import { motion } from 'framer-motion';
import { GitCompare } from 'lucide-react';
import { BulkBaselineComparison } from '@/components/rate-cards/BulkBaselineComparison';

export default function BaselineComparisonPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-violet-50/20">
      <div className="max-w-[1600px] mx-auto py-8 px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="p-3 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg shadow-violet-500/25">
            <GitCompare className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Baseline Comparison
            </h1>
            <p className="text-slate-600 mt-1">
              Compare your rates against established baselines
            </p>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <BulkBaselineComparison />
        </motion.div>
      </div>
    </div>
  );
}
