'use client';

import { motion } from 'framer-motion';
import { Activity, Loader2 } from 'lucide-react';
import { BaselineTrackingDashboard } from '@/components/rate-cards/BaselineTrackingDashboard';

export default function BaselineTrackingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
      <div className="container mx-auto py-8 px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Baseline Tracking
            </h1>
            <p className="text-slate-600 mt-1">
              Monitor progress against your baseline rate targets
            </p>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <BaselineTrackingDashboard />
        </motion.div>
      </div>
    </div>
  );
}
