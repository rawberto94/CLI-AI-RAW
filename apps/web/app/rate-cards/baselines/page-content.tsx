'use client';

import { motion } from 'framer-motion';
import { Target, Plus, Upload } from 'lucide-react';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { BaselinesList } from '@/components/rate-cards/BaselinesList';
import { BaselineTrackingDashboard } from '@/components/rate-cards/BaselineTrackingDashboard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function BaselinesPageContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/20">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <RateCardBreadcrumbs />
        
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
              <Target className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                Baseline Target Rates
              </h1>
              <p className="text-slate-600 mt-1">
                Set and track baseline target rates for procurement goals
              </p>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex gap-2"
          >
            <Link href="/rate-cards/baselines/import">
              <Button 
                variant="outline" 
                className="bg-white/80 backdrop-blur-sm border-white/50 hover:bg-white hover:shadow-lg transition-all"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Baselines
              </Button>
            </Link>
            <Link href="/rate-cards/baselines/new">
              <Button className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25">
                <Plus className="h-4 w-4 mr-2" />
                Add Baseline
              </Button>
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <BaselineTrackingDashboard />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <BaselinesList />
        </motion.div>
      </div>
    </div>
  );
}
