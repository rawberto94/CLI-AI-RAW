'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { DashboardKPICards } from '@/components/rate-cards/DashboardKPICards';
import { FinancialMetricsCards } from '@/components/rate-cards/FinancialMetricsCards';
import { PerformanceIndicators } from '@/components/rate-cards/PerformanceIndicators';
import { TopOpportunitiesWidget } from '@/components/rate-cards/TopOpportunitiesWidget';
import { DashboardTrendCharts } from '@/components/rate-cards/DashboardTrendCharts';
import { ClientOverviewWidget } from '@/components/rate-cards/ClientOverviewWidget';
import { BaselineTrackingWidget } from '@/components/rate-cards/BaselineTrackingWidget';
import { NegotiationStatusWidget } from '@/components/rate-cards/NegotiationStatusWidget';
import { useRouter } from 'next/navigation';
import { useRealTimeEvents } from '@/contexts/RealTimeContext';
import { Button } from '@/components/ui/button';
import { Upload, Plus, RefreshCw, DollarSign } from 'lucide-react';
import { useRateCardDashboardMetrics } from '@/hooks/use-queries';

export default function RateCardDashboardPage() {
  const router = useRouter();

  // Use React Query for data fetching with caching
  const { 
    data: metricsData, 
    isLoading: loading, 
    refetch: fetchDashboardMetrics 
  } = useRateCardDashboardMetrics();

  const clientMetrics = metricsData?.clientMetrics || null;
  const baselineMetrics = metricsData?.baselineMetrics || null;
  const negotiationMetrics = metricsData?.negotiationMetrics || null;

  // Real-time updates for rate cards
  const eventHandlers = useMemo(() => ({
    'ratecard:created': () => {
      fetchDashboardMetrics(); // Refresh metrics on new rate card
    },
    'ratecard:updated': () => {
      fetchDashboardMetrics(); // Refresh metrics on update
    },
    'ratecard:imported': () => {
      fetchDashboardMetrics(); // Refresh metrics on import
    },
    'benchmark:calculated': () => {
      fetchDashboardMetrics(); // Refresh metrics on benchmark
    },
    'benchmark:invalidated': () => {
      fetchDashboardMetrics(); // Refresh metrics on invalidation
    },
  }), [fetchDashboardMetrics]);

  useRealTimeEvents(eventHandlers);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <motion.div 
        className="flex items-center justify-between motion-reduce:transition-none"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-4">
          <motion.div 
            className="p-4 rounded-2xl bg-gradient-to-br from-violet-500 via-green-500 to-violet-500 text-white shadow-xl shadow-violet-500/30 motion-reduce:transform-none"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <DollarSign className="h-8 w-8" aria-hidden="true" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 via-green-600 to-violet-600 dark:from-violet-400 dark:via-green-400 dark:to-violet-400 bg-clip-text text-transparent">
              Rate Card Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor portfolio health and identify savings opportunities
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="motion-reduce:transform-none">
            <Button 
              onClick={() => router.push('/rate-cards/import')} 
              variant="outline"
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-700 shadow-sm"
            >
              <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
              Import Rate Cards
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="motion-reduce:transform-none">
            <Button 
              onClick={() => router.push('/rate-cards/create')}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25"
            >
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              Add Rate Card
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Client, Baseline, and Negotiation Widgets */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="motion-reduce:transition-none"
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 dark:text-slate-100">
          <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-violet-500 to-purple-500" aria-hidden="true" />
          Client & Negotiation Overview
        </h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {clientMetrics && (
            <ClientOverviewWidget metrics={clientMetrics} loading={loading} />
          )}
          {baselineMetrics && (
            <BaselineTrackingWidget metrics={baselineMetrics} loading={loading} />
          )}
          {negotiationMetrics && (
            <NegotiationStatusWidget 
              metrics={negotiationMetrics} 
              loading={loading}
              onViewOpportunities={() => router.push('/rate-cards/opportunities')}
            />
          )}
        </div>
      </motion.section>

      {/* KPI Cards */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="motion-reduce:transition-none"
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 dark:text-slate-100">
          <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-violet-500 to-purple-500" aria-hidden="true" />
          Portfolio Overview
        </h2>
        <DashboardKPICards />
      </motion.section>

      {/* Financial Metrics */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="motion-reduce:transition-none"
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 dark:text-slate-100">
          <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-amber-500 to-orange-500" aria-hidden="true" />
          Financial Performance
        </h2>
        <FinancialMetricsCards />
      </motion.section>

      {/* Performance Indicators */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="motion-reduce:transition-none"
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 dark:text-slate-100">
          <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-purple-500 to-pink-500" aria-hidden="true" />
          Performance Indicators
        </h2>
        <PerformanceIndicators />
      </motion.section>

      {/* Top Opportunities and Trends */}
      <motion.div 
        className="grid gap-6 lg:grid-cols-2 motion-reduce:transition-none"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <section>
          <TopOpportunitiesWidget />
        </section>
        <section>
          <div className="space-y-6">
            <DashboardTrendCharts />
          </div>
        </section>
      </motion.div>
    </div>
  );
}
