'use client';

import { motion } from 'framer-motion';
import { Award } from 'lucide-react';
import { BestRatesView } from '@/components/rate-cards/BestRatesView';

export function BestRatesPageContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-yellow-50/20">
      <div className="container mx-auto py-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="p-3 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl shadow-lg shadow-amber-500/25">
            <Award className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Best Rates
            </h1>
            <p className="text-slate-600 mt-1">
              View the best rates in the market for each role and geography
            </p>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <BestRatesView />
        </motion.div>
      </div>
    </div>
  );
}
