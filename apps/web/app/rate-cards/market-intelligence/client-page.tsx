'use client';

import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { MarketIntelligenceDashboard } from '@/components/rate-cards/MarketIntelligenceDashboard';
import { MarketIntelligenceFilters } from '@/components/rate-cards/MarketIntelligenceFilters';
import { EmergingTrendsPanel } from '@/components/rate-cards/EmergingTrendsPanel';

export function MarketIntelligenceClientPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-violet-50/20">
      <div className="container mx-auto p-6 space-y-6">
        <RateCardBreadcrumbs />
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="p-3 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg shadow-purple-500/25">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Market Intelligence
            </h1>
            <p className="text-slate-600 mt-1">
              Analyze market trends and competitive positioning
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <MarketIntelligenceFilters onFilterChange={() => {}} />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <MarketIntelligenceDashboard tenantId="default-tenant" />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <EmergingTrendsPanel tenantId="default-tenant" />
        </motion.div>
      </div>
    </div>
  );
}
